-- ============================================================
-- GDprint v7.3.3 — Staff/Admin bridge repair
-- Run AFTER 036_admin_data_ui_notifications_fix.sql
-- Repairs a live DB where older staff RPC migrations were skipped or
-- PostgREST schema cache is stale. Safe to re-run.
-- ============================================================

-- ---------- 1. Missing order context RPC ----------
drop function if exists public.staff_my_order_contexts();
create function public.staff_my_order_contexts()
returns table(
  order_id uuid,
  order_number text,
  service_key text,
  service_name text,
  order_status text,
  description text,
  language text,
  customer_name text,
  order_created_at timestamptz,
  details jsonb,
  delivery_method text,
  file_count bigint,
  proof_count bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    o.id,
    o.order_number,
    o.service_key,
    o.service_name,
    o.status,
    o.description,
    o.language,
    o.customer_name,
    o.created_at,
    coalesce(od.details,'{}'::jsonb),
    dd.delivery_method,
    (select count(*) from public.order_files f where f.order_id=o.id),
    (select count(*) from public.order_design_proofs p where p.order_id=o.id)
  from public.orders o
  join (
    select distinct a.order_id
    from public.staff_assignments a
    where a.assignee_id=auth.uid()
      and a.order_id is not null
      and a.status <> 'cancelled'
  ) assigned on assigned.order_id=o.id
  left join lateral (
    select d.details
    from public.order_details d
    where d.order_id=o.id
    order by d.id desc
    limit 1
  ) od on true
  left join public.order_delivery_details dd on dd.order_id=o.id
  where public.is_staff()
  order by o.created_at desc;
$$;
revoke all on function public.staff_my_order_contexts() from public,anon;
grant execute on function public.staff_my_order_contexts() to authenticated;

-- ---------- 2. Rebuild directory used by Staff/Admin chat ----------
drop function if exists public.staff_directory();
create function public.staff_directory()
returns table(id uuid,employee_id text,full_name text,role text)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,p.employee_id,p.full_name,p.role
  from public.profiles p
  where public.is_staff()
    and p.role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')
    and coalesce(p.approval_status,'approved')='approved'
    and coalesce(p.account_status,'active')='active'
  order by case when p.role='admin' then 0 else 1 end,
           p.full_name nulls last,p.employee_id;
$$;
revoke all on function public.staff_directory() from public,anon;
grant execute on function public.staff_directory() to authenticated;

-- ---------- 3. One RLS-independent chat bridge for both sides ----------
drop function if exists public.staff_chat_bundle();
create function public.staff_chat_bundle()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare out jsonb; v_role text;
begin
  select role into v_role from public.profiles
  where id=auth.uid()
    and coalesce(approval_status,'approved')='approved'
    and coalesce(account_status,'active')='active';
  if v_role is null or v_role not in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') then
    raise exception 'Staff access required';
  end if;

  select jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'employee_id',p.employee_id,'full_name',p.full_name,'role',p.role
      ) order by case when p.role='admin' then 0 else 1 end,p.full_name nulls last,p.employee_id)
      from public.profiles p
      where p.role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')
        and coalesce(p.approval_status,'approved')='approved'
        and coalesce(p.account_status,'active')='active'
    ),'[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'sender_id',m.sender_id,'recipient_id',m.recipient_id,
        'message',m.message,'is_read',m.is_read,'created_at',m.created_at
      ) order by m.created_at)
      from public.staff_chat_messages m
      where v_role='admin'
         or m.sender_id=auth.uid()
         or m.recipient_id=auth.uid()
         or m.recipient_id is null
    ),'[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.staff_chat_bundle() from public,anon;
grant execute on function public.staff_chat_bundle() to authenticated;


