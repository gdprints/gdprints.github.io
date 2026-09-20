-- GDprint ERP Phase 4: courier, finance, employee self-service, IT console
create table if not exists public.delivery_events(id uuid primary key default gen_random_uuid(),assignment_id uuid references public.staff_assignments(id) on delete cascade,order_id uuid references public.orders(id) on delete cascade,courier_id uuid references public.profiles(id),event_type text not null,note text,payment_amount numeric default 0,created_at timestamptz default now());
alter table public.delivery_events enable row level security;
create policy delivery_events_staff on public.delivery_events for select to authenticated using(public.is_admin() or courier_id=auth.uid() or public.current_staff_role()='finance');
create policy delivery_events_courier_insert on public.delivery_events for insert to authenticated with check(courier_id=auth.uid() and public.current_staff_role()='courier' and public.is_assigned_to_order(order_id));

create table if not exists public.finance_transactions(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id) on delete set null,kind text not null check(kind in ('payment','refund','expense','salary','commission','supplier')),method text check(method is null or method in ('cash','bank_transfer','online_payment','delivery_payment')),amount numeric not null check(amount>=0),note text,created_by uuid references public.profiles(id),created_at timestamptz default now());
alter table public.finance_transactions enable row level security;
create policy finance_transactions_read on public.finance_transactions for select to authenticated using(public.is_admin() or public.current_staff_role()='finance');
create policy finance_transactions_write on public.finance_transactions for insert to authenticated with check((public.is_admin() or public.current_staff_role()='finance') and created_by=auth.uid());

create table if not exists public.staff_schedules(id uuid primary key default gen_random_uuid(),user_id uuid references public.profiles(id) on delete cascade,work_date date not null,start_time time,end_time time,note text,unique(user_id,work_date));
alter table public.staff_schedules enable row level security;
create policy staff_schedule_self on public.staff_schedules for select to authenticated using(user_id=auth.uid() or public.is_admin());

create table if not exists public.staff_compensation_visibility(user_id uuid primary key references public.profiles(id) on delete cascade,show_salary boolean default false,show_bonus boolean default false,salary numeric default 0,bonus numeric default 0,updated_at timestamptz default now());
alter table public.staff_compensation_visibility enable row level security;
create policy staff_comp_self on public.staff_compensation_visibility for select to authenticated using(user_id=auth.uid() or public.is_admin() or public.current_staff_role()='finance');

create table if not exists public.system_incidents(id uuid primary key default gen_random_uuid(),category text not null,severity text default 'normal',title text not null,details text,status text default 'open',created_by uuid references public.profiles(id),created_at timestamptz default now(),resolved_at timestamptz);
alter table public.system_incidents enable row level security;
create policy it_incidents_rw on public.system_incidents for all to authenticated using(public.is_admin() or public.current_staff_role()='it_admin') with check(public.is_admin() or public.current_staff_role()='it_admin');

create or replace function public.courier_record_event(p_assignment_id uuid,p_event text,p_note text default null,p_payment numeric default 0)
returns void language plpgsql security definer set search_path=public as $$ declare a public.staff_assignments%rowtype; begin
 select * into a from public.staff_assignments where id=p_assignment_id and assignee_id=auth.uid() and stage='delivery'; if not found or public.current_staff_role()<>'courier' then raise exception 'Not allowed'; end if;
 insert into public.delivery_events(assignment_id,order_id,courier_id,event_type,note,payment_amount) values(a.id,a.order_id,auth.uid(),p_event,p_note,coalesce(p_payment,0));
 if p_event='started' then update public.staff_assignments set status='in_progress',started_at=coalesce(started_at,now()) where id=a.id;
 elsif p_event='delivered' then update public.staff_assignments set status='completed',completed_at=now() where id=a.id;
 elsif p_event in ('customer_absent','wrong_address','returned','not_delivered') then update public.staff_assignments set status='waiting' where id=a.id; end if;
 if coalesce(p_payment,0)>0 then insert into public.finance_transactions(order_id,kind,method,amount,note,created_by) values(a.order_id,'payment','delivery_payment',p_payment,'Courier collection',auth.uid()); end if;
end $$;
grant execute on function public.courier_record_event(uuid,text,text,numeric) to authenticated;

create or replace function public.staff_my_summary() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('assigned',count(*) filter(where status='assigned'),'in_progress',count(*) filter(where status='in_progress'),'completed',count(*) filter(where status='completed'),'waiting',count(*) filter(where status='waiting')) from public.staff_assignments where assignee_id=auth.uid(); $$;
grant execute on function public.staff_my_summary() to authenticated;
notify pgrst,'reload schema';
