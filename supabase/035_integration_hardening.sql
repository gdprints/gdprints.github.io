-- ============================================================
-- GDprint ADMIN v7.3 / Phase 8 — integration hardening
-- Run AFTER 034_document_gap_closure.sql
-- Fixes role drift, missing RPCs, storage access for assigned staff,
-- validates role/stage assignments, connects production hand-offs,
-- and adds an Admin integration health probe + quote approval RPC.
-- ============================================================

-- 1) Quality Control must be accepted by all staff-account paths.
create or replace function public.admin_set_staff_account(
  p_user_id uuid,
  p_role text,
  p_approval_status text,
  p_account_status text,
  p_job_title text default null,
  p_hire_date date default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_old_role text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_user_id=auth.uid() and p_role <> 'admin' then raise exception 'You cannot remove your own admin role'; end if;
  if p_role not in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') then raise exception 'Invalid role'; end if;
  if p_approval_status not in ('pending','approved','rejected') then raise exception 'Invalid approval status'; end if;
  if p_account_status not in ('active','blocked','suspended','disabled','terminated') then raise exception 'Invalid account status'; end if;

  select role into v_old_role from public.profiles where id=p_user_id;
  if v_old_role is null then raise exception 'Profile not found'; end if;

  update public.profiles
     set role=p_role,
         approval_status=p_approval_status,
         account_status=p_account_status,
         job_title=nullif(trim(coalesce(p_job_title,'')),''),
         hire_date=p_hire_date,
         employee_id=coalesce(employee_id,public.gd_next_employee_id())
   where id=p_user_id;

  begin
    insert into public.activity_log(actor_id,action,target_table,target_id)
    values(auth.uid(),'Աշխատակցի հաշիվ՝ role='||p_role||', approval='||p_approval_status||', status='||p_account_status,'profiles',p_user_id);
  exception when others then null; end;

  return jsonb_build_object('ok',true,'old_role',v_old_role,'new_role',p_role);
end $$;
revoke all on function public.admin_set_staff_account(uuid,text,text,text,text,date) from public;
grant execute on function public.admin_set_staff_account(uuid,text,text,text,text,date) to authenticated;

-- 2) Push subscriptions: QC was added after the original role constraint/function.
alter table if exists public.staff_push_subscriptions drop constraint if exists staff_push_subscriptions_role_check;
alter table if exists public.staff_push_subscriptions add constraint staff_push_subscriptions_role_check check(
 role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')
);

create or replace function public.save_staff_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_role text; rid uuid;
begin
 select role into v_role from public.profiles where id=auth.uid()
   and role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')
   and coalesce(approval_status,'approved')='approved'
   and coalesce(account_status,'active')='active';
 if v_role is null then raise exception 'Staff access required'; end if;
 if coalesce(trim(p_endpoint),'')='' then raise exception 'Push endpoint required'; end if;
 insert into public.staff_push_subscriptions(user_id,role,endpoint,p256dh,auth,user_agent)
 values(auth.uid(),v_role,p_endpoint,p_p256dh,p_auth,left(coalesce(p_user_agent,''),500))
 on conflict(endpoint) do update set user_id=excluded.user_id,role=excluded.role,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,last_seen_at=now()
 returning id into rid;
 return rid;
end $$;
revoke all on function public.save_staff_push_subscription(text,text,text,text) from public;
grant execute on function public.save_staff_push_subscription(text,text,text,text) to authenticated;

