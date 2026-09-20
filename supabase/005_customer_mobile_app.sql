-- ============================================================
-- GDprint Customer Mobile App v2
-- Run once AFTER 001-004.
-- Adds customer auth linking, secure customer-only order access,
-- server-side price calculation, notifications and private file upload.
-- ============================================================

create extension if not exists pgcrypto;

alter table public.customers add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists customers_auth_user_id_uidx on public.customers(auth_user_id) where auth_user_id is not null;
alter table public.order_files add column if not exists storage_path text;


-- Existing manager registration installs often create a profiles row for every Auth signup.
-- Customer accounts are CRM customers, not managers, so remove an accidentally-created
-- manager profile when account_type=customer. The zz_ name makes this run after the usual
-- on_auth_user_created trigger in normal PostgreSQL trigger ordering.
create or replace function public.cleanup_customer_manager_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type','')='customer' then
    delete from public.profiles where id=new.id and role='manager';
  end if;
  return new;
end $$;
drop trigger if exists zz_gd_customer_profile_cleanup on auth.users;
create trigger zz_gd_customer_profile_cleanup after insert or update of raw_user_meta_data on auth.users
for each row execute function public.cleanup_customer_manager_profile();

create table if not exists public.customer_app_notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists customer_app_notifications_customer_idx on public.customer_app_notifications(customer_id,created_at desc);

-- Is the current authenticated user a linked customer?
create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path=public as $$
  select id from public.customers where auth_user_id=auth.uid() limit 1;
$$;
grant execute on function public.current_customer_id() to authenticated;

