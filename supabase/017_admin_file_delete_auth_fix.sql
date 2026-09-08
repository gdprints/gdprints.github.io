-- GDprint v5.4 — Admin file-delete authorization fix
-- Run once after migration 016.
-- Fixes: "Database: Admin access required" for a real Admin session.

-- 1) Harden the shared admin helper. We intentionally read both auth.uid()
--    and the JWT sub claim; on a normal Supabase request they are identical.
--    row_security=off prevents profile RLS from hiding the caller from this
--    SECURITY DEFINER helper on projects with stricter profile policies.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    begin
      v_uid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    exception when others then
      v_uid := null;
    end;
  end if;

  if v_uid is null then
    return false;
  end if;

  return exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and lower(trim(coalesce(p.role, ''))) = 'admin'
  );
end;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 2) Direct Admin RLS delete policy for order-file metadata.
alter table public.order_files enable row level security;
drop policy if exists admin_delete_order_files on public.order_files;
create policy admin_delete_order_files
on public.order_files
for delete
to authenticated
using (public.is_admin());

-- 3) Storage delete policy uses the same hardened helper.
drop policy if exists admin_delete_customer_order_storage on storage.objects;
create policy admin_delete_customer_order_storage
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-order-files'
  and public.is_admin()
);

-- 4) Rebuild the fallback RPC with the hardened helper.
create or replace function public.admin_delete_order_file_record(p_file_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_deleted integer := 0;
begin
  if not public.is_admin() then
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

-- Optional diagnostic helper for troubleshooting. It exposes only the current
-- caller's own id/role/admin result and no secret values.
create or replace function public.admin_auth_diagnostic()
returns table(auth_uid uuid, jwt_sub text, profile_role text, is_admin boolean)
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select
    auth.uid(),
    current_setting('request.jwt.claim.sub', true),
    (select p.role from public.profiles p where p.id = auth.uid()),
    public.is_admin();
$$;

revoke all on function public.admin_auth_diagnostic() from public;
grant execute on function public.admin_auth_diagnostic() to authenticated;

notify pgrst, 'reload schema';
