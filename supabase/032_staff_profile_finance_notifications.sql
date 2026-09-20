-- GDprint ERP Phase 5: staff profile, schedules, compensation, notifications, finance ledger
create table if not exists public.staff_notifications(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, message text, kind text default 'info', is_read boolean default false,
 created_by uuid references public.profiles(id), created_at timestamptz default now(), read_at timestamptz
);
alter table public.staff_notifications enable row level security;
drop policy if exists staff_notifications_select on public.staff_notifications;
create policy staff_notifications_select on public.staff_notifications for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists staff_notifications_update on public.staff_notifications;
create policy staff_notifications_update on public.staff_notifications for update to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
drop policy if exists staff_notifications_admin_insert on public.staff_notifications;
create policy staff_notifications_admin_insert on public.staff_notifications for insert to authenticated with check(public.is_admin());

create or replace function public.staff_my_profile_bundle() returns jsonb language plpgsql stable security definer set search_path=public as $$
declare p jsonb; s jsonb; c jsonb; a jsonb; n jsonb; begin
 select to_jsonb(x) into p from (select id,employee_id,full_name,email,phone,role,job_title,hire_date,approval_status,account_status from public.profiles where id=auth.uid()) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.work_date desc),'[]'::jsonb) into s from (select work_date,start_time,end_time,note from public.staff_schedules where user_id=auth.uid() and work_date>=current_date-30 order by work_date desc limit 60) x;
 select to_jsonb(x) into c from (select show_salary,show_bonus,case when show_salary then salary else null end salary,case when show_bonus then bonus else null end bonus,updated_at from public.staff_compensation_visibility where user_id=auth.uid()) x;
 select jsonb_build_object('total',count(*),'completed',count(*) filter(where status='completed'),'open',count(*) filter(where status not in ('completed','cancelled')),'late',count(*) filter(where deadline<now() and status not in ('completed','cancelled'))) into a from public.staff_assignments where assignee_id=auth.uid();
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into n from (select id,title,message,kind,is_read,created_at from public.staff_notifications where user_id=auth.uid() order by created_at desc limit 50) x;
 return jsonb_build_object('profile',p,'schedules',s,'compensation',coalesce(c,'{}'::jsonb),'assignments',a,'notifications',n);
end $$;
grant execute on function public.staff_my_profile_bundle() to authenticated;

create or replace function public.staff_mark_notification_read(p_id uuid) returns void language sql security definer set search_path=public as $$ update public.staff_notifications set is_read=true,read_at=now() where id=p_id and user_id=auth.uid(); $$;
grant execute on function public.staff_mark_notification_read(uuid) to authenticated;

create or replace function public.admin_save_staff_compensation(p_user_id uuid,p_salary numeric,p_bonus numeric,p_show_salary boolean,p_show_bonus boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_admin() then raise exception 'Admin only'; end if;
 insert into public.staff_compensation_visibility(user_id,salary,bonus,show_salary,show_bonus,updated_at) values(p_user_id,greatest(coalesce(p_salary,0),0),greatest(coalesce(p_bonus,0),0),coalesce(p_show_salary,false),coalesce(p_show_bonus,false),now()) on conflict(user_id) do update set salary=excluded.salary,bonus=excluded.bonus,show_salary=excluded.show_salary,show_bonus=excluded.show_bonus,updated_at=now();
end $$;
grant execute on function public.admin_save_staff_compensation(uuid,numeric,numeric,boolean,boolean) to authenticated;

create or replace function public.admin_upsert_staff_schedule(p_user_id uuid,p_work_date date,p_start time,p_end time,p_note text default null) returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_admin() then raise exception 'Admin only'; end if;
 insert into public.staff_schedules(user_id,work_date,start_time,end_time,note) values(p_user_id,p_work_date,p_start,p_end,p_note) on conflict(user_id,work_date) do update set start_time=excluded.start_time,end_time=excluded.end_time,note=excluded.note;
end $$;
grant execute on function public.admin_upsert_staff_schedule(uuid,date,time,time,text) to authenticated;

create or replace function public.admin_notify_staff(p_user_id uuid,p_title text,p_message text,p_kind text default 'info') returns void language plpgsql security definer set search_path=public as $$ begin
 if not public.is_admin() then raise exception 'Admin only'; end if;
 insert into public.staff_notifications(user_id,title,message,kind,created_by) values(p_user_id,p_title,p_message,coalesce(p_kind,'info'),auth.uid());
end $$;
grant execute on function public.admin_notify_staff(uuid,text,text,text) to authenticated;

-- Finance can insert ledger entries; admin/finance can read.
drop policy if exists finance_tx_read on public.finance_transactions;
create policy finance_tx_read on public.finance_transactions for select to authenticated using(public.is_admin() or public.current_staff_role()='finance');
drop policy if exists finance_tx_insert on public.finance_transactions;
create policy finance_tx_insert on public.finance_transactions for insert to authenticated with check((public.is_admin() or public.current_staff_role()='finance') and created_by=auth.uid());

create or replace function public.finance_add_transaction(p_order_id uuid,p_kind text,p_method text,p_amount numeric,p_note text default null) returns uuid language plpgsql security definer set search_path=public as $$ declare v uuid; begin
 if not (public.is_admin() or public.current_staff_role()='finance') then raise exception 'Finance only'; end if;
 if p_kind not in ('payment','refund','expense','salary','commission','supplier') then raise exception 'Invalid kind'; end if;
 if p_method not in ('cash','bank_transfer','online_payment','delivery_payment','other') then raise exception 'Invalid method'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'Amount must be positive'; end if;
 insert into public.finance_transactions(order_id,kind,method,amount,note,created_by) values(p_order_id,p_kind,p_method,p_amount,p_note,auth.uid()) returning id into v; return v;
end $$;
grant execute on function public.finance_add_transaction(uuid,text,text,numeric,text) to authenticated;
notify pgrst,'reload schema';
