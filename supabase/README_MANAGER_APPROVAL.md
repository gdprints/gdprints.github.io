# GDprint — Manager approval, welcome email, notifications

## 1. Run the SQL migration
In Supabase Dashboard → SQL Editor, run:

`002_manager_approval_notifications.sql`

Run `001_app_settings.sql` first if you have not already run it.

The migration:
- adds `profiles.approval_status` (`pending`, `approved`, `rejected`),
- keeps existing accounts approved,
- makes future manager registrations pending,
- creates the `notifications` table + RLS,
- notifies admins about new manager registrations and new orders,
- notifies recipients about internal messages,
- enables Realtime for notifications.

## 2. Configure welcome emails
The approval Edge Function sends email server-side through Resend. Never put the Resend API key in browser JavaScript.

In Supabase Dashboard → Edge Functions → Secrets add:
- `RESEND_API_KEY` = your Resend API key
- `WELCOME_FROM_EMAIL` = e.g. `GDprint <manager@your-verified-domain.am>`

The sender/domain must be verified in your email provider.

## 3. Deploy the Edge Function
Deploy the folder:

`supabase/functions/manager-approval/`

Function name must be exactly:

`manager-approval`

The standard Supabase secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used by the function on the server.

After deployment, Admin → Մենեջերներ → Հաստատել will:
1. verify the caller is an admin,
2. set the manager to `approved`,
3. create an in-app notification for the manager,
4. send the welcome email,
5. write an activity-log entry when that table is available.

If `RESEND_API_KEY` is not configured, approval still succeeds, but the Admin UI shows that email was not sent.
