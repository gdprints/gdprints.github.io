-- GDprint v5.6 — Customer/Admin file visibility + proof visibility
-- Run once in Supabase SQL Editor after migrations 001–017.

-- A) Staff must be able to read customer order-file metadata.
alter table public.order_files enable row level security;
drop policy if exists staff_read_order_files on public.order_files;
create policy staff_read_order_files
on public.order_files
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(trim(coalesce(p.role,''))) = 'manager'
      and coalesce(p.account_status,'active') <> 'blocked'
  )
);

-- B) Staff can read files in the private order bucket (customer uploads included).
drop policy if exists gd_staff_read_customer_order_storage on storage.objects;
create policy gd_staff_read_customer_order_storage
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-order-files'
  and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and lower(trim(coalesce(p.role,''))) = 'manager'
        and coalesce(p.account_status,'active') <> 'blocked'
    )
  )
);

-- C) Customer can read any storage object that is explicitly attached to one of their orders.
-- This fixes staff-published design proofs whose storage path begins with customer_id instead of auth.uid().
drop policy if exists customer_read_attached_order_storage on storage.objects;
create policy customer_read_attached_order_storage
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-order-files'
  and (
    -- normal customer-upload path
    (storage.foldername(name))[1] = auth.uid()::text
    -- file linked in order_files
    or exists (
      select 1
      from public.order_files f
      join public.orders o on o.id = f.order_id
      where f.storage_path = name
        and o.customer_id = public.current_customer_id()
    )
    -- design proof linked to customer's order
    or exists (
      select 1
      from public.order_design_proofs pr
      join public.orders o on o.id = pr.order_id
      where pr.storage_path = name
        and o.customer_id = public.current_customer_id()
    )
  )
);

-- Keep metadata proof read policy explicit for customer + staff.
alter table public.order_design_proofs enable row level security;
drop policy if exists customer_proofs_read_v56 on public.order_design_proofs;
create policy customer_proofs_read_v56
on public.order_design_proofs
for select
to authenticated
using (
  exists(select 1 from public.orders o where o.id=order_id and o.customer_id=public.current_customer_id())
  or public.is_admin()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and lower(trim(coalesce(p.role,'')))='manager' and coalesce(p.account_status,'active')<>'blocked')
);
