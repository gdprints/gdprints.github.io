-- GDprint v7.5.8 — Order → Inventory automation
-- Run once AFTER 042_partner_status_constraint_fix.sql
-- Phase 1: generic service-to-material rules + photo A4/A5/A6 presets,
-- reservation, production consumption, cancellation release and waste logging.

-- ------------------------------------------------------------
-- 1) Inventory model upgrades
-- ------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname='inventory_items_unit_check'
      and conrelid='public.inventory_items'::regclass
  ) then
    alter table public.inventory_items drop constraint inventory_items_unit_check;
  end if;
exception when undefined_table then null;
end $$;

alter table public.inventory_items
  add constraint inventory_items_unit_check
  check (unit in ('piece','box','roll','meter','sqm'));

alter table public.inventory_movements
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists allocation_id uuid,
  add column if not exists movement_type text;

create index if not exists inventory_movements_order_idx
  on public.inventory_movements(order_id,created_at desc);

create table if not exists public.service_inventory_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique,
  service_key text not null,
  label text not null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  match_field text,
  match_value text,
  calculation_type text not null default 'quantity'
    check (calculation_type in ('quantity','area','fixed')),
  multiplier numeric(14,4) not null default 1 check (multiplier > 0),
  consume_stage text not null default 'digital_print'
    check (consume_stage in ('prepress','digital_print','large_format','finishing','quality_control','packing','delivery')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_inventory_rules_service_idx
  on public.service_inventory_rules(service_key,active);

create table if not exists public.order_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rule_id uuid not null references public.service_inventory_rules(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  planned_quantity numeric(14,4) not null default 0 check (planned_quantity >= 0),
  reserved_quantity numeric(14,4) not null default 0 check (reserved_quantity >= 0),
  consumed_quantity numeric(14,4) not null default 0 check (consumed_quantity >= 0),
  waste_quantity numeric(14,4) not null default 0 check (waste_quantity >= 0),
  status text not null default 'reserved'
    check (status in ('reserved','shortage','consumed','released')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id,rule_id)
);

create index if not exists order_inventory_alloc_order_idx
  on public.order_inventory_allocations(order_id,created_at desc);
create index if not exists order_inventory_alloc_item_idx
  on public.order_inventory_allocations(item_id,status);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_allocation_id_fkey;
alter table public.inventory_movements
  add constraint inventory_movements_allocation_id_fkey
  foreign key (allocation_id) references public.order_inventory_allocations(id) on delete set null;

create or replace function public.gd_inventory_touch_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists trg_service_inventory_rules_updated_at on public.service_inventory_rules;
create trigger trg_service_inventory_rules_updated_at
before update on public.service_inventory_rules
for each row execute function public.gd_inventory_touch_updated_at();

drop trigger if exists trg_order_inventory_allocations_updated_at on public.order_inventory_allocations;
create trigger trg_order_inventory_allocations_updated_at
before update on public.order_inventory_allocations
for each row execute function public.gd_inventory_touch_updated_at();

-- ------------------------------------------------------------
-- 2) RLS
-- ------------------------------------------------------------
alter table public.service_inventory_rules enable row level security;
alter table public.order_inventory_allocations enable row level security;

drop policy if exists service_inventory_rules_admin_all on public.service_inventory_rules;
create policy service_inventory_rules_admin_all
on public.service_inventory_rules for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists service_inventory_rules_warehouse_read on public.service_inventory_rules;
create policy service_inventory_rules_warehouse_read
on public.service_inventory_rules for select to authenticated
using (public.current_staff_role()='warehouse' and public.is_staff());

drop policy if exists order_inventory_allocations_admin_read on public.order_inventory_allocations;
create policy order_inventory_allocations_admin_read
on public.order_inventory_allocations for select to authenticated
using (public.is_admin());

drop policy if exists order_inventory_allocations_warehouse_read on public.order_inventory_allocations;
create policy order_inventory_allocations_warehouse_read
on public.order_inventory_allocations for select to authenticated
using (public.current_staff_role()='warehouse' and public.is_staff());

