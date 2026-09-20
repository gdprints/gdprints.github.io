-- ============================================================
-- GDprint v6.4 — Staff Authentication, RBAC and Production ERP
-- Run ONCE after 023_admin_delete_customer.sql
-- ============================================================
create extension if not exists pgcrypto;

-- ---------- Profiles / employees ----------
alter table public.profiles add column if not exists employee_id text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists hire_date date;
alter table public.profiles add column if not exists requested_role text;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists profile_photo_url text;

-- Expand account state model.
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check
  check (account_status in ('active','blocked','suspended','disabled','terminated'));

-- Expand role model. Remove any legacy CHECK constraint that restricts profiles.role
-- (older project copies may use a different constraint name).
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='profiles' and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I',r.conname);
  end loop;
end $$;

alter table public.profiles add constraint profiles_role_check check (
  role in (
    'admin','manager','designer','digital_print','large_format','finishing',
    'packing','courier','warehouse','finance','it_admin'
  )
);

create sequence if not exists public.gd_employee_number_seq start 1;
create or replace function public.gd_next_employee_id()
returns text language sql volatile as $$
  select 'GD-EMP-' || lpad(nextval('public.gd_employee_number_seq')::text,4,'0');
$$;

update public.profiles
set employee_id = public.gd_next_employee_id()
where employee_id is null
  and role in ('admin','manager','designer','digital_print','large_format','finishing','packing','courier','warehouse','finance','it_admin');

create unique index if not exists profiles_employee_id_uidx on public.profiles(employee_id) where employee_id is not null;

create or replace function public.gd_assign_employee_id()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.employee_id is null and new.role in ('admin','manager','designer','digital_print','large_format','finishing','packing','courier','warehouse','finance','it_admin') then
    new.employee_id := public.gd_next_employee_id();
  end if;
  return new;
end $$;
drop trigger if exists trg_gd_assign_employee_id on public.profiles;
create trigger trg_gd_assign_employee_id before insert or update of role on public.profiles
for each row execute function public.gd_assign_employee_id();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.role in ('admin','manager','designer','digital_print','large_format','finishing','packing','courier','warehouse','finance','it_admin')
      and coalesce(p.approval_status,'approved')='approved'
      and coalesce(p.account_status,'active')='active'
  );
$$;

create or replace function public.current_staff_role()
returns text language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid();
$$;

-- ---------- Production assignments ----------
create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null default auth.uid(),
  stage text not null check (stage in ('intake','prepress','digital_print','large_format','finishing','packing','delivery','warehouse','finance','it_support','quality_control')),
  title text not null,
  notes text,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'assigned' check (status in ('assigned','in_progress','waiting','completed','cancelled')),
  deadline timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_assignments_assignee_idx on public.staff_assignments(assignee_id,status,created_at desc);
create index if not exists staff_assignments_order_idx on public.staff_assignments(order_id,created_at desc);
create index if not exists staff_assignments_deadline_idx on public.staff_assignments(deadline) where status not in ('completed','cancelled');

