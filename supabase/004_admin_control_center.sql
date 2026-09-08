-- GDprint v9 — Admin Control Center & hard manager restrictions
-- Run once AFTER 001, 002, 003.

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','blocked'));

create table if not exists public.manager_permissions (
  manager_id uuid primary key references public.profiles(id) on delete cascade,
  can_create_orders boolean not null default true,
  can_view_customers boolean not null default true,
  can_view_other_orders boolean not null default false,
  can_change_status boolean not null default true,
  can_mark_payment boolean not null default false,
  can_delete_orders boolean not null default false,
  can_change_price boolean not null default false,
  can_apply_discount boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.manager_permissions(manager_id)
select id from public.profiles where role='manager' on conflict do nothing;

create table if not exists public.approval_requests (
 id uuid primary key default gen_random_uuid(), requester_id uuid references public.profiles(id) on delete set null,
 order_id uuid references public.orders(id) on delete cascade, request_type text not null,
 requested_value jsonb not null default '{}'::jsonb, reason text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.daily_closings (
 id uuid primary key default gen_random_uuid(), manager_id uuid not null references public.profiles(id) on delete cascade,
 closing_date date not null default current_date, cash_amount numeric not null default 0, transfer_amount numeric not null default 0,
 debt_amount numeric not null default 0, note text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now(),
 unique(manager_id, closing_date)
);

alter table public.customers add column if not exists customer_tier text not null default 'regular';
alter table public.customers add column if not exists admin_notes text;
alter table public.customers add column if not exists assigned_manager_id uuid references public.profiles(id) on delete set null;

alter table public.manager_permissions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.daily_closings enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$;

drop policy if exists mp_admin_all on public.manager_permissions;
create policy mp_admin_all on public.manager_permissions for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists mp_manager_read_own on public.manager_permissions;
create policy mp_manager_read_own on public.manager_permissions for select to authenticated using(manager_id=auth.uid());

drop policy if exists ar_admin_all on public.approval_requests;
create policy ar_admin_all on public.approval_requests for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists ar_manager_own on public.approval_requests;
create policy ar_manager_own on public.approval_requests for select to authenticated using(requester_id=auth.uid());
drop policy if exists ar_manager_insert on public.approval_requests;
create policy ar_manager_insert on public.approval_requests for insert to authenticated with check(requester_id=auth.uid() and status='pending');

drop policy if exists dc_admin_all on public.daily_closings;
create policy dc_admin_all on public.daily_closings for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists dc_manager_own on public.daily_closings;
create policy dc_manager_own on public.daily_closings for select to authenticated using(manager_id=auth.uid());
drop policy if exists dc_manager_insert on public.daily_closings;
create policy dc_manager_insert on public.daily_closings for insert to authenticated with check(manager_id=auth.uid());

-- HARD RULE: managers can never alter a registered order's price.
create or replace function public.guard_manager_order_price() returns trigger language plpgsql security definer set search_path=public as $$
declare v_role text;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role='manager' and new.total_amount is distinct from old.total_amount then
   raise exception 'Managers cannot change registered order price';
 end if;
 return new;
end; $$;
drop trigger if exists trg_guard_manager_order_price on public.orders;
create trigger trg_guard_manager_order_price before update on public.orders for each row execute function public.guard_manager_order_price();

-- Immutable DB audit for important order changes.
create or replace function public.audit_order_changes() returns trigger language plpgsql security definer set search_path=public as $$
declare v_action text;
begin
 v_action := 'Պատվեր '||coalesce(new.order_number,old.order_number,'')||': ';
 if new.total_amount is distinct from old.total_amount then v_action:=v_action||'գին '||old.total_amount||' → '||new.total_amount||'; '; end if;
 if new.cost_amount is distinct from old.cost_amount then v_action:=v_action||'ծախս '||coalesce(old.cost_amount,0)||' → '||coalesce(new.cost_amount,0)||'; '; end if;
 if new.payment_status is distinct from old.payment_status then v_action:=v_action||'վճարում '||old.payment_status||' → '||new.payment_status||'; '; end if;
 if new.status is distinct from old.status then v_action:=v_action||'կարգավիճակ '||old.status||' → '||new.status||'; '; end if;
 if v_action <> 'Պատվեր '||coalesce(new.order_number,old.order_number,'')||': ' then
   insert into public.activity_log(actor_id,action,target_table,target_id) values(auth.uid(),v_action,'orders',new.id);
 end if;
 return new;
exception when others then return new;
end; $$;
drop trigger if exists trg_audit_order_changes on public.orders;
create trigger trg_audit_order_changes after update on public.orders for each row execute function public.audit_order_changes();

create or replace function public.set_manager_blocked(p_manager_id uuid,p_blocked boolean) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 update public.profiles set account_status=case when p_blocked then 'blocked' else 'active' end where id=p_manager_id and role='manager';
 if not found then raise exception 'Manager not found'; end if;
 insert into public.activity_log(actor_id,action,target_table,target_id) values(auth.uid(),case when p_blocked then 'Արգելափակեց մենեջերի հաշիվը' else 'Ապաարգելափակեց մենեջերի հաշիվը' end,'profiles',p_manager_id);
 return jsonb_build_object('ok',true,'blocked',p_blocked);
end $$;
grant execute on function public.set_manager_blocked(uuid,boolean) to authenticated;

-- Deletes the Auth user too; profile/related rows follow their FK rules.
create or replace function public.delete_manager_account(p_manager_id uuid) returns jsonb language plpgsql security definer set search_path=public,auth as $$
begin
 if not public.is_admin() then raise exception 'Admin access required'; end if;
 if not exists(select 1 from public.profiles where id=p_manager_id and role='manager') then raise exception 'Manager not found'; end if;
 delete from auth.users where id=p_manager_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.delete_manager_account(uuid) from public;
grant execute on function public.delete_manager_account(uuid) to authenticated;

-- Ensure every manager gets a permission row.
create or replace function public.ensure_manager_permissions() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.role='manager' then insert into public.manager_permissions(manager_id) values(new.id) on conflict do nothing; end if; return new; end $$;
drop trigger if exists trg_ensure_manager_permissions on public.profiles;
create trigger trg_ensure_manager_permissions after insert or update of role on public.profiles for each row execute function public.ensure_manager_permissions();

-- Suspicious / attention notifications for admins on cancellations and payment reversals.
create or replace function public.notify_admins_sensitive_order_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (new.status='cancelled' and old.status is distinct from new.status) or
    (old.payment_status='paid' and new.payment_status is distinct from old.payment_status) then
   insert into public.notifications(recipient_id,type,title,message,link)
   select id,'security_alert','Ուշադրություն՝ պատվերի կարևոր փոփոխություն',
     'Պատվեր '||coalesce(new.order_number,new.id::text)||' — '||case when new.status='cancelled' then 'չեղարկվել է' else 'վճարման կարգավիճակը փոխվել է paid-ից' end,
     'dashboard.html' from public.profiles where role='admin';
 end if;
 return new;
end $$;
drop trigger if exists trg_notify_admins_sensitive_order_change on public.orders;
create trigger trg_notify_admins_sensitive_order_change after update on public.orders for each row execute function public.notify_admins_sensitive_order_change();

-- Never allow the two financial permissions to be enabled, even by accidental UI/API writes.
create or replace function public.force_manager_financial_restrictions() returns trigger language plpgsql as $$
begin new.can_change_price:=false; new.can_apply_discount:=false; return new; end $$;
drop trigger if exists trg_force_manager_financial_restrictions on public.manager_permissions;
create trigger trg_force_manager_financial_restrictions before insert or update on public.manager_permissions for each row execute function public.force_manager_financial_restrictions();

-- Enforce manager operational permissions at DB level.
create or replace function public.guard_manager_order_actions() returns trigger language plpgsql security definer set search_path=public as $$
declare v_role text; v_perm public.manager_permissions%rowtype;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role <> 'manager' then return new; end if;
 select * into v_perm from public.manager_permissions where manager_id=auth.uid();
 if tg_op='INSERT' then
   if coalesce(v_perm.can_create_orders,true)=false then raise exception 'Order creation is disabled for this manager'; end if;
   return new;
 end if;
 if new.status is distinct from old.status and coalesce(v_perm.can_change_status,true)=false then raise exception 'Status changes are disabled for this manager'; end if;
 if new.payment_status is distinct from old.payment_status and coalesce(v_perm.can_mark_payment,false)=false then raise exception 'Payment changes are disabled for this manager'; end if;
 return new;
end $$;
drop trigger if exists trg_guard_manager_order_actions_insert on public.orders;
create trigger trg_guard_manager_order_actions_insert before insert on public.orders for each row execute function public.guard_manager_order_actions();
drop trigger if exists trg_guard_manager_order_actions_update on public.orders;
create trigger trg_guard_manager_order_actions_update before update on public.orders for each row execute function public.guard_manager_order_actions();