-- ------------------------------------------------------------
-- 3) Detail helpers
-- ------------------------------------------------------------
create or replace function public.gd_inventory_detail_value(p_details jsonb,p_field text)
returns text
language plpgsql immutable
set search_path=public
as $$
begin
  if p_details is null then return null; end if;
  case lower(coalesce(p_field,''))
    when 'size' then
      return coalesce(
        p_details->>'size',
        p_details->>'Թղթի չափս',
        p_details->>'Չափս',
        p_details->>'Размер бумаги',
        p_details->>'Paper size'
      );
    when 'quantity' then
      return coalesce(
        p_details->>'quantity',
        p_details->>'Տպագրության քանակը',
        p_details->>'Տպման քանակը',
        p_details->>'Քանակ',
        p_details->>'Количество',
        p_details->>'Print quantity'
      );
    when 'width' then
      return coalesce(p_details->>'width',p_details->>'Լայնություն',p_details->>'Ширина',p_details->>'Width');
    when 'height' then
      return coalesce(p_details->>'height',p_details->>'Բարձրություն',p_details->>'Высота',p_details->>'Height');
    when 'material' then
      return coalesce(p_details->>'material',p_details->>'Նյութ',p_details->>'Материал',p_details->>'Material');
    when 'paper_type' then
      return coalesce(p_details->>'paper_type',p_details->>'Թղթի տեսակ',p_details->>'Тип бумаги',p_details->>'Paper type');
    else
      return p_details->>p_field;
  end case;
end $$;

create or replace function public.gd_inventory_detail_number(p_details jsonb,p_field text,p_default numeric default null)
returns numeric
language plpgsql immutable
set search_path=public
as $$
declare v text; n numeric;
begin
  v:=public.gd_inventory_detail_value(p_details,p_field);
  if v is null or btrim(v)='' then return p_default; end if;
  begin
    n:=nullif(regexp_replace(replace(v,',','.'),'[^0-9.\-]','','g'),'')::numeric;
    return coalesce(n,p_default);
  exception when others then
    return p_default;
  end;
end $$;

create or replace function public.gd_inventory_rule_matches(p_details jsonb,p_field text,p_value text)
returns boolean
language plpgsql immutable
set search_path=public
as $$
declare actual text;
begin
  if p_field is null or btrim(p_field)='' then return true; end if;
  actual:=public.gd_inventory_detail_value(p_details,p_field);
  return lower(btrim(coalesce(actual,'')))=lower(btrim(coalesce(p_value,'')));
end $$;

create or replace function public.gd_inventory_rule_quantity(
  p_details jsonb,p_calculation_type text,p_multiplier numeric
)
returns numeric
language plpgsql immutable
set search_path=public
as $$
declare q numeric; w numeric; h numeric; result numeric;
begin
  if p_calculation_type='fixed' then
    result:=p_multiplier;
  elsif p_calculation_type='area' then
    q:=greatest(1,coalesce(public.gd_inventory_detail_number(p_details,'quantity',1),1));
    w:=greatest(0,coalesce(public.gd_inventory_detail_number(p_details,'width',0),0));
    h:=greatest(0,coalesce(public.gd_inventory_detail_number(p_details,'height',0),0));
    result:=w*h*q*p_multiplier;
  else
    q:=greatest(0,coalesce(public.gd_inventory_detail_number(p_details,'quantity',0),0));
    result:=q*p_multiplier;
  end if;
  return round(coalesce(result,0),4);
end $$;