-- Creates/links a customer row for the current Auth user.
-- Safe to call repeatedly, including after email confirmation.
create or replace function public.register_customer_account(p_full_name text, p_phone text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_uid uuid:=auth.uid(); v_email text; v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select email into v_email from auth.users where id=v_uid;
  if coalesce(trim(p_full_name),'')='' then raise exception 'Full name is required'; end if;
  if coalesce(trim(p_phone),'')='' then raise exception 'Phone is required'; end if;

  select id into v_id from public.customers where auth_user_id=v_uid limit 1;
  if v_id is not null then
    update public.customers set full_name=trim(p_full_name), phone=trim(p_phone), email=coalesce(v_email,email) where id=v_id;
    return v_id;
  end if;

  -- Reuse a pre-existing CRM customer by exact email if possible.
  select id into v_id from public.customers
   where auth_user_id is null and lower(coalesce(email,''))=lower(coalesce(v_email,'')) and coalesce(v_email,'')<>''
   limit 1;
  if v_id is not null then
    update public.customers set auth_user_id=v_uid, full_name=trim(p_full_name), phone=trim(p_phone), email=v_email where id=v_id;
    return v_id;
  end if;

  insert into public.customers(full_name,phone,email,auth_user_id)
  values(trim(p_full_name),trim(p_phone),v_email,v_uid)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.register_customer_account(text,text) from public;
grant execute on function public.register_customer_account(text,text) to authenticated;

create or replace function public.update_customer_profile(p_full_name text,p_phone text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_id uuid:=public.current_customer_id();
begin
 if v_id is null then raise exception 'Customer account not found'; end if;
 if coalesce(trim(p_full_name),'')='' or coalesce(trim(p_phone),'')='' then raise exception 'Name and phone are required'; end if;
 update public.customers set full_name=trim(p_full_name),phone=trim(p_phone) where id=v_id;
 return true;
end $$;
grant execute on function public.update_customer_profile(text,text) to authenticated;

-- Exact server-side version of the prices used by the current GDprint service calculators.
create or replace function public.gd_customer_price(p_service_key text,p_details jsonb)
returns numeric language plpgsql immutable as $$
declare
 q int; amount numeric:=0; s text; w numeric; h numeric; rate numeric; border numeric; material text; eyes int;
 wf numeric:=1; tf numeric:=1; discount numeric:=0; sqm numeric; base numeric;
begin
 case p_service_key
  when 'business_cards' then
    q:=greatest(1000,coalesce((p_details->>'quantity')::int,1000)); amount:=q*8;
  when 'photo_printing' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); s:=coalesce(p_details->>'size','A4');
    amount:=q*(case s when 'A4' then 400 when 'A5' then 200 when 'A6' then 100 else 400 end);
  when 'printable_forms' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); amount:=q*(case when p_details->>'print_type'='color' then 50 else 30 end);
  when 'cup_printing' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); amount:=q*(case when q>50 then 1900 else 2000 end);
  when 'poster_placement' then
    sqm:=greatest(.1,coalesce((p_details->>'square_meters')::numeric,.1)); amount:=round(sqm*4200);
  when 'rollup' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); s:=coalesce(p_details->>'size','80x200');
    amount:=q*(case s when '60x160' then 10150 when '80x200' then 16900 when '85x200' then 18000 when '100x200' then 21100 when '120x200' then 25350 when '150x200' then 31700 else 0 end);
  when 'canvas' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); s:=coalesce(p_details->>'size','30x40');
    amount:=q*(case s when '20x30' then 5460 when '30x40' then 5850 when '40x50' then 6370 when '50x70' then 6890 when '60x80' then 7410 when '70x100' then 7930 when '100x150' then 14820 when '20x20' then 5670 when '25x35' then 6100 when '35x35' then 6620 when '40x60' then 6620 when '60x60' then 7700 when '80x120' then 9180 when '100x100' then 10400 when '120x180' then 19700 else 0 end);
  when 'flyer' then
    q:=greatest(2000,coalesce((p_details->>'quantity')::int,2000)); s:=coalesce(p_details->>'size','A5');
    rate:=case s when 'A4' then 300 when 'A5' then 195 when 'A4 1/3' then 25 else 0 end;
    if coalesce(p_details->>'weight','115') like '%170%' then wf:=1.3; elsif coalesce(p_details->>'weight','115') like '%150%' then wf:=1.1; else wf:=1; end if;
    tf:=case when coalesce(p_details->>'paper_type','Փայլուն')='Անփայլ' then 1 else 1.1 end;
    if q>=1000 then discount:=.15; elsif q>=500 then discount:=.10; elsif q>=100 then discount:=.05; end if;
    base:=rate*q*wf*tf; amount:=round(base-(base*discount));
  when 'wide_format' then
    w:=greatest(.5,coalesce((p_details->>'width')::numeric,.5)); h:=greatest(.5,coalesce((p_details->>'height')::numeric,.5));
    rate:=coalesce((p_details->>'package_rate')::numeric,4500); if rate not in (4500,6000,8000,10000) then rate:=4500; end if;
    border:=case when coalesce((p_details->>'border_cut')::numeric,0)=100 then 100 else 0 end; material:=coalesce(p_details->>'material','Banner');
    amount:=w*h*rate; if border>0 then amount:=amount+2*(w+h)*border; end if;
    if material='Banner+ողակ' then
      eyes:=greatest(8,coalesce(nullif(p_details->>'eyelet_count','')::int,(floor(greatest(w-.024,0)/.3)::int+2)+(floor(greatest(h-.024,0)/.3)::int+2)));
      amount:=amount+eyes*100;
    end if; amount:=round(amount);
  when 'plotter_cutting','calendar' then amount:=0;
  else raise exception 'Unknown service';
 end case;
 return amount;
exception when invalid_text_representation then raise exception 'Invalid service parameters';
end $$;
grant execute on function public.gd_customer_price(text,jsonb) to authenticated;

