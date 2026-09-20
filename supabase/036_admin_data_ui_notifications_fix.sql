-- ============================================================
-- GDprint v7.3.2 / Phase 8 hotfix
-- Fixes:
-- 1) Admin Work Distribution data loading
-- 2) Admin Orders ERP data loading
-- 3) Staff -> Admin notes/messages/notifications
-- 4) Robust Admin master-data CRUD backend
-- Run AFTER 035_integration_hardening.sql
-- ============================================================

-- ---------- Admin data bundles (RLS-safe) ----------
drop function if exists public.admin_work_distribution_bundle();
create function public.admin_work_distribution_bundle()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'employees', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.full_name nulls last, x.employee_id)
      from (
        select p.id,p.employee_id,p.full_name,p.role,p.approval_status,p.account_status
        from public.profiles p
        where p.role is not null and p.role <> 'customer'
          and coalesce(p.approval_status,'approved')='approved'
          and coalesce(p.account_status,'active')='active'
      ) x
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.deadline nulls last, x.created_at desc)
      from (
        select a.*,
          (select e.message from public.staff_task_events e
            where e.assignment_id=a.id and nullif(trim(coalesce(e.message,'')),'') is not null
            order by e.created_at desc limit 1) as latest_note,
          (select e.created_at from public.staff_task_events e
            where e.assignment_id=a.id and nullif(trim(coalesce(e.message,'')),'') is not null
            order by e.created_at desc limit 1) as latest_note_at
        from public.staff_assignments a
      ) x
    ), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.admin_work_distribution_bundle() from public;
grant execute on function public.admin_work_distribution_bundle() to authenticated;


drop function if exists public.admin_orders_erp_list();
create function public.admin_orders_erp_list()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc),'[]'::jsonb)
  into out from public.orders o;
  return out;
end $$;
revoke all on function public.admin_orders_erp_list() from public;
grant execute on function public.admin_orders_erp_list() to authenticated;

-- ---------- Staff notes -> Admin notification center ----------
-- Keep Phase 8 production guards intact. Notifications are added to the
-- low-level status helper so ordinary tasks AND production hand-offs reach Admin.
create or replace function public.gd_set_assignment_status(p_assignment_id uuid,p_status text,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare
  v public.staff_assignments%rowtype;
  v_staff_name text;
  v_note text := nullif(trim(coalesce(p_note,'')),'');
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
  values(p_assignment_id,auth.uid(),'status_change',v_note);

  select coalesce(full_name,employee_id,email,'Աշխատակից') into v_staff_name
  from public.profiles where id=auth.uid();

  if not public.is_admin() and (v_note is not null or p_status in ('waiting','completed','cancelled')) then
    insert into public.notifications(recipient_id,type,title,message,link)
    select p.id,'staff_update','Աշխատակցի թարմացում',
      coalesce(v_staff_name,'Աշխատակից')||' · '||coalesce(v.title,'Աշխատանք')||' → '||p_status||
      case when v_note is not null then E'\nՆշում՝ '||v_note else '' end,
      'work-distribution.html'
    from public.profiles p
    where p.role='admin' and coalesce(p.account_status,'active')='active';
  end if;

  begin
    insert into public.activity_log(actor_id,action,target_table,target_id)
    values(auth.uid(),'Աշխատանքի կարգավիճակ → '||p_status||case when v_note is not null then ' · նշում' else '' end,'staff_assignments',p_assignment_id);
  exception when others then null; end;
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

-- Staff chat messages must also reach the Admin notification center.
create or replace function public.notify_admins_staff_chat()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_sender text; v_role text;
begin
  select coalesce(full_name,employee_id,email,'Աշխատակից'), role
  into v_sender,v_role from public.profiles where id=new.sender_id;

  if coalesce(v_role,'') <> 'admin' then
    insert into public.notifications(recipient_id,type,title,message,link)
    select p.id,'staff_message','Նոր հաղորդագրություն աշխատակցից',
      coalesce(v_sender,'Աշխատակից')||': '||left(new.message,700),
      'messages.html'
    from public.profiles p
    where p.role='admin' and coalesce(p.account_status,'active')='active';
  end if;
  return new;
end $$;

drop trigger if exists trg_notify_admins_staff_chat on public.staff_chat_messages;
create trigger trg_notify_admins_staff_chat
after insert on public.staff_chat_messages
for each row execute function public.notify_admins_staff_chat();

-- Best effort realtime for the staff chat table.
do $$ begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='staff_chat_messages'
  ) then
    alter publication supabase_realtime add table public.staff_chat_messages;
  end if;
exception when others then null; end $$;

-- ---------- RLS-safe master-data API ----------
drop function if exists public.admin_master_data_list(text);
create function public.admin_master_data_list(p_module text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_module='services' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order,x.name_hy),'[]'::jsonb) into out from public.service_catalog x;
  elsif p_module='marketing' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into out from public.marketing_campaigns x;
  elsif p_module='website_content' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.content_key,x.locale),'[]'::jsonb) into out from public.website_content x;
  else
    raise exception 'Unknown module';
  end if;
  return out;
end $$;
revoke all on function public.admin_master_data_list(text) from public;
grant execute on function public.admin_master_data_list(text) to authenticated;