-- ------------------------------------------------------------
-- 4) Seed / reuse photo-paper inventory items and rules
-- ------------------------------------------------------------
do $$
declare s text; item uuid;
begin
  foreach s in array array['A3','A4','A5','A6'] loop
    select id into item
    from public.inventory_items
    where upper(replace(btrim(size),' ',''))=s
      and (
        lower(coalesce(name,'')) like '%ֆոտ%'
        or lower(coalesce(material_type,'')) like '%ֆոտ%'
        or lower(coalesce(name,'')) like '%photo%'
        or lower(coalesce(material_type,'')) like '%photo%'
      )
    order by created_at asc
    limit 1;

    if item is null then
      insert into public.inventory_items(
        name,category,material_type,size,unit,quantity,cost_price,sale_price,min_stock,purpose,notes
      ) values(
        'Ֆոտոթուղթ '||s,'Թուղթ','Ֆոտոթուղթ',s,'piece',0,0,0,0,'printing',
        'Ավտոմատ ստեղծված v7.5.8-ում։ Լրացրեք իրական մնացորդը և գները։'
      ) returning id into item;
    end if;

    insert into public.service_inventory_rules(
      rule_code,service_key,label,inventory_item_id,match_field,match_value,calculation_type,multiplier,consume_stage,active
    ) values(
      'photo_'||lower(s),'photo_printing','Լուսանկար '||s||' → ֆոտոթուղթ '||s,
      item,'size',s,'quantity',1,'digital_print',true
    )
    on conflict(rule_code) do update set
      service_key=excluded.service_key,
      label=excluded.label,
      inventory_item_id=coalesce(public.service_inventory_rules.inventory_item_id,excluded.inventory_item_id),
      match_field=excluded.match_field,
      match_value=excluded.match_value,
      calculation_type=excluded.calculation_type,
      multiplier=excluded.multiplier,
      consume_stage=excluded.consume_stage,
      active=true,
      updated_at=now();
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5) Reservation planner
-- ------------------------------------------------------------
create or replace function public.gd_inventory_plan_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
declare
  ord record;
  det jsonb;
  r record;
  item record;
  planned numeric;
  other_reserved numeric;
  available numeric;
  reserve_qty numeric;
  alloc_status text;
  shortage numeric;
  out jsonb:='[]'::jsonb;
begin
  select o.id,o.order_number,o.service_key,o.status,o.workflow_stage
  into ord from public.orders o where o.id=p_order_id;
  if not found then return jsonb_build_object('ok',false,'reason','order_not_found'); end if;

  if coalesce(ord.status,'')='cancelled' or coalesce(ord.workflow_stage,'')='cancelled' then
    update public.order_inventory_allocations
      set status='released',reserved_quantity=0,note='Պատվերը չեղարկված է'
    where order_id=p_order_id and status in ('reserved','shortage');
    return jsonb_build_object('ok',true,'cancelled',true);
  end if;

  select od.details into det
  from public.order_details od
  where od.order_id=p_order_id
  order by od.id desc
  limit 1;
  if det is null then return jsonb_build_object('ok',false,'reason','details_not_found'); end if;

  -- Release only unconsumed previous reservations; consumed material is physical history.
  update public.order_inventory_allocations
    set status='released',reserved_quantity=0,note='Վերահաշվարկվել է պատվերի տվյալների փոփոխությունից հետո'
  where order_id=p_order_id and consumed_quantity=0 and status in ('reserved','shortage');

  for r in
    select * from public.service_inventory_rules
    where service_key=ord.service_key and active=true and inventory_item_id is not null
    order by created_at,id
  loop
    if not public.gd_inventory_rule_matches(det,r.match_field,r.match_value) then
      continue;
    end if;

    planned:=public.gd_inventory_rule_quantity(det,r.calculation_type,r.multiplier);
    if planned<=0 then continue; end if;

    select * into item from public.inventory_items where id=r.inventory_item_id for update;
    if not found then continue; end if;

    select coalesce(sum(a.reserved_quantity),0) into other_reserved
    from public.order_inventory_allocations a
    where a.item_id=item.id
      and a.order_id<>p_order_id
      and a.status in ('reserved','shortage')
      and a.reserved_quantity>0;

    available:=greatest(0,item.quantity-other_reserved);
    reserve_qty:=least(planned,available);
    alloc_status:=case when reserve_qty>=planned then 'reserved' else 'shortage' end;
    shortage:=greatest(0,planned-reserve_qty);

    insert into public.order_inventory_allocations(
      order_id,rule_id,item_id,planned_quantity,reserved_quantity,consumed_quantity,waste_quantity,status,note
    ) values(
      p_order_id,r.id,item.id,planned,reserve_qty,0,0,alloc_status,
      case when alloc_status='shortage' then 'Պակաս՝ '||shortage||' '||item.unit else 'Նյութը պահուստավորված է' end
    )
    on conflict(order_id,rule_id) do update set
      item_id=excluded.item_id,
      planned_quantity=excluded.planned_quantity,
      reserved_quantity=excluded.reserved_quantity,
      status=excluded.status,
      note=excluded.note,
      updated_at=now()
    where public.order_inventory_allocations.consumed_quantity=0;

    if alloc_status='shortage' then
      begin
        insert into public.notifications(recipient_id,type,title,message,link)
        select p.id,'inventory_shortage','Պահեստում նյութը չի բավարարում',
          coalesce(ord.order_number,p_order_id::text)||' · '||item.name||' · պակաս '||shortage||' '||item.unit,
          'inventory.html'
        from public.profiles p
        where p.role='admin'
          and not exists(
            select 1 from public.notifications n
            where n.recipient_id=p.id and n.type='inventory_shortage'
              and n.message like coalesce(ord.order_number,p_order_id::text)||' · '||item.name||'%'
              and n.created_at>now()-interval '12 hours'
          );
      exception when others then null; end;
    end if;

    out:=out||jsonb_build_array(jsonb_build_object(
      'item_id',item.id,'item_name',item.name,'planned',planned,'reserved',reserve_qty,
      'available_before',available,'status',alloc_status
    ));
  end loop;

  return jsonb_build_object('ok',true,'order_id',p_order_id,'allocations',out);
