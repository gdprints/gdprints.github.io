-- GDprint Customer App v4.7
-- Canonical delivery fee on orders + robust admin-only setter.
-- Run once after 012.

alter table public.orders
  add column if not exists delivery_fee numeric not null default 0;

do $$ begin
  alter table public.orders
    add constraint orders_delivery_fee_nonnegative check (delivery_fee >= 0);
exception when duplicate_object then null; end $$;

-- Backfill from existing delivery snapshots.
update public.orders o
set delivery_fee = greatest(0, coalesce(d.delivery_fee,0))
from public.order_delivery_details d
where d.order_id=o.id
  and coalesce(o.delivery_fee,0)=0
  and coalesce(d.delivery_fee,0)>0;

-- Admin-only setter. The orders row is canonical; delivery_details mirrors it when present.
create or replace function public.admin_set_order_delivery_fee(p_order_id uuid,p_delivery_fee numeric)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_old numeric := 0;
  v_new numeric := greatest(0,coalesce(p_delivery_fee,0));
  v_exists boolean := false;
begin
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
    raise exception 'Admin access required';
  end if;

  select true, coalesce(o.delivery_fee,0)
    into v_exists, v_old
  from public.orders o
  where o.id=p_order_id;

  if not coalesce(v_exists,false) then
    raise exception 'Order not found';
  end if;

  update public.orders
     set delivery_fee=v_new
   where id=p_order_id;

  -- Mirror into the delivery snapshot when it exists, but never fail the order fee save if it does not.
  begin
    update public.order_delivery_details
       set delivery_fee=v_new
     where order_id=p_order_id;
  exception when others then
    null;
  end;

  begin
    insert into public.activity_log(actor_id,action,target_table,target_id)
    values(auth.uid(),'Փոխեց առաքման արժեքը՝ '||coalesce(v_old,0)||' → '||v_new||' AMD','orders',p_order_id);
  exception when others then null; end;

  return jsonb_build_object('ok',true,'delivery_fee',v_new);
end $$;
revoke all on function public.admin_set_order_delivery_fee(uuid,numeric) from public;
grant execute on function public.admin_set_order_delivery_fee(uuid,numeric) to authenticated;

-- Managers can read delivery_fee through the normal orders SELECT policy,
-- but cannot modify it even by bypassing the UI.
create or replace function public.guard_manager_delivery_fee()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if v_role='manager' and new.delivery_fee is distinct from old.delivery_fee then
    raise exception 'Managers cannot change delivery fee';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_manager_delivery_fee on public.orders;
create trigger trg_guard_manager_delivery_fee
before update of delivery_fee on public.orders
for each row execute function public.guard_manager_delivery_fee();

notify pgrst, 'reload schema';