create or replace function public.gd_service_name(p_key text)
returns text language sql immutable as $$select case p_key
 when 'wide_format' then 'Լայնաֆորմատ տպագրություն' when 'plotter_cutting' then 'Պլոտերային հատում'
 when 'business_cards' then 'Այցեքարտերի տպագրություն' when 'photo_printing' then 'Լուսանկարների տպագրություն'
 when 'printable_forms' then 'Ձևաթղթերի տպագրություն' when 'calendar' then 'Օրացույցի տպագրություն'
 when 'rollup' then 'Roll-Up Stand' when 'canvas' then 'Կտավի վրա տպագրություն'
 when 'poster_placement' then 'Գովազդի տեղադրում' when 'cup_printing' then 'Բաժակի վրա տպագրություն'
 when 'flyer' then 'Թռուցիկների տպագրություն' else p_key end$$;

-- Customer orders must be created through this RPC so the browser cannot forge the final price.
create or replace function public.create_customer_order(p_service_key text,p_details jsonb,p_description text default '')
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text)
language plpgsql security definer set search_path=public as $$
declare
 v_customer public.customers%rowtype; v_amount numeric; v_no text; v_order public.orders%rowtype; v_prefix text;
begin
 select * into v_customer from public.customers where auth_user_id=auth.uid() limit 1;
 if v_customer.id is null then raise exception 'Customer account not found'; end if;
 if p_service_key not in ('wide_format','plotter_cutting','business_cards','photo_printing','printable_forms','calendar','rollup','canvas','poster_placement','cup_printing','flyer') then raise exception 'Unknown service'; end if;
 v_amount:=public.gd_customer_price(p_service_key,coalesce(p_details,'{}'::jsonb));
 v_prefix:=case p_service_key when 'wide_format' then 'LTP' when 'plotter_cutting' then 'PLT' when 'business_cards' then 'BC' when 'photo_printing' then 'PH' when 'printable_forms' then 'PF' when 'calendar' then 'CAL' when 'rollup' then 'RL' when 'canvas' then 'CNV' when 'poster_placement' then 'POST' when 'cup_printing' then 'CUP' when 'flyer' then 'FLY' else 'GD' end;
 v_no:=v_prefix||'-'||to_char(clock_timestamp(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 perform set_config('app.customer_order_rpc','1',true);
 insert into public.orders(order_number,customer_id,customer_name,customer_phone,customer_email,created_by_type,created_by_manager_id,service_key,service_name,language,total_amount,description,status)
 values(v_no,v_customer.id,v_customer.full_name,v_customer.phone,v_customer.email,'customer',null,p_service_key,public.gd_service_name(p_service_key),'hy',v_amount,coalesce(p_description,''),'pending') returning * into v_order;
 insert into public.order_details(order_id,details) values(v_order.id,coalesce(p_details,'{}'::jsonb)||jsonb_build_object('_server_price',v_amount,'_created_from','customer_app'));
 insert into public.order_status_history(order_id,old_status,new_status,changed_by) values(v_order.id,null,'pending',null);
 insert into public.customer_app_notifications(customer_id,order_id,type,title,message) values(v_customer.id,v_order.id,'order_created','Պատվերն ընդունված է','Ձեր '||v_no||' պատվերը հաջողությամբ գրանցվել է։');
 begin
   insert into public.notifications(recipient_id,type,title,message,link)
   select id,'new_customer_order','Նոր պատվեր Customer App-ից',v_no||' — '||public.gd_service_name(p_service_key),'dashboard.html' from public.profiles where role='admin';
 exception when others then null; end;
 return query select v_order.id,v_order.order_number,v_order.total_amount,v_order.status,v_order.service_name;
end $$;
revoke all on function public.create_customer_order(text,jsonb,text) from public;
grant execute on function public.create_customer_order(text,jsonb,text) to authenticated;

-- Defense-in-depth: linked customers cannot bypass the secure RPC to create/update/delete an order.
create or replace function public.guard_customer_order_write()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.current_customer_id() is not null then
   if tg_op='INSERT' and current_setting('app.customer_order_rpc',true)='1' then return new; end if;
   raise exception 'Customer orders can only be changed through approved GDprint actions';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists trg_guard_customer_order_write on public.orders;
create trigger trg_guard_customer_order_write before insert or update or delete on public.orders for each row execute function public.guard_customer_order_write();

create or replace function public.add_customer_order_message(p_order_id uuid,p_message text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if coalesce(trim(p_message),'')='' then raise exception 'Message is empty'; end if;
 if not exists(select 1 from public.orders o where o.id=p_order_id and o.customer_id=public.current_customer_id()) then raise exception 'Order not found'; end if;
 insert into public.order_messages(order_id,author_type,message) values(p_order_id,'customer',trim(p_message));
 return true;
end $$;
grant execute on function public.add_customer_order_message(uuid,text) to authenticated;

-- Customer status notifications whenever Admin/Manager moves an order to another stage.
create or replace function public.notify_customer_order_status()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_title text;
begin
 if new.status is distinct from old.status and new.customer_id is not null then
   v_title:=case new.status when 'design' then 'Դիզայնի փուլ' when 'printing' then 'Պատվերը տպագրվում է' when 'ready' then 'Պատվերը պատրաստ է' when 'delivered' then 'Պատվերը առաքված է' when 'cancelled' then 'Պատվերը չեղարկվել է' else 'Պատվերի կարգավիճակը փոխվել է' end;
   insert into public.customer_app_notifications(customer_id,order_id,type,title,message)
   values(new.customer_id,new.id,'order_status',v_title,'Պատվեր #'||coalesce(new.order_number,'')||' — '||coalesce(new.service_name,''));
 end if;
 return new;
end $$;
drop trigger if exists trg_notify_customer_order_status on public.orders;
create trigger trg_notify_customer_order_status after update of status on public.orders for each row execute function public.notify_customer_order_status();

-- RLS: customers see only themselves and their own order-related data.
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_details enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_files enable row level security;
alter table public.customer_app_notifications enable row level security;

drop policy if exists customer_read_self on public.customers;
create policy customer_read_self on public.customers for select to authenticated using(auth_user_id=auth.uid());

drop policy if exists customer_read_own_orders on public.orders;
create policy customer_read_own_orders on public.orders for select to authenticated using(customer_id=public.current_customer_id());

drop policy if exists customer_read_own_details on public.order_details;
create policy customer_read_own_details on public.order_details for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=public.current_customer_id()));

drop policy if exists customer_read_own_history on public.order_status_history;
create policy customer_read_own_history on public.order_status_history for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=public.current_customer_id()));

