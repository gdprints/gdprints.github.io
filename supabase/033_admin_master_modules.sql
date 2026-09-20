-- GDprint ERP Phase 6: master data, marketing/content and system operations
create table if not exists public.service_catalog (
 id uuid primary key default gen_random_uuid(), code text unique, name_hy text not null, name_ru text, name_en text,
 category text, base_price numeric(14,2) not null default 0, unit text default 'հատ', min_qty numeric(14,3) default 1,
 active boolean not null default true, website_visible boolean not null default true, sort_order int default 0,
 pricing_config jsonb not null default '{}'::jsonb, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.marketing_campaigns (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('discount','offer','advertisement')),
 title text not null, description text, discount_type text, discount_value numeric(14,2), promo_code text,
 starts_at timestamptz, ends_at timestamptz, active boolean default true, target text default 'all',
 banner_url text, cta_url text, created_by uuid references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.website_content (
 id uuid primary key default gen_random_uuid(), content_key text not null, locale text not null default 'hy', title text,
 body text, media_url text, active boolean default true, updated_by uuid references auth.users(id), updated_at timestamptz default now(),
 unique(content_key,locale)
);
create table if not exists public.system_operations (
 id uuid primary key default gen_random_uuid(), operation_type text not null,
 status text not null default 'info', title text not null, details jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.backup_registry (
 id uuid primary key default gen_random_uuid(), backup_type text not null default 'export', status text not null default 'registered',
 file_name text, storage_path text, notes text, created_by uuid references auth.users(id), created_at timestamptz default now()
);

alter table public.service_catalog enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.website_content enable row level security;
alter table public.system_operations enable row level security;
alter table public.backup_registry enable row level security;

-- Reuse profile role model. Drop/recreate named policies for idempotency.
do $$ begin
  execute 'drop policy if exists "admin service catalog" on public.service_catalog';
  execute 'create policy "admin service catalog" on public.service_catalog for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin'')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin''))';
  execute 'drop policy if exists "admin campaigns" on public.marketing_campaigns';
  execute 'create policy "admin campaigns" on public.marketing_campaigns for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin'')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin''))';
  execute 'drop policy if exists "admin website content" on public.website_content';
  execute 'create policy "admin website content" on public.website_content for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin'')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin''))';
  execute 'drop policy if exists "admin system operations" on public.system_operations';
  execute 'create policy "admin system operations" on public.system_operations for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin'')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin''))';
  execute 'drop policy if exists "admin backup registry" on public.backup_registry';
  execute 'create policy "admin backup registry" on public.backup_registry for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin'')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role=''admin''))';
end $$;

create index if not exists idx_service_catalog_active on public.service_catalog(active, sort_order);
create index if not exists idx_campaigns_kind_active on public.marketing_campaigns(kind,active);
create index if not exists idx_content_key_locale on public.website_content(content_key,locale);
create index if not exists idx_system_ops_created on public.system_operations(created_at desc);
