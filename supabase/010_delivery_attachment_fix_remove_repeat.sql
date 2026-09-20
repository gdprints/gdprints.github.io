-- ============================================================
-- GDprint Customer App v4.4
-- Stable delivery attachment + remove Repeat Order
-- Run once AFTER 009. Safe to re-run.
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

create or replace function public.set_customer_order_delivery(
  p_order_id uuid,
  p_delivery_method text default 'pickup',
  p_address_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  cid uuid:=public.current_customer_id();
  a public.customer_addresses%rowtype;
  owns_order boolean:=false;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  if coalesce(p_delivery_method,'pickup') not in ('pickup','delivery') then
    raise exception 'Invalid delivery method';
  end if;

  select exists(select 1 from public.orders o where o.id=p_order_id and o.customer_id=cid)
    into owns_order;
  if not owns_order then raise exception 'Order not found'; end if;

  if p_delivery_method='delivery' then
    if p_address_id is null then raise exception 'Delivery address is required'; end if;
    select * into a
      from public.customer_addresses
     where id=p_address_id and customer_id=cid;
    if a.id is null then raise exception 'Delivery address not found'; end if;

    insert into public.order_delivery_details(
      order_id,customer_id,delivery_method,address_id,label,
      recipient_name,phone,city,address_line,note
    ) values(
      p_order_id,cid,'delivery',a.id,a.label,
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
    values(p_order_id,cid,'pickup')
    on conflict(order_id) do update set
      customer_id=excluded.customer_id,
      delivery_method='pickup',
      address_id=null,label=null,recipient_name=null,phone=null,
      city=null,address_line=null,note=null;
  end if;
  return true;
end $$;

revoke all on function public.set_customer_order_delivery(uuid,text,uuid) from public;
grant execute on function public.set_customer_order_delivery(uuid,text,uuid) to authenticated;

-- Repeat Order intentionally removed from the Customer App.
drop function if exists public.repeat_customer_order(uuid);

notify pgrst, 'reload schema';
