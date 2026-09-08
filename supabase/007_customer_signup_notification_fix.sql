-- ============================================================
-- GDprint Customer App v3.2
-- Fix: customer signups must never generate manager-registration notifications.
-- Run ONCE after 006_customer_app_v3.sql.
-- ============================================================

create or replace function public.notify_admins_new_manager()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account_type text;
begin
  -- Profiles can be created by the legacy auth trigger before the customer
  -- cleanup trigger runs. Read Auth metadata here so the notification itself
  -- is blocked at the source for Customer App registrations.
  select coalesce(u.raw_user_meta_data->>'account_type','')
    into v_account_type
    from auth.users u
   where u.id = new.id;

  if new.role = 'manager'
     and new.approval_status = 'pending'
     and v_account_type <> 'customer' then
    insert into public.notifications (recipient_id, type, title, message, link)
    select p.id,
           'manager_registration',
           'Նոր մենեջերի գրանցում',
           coalesce(new.full_name, new.email, 'Նոր օգտվող') || ' սպասում է հաստատման։',
           'managers.html'
      from public.profiles p
     where p.role = 'admin';
  end if;
  return new;
end;
$$;

-- Keep the existing trigger attached to profiles, but recreate it explicitly
-- so older installations get the corrected function reliably.
drop trigger if exists trg_notify_admins_new_manager on public.profiles;
create trigger trg_notify_admins_new_manager
after insert on public.profiles
for each row execute function public.notify_admins_new_manager();
