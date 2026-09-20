-- GDprint v5.8 — Admin-only warehouse / inventory
-- Run ONCE in Supabase SQL Editor after 020_admin_delete_order.sql.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  material_type text not null,
  size text not null,
  unit text not null check (unit in ('piece','box','roll','meter')),
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  cost_price numeric(14,2) not null default 0 check (cost_price >= 0),
  sale_price numeric(14,2) not null default 0 check (sale_price >= 0),
  supplier text,
  min_stock numeric(14,3) not null default 0 check (min_stock >= 0),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  quantity numeric(14,3) not null check (quantity > 0),
  balance_before numeric(14,3) not null,
  balance_after numeric(14,3) not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_name_idx on public.inventory_items (lower(name));
create index if not exists inventory_items_unit_idx on public.inventory_items (unit);
create index if not exists inventory_movements_item_created_idx on public.inventory_movements (item_id, created_at desc);

create or replace function public.set_inventory_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at before update on public.inventory_items
for each row execute function public.set_inventory_updated_at();

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "inventory_items_admin_all" on public.inventory_items;
create policy "inventory_items_admin_all" on public.inventory_items
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "inventory_movements_admin_select" on public.inventory_movements;
create policy "inventory_movements_admin_select" on public.inventory_movements
for select to authenticated using (public.is_admin());

create or replace function public.inventory_move_stock(
  p_item_id uuid,p_direction text,p_quantity numeric,p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
declare v_before numeric(14,3); v_after numeric(14,3);
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_direction not in ('in','out') then raise exception 'Invalid movement direction'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;

  select quantity into v_before from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;

  v_after:=case when p_direction='in' then v_before+p_quantity else v_before-p_quantity end;
  if v_after<0 then raise exception 'Insufficient stock'; end if;

  update public.inventory_items set quantity=v_after,updated_at=now() where id=p_item_id;
  insert into public.inventory_movements(item_id,direction,quantity,balance_before,balance_after,note,created_by)
  values(p_item_id,p_direction,p_quantity,v_before,v_after,nullif(trim(coalesce(p_note,'')),''),auth.uid());

  return jsonb_build_object('ok',true,'item_id',p_item_id,'balance_before',v_before,'balance_after',v_after);
end;
$$;

revoke all on function public.inventory_move_stock(uuid,text,numeric,text) from public;
grant execute on function public.inventory_move_stock(uuid,text,numeric,text) to authenticated;
