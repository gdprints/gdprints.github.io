-- ============================================================
-- GDprint Customer App v4.2 — run once AFTER 007
-- Fixes:
-- 1) robust repeat order
-- 2) delivery address snapshot per order, visible to staff
-- 3) offline payment UX uses orders.payment_status only
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.order_delivery_details(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  delivery_method text not null default 'pickup' check(delivery_method in ('pickup','delivery')),
  address_id uuid references public.customer_addresses(id) on delete set null,
  label text,
  recipient_name text,
  phone text,
  city text,
  address_line text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_delivery_details_customer_idx on public.order_delivery_details(customer_id,created_at desc);

alter table public.order_delivery_details enable row level security;
drop policy if exists customer_delivery_read on public.order_delivery_details;
create policy customer_delivery_read on public.order_delivery_details
for select to authenticated using(
  customer_id=public.current_customer_id()
  or public.is_admin()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager' and coalesce(p.account_status,'active')<>'blocked')
);

-- New order RPC with delivery snapshot. Price is still calculated server-side.
create or replace function public.create_customer_order_v2(
  p_service_key text,
  p_details jsonb,
  p_description text default '',
  p_delivery_method text default 'pickup',
  p_address_id uuid default null
)
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text)
language plpgsql security definer set search_path=public as $$
declare
 v_customer public.customers%rowtype; v_amount numeric; v_no text; v_order public.orders%rowtype; v_prefix text;
 a public.customer_addresses%rowtype;