create table if not exists public.staff_task_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.staff_assignments(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null default auth.uid(),
  event_type text not null,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists staff_task_events_assignment_idx on public.staff_task_events(assignment_id,created_at desc);

create or replace function public.gd_staff_assignment_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_staff_assignment_updated_at on public.staff_assignments;
create trigger trg_staff_assignment_updated_at before update on public.staff_assignments
for each row execute function public.gd_staff_assignment_updated_at();

-- ---------- Staff chat ----------
create table if not exists public.staff_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  message text not null check (length(trim(message)) between 1 and 4000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists staff_chat_recipient_idx on public.staff_chat_messages(recipient_id,is_read,created_at desc);
create index if not exists staff_chat_sender_idx on public.staff_chat_messages(sender_id,created_at desc);

-- ---------- Login history ----------
create table if not exists public.staff_login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_agent text,
  event_type text not null default 'login' check(event_type in ('login','logout','password_reset')),
  created_at timestamptz not null default now()
);
create index if not exists staff_login_history_user_idx on public.staff_login_history(user_id,created_at desc);

-- ---------- RLS ----------
alter table public.staff_assignments enable row level security;
alter table public.staff_task_events enable row level security;
alter table public.staff_chat_messages enable row level security;
alter table public.staff_login_history enable row level security;

drop policy if exists staff_assignments_admin_all on public.staff_assignments;
create policy staff_assignments_admin_all on public.staff_assignments for all to authenticated
using(public.is_admin()) with check(public.is_admin());
drop policy if exists staff_assignments_own_read on public.staff_assignments;
create policy staff_assignments_own_read on public.staff_assignments for select to authenticated
using(assignee_id=auth.uid());

drop policy if exists staff_task_events_admin_all on public.staff_task_events;
create policy staff_task_events_admin_all on public.staff_task_events for all to authenticated
using(public.is_admin()) with check(public.is_admin());
drop policy if exists staff_task_events_own_read on public.staff_task_events;
create policy staff_task_events_own_read on public.staff_task_events for select to authenticated
using(exists(select 1 from public.staff_assignments a where a.id=assignment_id and a.assignee_id=auth.uid()));

drop policy if exists staff_chat_read on public.staff_chat_messages;
create policy staff_chat_read on public.staff_chat_messages for select to authenticated using(
  public.is_admin() or sender_id=auth.uid() or recipient_id=auth.uid() or recipient_id is null
);
drop policy if exists staff_chat_insert on public.staff_chat_messages;
create policy staff_chat_insert on public.staff_chat_messages for insert to authenticated
with check(public.is_staff() and sender_id=auth.uid());
drop policy if exists staff_chat_update_own_received on public.staff_chat_messages;
create policy staff_chat_update_own_received on public.staff_chat_messages for update to authenticated
using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());

drop policy if exists staff_login_history_admin_read on public.staff_login_history;
create policy staff_login_history_admin_read on public.staff_login_history for select to authenticated
using(public.is_admin() or user_id=auth.uid());

-- Staff can read their own profile. Admin can manage staff profiles.
drop policy if exists profiles_staff_read_self on public.profiles;
create policy profiles_staff_read_self on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());

-- Limited staff directory: exposes only non-sensitive fields needed for internal chat.
create or replace function public.staff_directory()
returns table(id uuid,employee_id text,full_name text,role text)
language sql stable security definer set search_path=public as $$
  select p.id,p.employee_id,p.full_name,p.role
  from public.profiles p
  where public.is_staff()
    and coalesce(p.approval_status,'approved')='approved'
    and coalesce(p.account_status,'active')='active'
  order by p.full_name nulls last,p.employee_id;
$$;
revoke all on function public.staff_directory() from public;
grant execute on function public.staff_directory() to authenticated;

-- Staff assignment feed. SECURITY DEFINER exposes only the caller's tasks plus
-- the minimum order metadata required to do the job; it does not open Orders RLS.
create or replace function public.staff_my_assignments()
returns table(
 id uuid,order_id uuid,assignee_id uuid,assigned_by uuid,stage text,title text,notes text,
 priority text,status text,deadline timestamptz,started_at timestamptz,completed_at timestamptz,
 created_at timestamptz,updated_at timestamptz,order_number text,service_key text,order_status text
)
language sql stable security definer set search_path=public as $$
  select a.id,a.order_id,a.assignee_id,a.assigned_by,a.stage,a.title,a.notes,a.priority,a.status,
         a.deadline,a.started_at,a.completed_at,a.created_at,a.updated_at,
         o.order_number,o.service_key,o.status
  from public.staff_assignments a
  left join public.orders o on o.id=a.order_id
  where a.assignee_id=auth.uid() and public.is_staff()
  order by a.created_at desc;
$$;
revoke all on function public.staff_my_assignments() from public;
grant execute on function public.staff_my_assignments() to authenticated;

-- ---------- Secure RPCs ----------
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
  if p_role not in ('admin','manager','designer','digital_print','large_format','finishing','packing','courier','warehouse','finance','it_admin') then raise exception 'Invalid role'; end if;
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

  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_set_staff_account(uuid,text,text,text,text,date) from public;
grant execute on function public.admin_set_staff_account(uuid,text,text,text,text,date) to authenticated;

