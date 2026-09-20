-- GDprint v5.9 — Inventory material variants / roll properties
-- Run once AFTER supabase/021_admin_inventory.sql

alter table public.inventory_items
  add column if not exists purpose text,
  add column if not exists color text,
  add column if not exists roll_width_m numeric(10,3),
  add column if not exists roll_length_m numeric(10,3);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='inventory_items_purpose_check'
  ) then
    alter table public.inventory_items
      add constraint inventory_items_purpose_check
      check (purpose is null or purpose in ('printing','plotter','both'));
  end if;
end $$;

create index if not exists inventory_items_purpose_idx on public.inventory_items(purpose);
create index if not exists inventory_items_color_idx on public.inventory_items(lower(color));