end $$;

-- ------------------------------------------------------------
-- 6) Consume reserved material when production begins
-- ------------------------------------------------------------
create or replace function public.gd_inventory_consume_order(p_order_id uuid,p_stage text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
declare
  ord record;
  a record;
  item record;
  needed numeric;
  other_reserved numeric;
  available_for_this numeric;
  before_qty numeric;
  after_qty numeric;
  out jsonb:='[]'::jsonb;
begin
  select id,order_number,status,workflow_stage into ord
  from public.orders where id=p_order_id;
  if not found then return jsonb_build_object('ok',false,'reason','order_not_found'); end if;
  if coalesce(ord.status,'')='cancelled' or coalesce(ord.workflow_stage,'')='cancelled' then
    return jsonb_build_object('ok',false,'reason','cancelled');
  end if;

  -- Re-plan immediately before consumption so newly replenished stock can satisfy shortages.
  perform public.gd_inventory_plan_order(p_order_id);

  for a in
    select a.*,r.consume_stage,r.label
    from public.order_inventory_allocations a
    join public.service_inventory_rules r on r.id=a.rule_id
    where a.order_id=p_order_id
      and r.active=true
      and r.consume_stage=p_stage
      and a.status in ('reserved','shortage')
    order by a.created_at,a.id
  loop
    needed:=greatest(0,a.planned_quantity-a.consumed_quantity);
    if needed<=0 then continue; end if;

    select * into item from public.inventory_items where id=a.item_id for update;
    if not found then continue; end if;

    select coalesce(sum(x.reserved_quantity),0) into other_reserved
    from public.order_inventory_allocations x
    where x.item_id=item.id
      and x.order_id<>p_order_id
      and x.status in ('reserved','shortage')
      and x.reserved_quantity>0;

    available_for_this:=greatest(0,item.quantity-other_reserved);
    if available_for_this < needed then
      update public.order_inventory_allocations
        set status='shortage',reserved_quantity=least(needed,available_for_this),
            note='Արտադրության պահին պակաս՝ '||(needed-available_for_this)||' '||item.unit
      where id=a.id;
      begin
        insert into public.notifications(recipient_id,type,title,message,link)
        select p.id,'inventory_shortage','Արտադրությունը սպասում է նյութի',
          coalesce(ord.order_number,p_order_id::text)||' · '||item.name||' · անհրաժեշտ '||needed||' '||item.unit||', հասանելի '||available_for_this,
          'inventory.html'
        from public.profiles p where p.role='admin';
      exception when others then null; end;
      out:=out||jsonb_build_array(jsonb_build_object('item',item.name,'status','shortage','needed',needed,'available',available_for_this));
      continue;
    end if;

    before_qty:=item.quantity;
    after_qty:=before_qty-needed;
    update public.inventory_items set quantity=after_qty,updated_at=now() where id=item.id;

    insert into public.inventory_movements(
      item_id,direction,quantity,balance_before,balance_after,note,created_by,order_id,allocation_id,movement_type
    ) values(
      item.id,'out',needed,before_qty,after_qty,
      'Ավտոմատ ելք · պատվեր '||coalesce(ord.order_number,p_order_id::text),
      auth.uid(),p_order_id,a.id,'order_consumption'
    );

    update public.order_inventory_allocations
      set consumed_quantity=consumed_quantity+needed,reserved_quantity=0,status='consumed',
          note='Արտադրության համար դուրս է գրվել պահեստից'
    where id=a.id;

    if after_qty<=coalesce(item.min_stock,0) then
      begin
        insert into public.notifications(recipient_id,type,title,message,link)
        select p.id,'inventory_low_stock','Պահեստում քիչ մնացորդ',
          item.name||' · մնացորդ '||after_qty||' '||item.unit,
          'inventory.html'
        from public.profiles p where p.role='admin';
      exception when others then null; end;
    end if;

    out:=out||jsonb_build_array(jsonb_build_object('item',item.name,'status','consumed','quantity',needed,'balance_after',after_qty));
  end loop;

  return jsonb_build_object('ok',true,'stage',p_stage,'results',out);
end $$;

-- ------------------------------------------------------------
-- 7) Waste / reprint stock usage
-- ------------------------------------------------------------
create or replace function public.gd_inventory_record_waste(
  p_order_id uuid,p_stage text,p_waste_units numeric,p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
declare a record; item record; extra numeric; before_qty numeric; after_qty numeric; out jsonb:='[]'::jsonb;
begin
  if p_waste_units is null or p_waste_units<=0 then return jsonb_build_object('ok',true,'skipped',true); end if;

  for a in
    select a.*,r.multiplier,r.calculation_type,r.consume_stage,o.order_number
    from public.order_inventory_allocations a
    join public.service_inventory_rules r on r.id=a.rule_id
    join public.orders o on o.id=a.order_id
    where a.order_id=p_order_id
      and r.active=true
      and r.consume_stage=p_stage
      and r.calculation_type='quantity'
      and a.status='consumed'
  loop
    extra:=round(p_waste_units*a.multiplier,4);
    if extra<=0 then continue; end if;
    select * into item from public.inventory_items where id=a.item_id for update;
    if not found then continue; end if;

    if item.quantity<extra then
      begin
        insert into public.notifications(recipient_id,type,title,message,link)
        select p.id,'inventory_shortage','Խոտանի համար նյութը չի բավարարում',
          coalesce(a.order_number,p_order_id::text)||' · '||item.name||' · անհրաժեշտ '||extra||' '||item.unit,
          'inventory.html'
        from public.profiles p where p.role='admin';
      exception when others then null; end;
      out:=out||jsonb_build_array(jsonb_build_object('item',item.name,'status','shortage','quantity',extra));
      continue;
    end if;

    before_qty:=item.quantity; after_qty:=before_qty-extra;
    update public.inventory_items set quantity=after_qty,updated_at=now() where id=item.id;
    insert into public.inventory_movements(
      item_id,direction,quantity,balance_before,balance_after,note,created_by,order_id,allocation_id,movement_type
    ) values(
      item.id,'out',extra,before_qty,after_qty,
      'Խոտան / վերատպում · պատվեր '||coalesce(a.order_number,p_order_id::text)||coalesce(' · '||nullif(btrim(p_note),''),''),
      auth.uid(),p_order_id,a.id,'waste'
    );
    update public.order_inventory_allocations set waste_quantity=waste_quantity+extra where id=a.id;
    out:=out||jsonb_build_array(jsonb_build_object('item',item.name,'status','consumed','waste',extra,'balance_after',after_qty));
  end loop;
  return jsonb_build_object('ok',true,'results',out);
end $$;

-- ------------------------------------------------------------
-- 8) Triggers: details → reserve, production → consume, cancel → release
-- ------------------------------------------------------------
create or replace function public.trg_gd_inventory_plan_order()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
begin
  perform public.gd_inventory_plan_order(new.order_id);
  return new;
