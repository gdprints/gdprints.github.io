-- GDprint v6.8 Phase 3 — Production staff workspaces
-- Run after 029_admin_erp_core.sql

create table if not exists public.production_job_logs(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 assignment_id uuid references public.staff_assignments(id) on delete set null, actor_id uuid not null references auth.users(id) on delete cascade,
 role text not null, action text not null, quantity numeric, waste_quantity numeric, material text, note text, created_at timestamptz not null default now()
);
create table if not exists public.preflight_checks(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade, size_ok boolean not null default false, bleed_ok boolean not null default false,
 cmyk_ok boolean not null default false, resolution_ok boolean not null default false, fonts_ok boolean not null default false,
 cut_contour_ok boolean not null default false, note text, created_at timestamptz not null default now()
);
create table if not exists public.quality_checks(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade, quantity_ok boolean not null default false, size_ok boolean not null default false,
 color_ok boolean not null default false, finishing_ok boolean not null default false, result text not null check(result in ('approved','rework')),
 return_stage text, defect_quantity numeric, reason text, created_at timestamptz not null default now()
);
create table if not exists public.packing_checks(
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade, quantity_checked boolean not null default false, quality_checked boolean not null default false,
 packed boolean not null default false, ready_for_delivery boolean not null default false, package_count integer, label_code text, note text, created_at timestamptz not null default now()
);
create table if not exists public.equipment_issues(
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id) on delete cascade, order_id uuid references public.orders(id) on delete set null,
 issue_type text not null check(issue_type in ('problem','maintenance','downtime')), equipment_name text, note text not null,
 status text not null default 'open' check(status in ('open','resolved')), created_at timestamptz not null default now(), resolved_at timestamptz
);

alter table public.production_job_logs enable row level security; alter table public.preflight_checks enable row level security;
alter table public.quality_checks enable row level security; alter table public.packing_checks enable row level security; alter table public.equipment_issues enable row level security;

