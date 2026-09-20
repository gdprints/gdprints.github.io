-- GDprint v7.5.3 — Order source / manager commission hardening
-- Website and Customer App orders must never create manager commission.

alter table public.orders add column if not exists source_channel text;

-- Backfill sources using the strongest available evidence first.
update public.orders o
set source_channel='customer_app'
where exists (
  select 1 from public.order_details d
  where d.order_id=o.id
    and coalesce(d.details->>'_created_from','') like 'customer_app%'
);

update public.orders o
set source_channel='website'
where exists (
  select 1 from public.order_files f
  where f.order_id=o.id
    and coalesce(f.storage_path,'') like 'website/%'
);

update public.orders
set source_channel='manager'
where source_channel is null
  and created_by_type='manager'
  and created_by_manager_id is not null;

update public.orders
set source_channel='website'
where source_channel is null;

alter table public.orders alter column source_channel set default 'website';
alter table public.orders alter column source_channel set not null;

DO $$ BEGIN
  alter table public.orders add constraint orders_source_channel_check
    check (source_channel in ('website','customer_app','manager','admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create or replace function public.normalize_order_source_attribution()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_role text;
begin
  -- Customer App RPCs set this transaction-local marker before INSERT.
  if current_setting('app.customer_order_rpc',true)='1' then
    new.source_channel := 'customer_app';
    new.created_by_type := 'customer';
    new.created_by_manager_id := null;
    return new;
  end if;

  -- Admin correction helper uses a transaction-local repair flag.
  if current_setting('app.order_source_repair',true)='1' and public.is_admin() then
    if new.source_channel='manager' then
      if new.created_by_manager_id is null or not exists(select 1 from public.profiles where id=new.created_by_manager_id and role='manager') then
        raise exception 'Valid manager is required';
      end if;
      new.created_by_type := 'manager';
    else
      new.created_by_manager_id := null;
      new.created_by_type := 'customer';
    end if;
    return new;
  end if;

  new.source_channel := coalesce(nullif(new.source_channel,''),'website');

  if new.source_channel='manager' then
    select role into v_role from public.profiles where id=auth.uid();
    if v_role <> 'manager' then
      raise exception 'Manager source requires an authenticated manager';
    end if;
    new.created_by_type := 'manager';
    new.created_by_manager_id := auth.uid();
  else
    -- Website / Customer App / Admin-created orders never generate manager commission.
    new.created_by_type := 'customer';
    new.created_by_manager_id := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_normalize_order_source_attribution on public.orders;
create trigger trg_normalize_order_source_attribution
before insert or update of source_channel,created_by_type,created_by_manager_id
on public.orders
for each row execute function public.normalize_order_source_attribution();

-- Leaderboard must count only orders truly created through the Manager channel.
create or replace function public.get_manager_leaderboard()
returns table(manager_id uuid,full_name text,orders_this_month bigint,revenue_this_month numeric)
language plpgsql stable security definer set search_path=public as $$
begin
  if not (public.is_admin() or public.current_staff_role()='manager') then
    raise exception 'Staff access required';
  end if;
  return query
  select p.id,p.full_name,
    count(o.id) filter(where o.created_at>=date_trunc('month',now()) and coalesce(o.status,'')<>'cancelled')::bigint,
    coalesce(sum(o.total_amount) filter(where o.created_at>=date_trunc('month',now()) and coalesce(o.status,'')<>'cancelled'),0)::numeric
  from public.profiles p
  left join public.orders o
    on o.created_by_manager_id=p.id
   and o.created_by_type='manager'
   and o.source_channel='manager'
  where p.role='manager'
    and coalesce(p.approval_status,'approved')='approved'
    and coalesce(p.account_status,'active')='active'
  group by p.id,p.full_name
  order by 4 desc,3 desc,p.full_name;
end $$;
revoke all on function public.get_manager_leaderboard() from public;
grant execute on function public.get_manager_leaderboard() to authenticated;

-- Admin-only correction helper for an already mis-attributed historical order.
create or replace function public.admin_set_order_source(
  p_order_number text,
  p_source text,
  p_manager_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_source not in ('website','customer_app','manager','admin') then raise exception 'Invalid source'; end if;
  if p_source='manager' and (p_manager_id is null or not exists(select 1 from public.profiles where id=p_manager_id and role='manager')) then
    raise exception 'Valid manager is required';
  end if;

  perform set_config('app.order_source_repair','1',true);
  update public.orders
  set source_channel=p_source,
      created_by_type=case when p_source='manager' then 'manager' else 'customer' end,
      created_by_manager_id=case when p_source='manager' then p_manager_id else null end
  where order_number=p_order_number;
  return found;
end $$;
revoke all on function public.admin_set_order_source(text,text,uuid) from public;
grant execute on function public.admin_set_order_source(text,text,uuid) to authenticated;

notify pgrst,'reload schema';