end $$;

drop trigger if exists trg_order_details_inventory_plan on public.order_details;
create trigger trg_order_details_inventory_plan
after insert or update of details on public.order_details
for each row execute function public.trg_gd_inventory_plan_order();

create or replace function public.trg_gd_inventory_order_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_catalog
set row_security=off
as $$
begin
  if (new.status='cancelled' and old.status is distinct from new.status)
     or (new.workflow_stage='cancelled' and old.workflow_stage is distinct from new.workflow_stage) then
    update public.order_inventory_allocations
      set status='released',reserved_quantity=0,note='Պատվերը չեղարկվել է՝ պահուստը ազատվել է'
    where order_id=new.id and status in ('reserved','shortage') and consumed_quantity=0;
    return new;
  end if;

  if new.workflow_stage is distinct from old.workflow_stage
     and new.workflow_stage in ('prepress','digital_print','large_format','finishing','quality_control','packing','delivery') then
    perform public.gd_inventory_consume_order(new.id,new.workflow_stage);
  elsif new.status is distinct from old.status and new.status='printing' then
    perform public.gd_inventory_consume_order(new.id,'digital_print');
    perform public.gd_inventory_consume_order(new.id,'large_format');
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_inventory_state on public.orders;
create trigger trg_orders_inventory_state
after update of workflow_stage,status on public.orders
for each row execute function public.trg_gd_inventory_order_state();