-- 3) Assigned production staff must be able to upload to the staff path used by staff.js.
drop policy if exists assigned_staff_upload_storage on storage.objects;
create policy assigned_staff_upload_storage on storage.objects
for insert to authenticated
with check(
  bucket_id='customer-order-files'
  and (storage.foldername(name))[1]=auth.uid()::text
  and (storage.foldername(name))[2]='staff'
  and array_length(storage.foldername(name),1) >= 3
  and (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_assigned_to_order(((storage.foldername(name))[3])::uuid)
  and public.current_staff_role() in ('designer','digital_print','large_format','finishing','packing')
);

-- 4) Admin task assignment must match employee role, preventing cross-department leakage.
create or replace function public.admin_create_staff_assignment(
  p_assignee_id uuid,p_order_id uuid,p_stage text,p_title text,p_notes text default null,
  p_priority text default 'normal',p_deadline timestamptz default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid; v_role text; v_expected text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_stage not in ('intake','prepress','digital_print','large_format','finishing','quality_control','packing','delivery','warehouse','finance','it_support') then raise exception 'Invalid stage'; end if;
  if p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
  if coalesce(trim(p_title),'')='' then raise exception 'Task title is required'; end if;

  select role into v_role from public.profiles
   where id=p_assignee_id
     and coalesce(approval_status,'approved')='approved'
     and coalesce(account_status,'active')='active';
  if v_role is null then raise exception 'Employee is not active'; end if;

  v_expected := case v_role
    when 'manager' then 'intake'
    when 'designer' then 'prepress'
    when 'digital_print' then 'digital_print'
    when 'large_format' then 'large_format'
    when 'finishing' then 'finishing'
    when 'quality_control' then 'quality_control'
    when 'packing' then 'packing'
    when 'courier' then 'delivery'
    when 'warehouse' then 'warehouse'
    when 'finance' then 'finance'
    when 'it_admin' then 'it_support'
    else null end;

  if v_expected is null then raise exception 'This role is not assignable'; end if;
  if p_stage <> v_expected then raise exception 'Stage % does not match employee role % (expected %)',p_stage,v_role,v_expected; end if;
  if p_order_id is not null and not exists(select 1 from public.orders where id=p_order_id) then raise exception 'Order not found'; end if;

  insert into public.staff_assignments(order_id,assignee_id,assigned_by,stage,title,notes,priority,deadline)
  values(p_order_id,p_assignee_id,auth.uid(),p_stage,trim(p_title),nullif(trim(coalesce(p_notes,'')),''),p_priority,p_deadline)
  returning id into rid;
  insert into public.staff_task_events(assignment_id,actor_id,event_type,message) values(rid,auth.uid(),'created','Աշխատանքը նշանակվել է');
  insert into public.notifications(recipient_id,type,title,message,link)
  values(p_assignee_id,'staff_task','Նոր աշխատանք',trim(p_title),'../staff/tasks.html');
  return rid;
end $$;
revoke all on function public.admin_create_staff_assignment(uuid,uuid,text,text,text,text,timestamptz) from public;
grant execute on function public.admin_create_staff_assignment(uuid,uuid,text,text,text,text,timestamptz) to authenticated;

-- 5) Missing compatibility RPC used by the public/manager order forms.
-- Reuses an existing customer by normalized phone first, then email. Existing CRM data is not overwritten by anonymous callers.
create or replace function public.get_or_create_customer(p_full_name text,p_phone text,p_email text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_phone text:=trim(coalesce(p_phone,'')); v_email text:=lower(trim(coalesce(p_email,''))); v_name text:=trim(coalesce(p_full_name,''));
begin
  if v_name='' then raise exception 'Full name is required'; end if;
  if v_phone='' then raise exception 'Phone is required'; end if;

  select id into v_id from public.customers
   where regexp_replace(coalesce(phone,''),'[^0-9+]','','g')=regexp_replace(v_phone,'[^0-9+]','','g')
   order by created_at nulls last limit 1;
  if v_id is not null then return v_id; end if;

  if v_email<>'' then
    select id into v_id from public.customers where lower(coalesce(email,''))=v_email order by created_at nulls last limit 1;
    if v_id is not null then return v_id; end if;
  end if;

  insert into public.customers(full_name,phone,email)
  values(v_name,v_phone,nullif(v_email,'')) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.get_or_create_customer(text,text,text) from public;
grant execute on function public.get_or_create_customer(text,text,text) to anon,authenticated;

-- 6) Missing Manager dashboard leaderboard RPC.
-- Older GDprint/Supabase installs may already have this function with a different
-- RETURNS TABLE / OUT signature. PostgreSQL cannot change that signature with
-- CREATE OR REPLACE, so drop the zero-argument overload first.
drop function if exists public.get_manager_leaderboard();

