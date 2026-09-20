-- GDprint v7.5.5 — Partner applications: Website -> Supabase -> Admin
-- Run AFTER previous migrations. Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  plan text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  email text not null default '',
  company text not null default '',
  company_type text not null default '',
  tin text not null default '',
  address text not null default '',
  expected_volume numeric,
  source text not null default '',
  comments text not null default '',
  language text not null default 'hy',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_applications
  add column if not exists plan text not null default '',
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists company text not null default '',
  add column if not exists company_type text not null default '',
  add column if not exists tin text not null default '',
  add column if not exists address text not null default '',
  add column if not exists expected_volume numeric,
  add column if not exists source text not null default '',
  add column if not exists comments text not null default '',
  add column if not exists language text not null default 'hy',
  add column if not exists status text not null default 'new',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Always replace a possible legacy status constraint. Older GDprint schemas may
-- already have the same constraint name with different allowed values.
alter table public.partner_applications
  drop constraint if exists partner_applications_status_check;

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
  add constraint partner_applications_status_check
  check (status in ('new','contacted','approved','rejected'));

create index if not exists partner_applications_created_idx
  on public.partner_applications(created_at desc);
create index if not exists partner_applications_status_idx
  on public.partner_applications(status, created_at desc);
create index if not exists partner_applications_email_idx
  on public.partner_applications(lower(email));

alter table public.partner_applications enable row level security;

drop policy if exists partner_applications_admin_select on public.partner_applications;
create policy partner_applications_admin_select
on public.partner_applications for select to authenticated
using (public.is_admin());

drop policy if exists partner_applications_admin_update on public.partner_applications;
create policy partner_applications_admin_update
on public.partner_applications for update to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists partner_applications_admin_delete on public.partner_applications;
create policy partner_applications_admin_delete
on public.partner_applications for delete to authenticated
using (public.is_admin());

-- No public direct INSERT policy: website registration goes through this validated RPC.
create or replace function public.submit_partner_application(
  p_plan text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_company text,
  p_company_type text,
  p_tin text,
  p_address text,
  p_expected_volume numeric default null,
  p_source text default '',
  p_comments text default '',
  p_language text default 'hy'
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_lang text := lower(coalesce(nullif(trim(p_language),''),'hy'));
begin
  if trim(coalesce(p_plan,''))='' then raise exception 'Plan is required'; end if;
  if trim(coalesce(p_first_name,''))='' then raise exception 'First name is required'; end if;
  if trim(coalesce(p_last_name,''))='' then raise exception 'Last name is required'; end if;
  if trim(coalesce(p_phone,''))='' then raise exception 'Phone is required'; end if;
  if trim(coalesce(p_email,''))='' then raise exception 'Email is required'; end if;
  if position('@' in p_email)=0 then raise exception 'Invalid email'; end if;
  if trim(coalesce(p_company,''))='' then raise exception 'Company is required'; end if;

  if v_lang not in ('hy','ru','en') then v_lang := 'hy'; end if;

  -- Avoid an accidental duplicate if the browser retries the same request.
  select pa.id into v_id
  from public.partner_applications pa
  where lower(pa.email)=lower(trim(p_email))
    and regexp_replace(pa.phone,'\D','','g')=regexp_replace(trim(p_phone),'\D','','g')
    and pa.plan=trim(p_plan)
    and pa.created_at > now() - interval '5 minutes'
  order by pa.created_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.partner_applications(
    plan,first_name,last_name,phone,email,company,company_type,tin,address,
    expected_volume,source,comments,language,status
  ) values (
    trim(p_plan),trim(p_first_name),trim(p_last_name),trim(p_phone),lower(trim(p_email)),
    trim(p_company),trim(coalesce(p_company_type,'')),trim(coalesce(p_tin,'')),trim(coalesce(p_address,'')),
    p_expected_volume,trim(coalesce(p_source,'')),trim(coalesce(p_comments,'')),v_lang,'new'
  ) returning id into v_id;

  begin
    insert into public.notifications(recipient_id,type,title,message,link)
    select p.id,
           'partner_application',
           'Նոր գործընկերային հայտ',
           trim(p_first_name)||' '||trim(p_last_name)||' · '||trim(p_company)||' · '||trim(p_plan),
           'partners.html'
    from public.profiles p
    where p.role='admin'
      and coalesce(p.account_status,'active')<>'blocked';
  exception when others then
    null;
  end;

  return v_id;
end;
$$;

revoke all on function public.submit_partner_application(text,text,text,text,text,text,text,text,text,numeric,text,text,text) from public;
grant execute on function public.submit_partner_application(text,text,text,text,text,text,text,text,text,numeric,text,text,text) to anon, authenticated;

create or replace function public.admin_partner_applications()
returns setof public.partner_applications
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return query
    select pa.* from public.partner_applications pa order by pa.created_at desc;
end;
$$;

grant execute on function public.admin_partner_applications() to authenticated;

create or replace function public.admin_set_partner_application_status(p_id uuid,p_status text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('new','contacted','approved','rejected') then
    raise exception 'Invalid status';
  end if;
  update public.partner_applications
  set status=p_status, updated_at=now()
  where id=p_id;
  return found;
end;
$$;

grant execute on function public.admin_set_partner_application_status(uuid,text) to authenticated;

-- PostgREST schema refresh
notify pgrst, 'reload schema';