create or replace function public.admin_delete_staff_account(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_user_id=auth.uid() then raise exception 'You cannot delete your own account'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile not found'; end if;
  delete from auth.users where id=p_user_id;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.admin_delete_staff_account(uuid) from public;
grant execute on function public.admin_delete_staff_account(uuid) to authenticated;

create or replace function public.staff_update_assignment(p_assignment_id uuid,p_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.staff_assignments%rowtype;
begin
  if p_status not in ('assigned','in_progress','waiting','completed','cancelled') then raise exception 'Invalid status'; end if;
  select * into v from public.staff_assignments where id=p_assignment_id for update;
  if v.id is null then raise exception 'Task not found'; end if;
  if not public.is_admin() and v.assignee_id<>auth.uid() then raise exception 'Access denied'; end if;
  if not public.is_admin() and not public.is_staff() then raise exception 'Staff access required'; end if;

  update public.staff_assignments set
    status=p_status,
    started_at=case when p_status='in_progress' and started_at is null then now() else started_at end,
    completed_at=case when p_status='completed' then now() when p_status<>'completed' then null else completed_at end
  where id=p_assignment_id;

  insert into public.staff_task_events(assignment_id,actor_id,event_type,message)
  values(p_assignment_id,auth.uid(),'status_change',nullif(trim(coalesce(p_note,'')),''));

  begin
    insert into public.activity_log(actor_id,action,target_table,target_id)
    values(auth.uid(),'Աշխատանքի կարգավիճակ → '||p_status,'staff_assignments',p_assignment_id);
  exception when others then null; end;

  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.staff_update_assignment(uuid,text,text) from public;
grant execute on function public.staff_update_assignment(uuid,text,text) to authenticated;

create or replace function public.staff_update_profile(p_full_name text,p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.profiles set full_name=nullif(trim(coalesce(p_full_name,'')),''), phone=nullif(trim(coalesce(p_phone,'')),'') where id=auth.uid();
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.staff_update_profile(text,text) from public;
grant execute on function public.staff_update_profile(text,text) to authenticated;

create or replace function public.log_staff_auth_event(p_event_type text,p_user_agent text default '')
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then return false; end if;
  if p_event_type not in ('login','logout','password_reset') then raise exception 'Invalid event'; end if;
  insert into public.staff_login_history(user_id,user_agent,event_type) values(auth.uid(),left(coalesce(p_user_agent,''),500),p_event_type);
  update public.profiles set last_login_at=case when p_event_type='login' then now() else last_login_at end where id=auth.uid();
  return true;
end $$;
revoke all on function public.log_staff_auth_event(text,text) from public;
grant execute on function public.log_staff_auth_event(text,text) to authenticated;

-- Admin-only task creation/update helpers avoid depending on direct table RLS from UI.
create or replace function public.admin_create_staff_assignment(
  p_assignee_id uuid,p_order_id uuid,p_stage text,p_title text,p_notes text default null,
  p_priority text default 'normal',p_deadline timestamptz default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare rid uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_stage not in ('intake','prepress','digital_print','large_format','finishing','packing','delivery','warehouse','finance','it_support','quality_control') then raise exception 'Invalid stage'; end if;
  if p_priority not in ('low','normal','high','urgent') then raise exception 'Invalid priority'; end if;
  if not exists(select 1 from public.profiles where id=p_assignee_id and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active') then raise exception 'Employee is not active'; end if;
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

-- Expand staff push subscriptions beyond admin/manager.
alter table public.staff_push_subscriptions drop constraint if exists staff_push_subscriptions_role_check;
alter table public.staff_push_subscriptions add constraint staff_push_subscriptions_role_check check(
 role in ('admin','manager','designer','digital_print','large_format','finishing','packing','courier','warehouse','finance','it_admin')
);
create or replace function public.save_staff_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_role text; rid uuid;
begin
 select role into v_role from public.profiles where id=auth.uid()
   and role in ('admin','manager','designer','digital_print','large_format','finishing','packing','courier','warehouse','finance','it_admin')
   and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active';
 if v_role is null then raise exception 'Staff access required'; end if;
 insert into public.staff_push_subscriptions(user_id,role,endpoint,p256dh,auth,user_agent)
 values(auth.uid(),v_role,p_endpoint,p_p256dh,p_auth,p_user_agent)
 on conflict(endpoint) do update set user_id=excluded.user_id,role=excluded.role,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,last_seen_at=now()
 returning id into rid;
 return rid;
end$$;
grant execute on function public.save_staff_push_subscription(text,text,text,text) to authenticated;

-- Warehouse access: warehouse staff can read inventory and post stock movements.
drop policy if exists inventory_items_warehouse_read on public.inventory_items;
create policy inventory_items_warehouse_read on public.inventory_items for select to authenticated
using(public.current_staff_role()='warehouse' and public.is_staff());
drop policy if exists inventory_movements_warehouse_read on public.inventory_movements;
create policy inventory_movements_warehouse_read on public.inventory_movements for select to authenticated
using(public.current_staff_role()='warehouse' and public.is_staff());

create or replace function public.inventory_move_stock(
  p_item_id uuid,p_direction text,p_quantity numeric,p_note text default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_catalog set row_security=off as $$
declare v_before numeric(14,3); v_after numeric(14,3); v_role text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or not (public.is_admin() or (v_role='warehouse' and public.is_staff())) then raise exception 'Warehouse/Admin access required'; end if;
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
end; $$;
revoke all on function public.inventory_move_stock(uuid,text,numeric,text) from public;
grant execute on function public.inventory_move_stock(uuid,text,numeric,text) to authenticated;

-- Notification trigger for any new pending employee registration.
create or replace function public.notify_admins_new_staff()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_type text;
begin
  select coalesce(u.raw_user_meta_data->>'account_type','') into v_type from auth.users u where u.id=new.id;
  if coalesce(v_type,'') in ('staff','manager') and coalesce(new.approval_status,'pending')='pending' then
    insert into public.notifications(recipient_id,type,title,message,link)
    select p.id,'staff_registration','Նոր աշխատակցի գրանցում',coalesce(new.full_name,new.email,'Նոր աշխատակից')||' սպասում է հաստատման։','employees.html'
    from public.profiles p where p.role='admin';
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_admins_new_manager on public.profiles;
drop trigger if exists trg_notify_admins_new_staff on public.profiles;
create trigger trg_notify_admins_new_staff after insert on public.profiles for each row execute function public.notify_admins_new_staff();

notify pgrst, 'reload schema';

-- ---------- Assigned-order visibility for production staff ----------
create or replace function public.is_assigned_to_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.staff_assignments a
    join public.profiles p on p.id=a.assignee_id
    where a.order_id=p_order_id and a.assignee_id=auth.uid()
      and a.status not in ('cancelled')
      and coalesce(p.approval_status,'approved')='approved'
      and coalesce(p.account_status,'active')='active'
  );
$$;
revoke all on function public.is_assigned_to_order(uuid) from public;
grant execute on function public.is_assigned_to_order(uuid) to authenticated;

-- Assigned production staff can read only files/proofs tied to their assigned orders.
drop policy if exists assigned_staff_read_order_files on public.order_files;
create policy assigned_staff_read_order_files on public.order_files for select to authenticated
using(public.is_assigned_to_order(order_id));

drop policy if exists assigned_staff_read_proofs on public.order_design_proofs;
create policy assigned_staff_read_proofs on public.order_design_proofs for select to authenticated
using(public.is_assigned_to_order(order_id));

drop policy if exists assigned_staff_read_storage on storage.objects;
create policy assigned_staff_read_storage on storage.objects for select to authenticated using(
  bucket_id='customer-order-files' and (
    exists(select 1 from public.order_files f where f.storage_path=name and public.is_assigned_to_order(f.order_id))
    or exists(select 1 from public.order_design_proofs pr where pr.storage_path=name and public.is_assigned_to_order(pr.order_id))
  )
);

-- Courier can read delivery snapshots only for orders assigned to the courier.
drop policy if exists courier_delivery_read on public.order_delivery_details;
create policy courier_delivery_read on public.order_delivery_details for select to authenticated using(
  public.current_staff_role()='courier' and public.is_assigned_to_order(order_id)
);

create or replace function public.staff_assigned_files()
returns table(
  order_id uuid,order_number text,service_key text,file_kind text,file_id uuid,file_name text,file_url text,storage_path text,created_at timestamptz
)
language sql stable security definer set search_path=public as $$
  select o.id,o.order_number,o.service_key,'order_file'::text,f.id,f.file_name,f.file_url,f.storage_path,f.created_at
  from public.staff_assignments a
  join public.orders o on o.id=a.order_id
  join public.order_files f on f.order_id=o.id
  where a.assignee_id=auth.uid() and public.is_staff()
  union all
  select o.id,o.order_number,o.service_key,'proof'::text,p.id,p.file_name,null::text,p.storage_path,p.published_at
  from public.staff_assignments a
  join public.orders o on o.id=a.order_id
  join public.order_design_proofs p on p.order_id=o.id
  where a.assignee_id=auth.uid() and public.is_staff()
  order by created_at desc;
$$;
revoke all on function public.staff_assigned_files() from public;
grant execute on function public.staff_assigned_files() to authenticated;

create or replace function public.courier_my_deliveries()
returns table(
 assignment_id uuid,order_id uuid,order_number text,task_status text,priority text,deadline timestamptz,
 delivery_method text,recipient_name text,phone text,city text,address_line text,note text
)
language sql stable security definer set search_path=public as $$
  select a.id,a.order_id,o.order_number,a.status,a.priority,a.deadline,
         d.delivery_method,d.recipient_name,d.phone,d.city,d.address_line,d.note
  from public.staff_assignments a
  join public.orders o on o.id=a.order_id
  left join public.order_delivery_details d on d.order_id=o.id
  where a.assignee_id=auth.uid() and public.current_staff_role()='courier' and public.is_staff()
    and a.stage='delivery'
  order by case a.priority when 'urgent' then 1 when 'high' then 2 else 3 end,a.deadline nulls last,a.created_at;
$$;
revoke all on function public.courier_my_deliveries() from public;
grant execute on function public.courier_my_deliveries() to authenticated;

create or replace function public.finance_order_summary()
returns table(
 id uuid,order_number text,customer_name text,service_name text,total_amount numeric,cost_amount numeric,payment_status text,status text,created_at timestamptz,delivery_fee numeric
)
language sql stable security definer set search_path=public as $$
  select o.id,o.order_number,o.customer_name,o.service_name,o.total_amount,o.cost_amount,o.payment_status,o.status,o.created_at,coalesce(o.delivery_fee,0)
  from public.orders o
  where public.current_staff_role()='finance' and public.is_staff()
  order by o.created_at desc
  limit 1000;
$$;
revoke all on function public.finance_order_summary() from public;
grant execute on function public.finance_order_summary() to authenticated;

notify pgrst, 'reload schema';

-- Production staff can attach final/working files only to orders assigned to them.
drop policy if exists assigned_staff_insert_order_files on public.order_files;
create policy assigned_staff_insert_order_files on public.order_files for insert to authenticated
with check(public.is_assigned_to_order(order_id) and public.current_staff_role() in ('designer','digital_print','large_format','finishing','packing'));

-- Designer may publish a customer approval proof only for an assigned order.
create or replace function public.staff_publish_design_proof(p_order_id uuid,p_file_name text,p_storage_path text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v int; rid uuid; cid uuid; v_role text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if not (
    public.is_admin()
    or (v_role='manager' and exists(select 1 from public.profiles p where p.id=auth.uid() and coalesce(p.account_status,'active')='active'))
    or (v_role='designer' and public.is_staff() and public.is_assigned_to_order(p_order_id))
  ) then raise exception 'Staff access required'; end if;
  select customer_id into cid from public.orders where id=p_order_id;
  if cid is null then raise exception 'Customer-linked order required'; end if;
  select coalesce(max(version),0)+1 into v from public.order_design_proofs where order_id=p_order_id;
  insert into public.order_design_proofs(order_id,version,file_name,storage_path,published_by)
  values(p_order_id,v,p_file_name,p_storage_path,auth.uid()) returning id into rid;
  insert into public.customer_app_notifications(customer_id,order_id,type,title,message)
  values(cid,p_order_id,'design_proof','Դիզայնը պատրաստ է հաստատման','Բացեք պատվերը և հաստատեք դիզայնը կամ գրեք անհրաժեշտ փոփոխությունը։');
  return rid;
end $$;
grant execute on function public.staff_publish_design_proof(uuid,text,text) to authenticated;

notify pgrst, 'reload schema';
