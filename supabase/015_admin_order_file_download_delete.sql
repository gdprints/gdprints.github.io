-- GDprint v5.2 — Admin can remove customer-uploaded order files after download.
-- Run once in Supabase SQL Editor.

-- Admin may delete order_files metadata rows.
alter table public.order_files enable row level security;
drop policy if exists admin_delete_order_files on public.order_files;
create policy admin_delete_order_files
on public.order_files
for delete
to authenticated
using (public.is_admin());

-- Admin may delete the physical customer upload from the private Storage bucket.
-- Managers keep read/download access but cannot delete.
drop policy if exists admin_delete_customer_order_storage on storage.objects;
create policy admin_delete_customer_order_storage
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-order-files'
  and public.is_admin()
);

-- Ensure authenticated staff can continue reading private customer files.
drop policy if exists customer_read_storage_files on storage.objects;
create policy customer_read_storage_files
on storage.objects
for select
to authenticated
using (
  bucket_id='customer-order-files'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or public.is_admin()
    or exists(
      select 1 from public.profiles p
      where p.id=auth.uid() and p.role='manager' and coalesce(p.is_active,true)=true
    )
  )
);

notify pgrst, 'reload schema';
