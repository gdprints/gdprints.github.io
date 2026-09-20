-- GDprint v6.0 — Permanent customer deletion
-- Run ONCE after 022_inventory_material_variants.sql.
-- Only authenticated Admin may execute.

create or replace function public.admin_delete_customer_permanently(p_customer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_catalog
set row_security = off
as $$
declare
  v_auth_user_id uuid;
  v_name text;
  v_table record;
  v_rows bigint := 0;
  v_related bigint := 0;
  v_orders bigint := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select c.auth_user_id, c.full_name
    into v_auth_user_id, v_name
  from public.customers c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer not found';
  end if;

  select count(*) into v_orders
  from public.orders
  where customer_id = p_customer_id;

  -- First clear every public child table connected by order_id.
  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'order_id'
      and c.table_name <> 'orders'
      and t.table_type = 'BASE TABLE'
    group by c.table_name
  loop
    execute format(
      'delete from public.%I where order_id in (select id from public.orders where customer_id=$1)',
      v_table.table_name
    ) using p_customer_id;
    get diagnostics v_rows = row_count;
    v_related := v_related + v_rows;
  end loop;

  -- Delete the customer's orders.
  delete from public.orders where customer_id = p_customer_id;
  get diagnostics v_rows = row_count;
  v_related := v_related + v_rows;

  -- Clear every public child table directly connected by customer_id.
  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'customer_id'
      and c.table_name not in ('customers','orders')
      and t.table_type = 'BASE TABLE'
    group by c.table_name
  loop
    execute format('delete from public.%I where customer_id=$1', v_table.table_name)
      using p_customer_id;
    get diagnostics v_rows = row_count;
    v_related := v_related + v_rows;
  end loop;

  delete from public.customers where id = p_customer_id;
  if not found then
    raise exception 'Customer delete failed';
  end if;

  -- Remove Customer App login too. This is server-side only; no service-role key
  -- is exposed to browser JavaScript.
  if v_auth_user_id is not null then
    delete from auth.users where id = v_auth_user_id;
  end if;

  insert into public.activity_log(actor_id,action,target_table,target_id)
  values(
    auth.uid(),
    'Վերջնական ջնջեց հաճախորդին՝ ' || coalesce(v_name,p_customer_id::text),
    'customers',
    p_customer_id
  );

  return jsonb_build_object(
    'deleted', true,
    'customer_id', p_customer_id,
    'customer_name', v_name,
    'orders_deleted', v_orders,
    'related_rows_deleted', v_related,
    'auth_account_deleted', (v_auth_user_id is not null)
  );
end;
$$;

revoke all on function public.admin_delete_customer_permanently(uuid) from public;
grant execute on function public.admin_delete_customer_permanently(uuid) to authenticated;

notify pgrst, 'reload schema';
