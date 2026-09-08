-- ============================================================
-- GDprint Customer App v4.5
-- Reliable delivery snapshot + Admin/Manager visibility
-- Run once AFTER 010. Safe to re-run.
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

alter table public.order_delivery_details enable row level security;
grant select on public.order_delivery_details to authenticated;

-- Customer can read only their own delivery data.
drop policy if exists customer_delivery_read on public.order_delivery_details;
create policy customer_delivery_read on public.order_delivery_details
for select to authenticated
using (customer_id = public.current_customer_id());

-- Admin and active managers can read delivery details for order processing.
drop policy if exists staff_delivery_read on public.order_delivery_details;
create policy staff_delivery_read on public.order_delivery_details
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
      and coalesce(p.account_status,'active') <> 'blocked'
  )
);

-- Save a permanent snapshot. We prefer the owned address row when available,
-- but accept the supplied snapshot as a robust fallback.
create or replace function public.save_customer_order_delivery_snapshot(
  p_order_id uuid,
  p_delivery_method text default 'pickup',
  p_address_id uuid default null,
  p_snapshot jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  cid uuid := public.current_customer_id();
  a public.customer_addresses%rowtype;
  v_label text;
  v_recipient text;
  v_phone text;
  v_city text;
  v_line text;
  v_note text;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  if coalesce(p_delivery_method,'pickup') not in ('pickup','delivery') then
    raise exception 'Invalid delivery method';
  end if;

  if not exists(select 1 from public.orders o where o.id=p_order_id and o.customer_id=cid) then
    raise exception 'Order not found';
  end if;

  if coalesce(p_delivery_method,'pickup')='pickup' then
    insert into public.order_delivery_details(order_id,customer_id,delivery_method)
    values(p_order_id,cid,'pickup')
    on conflict(order_id) do update set
      customer_id=excluded.customer_id,
      delivery_method='pickup',
      address_id=null,
      label=null,
      recipient_name=null,
      phone=null,
      city=null,
      address_line=null,
      note=null;
    return true;
  end if;

  -- First try the selected saved address belonging to this customer.
  if p_address_id is not null then
    select * into a
    from public.customer_addresses
    where id=p_address_id and customer_id=cid;
  end if;

  if a.id is not null then
    v_label := a.label;
    v_recipient := a.recipient_name;
    v_phone := a.phone;
    v_city := a.city;
    v_line := a.address_line;
    v_note := a.note;
  else
    -- Fallback to the snapshot already shown to the authenticated customer.
    v_label := nullif(trim(coalesce(p_snapshot->>'label','')),'');
    v_recipient := nullif(trim(coalesce(p_snapshot->>'recipient_name','')),'');
    v_phone := nullif(trim(coalesce(p_snapshot->>'phone','')),'');
    v_city := nullif(trim(coalesce(p_snapshot->>'city','')),'');
    v_line := nullif(trim(coalesce(p_snapshot->>'address_line','')),'');
    v_note := nullif(trim(coalesce(p_snapshot->>'note','')),'');
  end if;

  if v_recipient is null or v_phone is null or v_city is null or v_line is null then
    raise exception 'Delivery address data is incomplete';
  end if;

  insert into public.order_delivery_details(
    order_id,customer_id,delivery_method,address_id,label,
    recipient_name,phone,city,address_line,note
  ) values(
    p_order_id,cid,'delivery',a.id,v_label,
    v_recipient,v_phone,v_city,v_line,v_note
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

  return true;
end $$;

revoke all on function public.save_customer_order_delivery_snapshot(uuid,text,uuid,jsonb) from public;
grant execute on function public.save_customer_order_delivery_snapshot(uuid,text,uuid,jsonb) to authenticated;

notify pgrst, 'reload schema';
