-- GDprint v7.3.3 — diagnostic-only fix for gd_staff_bridge_health()
-- Safe to run after FIX_037_staff_admin_bridge_repair.sql.
-- This does NOT alter Staff/Admin chat data or workflow logic.

DROP FUNCTION IF EXISTS public.gd_staff_bridge_health();

CREATE FUNCTION public.gd_staff_bridge_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  -- SQL Editor/server context has no end-user JWT (auth.uid() IS NULL).
  -- Browser/app callers have auth.uid(); those callers must be Admin.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN jsonb_build_object(
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
END $$;

REVOKE ALL ON FUNCTION public.gd_staff_bridge_health() FROM public,anon;
GRANT EXECUTE ON FUNCTION public.gd_staff_bridge_health() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Run the diagnostic immediately in SQL Editor:
SELECT public.gd_staff_bridge_health();