drop policy if exists customer_read_own_files on public.order_files;
create policy customer_read_own_files on public.order_files for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=public.current_customer_id()));
drop policy if exists customer_insert_own_files on public.order_files;
create policy customer_insert_own_files on public.order_files for insert to authenticated with check(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=public.current_customer_id()));

drop policy if exists customer_notifications_read on public.customer_app_notifications;
create policy customer_notifications_read on public.customer_app_notifications for select to authenticated using(customer_id=public.current_customer_id());
drop policy if exists customer_notifications_update on public.customer_app_notifications;
create policy customer_notifications_update on public.customer_app_notifications for update to authenticated using(customer_id=public.current_customer_id()) with check(customer_id=public.current_customer_id());

-- Private file bucket. Customer may upload only to their UID folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-order-files','customer-order-files',false,52428800,null)
on conflict(id) do update set public=false,file_size_limit=52428800;

drop policy if exists customer_upload_own_order_files on storage.objects;
create policy customer_upload_own_order_files on storage.objects for insert to authenticated
with check(bucket_id='customer-order-files' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists customer_read_storage_files on storage.objects;
create policy customer_read_storage_files on storage.objects for select to authenticated
using(bucket_id='customer-order-files' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager')));
drop policy if exists customer_delete_own_temp_files on storage.objects;
create policy customer_delete_own_temp_files on storage.objects for delete to authenticated
using(bucket_id='customer-order-files' and (storage.foldername(name))[1]=auth.uid()::text);

-- Realtime notification support (ignore duplicate publication error if already present).
do $$ begin
 alter publication supabase_realtime add table public.customer_app_notifications;
exception when duplicate_object then null; end $$;
