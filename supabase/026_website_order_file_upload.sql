-- GDprint v6.5.2 — website order file upload
-- Allows the public website order forms to upload print files to the existing PRIVATE bucket.
-- Files are not public. Only INSERT is granted to anonymous website users under website/*.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('customer-order-files','customer-order-files',false,52428800,null)
on conflict(id) do update set public=false,file_size_limit=52428800;

drop policy if exists website_anon_upload_order_files on storage.objects;
create policy website_anon_upload_order_files
on storage.objects
for insert
to anon
with check (
  bucket_id='customer-order-files'
  and (storage.foldername(name))[1]='website'
);

create or replace function public.attach_website_order_file(
  p_order_id uuid,
  p_order_number text,
  p_file_name text,
  p_storage_path text
)
returns void
language plpgsql
security definer
set search_path=public,storage
as $$
begin
  if p_order_id is null or coalesce(trim(p_order_number),'')='' then
    raise exception 'Invalid order';
  end if;
  if p_storage_path is null or p_storage_path not like ('website/' || p_order_number || '/%') then
    raise exception 'Invalid storage path';
  end if;
  if not exists(
    select 1 from public.orders o
    where o.id=p_order_id
      and o.order_number=p_order_number
      and coalesce(o.created_by_type,'customer')='customer'
      and o.created_at > now()-interval '2 hours'
  ) then
    raise exception 'Order is not eligible for website file attachment';
  end if;
  if not exists(
    select 1 from storage.objects s
    where s.bucket_id='customer-order-files' and s.name=p_storage_path
  ) then
    raise exception 'Uploaded object was not found';
  end if;

  insert into public.order_files(order_id,file_name,storage_path)
  values(p_order_id,left(coalesce(p_file_name,'file'),500),p_storage_path);
  return;
end;
$$;

revoke all on function public.attach_website_order_file(uuid,text,text,text) from public;
grant execute on function public.attach_website_order_file(uuid,text,text,text) to anon, authenticated;