create or replace function public.get_manager_leaderboard()
returns table(manager_id uuid,full_name text,orders_this_month bigint,revenue_this_month numeric)
language plpgsql stable security definer set search_path=public as $$
begin
  if not (public.is_admin() or public.current_staff_role()='manager') then raise exception 'Staff access required'; end if;
  return query
  select p.id,p.full_name,
    count(o.id) filter(where o.created_at>=date_trunc('month',now()) and coalesce(o.status,'')<>'cancelled')::bigint,
    coalesce(sum(o.total_amount) filter(where o.created_at>=date_trunc('month',now()) and coalesce(o.status,'')<>'cancelled'),0)::numeric
  from public.profiles p
  left join public.orders o on o.created_by_manager_id=p.id
  where p.role='manager' and coalesce(p.approval_status,'approved')='approved' and coalesce(p.account_status,'active')='active'
  group by p.id,p.full_name
  order by 4 desc,3 desc,p.full_name;
end $$;
revoke all on function public.get_manager_leaderboard() from public;
grant execute on function public.get_manager_leaderboard() to authenticated;

-- 7) Explicit workflow audit history.
create table if not exists public.order_workflow_history(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 from_stage text,
 to_stage text not null,
 actor_id uuid references public.profiles(id) on delete set null,
 source text not null default 'system',
 note text,
 created_at timestamptz not null default now()
);
create index if not exists order_workflow_history_order_idx on public.order_workflow_history(order_id,created_at desc);
alter table public.order_workflow_history enable row level security;
drop policy if exists workflow_history_admin_read on public.order_workflow_history;
create policy workflow_history_admin_read on public.order_workflow_history for select to authenticated using(public.is_admin());
drop policy if exists workflow_history_assigned_read on public.order_workflow_history;
create policy workflow_history_assigned_read on public.order_workflow_history for select to authenticated using(public.is_assigned_to_order(order_id));

grant select on public.order_workflow_history to authenticated;

