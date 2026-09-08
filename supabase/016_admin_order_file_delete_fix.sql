-- GDprint v5.3 — reliable Admin order-file deletion
-- Run once in Supabase SQL Editor after migration 015.

-- 1) Use a direct profile check for Storage DELETE instead of relying only on is_admin().
drop policy if exists admin_delete_customer_order_storage on storage.objects;
create policy admin_delete_customer_order_storage
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-order-files'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- 2) Keep a direct Admin delete policy on the metadata table.
drop policy if exists admin_delete_order_files on public.order_files;
create policy admin_delete_order_files
on public.order_files
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

-- 3) Reliable SECURITY DEFINER RPC for deleting the DB record.
--    This avoids a silent zero-row DELETE when RLS/schema cache gets in the way.
create or replace function public.admin_delete_order_file_record(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_deleted integer := 0;
begin
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Admin access required';
  end if;

  delete from public.order_files
  where id = p_file_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.admin_delete_order_file_record(uuid) from public;
grant execute on function public.admin_delete_order_file_record(uuid) to authenticated;

notify pgrst, 'reload schema';