-- ------------------------------------------------------------
-- 9) Override production action to account for declared defect/reprint waste
-- ------------------------------------------------------------
create or replace function public.staff_record_production_action(
  p_order_id uuid,p_action text,p_quantity numeric default null,p_waste numeric default null,p_material text default null,p_note text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r text; aid uuid; old_stage text; next_stage text;
begin
 select role into r from public.profiles where id=auth.uid() and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active';
 if r not in ('digital_print','large_format','finishing') then raise exception 'Production operator access required'; end if;

 if r='digital_print' and p_action not in ('start','pause','printed','reprint','defect','completed') then raise exception 'Action is not allowed for Digital Print'; end if;
 if r='large_format' and p_action not in ('start','pause','printed','cut','laminated','defect','completed') then raise exception 'Action is not allowed for Large Format'; end if;
 if r='finishing' and p_action not in ('start','pause','cutting','lamination','folding','creasing','stitching','gluing','perforation','packing','defect','completed') then raise exception 'Action is not allowed for Finishing'; end if;

 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and stage=(case r when 'digital_print' then 'digital_print' when 'large_format' then 'large_format' when 'finishing' then 'finishing' end) and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to your department'; end if;
 select workflow_stage into old_stage from public.orders where id=p_order_id for update;

 insert into public.production_job_logs(order_id,assignment_id,actor_id,role,action,quantity,waste_quantity,material,note)
 values(p_order_id,aid,auth.uid(),r,p_action,p_quantity,p_waste,nullif(trim(coalesce(p_material,'')),''),nullif(trim(coalesce(p_note,'')),''));

 -- Any real production action (except pause) verifies that planned material
 -- has already been physically consumed. The function is idempotent.
 if p_action<>'pause' then
   perform public.gd_inventory_consume_order(p_order_id,r);
 end if;

 if p_action='start' then
   perform public.gd_set_assignment_status(aid,'in_progress',p_note);
 elsif p_action='pause' then
   perform public.gd_set_assignment_status(aid,'waiting',p_note);
 elsif p_action='completed' then
   perform public.gd_set_assignment_status(aid,'completed',p_note);
   next_stage := case when r in ('digital_print','large_format') then 'finishing' when exists(select 1 from public.profiles p where p.role='quality_control' and coalesce(p.approval_status,'approved')='approved' and coalesce(p.account_status,'active')='active') then 'quality_control' else 'packing' end;
   update public.orders set workflow_stage=next_stage where id=p_order_id;
   perform public.gd_log_workflow(p_order_id,old_stage,next_stage,'staff_handoff',p_note);
 elsif p_action in ('printed','cut','laminated','reprint','defect','cutting','lamination','folding','creasing','stitching','gluing','perforation','packing') then
   perform public.gd_set_assignment_status(aid,'in_progress',p_note);
 end if;

 if p_action in ('defect','reprint') and coalesce(p_waste,0)>0 then
   perform public.gd_inventory_record_waste(p_order_id,r,p_waste,p_note);
 end if;

 return jsonb_build_object('ok',true,'next_stage',next_stage);
end $$;
revoke all on function public.staff_record_production_action(uuid,text,numeric,numeric,text,text) from public;
grant execute on function public.staff_record_production_action(uuid,text,numeric,numeric,text,text) to authenticated;

-- ------------------------------------------------------------
-- 10) Protect manual stock movement from consuming order reservations
-- ------------------------------------------------------------
create or replace function public.inventory_move_stock(
  p_item_id uuid,p_direction text,p_quantity numeric,p_note text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog set row_security=off as $$
declare v_before numeric(14,3); v_after numeric(14,3); v_role text; v_reserved numeric(14,4);
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or not (public.is_admin() or (v_role='warehouse' and public.is_staff())) then raise exception 'Warehouse/Admin access required'; end if;
  if p_direction not in ('in','out') then raise exception 'Invalid movement direction'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;

  select quantity into v_before from public.inventory_items where id=p_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  select coalesce(sum(reserved_quantity),0) into v_reserved
  from public.order_inventory_allocations
  where item_id=p_item_id and status in ('reserved','shortage') and reserved_quantity>0;

  v_after:=case when p_direction='in' then v_before+p_quantity else v_before-p_quantity end;
  if v_after<0 then raise exception 'Insufficient stock'; end if;
  if p_direction='out' and v_after<v_reserved then
    raise exception 'Այս նյութից % միավոր պահուստավորված է պատվերների համար։ Ազատ հասանելի մնացորդը % է։',v_reserved,greatest(0,v_before-v_reserved);
  end if;

  update public.inventory_items set quantity=v_after,updated_at=now() where id=p_item_id;
  insert into public.inventory_movements(item_id,direction,quantity,balance_before,balance_after,note,created_by,movement_type)
  values(p_item_id,p_direction,p_quantity,v_before,v_after,nullif(trim(coalesce(p_note,'')),''),auth.uid(),'manual');
  return jsonb_build_object('ok',true,'item_id',p_item_id,'balance_before',v_before,'balance_after',v_after,'reserved',v_reserved,'available_after',v_after-v_reserved);
end $$;
revoke all on function public.inventory_move_stock(uuid,text,numeric,text) from public;
grant execute on function public.inventory_move_stock(uuid,text,numeric,text) to authenticated;

-- ------------------------------------------------------------
-- 11) Admin utilities
-- ------------------------------------------------------------
create or replace function public.admin_inventory_replan_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog set row_security=off as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admin access required'; end if;
  return public.gd_inventory_plan_order(p_order_id);