drop function if exists public.staff_chat_send(uuid,text);
create function public.staff_chat_send(p_recipient_id uuid,p_message text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare rid uuid; v_role text; v_recipient_role text;
begin
  select role into v_role from public.profiles
  where id=auth.uid()
    and coalesce(approval_status,'approved')='approved'
    and coalesce(account_status,'active')='active';
  if v_role is null or v_role not in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') then
    raise exception 'Staff access required';
  end if;
  if nullif(trim(coalesce(p_message,'')),'') is null then raise exception 'Message is required'; end if;
  if length(trim(p_message))>4000 then raise exception 'Message is too long'; end if;

  if p_recipient_id is not null then
    select role into v_recipient_role from public.profiles
    where id=p_recipient_id
      and role in ('admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin')
      and coalesce(approval_status,'approved')='approved'
      and coalesce(account_status,'active')='active';
    if v_recipient_role is null then raise exception 'Recipient is not available'; end if;
  end if;

  insert into public.staff_chat_messages(sender_id,recipient_id,message)
  values(auth.uid(),p_recipient_id,trim(p_message)) returning id into rid;
  return rid;
end $$;
revoke all on function public.staff_chat_send(uuid,text) from public,anon;
grant execute on function public.staff_chat_send(uuid,text) to authenticated;


drop function if exists public.staff_chat_mark_read(uuid);
create function public.staff_chat_mark_read(p_sender_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare n integer;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  update public.staff_chat_messages
     set is_read=true
   where recipient_id=auth.uid()
     and sender_id=p_sender_id
     and is_read=false;
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function public.staff_chat_mark_read(uuid) from public,anon;
grant execute on function public.staff_chat_mark_read(uuid) to authenticated;

-- ---------- 4. Guarantee staff chat -> Admin notification ----------
create or replace function public.notify_admins_staff_chat()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_sender text; v_role text;
begin
  select coalesce(full_name,employee_id,email,'Աշխատակից'),role
    into v_sender,v_role
  from public.profiles where id=new.sender_id;

  if coalesce(v_role,'') <> 'admin' then
    insert into public.notifications(recipient_id,type,title,message,link)
    select p.id,'staff_message','Նոր հաղորդագրություն աշխատակցից',
      coalesce(v_sender,'Աշխատակից')||': '||left(new.message,700),
      'messages.html'
    from public.profiles p
    where p.role='admin'
      and coalesce(p.approval_status,'approved')='approved'
      and coalesce(p.account_status,'active')='active';
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_admins_staff_chat on public.staff_chat_messages;
create trigger trg_notify_admins_staff_chat
after insert on public.staff_chat_messages
for each row execute function public.notify_admins_staff_chat();

-- ---------- 5. Live diagnostic ----------
drop function if exists public.gd_staff_bridge_health();
create function public.gd_staff_bridge_health()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  -- Supabase SQL Editor runs without an end-user JWT, therefore auth.uid() is NULL.
  -- Allow that trusted SQL-editor/server context for diagnostics, while an authenticated
  -- application user must still be an Admin.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  return jsonb_build_object(
    'staff_my_assignments',to_regprocedure('public.staff_my_assignments()') is not null,
    'staff_my_order_contexts',to_regprocedure('public.staff_my_order_contexts()') is not null,
    'staff_directory',to_regprocedure('public.staff_directory()') is not null,
    'staff_chat_bundle',to_regprocedure('public.staff_chat_bundle()') is not null,
    'staff_chat_send',to_regprocedure('public.staff_chat_send(uuid,text)') is not null,
    'staff_chat_mark_read',to_regprocedure('public.staff_chat_mark_read(uuid)') is not null,
    'staff_chat_rows',(select count(*) from public.staff_chat_messages),
    'active_admins',(select count(*) from public.profiles where role='admin' and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active'),
    'active_staff',(select count(*) from public.profiles where role in ('manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin') and coalesce(approval_status,'approved')='approved' and coalesce(account_status,'active')='active')
  );
end $$;
revoke all on function public.gd_staff_bridge_health() from public,anon;
grant execute on function public.gd_staff_bridge_health() to authenticated;

-- Realtime is optional; direct refresh works even if publication cannot be changed.
do $$ begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='staff_chat_messages'
  ) then
    alter publication supabase_realtime add table public.staff_chat_messages;
  end if;
exception when others then null; end $$;

-- Force PostgREST/Supabase API to see the recreated RPCs immediately.
notify pgrst, 'reload schema';
