-- GDprint v7: robust manager approval RPC
-- Run ONCE after 002_manager_approval_notifications.sql.
-- Approval no longer depends on an Edge Function being deployed.

create or replace function public.set_manager_approval(
  p_manager_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_manager public.profiles%rowtype;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Invalid approval status';
  end if;

  select * into v_actor
  from public.profiles
  where id = auth.uid();

  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'Admin access required';
  end if;

  select * into v_manager
  from public.profiles
  where id = p_manager_id and role = 'manager'
  for update;

  if v_manager.id is null then
    raise exception 'Manager not found';
  end if;

  update public.profiles
  set approval_status = p_status
  where id = p_manager_id;

  insert into public.notifications (recipient_id, type, title, message, link)
  values (
    p_manager_id,
    case when p_status = 'approved' then 'manager_approved' else 'manager_rejected' end,
    case when p_status = 'approved' then 'Ձեր հաշիվը հաստատվել է' else 'Գրանցման կարգավիճակ' end,
    case when p_status = 'approved'
      then 'Բարի գալուստ GDprint։ Ձեր մենեջերի հաշիվը ակտիվ է, և այժմ կարող եք մուտք գործել։'
      else 'Ձեր մենեջերի գրանցումը չի հաստատվել։ Լրացուցիչ տեղեկության համար կապվեք ադմինիստրատորի հետ։'
    end,
    case when p_status = 'approved' then 'dashboard.html' else null end
  );

  -- Activity log is optional across installations. Do not block approval if it fails.
  begin
    insert into public.activity_log (actor_id, action, target_table, target_id)
    values (
      v_actor.id,
      (case when p_status = 'approved' then 'Հաստատեց' else 'Մերժեց' end) ||
        ' մենեջեր ' || coalesce(v_manager.full_name, v_manager.email, v_manager.id::text),
      'profiles',
      v_manager.id
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'manager_id', p_manager_id,
    'status', p_status,
    'email', v_manager.email,
    'full_name', v_manager.full_name
  );
end;
$$;

revoke all on function public.set_manager_approval(uuid, text) from public;
grant execute on function public.set_manager_approval(uuid, text) to authenticated;
