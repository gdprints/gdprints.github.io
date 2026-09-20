-- GDprint Admin settings table. Run once in Supabase SQL Editor.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

drop policy if exists "admins can read app settings" on public.app_settings;
create policy "admins can read app settings"
on public.app_settings for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admins can insert app settings" on public.app_settings;
create policy "admins can insert app settings"
on public.app_settings for insert
to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "admins can update app settings" on public.app_settings;
create policy "admins can update app settings"
on public.app_settings for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.set_app_settings_audit_fields()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_app_settings_audit on public.app_settings;
create trigger trg_app_settings_audit
before insert or update on public.app_settings
for each row execute function public.set_app_settings_audit_fields();

insert into public.app_settings(key,value) values
('company_name','"GDprint"'::jsonb),
('support_phone','""'::jsonb),
('support_email','""'::jsonb),
('currency','"AMD"'::jsonb),
('order_prefix','"GD"'::jsonb),
('default_order_status','"pending"'::jsonb),
('allow_manager_order_creation','true'::jsonb),
('default_commission_percent','10'::jsonb),
('default_monthly_target','0'::jsonb),
('maintenance_mode','false'::jsonb),
('order_notifications','true'::jsonb)
on conflict (key) do nothing;
