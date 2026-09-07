-- ============================================================
-- GDprint Customer App v4.3 — reliability fix
-- Run once AFTER 008. Safe to re-run.
-- Makes order creation/repeat depend only on the proven core RPC.
-- Delivery/files/notifications are attached afterwards.
-- ============================================================
create extension if not exists pgcrypto;

-- Ensure delivery snapshot table exists even if 008 previously stopped midway.
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
create index if not exists order_delivery_details_customer_idx
  on public.order_delivery_details(customer_id,created_at desc);

alter table public.order_delivery_details enable row level security;
drop policy if exists customer_delivery_read on public.order_delivery_details;
create policy customer_delivery_read on public.order_delivery_details
for select to authenticated using(
  customer_id=public.current_customer_id()
  or public.is_admin()
  or exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='manager'
      and coalesce(p.account_status,'active')<>'blocked'
  )
);

-- Wrapper around the original proven secure customer-order RPC.
-- The core order is created first; delivery snapshot is attached after it.
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
  r record;
  cid uuid:=public.current_customer_id();
  a public.customer_addresses%rowtype;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  if coalesce(p_delivery_method,'pickup') not in ('pickup','delivery') then
    raise exception 'Invalid delivery method';
  end if;

  if p_delivery_method='delivery' then
    if p_address_id is null then raise exception 'Delivery address is required'; end if;
    select * into a from public.customer_addresses
      where id=p_address_id and customer_id=cid;
    if a.id is null then raise exception 'Delivery address not found'; end if;
  end if;

  -- This is the already tested, server-priced secure order creator from 005.
  select * into r from public.create_customer_order(
    p_service_key,
    coalesce(p_details,'{}'::jsonb),
    coalesce(p_description,'')
  );

  -- Snapshot is independent from the core order write.
  begin
    if p_delivery_method='delivery' then
      insert into public.order_delivery_details(
        order_id,customer_id,delivery_method,address_id,label,
        recipient_name,phone,city,address_line,note
      ) values(
        r.id,cid,'delivery',a.id,a.label,
        a.recipient_name,a.phone,a.city,a.address_line,a.note
      )
      on conflict(order_id) do update set
        customer_id=excluded.customer_id,
        delivery_method=excluded.delivery_method,
        address_id=excluded.address_id,
        label=excluded.label,
        recipient_name=excluded.recipient_name,
        phone=excluded.phone,
        city=excluded.city,
        address_line=excluded.address_line,
        note=excluded.note;
    else
      insert into public.order_delivery_details(order_id,customer_id,delivery_method)
      values(r.id,cid,'pickup')
      on conflict(order_id) do update set
        customer_id=excluded.customer_id,
        delivery_method='pickup',
        address_id=null,label=null,recipient_name=null,phone=null,
        city=null,address_line=null,note=null;
    end if;
  exception when others then
    -- Do not destroy a valid print order because an auxiliary snapshot failed.
    raise warning 'GDprint delivery snapshot failed for order %: %', r.id, sqlerrm;
  end;

  return query select r.id,r.order_number,r.total_amount,r.status,r.service_name;
end $$;
revoke all on function public.create_customer_order_v2(text,jsonb,text,text,uuid) from public;
grant execute on function public.create_customer_order_v2(text,jsonb,text,text,uuid) to authenticated;

-- Robust repeat: create the new core order via the proven RPC and attach auxiliary data afterwards.
create or replace function public.repeat_customer_order(p_order_id uuid)
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text)
language plpgsql security definer set search_path=public as $$
declare
  o public.orders%rowtype;
  d jsonb;
  r record;
  cid uuid:=public.current_customer_id();
  ad public.order_delivery_details%rowtype;
begin
  if cid is null then raise exception 'Customer account not found'; end if;

  select * into o from public.orders
    where id=p_order_id and customer_id=cid;
  if o.id is null then raise exception 'Order not found'; end if;

  select details into d from public.order_details
    where order_id=o.id
    order by id desc
    limit 1;
  d:=coalesce(d,'{}'::jsonb)-'_server_price'-'_created_from'-'_repeated_from';

  select * into r from public.create_customer_order(
    o.service_key,
    d,
    coalesce(o.description,'')
  );

  -- Mark provenance when order_details has the expected JSONB shape.
  begin
    update public.order_details
       set details=coalesce(details,'{}'::jsonb)||jsonb_build_object(
         '_created_from','customer_app_repeat',
         '_repeated_from',o.order_number
       )
     where order_id=r.id;
  exception when others then
    raise warning 'GDprint repeat metadata failed: %', sqlerrm;
  end;

  -- Copy delivery snapshot, but never block the repeated order.
  begin
    select * into ad from public.order_delivery_details where order_id=o.id;
    if ad.id is not null then
      insert into public.order_delivery_details(
        order_id,customer_id,delivery_method,address_id,label,
        recipient_name,phone,city,address_line,note
      ) values(
        r.id,cid,ad.delivery_method,ad.address_id,ad.label,
        ad.recipient_name,ad.phone,ad.city,ad.address_line,ad.note
      ) on conflict(order_id) do nothing;
    else
      insert into public.order_delivery_details(order_id,customer_id,delivery_method)
      values(r.id,cid,'pickup') on conflict(order_id) do nothing;
    end if;
  exception when others then
    raise warning 'GDprint repeat delivery copy failed: %', sqlerrm;
  end;

  -- Copy only columns guaranteed by the existing GDprint schema/migrations.
  begin
    insert into public.order_files(order_id,file_name,storage_path)
      select r.id,file_name,storage_path
      from public.order_files
      where order_id=o.id and storage_path is not null;
  exception when others then
    raise warning 'GDprint repeat file metadata copy failed: %', sqlerrm;
  end;

  begin
    insert into public.customer_app_notifications(customer_id,order_id,type,title,message)
    values(cid,r.id,'order_created','Պատվերը կրկնվել է','Ստեղծվել է նոր պատվեր #'||r.order_number||'։');
  exception when others then
    null;
  end;

  return query select r.id,r.order_number,r.total_amount,r.status,r.service_name;
end $$;
revoke all on function public.repeat_customer_order(uuid) from public;
grant execute on function public.repeat_customer_order(uuid) to authenticated;

-- Ask PostgREST to refresh functions immediately after migration.
notify pgrst, 'reload schema';
