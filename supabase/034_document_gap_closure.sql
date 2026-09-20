-- GDprint v7.2 Phase 7 — ADMIN(1).docx gap closure: customer CRM + manager operations
create table if not exists public.customer_crm_notes(
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 kind text not null default 'note' check(kind in ('note','call','email','whatsapp','viber','discount')),
 note text not null, discount_value numeric(14,2), created_by uuid references public.profiles(id), created_at timestamptz default now()
);
create index if not exists customer_crm_notes_customer_idx on public.customer_crm_notes(customer_id,created_at desc);

create table if not exists public.manager_quote_requests(
 id uuid primary key default gen_random_uuid(), manager_id uuid not null references public.profiles(id) on delete cascade,
 customer_id uuid references public.customers(id) on delete set null, order_id uuid references public.orders(id) on delete set null,
 title text not null, requested_amount numeric(14,2), note text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 approved_amount numeric(14,2), admin_note text, reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz default now()
);
create index if not exists manager_quote_requests_manager_idx on public.manager_quote_requests(manager_id,created_at desc);

alter table public.customer_crm_notes enable row level security;
alter table public.manager_quote_requests enable row level security;

drop policy if exists customer_crm_admin_all on public.customer_crm_notes;
create policy customer_crm_admin_all on public.customer_crm_notes for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists customer_crm_manager_read on public.customer_crm_notes;
create policy customer_crm_manager_read on public.customer_crm_notes for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager'));
drop policy if exists customer_crm_manager_insert on public.customer_crm_notes;
create policy customer_crm_manager_insert on public.customer_crm_notes for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager') and kind in ('note','call','email','whatsapp','viber'));

drop policy if exists quote_admin_all on public.manager_quote_requests;
create policy quote_admin_all on public.manager_quote_requests for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists quote_manager_own on public.manager_quote_requests;
create policy quote_manager_own on public.manager_quote_requests for select to authenticated using(manager_id=auth.uid());
drop policy if exists quote_manager_insert on public.manager_quote_requests;
create policy quote_manager_insert on public.manager_quote_requests for insert to authenticated with check(manager_id=auth.uid() and status='pending');

grant select,insert on public.customer_crm_notes to authenticated;
grant select,insert on public.manager_quote_requests to authenticated;
grant update,delete on public.customer_crm_notes, public.manager_quote_requests to authenticated;
alter table public.orders add column if not exists is_archived boolean not null default false;
alter table public.orders add column if not exists archived_at timestamptz;
create or replace function public.admin_set_order_archived(p_order_id uuid,p_archived boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.orders set is_archived=coalesce(p_archived,false), archived_at=case when p_archived then now() else null end where id=p_order_id;
end $$;
grant execute on function public.admin_set_order_archived(uuid,boolean) to authenticated;
-- Production status semantics required by the document: pause and hand-off completion.
create or replace function public.staff_record_production_action(p_order_id uuid,p_action text,p_quantity numeric default null,p_waste numeric default null,p_material text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r text; aid uuid;
begin
 select role into r from public.profiles where id=auth.uid();
 if r not in ('designer','digital_print','large_format','finishing','quality_control','packing') then raise exception 'Production staff access required'; end if;
 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to you'; end if;
 insert into public.production_job_logs(order_id,assignment_id,actor_id,role,action,quantity,waste_quantity,material,note) values(p_order_id,aid,auth.uid(),r,p_action,p_quantity,p_waste,nullif(trim(coalesce(p_material,'')),''),nullif(trim(coalesce(p_note,'')),''));
 if p_action='start' then perform public.staff_update_assignment(aid,'in_progress',p_note);
 elsif p_action='pause' then perform public.staff_update_assignment(aid,'waiting',p_note);
 elsif p_action='completed' then perform public.staff_update_assignment(aid,'completed',p_note);
 elsif p_action in ('printed','cut','finished','laminated','reprint','defect') then perform public.staff_update_assignment(aid,'in_progress',p_note); end if;
 return jsonb_build_object('ok',true);
end $$;
grant execute on function public.staff_record_production_action(uuid,text,numeric,numeric,text,text) to authenticated;
