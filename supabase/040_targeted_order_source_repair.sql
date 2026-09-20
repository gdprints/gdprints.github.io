-- GDprint v7.5.4 — targeted source repair + strict attribution consistency
-- User-confirmed website order: LTP-992313

-- 1) Diagnostic BEFORE (safe to inspect in SQL Editor)
select
  order_number,
  source_channel,
  created_by_type,
  created_by_manager_id,
  total_amount,
  payment_status,
  status,
  created_at
from public.orders
where order_number = 'LTP-992313';

-- 2) Repair the confirmed website order.
-- The v7.5.3 normalization trigger will also keep manager attribution cleared.
update public.orders
set source_channel = 'website',
    created_by_type = 'customer',
    created_by_manager_id = null
where order_number = 'LTP-992313';

-- Keep order metadata consistent when order_details exists.
update public.order_details d
set details = jsonb_set(coalesce(d.details, '{}'::jsonb), '{_created_from}', '"website"'::jsonb, true)
where d.order_id in (
  select id from public.orders where order_number = 'LTP-992313'
);

-- 3) Repair any other rows that already have explicit website/customer-app evidence.
update public.orders o
set source_channel = 'website',
    created_by_type = 'customer',
    created_by_manager_id = null
where exists (
  select 1 from public.order_details d
  where d.order_id = o.id
    and coalesce(d.details->>'_created_from','') = 'website'
)
and (
  o.source_channel is distinct from 'website'
  or o.created_by_type is distinct from 'customer'
  or o.created_by_manager_id is not null
);

update public.orders o
set source_channel = 'customer_app',
    created_by_type = 'customer',
    created_by_manager_id = null
where exists (
  select 1 from public.order_details d
  where d.order_id = o.id
    and coalesce(d.details->>'_created_from','') like 'customer_app%'
)
and (
  o.source_channel is distinct from 'customer_app'
  or o.created_by_type is distinct from 'customer'
  or o.created_by_manager_id is not null
);

-- 4) New/updated rows must remain attribution-consistent.
-- NOT VALID avoids blocking installation because of unrelated historical rows,
-- while still enforcing the rule for future INSERT/UPDATE operations.
do $$
begin
  alter table public.orders
    add constraint orders_manager_attribution_consistency
    check (
      (source_channel = 'manager' and created_by_type = 'manager' and created_by_manager_id is not null)
      or
      (source_channel <> 'manager' and created_by_manager_id is null and created_by_type <> 'manager')
    ) not valid;
exception when duplicate_object then null;
end $$;

-- 5) Strict leaderboard: only explicit manager-source orders count.
drop function if exists public.get_manager_leaderboard();
create function public.get_manager_leaderboard()
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

notify pgrst,'reload schema';

-- 6) Diagnostic AFTER — these three fields must be website/customer/NULL.
select
  order_number,
  source_channel,
  created_by_type,
  created_by_manager_id,
  total_amount,
  payment_status,
  status,
  created_at
from public.orders
where order_number = 'LTP-992313';
