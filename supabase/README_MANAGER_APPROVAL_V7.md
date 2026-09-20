# GDprint v7 — Manager approval fix

## Required (approval)
Run this once in **Supabase → SQL Editor**:

`003_manager_approval_rpc.sql`

This creates `public.set_manager_approval(...)`. The Admin panel now uses this RPC to approve/reject managers. Approval no longer depends on any Edge Function.

## Optional (welcome email)
Email is a separate, best-effort step. To send it, deploy:

`supabase/functions/manager-email/index.ts`

Function name: `manager-email`

Required secrets:
- `RESEND_API_KEY`
- `WELCOME_FROM_EMAIL` (example: `GDprint <hello@your-domain.am>`)

If the email function is missing or misconfigured, the manager is still approved and can log in.

## Previous migration
`002_manager_approval_notifications.sql` is still required if you have not run it before.
