-- GDprint ERP Phase 2: Super Admin core workflow / finance / assignment overview
-- Run after 028_quality_control_role.sql

alter table public.orders add column if not exists priority text default 'normal';
alter table public.orders add column if not exists deadline timestamptz;
alter table public.orders add column if not exists internal_notes text;
alter table public.orders add column if not exists workflow_stage text default 'intake';
alter table public.orders add column if not exists final_price_approved_by uuid references public.profiles(id) on delete set null;
alter table public.orders add column if not exists final_price_approved_at timestamptz;

do $$ begin
  alter table public.orders add constraint orders_priority_check check(priority in ('low','normal','high','urgent'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.orders add constraint orders_workflow_stage_check check(workflow_stage in ('intake','approval','prepress','digital_print','large_format','finishing','quality_control','packing','delivery','completed','cancelled'));
exception when duplicate_object then null; end $$;

create table if not exists public.company_expenses(
 id uuid primary key default gen_random_uuid(),
 expense_date date not null default current_date,
 category text not null,
 description text,
 amount numeric(14,2) not null check(amount>=0),
 payment_method text,
 supplier text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.company_expenses enable row level security;
drop policy if exists company_expenses_admin_finance on public.company_expenses;
create policy company_expenses_admin_finance on public.company_expenses for all to authenticated
using(public.is_admin() or public.current_staff_role()='finance')
with check(public.is_admin() or public.current_staff_role()='finance');

create or replace function public.admin_erp_dashboard()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select jsonb_build_object(
  'today_orders', count(*) filter(where created_at::date=current_date),
  'active_orders', count(*) filter(where status not in ('completed','cancelled')),
  'completed_orders', count(*) filter(where status='completed'),
  'today_revenue', coalesce(sum(total_amount) filter(where created_at::date=current_date and status<>'cancelled'),0),
  'month_revenue', coalesce(sum(total_amount) filter(where date_trunc('month',created_at)=date_trunc('month',now()) and status<>'cancelled'),0),
  'unpaid_orders', count(*) filter(where coalesce(payment_status,'unpaid')<>'paid' and status<>'cancelled'),
  'late_orders', count(*) filter(where deadline<now() and status not in ('completed','cancelled'))
 ) into r from public.orders;
 r=r||jsonb_build_object('active_staff',(select count(*) from public.profiles where coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active' and role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')));
 return r;
end $$;
revoke all on function public.admin_erp_dashboard() from public;
grant execute on function public.admin_erp_dashboard() to authenticated;

create or replace function public.admin_set_order_workflow(p_order_id uuid,p_stage text,p_priority text,p_deadline timestamptz,p_internal_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_stage not in ('intake','approval','prepress','digital_print','large_format','finishing','quality_control','packing','delivery','completed','cancelled') then raise exception 'Invalid stage'; end if;
 if p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
 update public.orders set workflow_stage=p_stage,priority=p_priority,deadline=p_deadline,internal_notes=nullif(trim(coalesce(p_internal_notes,'')),'') where id=p_order_id;
 if not found then raise exception 'Order not found'; end if;
 begin insert into public.activity_log(actor_id,action,target_table,target_id) values(auth.uid(),'Workflow → '||p_stage||' / priority='||p_priority,'orders',p_order_id); exception when others then null; end;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_set_order_workflow(uuid,text,text,timestamptz,text) from public;
grant execute on function public.admin_set_order_workflow(uuid,text,text,timestamptz,text) to authenticated;

create or replace function public.admin_approve_final_price(p_order_id uuid,p_total numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_total<0 then raise exception 'Invalid total'; end if;
 update public.orders set total_amount=p_total,final_price_approved_by=auth.uid(),final_price_approved_at=now() where id=p_order_id;
 if not found then raise exception 'Order not found'; end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_approve_final_price(uuid,numeric) from public;
grant execute on function public.admin_approve_final_price(uuid,numeric) to authenticated;