end $$;

create or replace function public.admin_inventory_retry_consumption(p_order_id uuid,p_stage text)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog set row_security=off as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admin access required'; end if;
  return public.gd_inventory_consume_order(p_order_id,p_stage);
end $$;

revoke all on function public.gd_inventory_plan_order(uuid) from public;
revoke all on function public.gd_inventory_consume_order(uuid,text) from public;
revoke all on function public.gd_inventory_record_waste(uuid,text,numeric,text) from public;
revoke all on function public.admin_inventory_replan_order(uuid) from public;
revoke all on function public.admin_inventory_retry_consumption(uuid,text) from public;
grant execute on function public.admin_inventory_replan_order(uuid) to authenticated;
grant execute on function public.admin_inventory_retry_consumption(uuid,text) to authenticated;

create or replace function public.gd_inventory_automation_health()
returns jsonb language plpgsql stable security definer set search_path=public,pg_catalog set row_security=off as $$
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admin access required'; end if;
  return jsonb_build_object(
    'rules_table',to_regclass('public.service_inventory_rules') is not null,
    'allocations_table',to_regclass('public.order_inventory_allocations') is not null,
    'photo_rules',(select count(*) from public.service_inventory_rules where service_key='photo_printing' and active),
    'photo_items',(select count(*) from public.inventory_items where lower(coalesce(material_type,'')) like '%ֆոտ%' or lower(coalesce(material_type,'')) like '%photo%'),
    'details_trigger',exists(select 1 from pg_trigger where tgname='trg_order_details_inventory_plan' and not tgisinternal),
    'order_state_trigger',exists(select 1 from pg_trigger where tgname='trg_orders_inventory_state' and not tgisinternal),
    'reserved_orders',(select count(*) from public.order_inventory_allocations where status='reserved'),
    'shortages',(select count(*) from public.order_inventory_allocations where status='shortage')
  );
end $$;
revoke all on function public.gd_inventory_automation_health() from public;
grant execute on function public.gd_inventory_automation_health() to authenticated;

-- Force PostgREST schema refresh.
notify pgrst,'reload schema';
