-- GDprint v5.7 — Admin permanent order deletion
-- Run ONCE in Supabase SQL Editor after migration 019.
create or replace function public.admin_delete_order_permanently(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
set row_security = off
as $$
declare
  v_order_number text;
  v_table record;
  v_count bigint := 0;
  v_rows bigint := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and lower(trim(coalesce(p.role,'')))='admin'
  ) then raise exception 'Admin access required'; end if;

  select o.order_number into v_order_number
  from public.orders o where o.id=p_order_id for update;
  if v_order_number is null then raise exception 'Order not found'; end if;

  for v_table in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema=c.table_schema and t.table_name=c.table_name
    where c.table_schema='public' and c.column_name='order_id'
      and c.table_name<>'orders' and t.table_type='BASE TABLE'
    group by c.table_name
  loop
    execute format('delete from public.%I where order_id = $1',v_table.table_name) using p_order_id;
    get diagnostics v_rows=row_count;
    v_count:=v_count+v_rows;
  end loop;

  delete from public.orders where id=p_order_id;
  if not found then raise exception 'Order delete failed'; end if;

  return jsonb_build_object('deleted',true,'order_id',p_order_id,'order_number',v_order_number,'related_rows_deleted',v_count);
end;
$$;
revoke all on function public.admin_delete_order_permanently(uuid) from public;
grant execute on function public.admin_delete_order_permanently(uuid) to authenticated;
