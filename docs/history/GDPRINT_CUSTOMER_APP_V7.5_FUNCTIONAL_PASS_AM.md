# GDprint Customer App v7.5 — Functional Pass

Այս փուլը կառուցված է v7.4.1 Brand Assets տարբերակի վրա։

## Ավելացված է
- Հաղորդագրությունների առանձին էջ՝ պատվերների thread-երով։
- Պատվերի էջում ամբողջ Customer ↔ GDprint հաղորդակցության պատմություն։
- Customer-ի հաղորդագրությունը Admin-ին ստեղծում է notification։
- Admin/Staff պատասխանը Customer App-ում ստեղծում է notification։
- Ավարտված/առաքված պատվերի մեկ սեղմումով կրկնում։
- Forgot password / Reset password։
- Պրոֆիլից գաղտնաբառի փոփոխում։
- Bottom navigation-ում առանձին «Հաղորդագրություններ»։
- PWA cache/shortcuts թարմացված։

## Supabase
Նախորդ migration-ներից հետո գործարկել `supabase/038_customer_app_messages_security.sql`։

Supabase Auth → URL Configuration-ում Redirect URLs-ում ավելացրեք production app-ի `reset-password.html` հասցեն, օրինակ՝ `https://YOUR-DOMAIN/app/reset-password.html`։
