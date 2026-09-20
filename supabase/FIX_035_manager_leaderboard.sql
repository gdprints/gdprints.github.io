-- GDprint Phase 8 hotfix
-- Fixes: ERROR 42P13 cannot change return type of existing function

DROP FUNCTION IF EXISTS public.get_manager_leaderboard();

CREATE OR REPLACE FUNCTION public.get_manager_leaderboard()
RETURNS TABLE(
  manager_id uuid,
  full_name text,
  orders_this_month bigint,
  revenue_this_month numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.current_staff_role()='manager') THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    count(o.id) FILTER (
      WHERE o.created_at >= date_trunc('month',now())
        AND coalesce(o.status,'') <> 'cancelled'
    )::bigint,
    coalesce(sum(o.total_amount) FILTER (
      WHERE o.created_at >= date_trunc('month',now())
        AND coalesce(o.status,'') <> 'cancelled'
    ),0)::numeric
  FROM public.profiles p
  LEFT JOIN public.orders o ON o.created_by_manager_id=p.id
  WHERE p.role='manager'
    AND coalesce(p.approval_status,'approved')='approved'
    AND coalesce(p.account_status,'active')='active'
  GROUP BY p.id,p.full_name
  ORDER BY 4 DESC,3 DESC,p.full_name;
END $$;

REVOKE ALL ON FUNCTION public.get_manager_leaderboard() FROM public;
GRANT EXECUTE ON FUNCTION public.get_manager_leaderboard() TO authenticated;