do $$ declare t text; begin foreach t in array array['production_job_logs','preflight_checks','quality_checks','packing_checks','equipment_issues'] loop
 execute format('drop policy if exists %I_admin_all on public.%I',t,t); execute format('create policy %I_admin_all on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t,t);
 execute format('drop policy if exists %I_own_read on public.%I',t,t); execute format('create policy %I_own_read on public.%I for select to authenticated using(actor_id=auth.uid())',t,t);
end loop; end $$;

create or replace function public.staff_production_snapshot()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r text; out jsonb;
begin
 select role into r from public.profiles where id=auth.uid();
 if r not in ('designer','digital_print','large_format','finishing','quality_control','packing') then raise exception 'Production staff access required'; end if;
 select jsonb_build_object(
  'role',r,
  'orders',coalesce(jsonb_agg(jsonb_build_object('assignment_id',a.id,'order_id',o.id,'order_number',o.order_number,'service_key',o.service_key,'service_name',o.service_name,'status',a.status,'priority',a.priority,'deadline',a.deadline,'stage',a.stage,'title',a.title,'notes',a.notes) order by a.created_at desc),'[]'::jsonb)
 ) into out from public.staff_assignments a join public.orders o on o.id=a.order_id where a.assignee_id=auth.uid() and a.status<>'cancelled';
 return coalesce(out,jsonb_build_object('role',r,'orders','[]'::jsonb));
end $$;
grant execute on function public.staff_production_snapshot() to authenticated;

create or replace function public.staff_record_production_action(p_order_id uuid,p_action text,p_quantity numeric default null,p_waste numeric default null,p_material text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r text; aid uuid;
begin
 select role into r from public.profiles where id=auth.uid();
 if r not in ('designer','digital_print','large_format','finishing','quality_control','packing') then raise exception 'Production staff access required'; end if;
 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to you'; end if;
 insert into public.production_job_logs(order_id,assignment_id,actor_id,role,action,quantity,waste_quantity,material,note) values(p_order_id,aid,auth.uid(),r,p_action,p_quantity,p_waste,nullif(trim(coalesce(p_material,'')),''),nullif(trim(coalesce(p_note,'')),''));
 if p_action='start' then perform public.staff_update_assignment(aid,'in_progress',p_note); end if;
 if p_action in ('printed','cut','finished') then perform public.staff_update_assignment(aid,'in_progress',p_note); end if;
 return jsonb_build_object('ok',true);
end $$;
grant execute on function public.staff_record_production_action(uuid,text,numeric,numeric,text,text) to authenticated;

create or replace function public.staff_save_preflight(p_order_id uuid,p_size boolean,p_bleed boolean,p_cmyk boolean,p_resolution boolean,p_fonts boolean,p_cut boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='designer') then raise exception 'Designer access required'; end if;
 if not exists(select 1 from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and status<>'cancelled') then raise exception 'Order is not assigned to you'; end if;
 insert into public.preflight_checks(order_id,actor_id,size_ok,bleed_ok,cmyk_ok,resolution_ok,fonts_ok,cut_contour_ok,note) values(p_order_id,auth.uid(),p_size,p_bleed,p_cmyk,p_resolution,p_fonts,p_cut,nullif(trim(coalesce(p_note,'')),''));
 return jsonb_build_object('ok',true,'ready',p_size and p_bleed and p_cmyk and p_resolution and p_fonts and p_cut);
end $$;
grant execute on function public.staff_save_preflight(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text) to authenticated;

create or replace function public.staff_save_quality_check(p_order_id uuid,p_quantity boolean,p_size boolean,p_color boolean,p_finishing boolean,p_result text,p_return_stage text default null,p_defect numeric default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='quality_control') then raise exception 'Quality Control access required'; end if;
 if p_result not in ('approved','rework') then raise exception 'Invalid result'; end if;
 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to you'; end if;
 insert into public.quality_checks(order_id,actor_id,quantity_ok,size_ok,color_ok,finishing_ok,result,return_stage,defect_quantity,reason) values(p_order_id,auth.uid(),p_quantity,p_size,p_color,p_finishing,p_result,nullif(p_return_stage,''),p_defect,nullif(trim(coalesce(p_reason,'')),''));
 perform public.staff_update_assignment(aid,case when p_result='approved' then 'completed' else 'waiting' end,p_reason);
 return jsonb_build_object('ok',true);
end $$;
grant execute on function public.staff_save_quality_check(uuid,boolean,boolean,boolean,boolean,text,text,numeric,text) to authenticated;

create or replace function public.staff_save_packing_check(p_order_id uuid,p_quantity boolean,p_quality boolean,p_packed boolean,p_ready boolean,p_packages integer,p_label text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='packing') then raise exception 'Packing access required'; end if;
 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to you'; end if;
 insert into public.packing_checks(order_id,actor_id,quantity_checked,quality_checked,packed,ready_for_delivery,package_count,label_code,note) values(p_order_id,auth.uid(),p_quantity,p_quality,p_packed,p_ready,p_packages,nullif(trim(coalesce(p_label,'')),''),nullif(trim(coalesce(p_note,'')),''));
 if p_ready then perform public.staff_update_assignment(aid,'completed',p_note); end if;
 return jsonb_build_object('ok',true);
end $$;
grant execute on function public.staff_save_packing_check(uuid,boolean,boolean,boolean,boolean,integer,text,text) to authenticated;

create or replace function public.staff_report_equipment_issue(p_order_id uuid,p_type text,p_equipment text,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r text;
begin select role into r from public.profiles where id=auth.uid(); if r not in ('digital_print','large_format') then raise exception 'Operator access required'; end if;
 if p_type not in ('problem','maintenance','downtime') then raise exception 'Invalid issue type'; end if;
 insert into public.equipment_issues(actor_id,order_id,issue_type,equipment_name,note) values(auth.uid(),p_order_id,p_type,nullif(trim(coalesce(p_equipment,'')),''),p_note); return jsonb_build_object('ok',true); end $$;
grant execute on function public.staff_report_equipment_issue(uuid,text,text,text) to authenticated;