create or replace function public.gd_log_workflow(p_order_id uuid,p_from text,p_to text,p_source text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_to is distinct from p_from then
   insert into public.order_workflow_history(order_id,from_stage,to_stage,actor_id,source,note)
   values(p_order_id,p_from,p_to,auth.uid(),coalesce(nullif(p_source,''),'system'),nullif(trim(coalesce(p_note,'')),''));
 end if;
end $$;
revoke all on function public.gd_log_workflow(uuid,text,text,text,text) from public,anon,authenticated;

-- Admin stage changes now always create workflow history.
create or replace function public.admin_set_order_workflow(p_order_id uuid,p_stage text,p_priority text,p_deadline timestamptz,p_internal_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_old text;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_stage not in ('intake','approval','prepress','digital_print','large_format','finishing','quality_control','packing','delivery','completed','cancelled') then raise exception 'Invalid stage'; end if;
 if p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
 select workflow_stage into v_old from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order not found'; end if;
 update public.orders set workflow_stage=p_stage,priority=p_priority,deadline=p_deadline,internal_notes=nullif(trim(coalesce(p_internal_notes,'')),'') where id=p_order_id;
 perform public.gd_log_workflow(p_order_id,v_old,p_stage,'admin',p_internal_notes);
 begin insert into public.activity_log(actor_id,action,target_table,target_id) values(auth.uid(),'Workflow → '||p_stage||' / priority='||p_priority,'orders',p_order_id); exception when others then null; end;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_set_order_workflow(uuid,text,text,timestamptz,text) from public;
grant execute on function public.admin_set_order_workflow(uuid,text,text,timestamptz,text) to authenticated;

-- Generic assignment status is kept for ordinary tasks, but production completion must go through its department workflow.
create or replace function public.gd_set_assignment_status(p_assignment_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v public.staff_assignments%rowtype;
begin
  if p_status not in ('assigned','in_progress','waiting','completed','cancelled') then raise exception 'Invalid status'; end if;
  select * into v from public.staff_assignments where id=p_assignment_id for update;
  if v.id is null then raise exception 'Task not found'; end if;
  update public.staff_assignments set
    status=p_status,
    started_at=case when p_status='in_progress' and started_at is null then now() else started_at end,
    completed_at=case when p_status='completed' then now() when p_status<>'completed' then null else completed_at end
  where id=p_assignment_id;
  insert into public.staff_task_events(assignment_id,actor_id,event_type,message)
  values(p_assignment_id,auth.uid(),'status_change',nullif(trim(coalesce(p_note,'')),''));
  begin insert into public.activity_log(actor_id,action,target_table,target_id)
    values(auth.uid(),'Աշխատանքի կարգավիճակ → '||p_status,'staff_assignments',p_assignment_id); exception when others then null; end;
end $$;
revoke all on function public.gd_set_assignment_status(uuid,text,text) from public,anon,authenticated;

create or replace function public.staff_update_assignment(p_assignment_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.staff_assignments%rowtype;
begin
  if p_status not in ('assigned','in_progress','waiting','completed','cancelled') then raise exception 'Invalid status'; end if;
  select * into v from public.staff_assignments where id=p_assignment_id for update;
  if v.id is null then raise exception 'Task not found'; end if;
  if not public.is_admin() and v.assignee_id<>auth.uid() then raise exception 'Access denied'; end if;
  if not public.is_admin() and not public.is_staff() then raise exception 'Staff access required'; end if;
  if not public.is_admin() and p_status='cancelled' then raise exception 'Only Admin can cancel an assignment'; end if;
  if not public.is_admin() and p_status='completed' and v.stage in ('digital_print','large_format','finishing','quality_control','packing','delivery') then
    raise exception 'Complete this production task from the department workspace so the order moves to the next stage';
  end if;
  perform public.gd_set_assignment_status(p_assignment_id,p_status,p_note);
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.staff_update_assignment(uuid,text,text) from public;
grant execute on function public.staff_update_assignment(uuid,text,text) to authenticated;

-- 8) Production actions are role-specific and hand off the order to the next department.
create or replace function public.staff_record_production_action(p_order_id uuid,p_action text,p_quantity numeric default null,p_waste numeric default null,p_material text default null,p_note text default null)
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

 if p_action='start' then perform public.gd_set_assignment_status(aid,'in_progress',p_note);
 elsif p_action='pause' then perform public.gd_set_assignment_status(aid,'waiting',p_note);
 elsif p_action='completed' then
   perform public.gd_set_assignment_status(aid,'completed',p_note);
   next_stage := case when r in ('digital_print','large_format') then 'finishing' when exists(select 1 from public.profiles p where p.role='quality_control' and coalesce(p.approval_status,'approved')='approved' and coalesce(p.account_status,'active')='active') then 'quality_control' else 'packing' end;
   update public.orders set workflow_stage=next_stage where id=p_order_id;
   perform public.gd_log_workflow(p_order_id,old_stage,next_stage,'staff_handoff',p_note);
 elsif p_action in ('printed','cut','laminated','reprint','defect','cutting','lamination','folding','creasing','stitching','gluing','perforation','packing') then
   perform public.gd_set_assignment_status(aid,'in_progress',p_note);
 end if;
 return jsonb_build_object('ok',true,'next_stage',next_stage);
end $$;
revoke all on function public.staff_record_production_action(uuid,text,numeric,numeric,text,text) from public;
grant execute on function public.staff_record_production_action(uuid,text,numeric,numeric,text,text) to authenticated;

-- QC approval -> packing; rework -> selected production stage.
create or replace function public.staff_save_quality_check(p_order_id uuid,p_quantity boolean,p_size boolean,p_color boolean,p_finishing boolean,p_result text,p_return_stage text default null,p_defect numeric default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid; old_stage text; target_stage text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='quality_control' and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active') then raise exception 'Quality Control access required'; end if;
 if p_result not in ('approved','rework') then raise exception 'Invalid result'; end if;
 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and stage='quality_control' and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to Quality Control'; end if;
 select workflow_stage into old_stage from public.orders where id=p_order_id for update;

 if p_result='approved' and not (coalesce(p_quantity,false) and coalesce(p_size,false) and coalesce(p_color,false) and coalesce(p_finishing,false)) then raise exception 'All quality checks must pass before approval'; end if;
 if p_result='approved' then target_stage:='packing';
 else
   target_stage:=case p_return_stage when 'designer' then 'prepress' else p_return_stage end;
   if target_stage not in ('prepress','digital_print','large_format','finishing') then raise exception 'Invalid return stage'; end if;
 end if;

 insert into public.quality_checks(order_id,actor_id,quantity_ok,size_ok,color_ok,finishing_ok,result,return_stage,defect_quantity,reason)
 values(p_order_id,auth.uid(),p_quantity,p_size,p_color,p_finishing,p_result,target_stage,p_defect,nullif(trim(coalesce(p_reason,'')),''));
 perform public.gd_set_assignment_status(aid,case when p_result='approved' then 'completed' else 'waiting' end,p_reason);
 update public.orders set workflow_stage=target_stage where id=p_order_id;
 perform public.gd_log_workflow(p_order_id,old_stage,target_stage,'quality_control',p_reason);
 return jsonb_build_object('ok',true,'next_stage',target_stage);
end $$;
revoke all on function public.staff_save_quality_check(uuid,boolean,boolean,boolean,boolean,text,text,numeric,text) from public;
grant execute on function public.staff_save_quality_check(uuid,boolean,boolean,boolean,boolean,text,text,numeric,text) to authenticated;

-- Packing ready -> delivery.
create or replace function public.staff_save_packing_check(p_order_id uuid,p_quantity boolean,p_quality boolean,p_packed boolean,p_ready boolean,p_packages integer,p_label text default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare aid uuid; old_stage text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='packing' and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active') then raise exception 'Packing access required'; end if;
 select id into aid from public.staff_assignments where order_id=p_order_id and assignee_id=auth.uid() and stage='packing' and status<>'cancelled' order by created_at desc limit 1;
 if aid is null then raise exception 'Order is not assigned to Packing'; end if;
 if p_packages is not null and p_packages<1 then raise exception 'Package count must be positive'; end if;
 if p_ready and not (coalesce(p_quantity,false) and coalesce(p_quality,false) and coalesce(p_packed,false) and coalesce(p_packages,0)>=1) then raise exception 'Quantity, quality, packing and package count must be confirmed before delivery'; end if;
 insert into public.packing_checks(order_id,actor_id,quantity_checked,quality_checked,packed,ready_for_delivery,package_count,label_code,note)
 values(p_order_id,auth.uid(),p_quantity,p_quality,p_packed,p_ready,p_packages,nullif(trim(coalesce(p_label,'')),''),nullif(trim(coalesce(p_note,'')),''));
 if p_ready then
   select workflow_stage into old_stage from public.orders where id=p_order_id for update;
   perform public.gd_set_assignment_status(aid,'completed',p_note);
   update public.orders set workflow_stage='delivery',status=case when status in ('cancelled','delivered') then status else 'ready' end where id=p_order_id;
   perform public.gd_log_workflow(p_order_id,old_stage,'delivery','packing',p_note);
 end if;
 return jsonb_build_object('ok',true,'next_stage',case when p_ready then 'delivery' else null end);
end $$;
revoke all on function public.staff_save_packing_check(uuid,boolean,boolean,boolean,boolean,integer,text,text) from public;
grant execute on function public.staff_save_packing_check(uuid,boolean,boolean,boolean,boolean,integer,text,text) to authenticated;

-- Courier delivered -> workflow completed + customer-visible delivered status.
create or replace function public.courier_record_event(p_assignment_id uuid,p_event text,p_note text default null,p_payment numeric default 0)
returns void language plpgsql security definer set search_path=public as $$
declare a public.staff_assignments%rowtype; old_stage text;
begin
 select * into a from public.staff_assignments where id=p_assignment_id and assignee_id=auth.uid() and stage='delivery';
 if not found or public.current_staff_role()<>'courier' then raise exception 'Not allowed'; end if;
 if p_event not in ('started','arrived','delivered','customer_absent','wrong_address','returned','not_delivered','payment') then raise exception 'Invalid delivery event'; end if;
 if coalesce(p_payment,0)<0 then raise exception 'Invalid payment'; end if;
 insert into public.delivery_events(assignment_id,order_id,courier_id,event_type,note,payment_amount) values(a.id,a.order_id,auth.uid(),p_event,p_note,coalesce(p_payment,0));
 if p_event='started' then update public.staff_assignments set status='in_progress',started_at=coalesce(started_at,now()) where id=a.id;
 elsif p_event='delivered' then
   update public.staff_assignments set status='completed',completed_at=now() where id=a.id;
   select workflow_stage into old_stage from public.orders where id=a.order_id for update;
   update public.orders set workflow_stage='completed',status='delivered' where id=a.order_id;
   perform public.gd_log_workflow(a.order_id,old_stage,'completed','courier',p_note);
 elsif p_event in ('customer_absent','wrong_address','returned','not_delivered') then update public.staff_assignments set status='waiting' where id=a.id; end if;
 if coalesce(p_payment,0)>0 then insert into public.finance_transactions(order_id,kind,method,amount,note,created_by) values(a.order_id,'payment','delivery_payment',p_payment,'Courier collection',auth.uid()); end if;
end $$;
revoke all on function public.courier_record_event(uuid,text,text,numeric) from public;
grant execute on function public.courier_record_event(uuid,text,text,numeric) to authenticated;

-- 9) Admin review path for Manager price quote requests.
create or replace function public.admin_review_manager_quote(p_quote_id uuid,p_status text,p_approved_amount numeric default null,p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.manager_quote_requests%rowtype;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;
 if p_status='approved' and (p_approved_amount is null or p_approved_amount<0) then raise exception 'Approved amount is required'; end if;
 select * into q from public.manager_quote_requests where id=p_quote_id for update;
 if q.id is null then raise exception 'Quote request not found'; end if;
 update public.manager_quote_requests set status=p_status,approved_amount=case when p_status='approved' then p_approved_amount else null end,admin_note=nullif(trim(coalesce(p_admin_note,'')),''),reviewed_by=auth.uid(),reviewed_at=now() where id=p_quote_id;
 insert into public.notifications(recipient_id,type,title,message,link)
 values(q.manager_id,'quote_review',case when p_status='approved' then 'Գնային առաջարկը հաստատվել է' else 'Գնային առաջարկը մերժվել է' end,
        case when p_status='approved' then q.title||' — '||p_approved_amount||' AMD' else q.title||coalesce(' — '||nullif(trim(coalesce(p_admin_note,'')),''),'') end,
        'workspace.html');
 return jsonb_build_object('ok',true,'status',p_status,'approved_amount',p_approved_amount);
end $$;
revoke all on function public.admin_review_manager_quote(uuid,text,numeric,text) from public;
grant execute on function public.admin_review_manager_quote(uuid,text,numeric,text) to authenticated;

-- 10) Admin integration health snapshot used by System Center.
create or replace function public.admin_integration_health()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb; mismatch bigint; missing_ids bigint; open_late bigint; pending_quotes bigint;
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 select count(*) into mismatch
 from public.staff_assignments a join public.profiles p on p.id=a.assignee_id
 where a.status<>'cancelled' and a.stage is distinct from case p.role
   when 'manager' then 'intake' when 'designer' then 'prepress' when 'digital_print' then 'digital_print'
   when 'large_format' then 'large_format' when 'finishing' then 'finishing' when 'quality_control' then 'quality_control'
   when 'packing' then 'packing' when 'courier' then 'delivery' when 'warehouse' then 'warehouse'
   when 'finance' then 'finance' when 'it_admin' then 'it_support' else a.stage end;
 select count(*) into missing_ids from public.profiles where role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') and employee_id is null;
 select count(*) into open_late from public.staff_assignments where status not in ('completed','cancelled') and deadline<now();
 select count(*) into pending_quotes from public.manager_quote_requests where status='pending';
 r:=jsonb_build_object(
   'phase','7.3 / Phase 8',
   'role_stage_mismatches',mismatch,
   'staff_missing_employee_id',missing_ids,
   'late_open_tasks',open_late,
   'pending_quote_requests',pending_quotes,
   'orders_without_workflow_stage',(select count(*) from public.orders where workflow_stage is null),
   'active_staff',(select count(*) from public.profiles where role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active'),
   'workflow_history_rows',(select count(*) from public.order_workflow_history),
   'required_objects',jsonb_build_object(
      'staff_assignments',to_regclass('public.staff_assignments') is not null,
      'production_job_logs',to_regclass('public.production_job_logs') is not null,
      'finance_transactions',to_regclass('public.finance_transactions') is not null,
      'manager_quote_requests',to_regclass('public.manager_quote_requests') is not null,
      'customer_crm_notes',to_regclass('public.customer_crm_notes') is not null,
      'workflow_history',to_regclass('public.order_workflow_history') is not null,
      'leaderboard_rpc',to_regprocedure('public.get_manager_leaderboard()') is not null,
      'customer_rpc',to_regprocedure('public.get_or_create_customer(text,text,text)') is not null
   )
 );
 return r;
end $$;
revoke all on function public.admin_integration_health() from public;
grant execute on function public.admin_integration_health() to authenticated;

notify pgrst,'reload schema';
