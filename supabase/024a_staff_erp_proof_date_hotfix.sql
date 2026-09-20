-- GDprint Staff ERP v6.4.1 hotfix
-- Fixes: order_design_proofs has published_at, not created_at.
-- Safe to run after a failed 024_staff_erp.sql execution.

create or replace function public.staff_assigned_files()
returns table(
  order_id uuid,order_number text,service_key text,file_kind text,file_id uuid,file_name text,file_url text,storage_path text,created_at timestamptz
)
language sql stable security definer set search_path=public as $$
  select o.id,o.order_number,o.service_key,'order_file'::text,f.id,f.file_name,f.file_url,f.storage_path,f.created_at
  from public.staff_assignments a
  join public.orders o on o.id=a.order_id
  join public.order_files f on f.order_id=o.id
  where a.assignee_id=auth.uid() and public.is_staff()
  union all
  select o.id,o.order_number,o.service_key,'proof'::text,p.id,p.file_name,null::text,p.storage_path,p.published_at
  from public.staff_assignments a
  join public.orders o on o.id=a.order_id
  join public.order_design_proofs p on p.order_id=o.id
  where a.assignee_id=auth.uid() and public.is_staff()
  order by created_at desc;
$$;
revoke all on function public.staff_assigned_files() from public;
grant execute on function public.staff_assigned_files() to authenticated;

notify pgrst, 'reload schema';
