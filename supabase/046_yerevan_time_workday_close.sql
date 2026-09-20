-- GDprint v7.6.4
-- Armenia/Yerevan time semantics + employee end-of-day closure
-- Safe to run after existing staff ERP migrations.

begin;

create table if not exists public.staff_day_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  role text,
  closed_at timestamptz not null default now(),
  note text,
  open_tasks_count integer not null default 0,
  in_progress_tasks_count integer not null default 0,
  completed_today_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, work_date)
);

create index if not exists staff_day_closures_user_date_idx
  on public.staff_day_closures(user_id, work_date desc);
create index if not exists staff_day_closures_date_idx
  on public.staff_day_closures(work_date desc, closed_at desc);

alter table public.staff_day_closures enable row level security;

drop policy if exists staff_day_closures_select on public.staff_day_closures;
create policy staff_day_closures_select
on public.staff_day_closures
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create or replace function public.gd_yerevan_today()
returns date
language sql
stable
set search_path=public
as $$
  select (now() at time zone 'Asia/Yerevan')::date;
$$;

grant execute on function public.gd_yerevan_today() to authenticated;

create or replace function public.staff_day_status()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := (now() at time zone 'Asia/Yerevan')::date;
  v_close public.staff_day_closures%rowtype;
  v_open integer := 0;
  v_progress integer := 0;
  v_done integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select count(*)::int into v_open
  from public.staff_assignments
  where assignee_id=v_uid and status not in ('completed','cancelled');

  select count(*)::int into v_progress
  from public.staff_assignments
  where assignee_id=v_uid and status='in_progress';

  select count(*)::int into v_done
  from public.staff_assignments
  where assignee_id=v_uid
    and status='completed'
    and ((coalesce(completed_at,updated_at) at time zone 'Asia/Yerevan')::date = v_date);

  select * into v_close
  from public.staff_day_closures
  where user_id=v_uid and work_date=v_date;

  return jsonb_build_object(
    'work_date', v_date,
    'is_closed', found,
    'closed_at', case when found then v_close.closed_at else null end,
    'closed_time_yerevan', case when found then to_char(v_close.closed_at at time zone 'Asia/Yerevan','HH24:MI') else null end,
    'note', case when found then v_close.note else null end,
    'open_tasks', v_open,
    'in_progress_tasks', v_progress,
    'completed_today', v_done
  );
end $$;

grant execute on function public.staff_day_status() to authenticated;

create or replace function public.staff_close_day(p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := (now() at time zone 'Asia/Yerevan')::date;
  v_role text;
  v_open integer := 0;
  v_progress integer := 0;
  v_done integer := 0;
  v_row public.staff_day_closures%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select role into v_role from public.profiles where id=v_uid;
  if v_role is null then raise exception 'Staff profile not found'; end if;

  select count(*)::int into v_open
  from public.staff_assignments
  where assignee_id=v_uid and status not in ('completed','cancelled');

  select count(*)::int into v_progress
  from public.staff_assignments
  where assignee_id=v_uid and status='in_progress';

  select count(*)::int into v_done
  from public.staff_assignments
  where assignee_id=v_uid
    and status='completed'
    and ((coalesce(completed_at,updated_at) at time zone 'Asia/Yerevan')::date = v_date);

  insert into public.staff_day_closures(
    user_id,work_date,role,closed_at,note,open_tasks_count,in_progress_tasks_count,completed_today_count,updated_at
  ) values(
    v_uid,v_date,v_role,now(),nullif(btrim(coalesce(p_note,'')),''),v_open,v_progress,v_done,now()
  )
  on conflict(user_id,work_date) do update set
    role=excluded.role,
    closed_at=excluded.closed_at,
    note=excluded.note,
    open_tasks_count=excluded.open_tasks_count,
    in_progress_tasks_count=excluded.in_progress_tasks_count,
    completed_today_count=excluded.completed_today_count,
    updated_at=now()
  returning * into v_row;

  -- Activity log is optional in older installs, so never fail the close-day action because of logging.
  begin
    insert into public.activity_log(actor_id,action,target_table,target_id)
    values(v_uid,'close_workday','staff_day_closures',v_row.id);
  exception when others then null;
  end;

  return jsonb_build_object(
    'ok', true,
    'work_date', v_row.work_date,
    'closed_at', v_row.closed_at,
    'closed_time_yerevan', to_char(v_row.closed_at at time zone 'Asia/Yerevan','HH24:MI'),
    'open_tasks', v_row.open_tasks_count,
    'in_progress_tasks', v_row.in_progress_tasks_count,
    'completed_today', v_row.completed_today_count,
    'note', v_row.note
  );
end $$;

grant execute on function public.staff_close_day(text) to authenticated;

-- Admin visibility for current/history day-closing status.
create or replace function public.admin_staff_day_closures(p_work_date date default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_date date := coalesce(p_work_date,(now() at time zone 'Asia/Yerevan')::date);
  v_data jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.closed_at desc),'[]'::jsonb) into v_data
  from (
    select c.id,c.user_id,c.work_date,c.role,c.closed_at,c.note,
           c.open_tasks_count,c.in_progress_tasks_count,c.completed_today_count,
           p.full_name,p.employee_id,p.email,
           to_char(c.closed_at at time zone 'Asia/Yerevan','HH24:MI') as closed_time_yerevan
    from public.staff_day_closures c
    left join public.profiles p on p.id=c.user_id
    where c.work_date=v_date
  ) x;
  return v_data;
end $$;

grant execute on function public.admin_staff_day_closures(date) to authenticated;

-- Schema cache refresh for PostgREST.
notify pgrst, 'reload schema';

commit;
