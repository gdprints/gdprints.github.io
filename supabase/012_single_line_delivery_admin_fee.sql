-- GDprint Customer App v4.6
-- Single-line delivery address + Admin-only delivery fee.

alter table public.order_delivery_details
  add column if not exists delivery_fee numeric not null default 0;

do $$ begin
  alter table public.order_delivery_details
    add constraint order_delivery_details_delivery_fee_nonnegative check (delivery_fee >= 0);
exception when duplicate_object then null; end $$;

-- Customer saves a permanent one-line address snapshot. Recipient/phone are always
-- taken from the authenticated customer record, so the browser does not need to
-- maintain multiple address fields.
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
  c public.customers%rowtype;
  v_line text;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  select * into c from public.customers where id=cid;
  if coalesce(p_delivery_method,'pickup') not in ('pickup','delivery') then raise exception 'Invalid delivery method'; end if;
  if not exists(select 1 from public.orders o where o.id=p_order_id and o.customer_id=cid) then raise exception 'Order not found'; end if;

  if coalesce(p_delivery_method,'pickup')='pickup' then
    insert into public.order_delivery_details(order_id,customer_id,delivery_method,delivery_fee)
    values(p_order_id,cid,'pickup',0)
    on conflict(order_id) do update set
      customer_id=excluded.customer_id,
      delivery_method='pickup',
      address_id=null,label=null,recipient_name=null,phone=null,city=null,address_line=null,note=null,
      delivery_fee=0;
    return true;
  end if;

  v_line := nullif(trim(coalesce(p_snapshot->>'address_line','')),'');
  if v_line is null then raise exception 'Delivery address is required'; end if;

  insert into public.order_delivery_details(
    order_id,customer_id,delivery_method,address_id,label,recipient_name,phone,city,address_line,note,delivery_fee
  ) values(
    p_order_id,cid,'delivery',null,'Առաքման հասցե',coalesce(c.full_name,''),coalesce(c.phone,''),null,v_line,null,0
  )
  on conflict(order_id) do update set
    customer_id=excluded.customer_id,
    delivery_method='delivery',
    address_id=null,
    label=excluded.label,
    recipient_name=excluded.recipient_name,
    phone=excluded.phone,
    city=null,
    address_line=excluded.address_line,
    note=null;
  return true;
end $$;
revoke all on function public.save_customer_order_delivery_snapshot(uuid,text,uuid,jsonb) from public;
grant execute on function public.save_customer_order_delivery_snapshot(uuid,text,uuid,jsonb) to authenticated;

-- Only Admin can set/change delivery fee. Managers remain read-only.
create or replace function public.admin_set_order_delivery_fee(p_order_id uuid,p_delivery_fee numeric)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_old numeric;
  v_new numeric := greatest(0,coalesce(p_delivery_fee,0));
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select delivery_fee into v_old from public.order_delivery_details where order_id=p_order_id and delivery_method='delivery';
  if not found then raise exception 'Delivery details not found for this order'; end if;
  update public.order_delivery_details set delivery_fee=v_new where order_id=p_order_id;
  begin
    insert into public.activity_log(actor_id,action,target_table,target_id)
    values(auth.uid(),'Փոխեց առաքման արժեքը՝ '||coalesce(v_old,0)||' → '||v_new||' AMD','order_delivery_details',p_order_id);
  exception when others then null; end;
  return jsonb_build_object('ok',true,'delivery_fee',v_new);
end $$;
revoke all on function public.admin_set_order_delivery_fee(uuid,numeric) from public;
grant execute on function public.admin_set_order_delivery_fee(uuid,numeric) to authenticated;

notify pgrst, 'reload schema';
