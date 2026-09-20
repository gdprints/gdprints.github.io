-- ============================================================
-- GDprint v6.6 — Quality Control staff role
-- Run after 027_website_file_upload_hotfix.sql
-- Adds the production QA role required by the ERP workflow.
-- ============================================================

-- Rebuild role CHECK so existing projects can safely add quality_control.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I',r.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check check (
  role in (
    'admin','manager','designer','digital_print','large_format','finishing',
    'quality_control','packing','courier','warehouse','finance','it_admin'
  )
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')
      and coalesce(p.approval_status,'approved')='approved'
      and coalesce(p.account_status,'active')='active'
  );
$$;

-- Existing employee-id trigger from 024 only knows the old role set.
create or replace function public.gd_assign_employee_id()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.employee_id is null and new.role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') then
    new.employee_id := public.gd_next_employee_id();
  end if;
  return new;
end $$;

update public.profiles
set employee_id = public.gd_next_employee_id()
where employee_id is null and role='quality_control';
