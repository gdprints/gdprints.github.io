-- ============================================================
-- GDprint Customer Mobile App v3 — run once AFTER 005
-- Design approval, repeat order, delivery addresses, payments,
-- offers and Web Push subscriptions.
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists public.customer_addresses(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 label text not null, recipient_name text not null, phone text not null, city text not null, address_line text not null,
 note text, is_default boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists customer_addresses_customer_idx on public.customer_addresses(customer_id);

create table if not exists public.order_design_proofs(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 version int not null default 1, file_name text not null, storage_path text not null,
 status text not null default 'pending' check(status in ('pending','approved','changes_requested')),
 customer_comment text, published_by uuid, published_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(order_id,version));
create index if not exists order_design_proofs_order_idx on public.order_design_proofs(order_id,version desc);

create table if not exists public.customer_payment_requests(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade, amount numeric not null check(amount>=0), currency text not null default 'AMD',
 provider_label text, payment_url text, instructions text, status text not null default 'pending' check(status in ('pending','paid','cancelled','expired')),
 created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists payment_requests_customer_idx on public.customer_payment_requests(customer_id,created_at desc);

create table if not exists public.customer_offers(
 id uuid primary key default gen_random_uuid(), title text not null, description text, action_url text default 'services.html',
 is_active boolean not null default true, priority int not null default 0, starts_at timestamptz not null default now(), ends_at timestamptz,
 created_by uuid, created_at timestamptz not null default now());

create table if not exists public.customer_push_subscriptions(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth text not null, user_agent text, created_at timestamptz not null default now(), last_seen_at timestamptz not null default now());

-- Optional app_settings keys used by push integration.
insert into public.app_settings(key,value) values
('customer_push_vapid_public_key','""'::jsonb)
on conflict(key) do nothing;

create or replace function public.save_customer_address(p_id uuid,p_label text,p_recipient_name text,p_phone text,p_city text,p_address_line text,p_note text default '',p_is_default boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$declare cid uuid:=public.current_customer_id(); rid uuid;begin
 if cid is null then raise exception 'Customer account not found'; end if;
 if coalesce(trim(p_label),'')='' or coalesce(trim(p_recipient_name),'')='' or coalesce(trim(p_phone),'')='' or coalesce(trim(p_city),'')='' or coalesce(trim(p_address_line),'')='' then raise exception 'Required address fields are missing'; end if;
 if p_is_default then update public.customer_addresses set is_default=false where customer_id=cid; end if;
 if p_id is null then insert into public.customer_addresses(customer_id,label,recipient_name,phone,city,address_line,note,is_default) values(cid,trim(p_label),trim(p_recipient_name),trim(p_phone),trim(p_city),trim(p_address_line),trim(coalesce(p_note,'')),p_is_default) returning id into rid;
 else update public.customer_addresses set label=trim(p_label),recipient_name=trim(p_recipient_name),phone=trim(p_phone),city=trim(p_city),address_line=trim(p_address_line),note=trim(coalesce(p_note,'')),is_default=p_is_default,updated_at=now() where id=p_id and customer_id=cid returning id into rid; if rid is null then raise exception 'Address not found'; end if; end if; return rid;end$$;
grant execute on function public.save_customer_address(uuid,text,text,text,text,text,text,boolean) to authenticated;
create or replace function public.delete_customer_address(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$begin delete from public.customer_addresses where id=p_id and customer_id=public.current_customer_id();return found;end$$;
grant execute on function public.delete_customer_address(uuid) to authenticated;

-- Allow only approved customer RPCs to write customer orders.
create or replace function public.guard_customer_order_write() returns trigger language plpgsql security definer set search_path=public as $$begin
 if public.current_customer_id() is not null then
   if current_setting('app.customer_order_rpc',true)='1' then if tg_op='DELETE' then return old; else return new; end if; end if;
   raise exception 'Customer orders can only be changed through approved GDprint actions';
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end$$;

create or replace function public.repeat_customer_order(p_order_id uuid)
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text) language plpgsql security definer set search_path=public as $$declare o public.orders%rowtype; d jsonb; r record;begin
 select * into o from public.orders where id=p_order_id and customer_id=public.current_customer_id(); if o.id is null then raise exception 'Order not found'; end if;
 select details into d from public.order_details where order_id=o.id order by id desc limit 1; d:=coalesce(d,'{}'::jsonb)-'_server_price'-'_created_from';
 select * into r from public.create_customer_order(o.service_key,d,coalesce(o.description,''));
 return query select r.id,r.order_number,r.total_amount,r.status,r.service_name;end$$;
grant execute on function public.repeat_customer_order(uuid) to authenticated;

create or replace function public.staff_publish_design_proof(p_order_id uuid,p_file_name text,p_storage_path text)
returns uuid language plpgsql security definer set search_path=public as $$declare v int; rid uuid; cid uuid;begin
 if not (public.is_admin() or exists(select 1 from public.profiles where id=auth.uid() and role='manager' and coalesce(account_status,'active')<>'blocked')) then raise exception 'Staff access required'; end if;
 select customer_id into cid from public.orders where id=p_order_id; if cid is null then raise exception 'Customer-linked order required'; end if;
 select coalesce(max(version),0)+1 into v from public.order_design_proofs where order_id=p_order_id;
 insert into public.order_design_proofs(order_id,version,file_name,storage_path,published_by) values(p_order_id,v,p_file_name,p_storage_path,auth.uid()) returning id into rid;
 insert into public.customer_app_notifications(customer_id,order_id,type,title,message) values(cid,p_order_id,'design_proof','Դիզայնը պատրաստ է հաստատման','Բացեք պատվերը և հաստատեք դիզայնը կամ գրեք անհրաժեշտ փոփոխությունը։'); return rid;end$$;
grant execute on function public.staff_publish_design_proof(uuid,text,text) to authenticated;

create or replace function public.respond_to_design_proof(p_proof_id uuid,p_decision text,p_comment text default '') returns boolean language plpgsql security definer set search_path=public as $$declare pr public.order_design_proofs%rowtype; ord public.orders%rowtype;begin
 if p_decision not in ('approved','changes_requested') then raise exception 'Invalid decision'; end if; select * into pr from public.order_design_proofs where id=p_proof_id; if pr.id is null then raise exception 'Proof not found'; end if;
 select * into ord from public.orders where id=pr.order_id and customer_id=public.current_customer_id(); if ord.id is null then raise exception 'Order not found'; end if;
 if pr.status<>'pending' then raise exception 'This proof was already reviewed'; end if;
 if p_decision='changes_requested' and coalesce(trim(p_comment),'')='' then raise exception 'Comment is required'; end if;
 update public.order_design_proofs set status=p_decision,customer_comment=nullif(trim(coalesce(p_comment,'')),''),reviewed_at=now() where id=p_proof_id;
 begin insert into public.notifications(recipient_id,type,title,message,link) select id,'design_response',case when p_decision='approved' then 'Հաճախորդը հաստատել է դիզայնը' else 'Հաճախորդը փոփոխություն է պահանջել' end,ord.order_number||case when p_comment<>'' then ' — '||p_comment else '' end,'dashboard.html' from public.profiles where role='admin'; exception when others then null; end;
 return true;end$$;
grant execute on function public.respond_to_design_proof(uuid,text,text) to authenticated;

create or replace function public.staff_upsert_payment_request(p_order_id uuid,p_amount numeric,p_payment_url text default '',p_provider_label text default 'Առցանց վճարում',p_instructions text default '') returns uuid language plpgsql security definer set search_path=public as $$declare cid uuid; rid uuid;begin
 if not public.is_admin() then raise exception 'Admin access required'; end if; if p_amount<0 then raise exception 'Invalid amount'; end if; select customer_id into cid from public.orders where id=p_order_id; if cid is null then raise exception 'Customer-linked order required'; end if;
 update public.customer_payment_requests set status='expired',updated_at=now() where order_id=p_order_id and status='pending';
 insert into public.customer_payment_requests(order_id,customer_id,amount,payment_url,provider_label,instructions,created_by) values(p_order_id,cid,p_amount,nullif(trim(p_payment_url),''),p_provider_label,nullif(trim(p_instructions),''),auth.uid()) returning id into rid;
 insert into public.customer_app_notifications(customer_id,order_id,type,title,message) values(cid,p_order_id,'payment','Վճարման հարցում','Պատվերի համար ստեղծվել է '||p_amount||' AMD վճարման հարցում։'); return rid;end$$;
grant execute on function public.staff_upsert_payment_request(uuid,numeric,text,text,text) to authenticated;

create or replace function public.get_customer_app_public_config() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object('vapid_public_key',coalesce((select value #>> '{}' from public.app_settings where key='customer_push_vapid_public_key'),''))$$;
grant execute on function public.get_customer_app_public_config() to authenticated;
create or replace function public.save_customer_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default '') returns uuid language plpgsql security definer set search_path=public as $$declare cid uuid:=public.current_customer_id();rid uuid;begin if cid is null then raise exception 'Customer account not found'; end if;insert into public.customer_push_subscriptions(customer_id,endpoint,p256dh,auth,user_agent) values(cid,p_endpoint,p_p256dh,p_auth,p_user_agent) on conflict(endpoint) do update set customer_id=excluded.customer_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,last_seen_at=now() returning id into rid;return rid;end$$;
grant execute on function public.save_customer_push_subscription(text,text,text,text) to authenticated;
create or replace function public.delete_customer_push_subscription(p_endpoint text) returns boolean language plpgsql security definer set search_path=public as $$begin delete from public.customer_push_subscriptions where endpoint=p_endpoint and customer_id=public.current_customer_id();return found;end$$;
grant execute on function public.delete_customer_push_subscription(text) to authenticated;

alter table public.customer_addresses enable row level security;alter table public.order_design_proofs enable row level security;alter table public.customer_payment_requests enable row level security;alter table public.customer_offers enable row level security;alter table public.customer_push_subscriptions enable row level security;
drop policy if exists customer_addresses_read on public.customer_addresses;create policy customer_addresses_read on public.customer_addresses for select to authenticated using(customer_id=public.current_customer_id());
drop policy if exists customer_proofs_read on public.order_design_proofs;create policy customer_proofs_read on public.order_design_proofs for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and o.customer_id=public.current_customer_id()) or public.is_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager'));
drop policy if exists customer_payments_read on public.customer_payment_requests;create policy customer_payments_read on public.customer_payment_requests for select to authenticated using(customer_id=public.current_customer_id() or public.is_admin());
drop policy if exists customer_offers_read on public.customer_offers;create policy customer_offers_read on public.customer_offers for select to authenticated using(is_active=true or public.is_admin());
drop policy if exists admin_offers_all on public.customer_offers;create policy admin_offers_all on public.customer_offers for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Staff proof file upload to private customer bucket. Customers keep read access only to their own UID folder.
drop policy if exists staff_upload_customer_order_files on storage.objects;create policy staff_upload_customer_order_files on storage.objects for insert to authenticated with check(bucket_id='customer-order-files' and (public.is_admin() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager')));

do $$ begin alter publication supabase_realtime add table public.order_design_proofs; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.customer_payment_requests; exception when duplicate_object then null; end $$;