drop function if exists public.admin_master_data_save(text,uuid,jsonb);
create function public.admin_master_data_save(p_module text,p_id uuid,p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare rid uuid; v_title text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  if p_module='services' then
    if nullif(trim(coalesce(p_payload->>'name_hy','')),'') is null then raise exception 'Service name is required'; end if;
    if p_id is null then
      insert into public.service_catalog(code,name_hy,name_ru,name_en,category,base_price,unit,min_qty,active,website_visible,sort_order,pricing_config,updated_at)
      values(
        nullif(trim(p_payload->>'code'),''), trim(p_payload->>'name_hy'), nullif(trim(p_payload->>'name_ru'),''), nullif(trim(p_payload->>'name_en'),''),
        nullif(trim(p_payload->>'category'),''), coalesce(nullif(p_payload->>'base_price','')::numeric,0), coalesce(nullif(trim(p_payload->>'unit'),''),'հատ'),
        coalesce(nullif(p_payload->>'min_qty','')::numeric,1), coalesce((p_payload->>'active')::boolean,true), coalesce((p_payload->>'website_visible')::boolean,true),
        coalesce(nullif(p_payload->>'sort_order','')::int,0), coalesce(p_payload->'pricing_config','{}'::jsonb), now()
      ) returning id into rid;
    else
      update public.service_catalog set
        code=nullif(trim(p_payload->>'code'),''), name_hy=trim(p_payload->>'name_hy'), name_ru=nullif(trim(p_payload->>'name_ru'),''),
        name_en=nullif(trim(p_payload->>'name_en'),''), category=nullif(trim(p_payload->>'category'),''), base_price=coalesce(nullif(p_payload->>'base_price','')::numeric,0),
        unit=coalesce(nullif(trim(p_payload->>'unit'),''),'հատ'), min_qty=coalesce(nullif(p_payload->>'min_qty','')::numeric,1),
        active=coalesce((p_payload->>'active')::boolean,true), website_visible=coalesce((p_payload->>'website_visible')::boolean,true),
        sort_order=coalesce(nullif(p_payload->>'sort_order','')::int,0), updated_at=now()
      where id=p_id returning id into rid;
    end if;

  elsif p_module='marketing' then
    v_title=nullif(trim(coalesce(p_payload->>'title','')),'');
    if v_title is null then raise exception 'Campaign title is required'; end if;
    if coalesce(p_payload->>'kind','') not in ('discount','offer','advertisement') then raise exception 'Invalid campaign kind'; end if;
    if p_id is null then
      insert into public.marketing_campaigns(kind,title,description,discount_type,discount_value,promo_code,starts_at,ends_at,active,target,banner_url,cta_url,created_by,updated_at)
      values(p_payload->>'kind',v_title,nullif(trim(p_payload->>'description'),''),nullif(p_payload->>'discount_type',''),nullif(p_payload->>'discount_value','')::numeric,
        nullif(trim(p_payload->>'promo_code'),''),nullif(p_payload->>'starts_at','')::timestamptz,nullif(p_payload->>'ends_at','')::timestamptz,
        coalesce((p_payload->>'active')::boolean,true),coalesce(nullif(trim(p_payload->>'target'),''),'all'),nullif(trim(p_payload->>'banner_url'),''),nullif(trim(p_payload->>'cta_url'),''),auth.uid(),now())
      returning id into rid;
    else
      update public.marketing_campaigns set kind=p_payload->>'kind',title=v_title,description=nullif(trim(p_payload->>'description'),''),discount_type=nullif(p_payload->>'discount_type',''),
        discount_value=nullif(p_payload->>'discount_value','')::numeric,promo_code=nullif(trim(p_payload->>'promo_code'),''),starts_at=nullif(p_payload->>'starts_at','')::timestamptz,
        ends_at=nullif(p_payload->>'ends_at','')::timestamptz,active=coalesce((p_payload->>'active')::boolean,true),target=coalesce(nullif(trim(p_payload->>'target'),''),'all'),
        banner_url=nullif(trim(p_payload->>'banner_url'),''),cta_url=nullif(trim(p_payload->>'cta_url'),''),updated_at=now()
      where id=p_id returning id into rid;
    end if;

  elsif p_module='website_content' then
    if nullif(trim(coalesce(p_payload->>'content_key','')),'') is null then raise exception 'Content key is required'; end if;
    if coalesce(p_payload->>'locale','hy') not in ('hy','ru','en') then raise exception 'Invalid locale'; end if;
    if p_id is null then
      insert into public.website_content(content_key,locale,title,body,media_url,active,updated_by,updated_at)
      values(trim(p_payload->>'content_key'),coalesce(p_payload->>'locale','hy'),nullif(trim(p_payload->>'title'),''),p_payload->>'body',nullif(trim(p_payload->>'media_url'),''),coalesce((p_payload->>'active')::boolean,true),auth.uid(),now())
      returning id into rid;
    else
      update public.website_content set content_key=trim(p_payload->>'content_key'),locale=coalesce(p_payload->>'locale','hy'),title=nullif(trim(p_payload->>'title'),''),
        body=p_payload->>'body',media_url=nullif(trim(p_payload->>'media_url'),''),active=coalesce((p_payload->>'active')::boolean,true),updated_by=auth.uid(),updated_at=now()
      where id=p_id returning id into rid;
    end if;
  else
    raise exception 'Unknown module';
  end if;

  if rid is null then raise exception 'Record not found or not saved'; end if;
  return rid;
end $$;
revoke all on function public.admin_master_data_save(text,uuid,jsonb) from public;
grant execute on function public.admin_master_data_save(text,uuid,jsonb) to authenticated;
