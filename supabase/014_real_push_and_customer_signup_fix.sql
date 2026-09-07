-- ============================================================
-- GDprint v5.1 — Real Web Push + definitive customer/manager signup fix
-- Run ONCE after 013.
-- ============================================================
create extension if not exists pgcrypto;

-- Public VAPID key used by both Customer and Admin/Manager PWA clients.
insert into public.app_settings(key,value) values
('customer_push_vapid_public_key', to_jsonb('BOJWktIoesoSBZoTnw9cmjvbAQNdwTKWjpQYeFxaxx535dC2Ny1CrpZ5Q69pUm2cdgVGhZu58eJvC6zTMEtjYPo'::text))
on conflict(key) do update set value=excluded.value;
insert into public.app_settings(key,value) values
('staff_push_vapid_public_key', to_jsonb('BOJWktIoesoSBZoTnw9cmjvbAQNdwTKWjpQYeFxaxx535dC2Ny1CrpZ5Q69pUm2cdgVGhZu58eJvC6zTMEtjYPo'::text))
on conflict(key) do update set value=excluded.value;

-- Staff browser/device subscriptions.
create table if not exists public.staff_push_subscriptions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','manager')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists staff_push_user_idx on public.staff_push_subscriptions(user_id,last_seen_at desc);
alter table public.staff_push_subscriptions enable row level security;
drop policy if exists staff_push_read_own on public.staff_push_subscriptions;
create policy staff_push_read_own on public.staff_push_subscriptions for select to authenticated using(user_id=auth.uid());

create or replace function public.get_staff_push_public_config()
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('vapid_public_key',coalesce((select value #>> '{}' from public.app_settings where key='staff_push_vapid_public_key'),''));
$$;
grant execute on function public.get_staff_push_public_config() to authenticated;

create or replace function public.save_staff_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_role text; rid uuid;
begin
 select role into v_role from public.profiles where id=auth.uid() and role in ('admin','manager') and coalesce(account_status,'active')<>'blocked';
 if v_role is null then raise exception 'Staff access required'; end if;
 insert into public.staff_push_subscriptions(user_id,role,endpoint,p256dh,auth,user_agent)
 values(auth.uid(),v_role,p_endpoint,p_p256dh,p_auth,p_user_agent)
 on conflict(endpoint) do update set user_id=excluded.user_id,role=excluded.role,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,last_seen_at=now()
 returning id into rid;
 return rid;
end$$;
grant execute on function public.save_staff_push_subscription(text,text,text,text) to authenticated;

create or replace function public.delete_staff_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 delete from public.staff_push_subscriptions where endpoint=p_endpoint and user_id=auth.uid();
 return found;
end$$;
grant execute on function public.delete_staff_push_subscription(text) to authenticated;

-- DEFINITIVE FIX: only a true manager Auth signup may create manager-registration notification.
-- Customer App signups are explicitly excluded by metadata AND by linked customer state.
create or replace function public.notify_admins_new_manager()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_type text; v_is_customer boolean:=false;
begin
 select coalesce(u.raw_user_meta_data->>'account_type','') into v_type from auth.users u where u.id=new.id;
 select exists(select 1 from public.customers c where c.auth_user_id=new.id) into v_is_customer;
 if new.role='manager'
    and new.approval_status='pending'
    and coalesce(v_type,'') <> 'customer'
    and not v_is_customer then
   insert into public.notifications(recipient_id,type,title,message,link)
   select p.id,'manager_registration','Նոր մենեջերի գրանցում',coalesce(new.full_name,new.email,'Նոր օգտվող')||' սպասում է հաստատման։','managers.html'
   from public.profiles p where p.role='admin';
 end if;
 return new;
end$$;
drop trigger if exists trg_notify_admins_new_manager on public.profiles;
create trigger trg_notify_admins_new_manager after insert on public.profiles for each row execute function public.notify_admins_new_manager();

-- Also make manager registration explicitly identify itself in Auth metadata.
-- Browser change in v5.1 sends account_type=manager.

-- Realtime remains useful while app is open.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='staff_push_subscriptions') then
   alter publication supabase_realtime add table public.staff_push_subscriptions;
 end if;
end $$;

notify pgrst, 'reload schema';