begin
 select * into v_customer from public.customers where auth_user_id=auth.uid() limit 1;
 if v_customer.id is null then raise exception 'Customer account not found'; end if;
 if p_delivery_method not in ('pickup','delivery') then raise exception 'Invalid delivery method'; end if;
 if p_delivery_method='delivery' then
   if p_address_id is null then raise exception 'Delivery address is required'; end if;
   select * into a from public.customer_addresses where id=p_address_id and customer_id=v_customer.id;
   if a.id is null then raise exception 'Delivery address not found'; end if;
 end if;
 if p_service_key not in ('wide_format','plotter_cutting','business_cards','photo_printing','printable_forms','calendar','rollup','canvas','poster_placement','cup_printing','flyer') then raise exception 'Unknown service'; end if;
 v_amount:=public.gd_customer_price(p_service_key,coalesce(p_details,'{}'::jsonb));
 v_prefix:=case p_service_key when 'wide_format' then 'LTP' when 'plotter_cutting' then 'PLT' when 'business_cards' then 'BC' when 'photo_printing' then 'PH' when 'printable_forms' then 'PF' when 'calendar' then 'CAL' when 'rollup' then 'RL' when 'canvas' then 'CNV' when 'poster_placement' then 'POST' when 'cup_printing' then 'CUP' when 'flyer' then 'FLY' else 'GD' end;
 v_no:=v_prefix||'-'||to_char(clock_timestamp(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 perform set_config('app.customer_order_rpc','1',true);
 insert into public.orders(order_number,customer_id,customer_name,customer_phone,customer_email,created_by_type,created_by_manager_id,service_key,service_name,language,total_amount,description,status)
 values(v_no,v_customer.id,v_customer.full_name,v_customer.phone,v_customer.email,'customer',null,p_service_key,public.gd_service_name(p_service_key),'hy',v_amount,coalesce(p_description,''),'pending') returning * into v_order;
 insert into public.order_details(order_id,details) values(v_order.id,coalesce(p_details,'{}'::jsonb)||jsonb_build_object('_server_price',v_amount,'_created_from','customer_app'));
 insert into public.order_status_history(order_id,old_status,new_status,changed_by) values(v_order.id,null,'pending',null);
 if p_delivery_method='delivery' then
   insert into public.order_delivery_details(order_id,customer_id,delivery_method,address_id,label,recipient_name,phone,city,address_line,note)
   values(v_order.id,v_customer.id,'delivery',a.id,a.label,a.recipient_name,a.phone,a.city,a.address_line,a.note);
 else
   insert into public.order_delivery_details(order_id,customer_id,delivery_method)
   values(v_order.id,v_customer.id,'pickup');
 end if;
 insert into public.customer_app_notifications(customer_id,order_id,type,title,message) values(v_customer.id,v_order.id,'order_created','Պատվերն ընդունված է','Ձեր '||v_no||' պատվերը հաջողությամբ գրանցվել է։');
 begin
   insert into public.notifications(recipient_id,type,title,message,link)
   select id,'new_customer_order','Նոր պատվեր Customer App-ից',v_no||' — '||public.gd_service_name(p_service_key),'dashboard.html' from public.profiles where role='admin';
 exception when others then null; end;
 return query select v_order.id,v_order.order_number,v_order.total_amount,v_order.status,v_order.service_name;
end $$;
revoke all on function public.create_customer_order_v2(text,jsonb,text,text,uuid) from public;
grant execute on function public.create_customer_order_v2(text,jsonb,text,text,uuid) to authenticated;

-- Repeat order is implemented independently instead of nesting create_customer_order,
-- and copies the delivery snapshot when it exists.
create or replace function public.repeat_customer_order(p_order_id uuid)
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text)
language plpgsql security definer set search_path=public as $$
declare
  o public.orders%rowtype; d jsonb; v_customer public.customers%rowtype;
  v_amount numeric; v_no text; v_prefix text; n public.orders%rowtype; ad public.order_delivery_details%rowtype;
begin
  select * into v_customer from public.customers where auth_user_id=auth.uid() limit 1;
  if v_customer.id is null then raise exception 'Customer account not found'; end if;
  select * into o from public.orders where id=p_order_id and customer_id=v_customer.id;
  if o.id is null then raise exception 'Order not found'; end if;
  select details into d from public.order_details where order_id=o.id order by id desc limit 1;
  d:=coalesce(d,'{}'::jsonb)-'_server_price'-'_created_from';
  v_amount:=public.gd_customer_price(o.service_key,d);
  v_prefix:=case o.service_key when 'wide_format' then 'LTP' when 'plotter_cutting' then 'PLT' when 'business_cards' then 'BC' when 'photo_printing' then 'PH' when 'printable_forms' then 'PF' when 'calendar' then 'CAL' when 'rollup' then 'RL' when 'canvas' then 'CNV' when 'poster_placement' then 'POST' when 'cup_printing' then 'CUP' when 'flyer' then 'FLY' else 'GD' end;
  v_no:=v_prefix||'-'||to_char(clock_timestamp(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  perform set_config('app.customer_order_rpc','1',true);
  insert into public.orders(order_number,customer_id,customer_name,customer_phone,customer_email,created_by_type,created_by_manager_id,service_key,service_name,language,total_amount,description,status)
  values(v_no,v_customer.id,v_customer.full_name,v_customer.phone,v_customer.email,'customer',null,o.service_key,public.gd_service_name(o.service_key),coalesce(o.language,'hy'),v_amount,coalesce(o.description,''),'pending') returning * into n;
  insert into public.order_details(order_id,details) values(n.id,d||jsonb_build_object('_server_price',v_amount,'_created_from','customer_app_repeat','_repeated_from',o.order_number));
  insert into public.order_status_history(order_id,old_status,new_status,changed_by) values(n.id,null,'pending',null);
  insert into public.order_files(order_id,file_name,file_url,storage_path) select n.id,file_name,file_url,storage_path from public.order_files where order_id=o.id;
  select * into ad from public.order_delivery_details where order_id=o.id;
  if ad.id is not null then
    insert into public.order_delivery_details(order_id,customer_id,delivery_method,address_id,label,recipient_name,phone,city,address_line,note)
    values(n.id,v_customer.id,ad.delivery_method,ad.address_id,ad.label,ad.recipient_name,ad.phone,ad.city,ad.address_line,ad.note);
  else
    insert into public.order_delivery_details(order_id,customer_id,delivery_method) values(n.id,v_customer.id,'pickup');
  end if;
  insert into public.customer_app_notifications(customer_id,order_id,type,title,message)
  values(v_customer.id,n.id,'order_created','Պատվերը կրկնվել է','Ստեղծվել է նոր պատվեր #'||v_no||'։');
  begin
    insert into public.notifications(recipient_id,type,title,message,link)
    select id,'new_customer_order','Կրկնված պատվեր Customer App-ից',v_no||' — '||public.gd_service_name(o.service_key),'dashboard.html' from public.profiles where role='admin';
  exception when others then null; end;
  return query select n.id,n.order_number,n.total_amount,n.status,n.service_name;
end $$;
revoke all on function public.repeat_customer_order(uuid) from public;
grant execute on function public.repeat_customer_order(uuid) to authenticated;

-- Online payment requests are intentionally disabled in v4.2. Staff continues to manage orders.payment_status.
revoke execute on function public.staff_upsert_payment_request(uuid,numeric,text,text,text) from authenticated;
