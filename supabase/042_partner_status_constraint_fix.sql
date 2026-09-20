-- GDprint v7.5.7 — Partner application status constraint repair
-- Run AFTER 041_partner_applications_sync_fix.sql
-- Safe to re-run.

begin;

-- The old project may already have this constraint with legacy allowed values.
-- Drop it first so the current Admin statuses can be installed deterministically.
alter table public.partner_applications
  drop constraint if exists partner_applications_status_check;

-- Normalize legacy/current rows before adding the new constraint.
update public.partner_applications
set status = case
  when status is null or btrim(status) = '' then 'new'
  when lower(btrim(status)) in ('new','pending','submitted','waiting','awaiting','created') then 'new'
  when lower(btrim(status)) in ('contacted','in_progress','in-progress','processing','called','replied') then 'contacted'
  when lower(btrim(status)) in ('approved','accepted','active','partner','confirmed') then 'approved'
  when lower(btrim(status)) in ('rejected','declined','cancelled','canceled','denied') then 'rejected'
  else 'new'
end;

alter table public.partner_applications
  alter column status set default 'new',
  alter column status set not null;

alter table public.partner_applications
  add constraint partner_applications_status_check
  check (status in ('new','contacted','approved','rejected'));

-- Recreate the RPC too, so its validation exactly matches the DB constraint.
create or replace function public.admin_set_partner_application_status(p_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_status text := lower(btrim(coalesce(p_status,'')));
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if v_status not in ('new','contacted','approved','rejected') then
    raise exception 'Invalid status: %', p_status;
  end if;

  update public.partner_applications
  set status=v_status, updated_at=now()
  where id=p_id;

  return found;
end;
$$;

grant execute on function public.admin_set_partner_application_status(uuid,text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- Diagnostics: these should show the new constraint and only the 4 supported statuses.
select pg_get_constraintdef(oid) as partner_status_constraint
from pg_constraint
where conname='partner_applications_status_check'
  and conrelid='public.partner_applications'::regclass;

select status, count(*) as rows
from public.partner_applications
group by status
order by status;
