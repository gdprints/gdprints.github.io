-- GDprint: manager approval + in-app notifications
-- Run ONCE in Supabase SQL Editor after 001_app_settings.sql.

-- 1) Manager approval state
alter table public.profiles
  add column if not exists approval_status text;

-- Preserve all accounts that existed before this feature.
update public.profiles
set approval_status = 'approved'
where approval_status is null;

alter table public.profiles
  alter column approval_status set default 'pending';

alter table public.profiles
  alter column approval_status set not null;

alter table public.profiles
  drop constraint if exists profiles_approval_status_check;
alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending','approved','rejected'));

-- Admins must never be blocked by the manager approval workflow.
update public.profiles set approval_status = 'approved' where role = 'admin';

-- 2) Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(recipient_id, is_read)
  where is_read = false;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

-- No client-side INSERT/DELETE policy on purpose. Notifications are produced
-- by DB triggers or trusted Edge Functions, not arbitrary browser code.

-- 3) Notify every admin when a new manager profile is created.
create or replace function public.notify_admins_new_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'manager' and new.approval_status = 'pending' then
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

drop trigger if exists trg_notify_admins_new_manager on public.profiles;
create trigger trg_notify_admins_new_manager
after insert on public.profiles
for each row execute function public.notify_admins_new_manager();

-- 4) Optional convenience RPC for unread count is intentionally omitted;
-- the client reads only its own rows under RLS.

-- 5) Realtime support for the bell (safe if publication already contains it).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- 6) Bell notification for direct/internal messages.
create or replace function public.notify_internal_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.recipient_id is not null then
    insert into public.notifications (recipient_id, type, title, message, link)
    values (
      new.recipient_id,
      'message',
      'Նոր հաղորդագրություն',
      coalesce((select p.full_name from public.profiles p where p.id = new.sender_id), 'GDprint') || ': ' || left(coalesce(new.message,''), 120),
      'messages.html'
    );
  else
    insert into public.notifications (recipient_id, type, title, message, link)
    select p.id,
           'message',
           'Նոր ընդհանուր հայտարարություն',
           coalesce((select sp.full_name from public.profiles sp where sp.id = new.sender_id), 'GDprint') || ': ' || left(coalesce(new.message,''), 120),
           'messages.html'
    from public.profiles p
    where p.id <> new.sender_id and p.approval_status = 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_internal_message_recipient on public.internal_messages;
create trigger trg_notify_internal_message_recipient
after insert on public.internal_messages
for each row execute function public.notify_internal_message_recipient();

-- 7) Notify admins when a new order is created. This covers both website
-- orders and orders registered by a manager.
create or replace function public.notify_admins_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  order_label text;
begin
  order_label := coalesce(new.order_number, new.id::text);
  insert into public.notifications (recipient_id, type, title, message, link)
  select p.id,
         'order',
         'Նոր պատվեր',
         'Գրանցվել է նոր պատվեր՝ ' || order_label || '.',
         'dashboard.html'
  from public.profiles p
  where p.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_notify_admins_new_order on public.orders;
create trigger trg_notify_admins_new_order
after insert on public.orders
for each row execute function public.notify_admins_new_order();
