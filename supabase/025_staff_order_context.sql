-- GDprint Staff ERP v6.4.3
-- Rich order context for assigned production staff.
-- Safe to run after 024_staff_erp.sql.

create or replace function public.staff_my_order_contexts()
returns table(
  order_id uuid,
  order_number text,
  service_key text,
  service_name text,
  order_status text,
  description text,
  language text,
  customer_name text,
  order_created_at timestamptz,
  details jsonb,
  delivery_method text,
  file_count bigint,
  proof_count bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    o.id,
    o.order_number,
    o.service_key,
    o.service_name,
    o.status,
    o.description,
    o.language,
    o.customer_name,
    o.created_at,
    coalesce(od.details,'{}'::jsonb),
    dd.delivery_method,
    (select count(*) from public.order_files f where f.order_id=o.id),
    (select count(*) from public.order_design_proofs p where p.order_id=o.id)
  from public.orders o
  join (
    select distinct a.order_id
    from public.staff_assignments a
    where a.assignee_id=auth.uid()
      and a.order_id is not null
      and a.status <> 'cancelled'
  ) assigned on assigned.order_id=o.id
  left join lateral (
    select d.details
    from public.order_details d
    where d.order_id=o.id
    order by d.id desc
    limit 1
  ) od on true
  left join public.order_delivery_details dd on dd.order_id=o.id
  where public.is_staff()
  order by o.created_at desc;
$$;

revoke all on function public.staff_my_order_contexts() from public;
grant execute on function public.staff_my_order_contexts() to authenticated;
