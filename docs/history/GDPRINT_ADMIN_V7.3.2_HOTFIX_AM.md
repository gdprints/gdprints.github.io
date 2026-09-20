# GDprint ADMIN v7.3.2 — Phase 8 Hotfix

Այս տարբերակը ուղղում է օգտագործողի կողմից նշված 4 խնդիրները։

## 1. Աշխատանքների բաշխում
- Հեռացվել է `stage-filter` / `stage_filter` սխալ DOM կապը։
- Էջը տվյալները ստանում է Admin-only `admin_work_distribution_bundle()` RPC-ից։
- Ցուցադրվում է նաև աշխատակցի վերջին փոխանցած նշումը։

## 2. Բոլոր պատվերները
- Հեռացվել են `m-stage` / `m_stage`, `m-priority` / `m_priority` և նման implicit-global սխալները։
- Պատվերները բեռնվում են `admin_orders_erp_list()` Admin-only RPC-ից, ուստի Customer RLS-ը այլևս չի արգելափակում Admin ERP ցուցակը։
- Workflow modal-ը աշխատում է explicit DOM binding-ով։

## 3. Աշխատակից → Admin հաղորդագրություններ / նշումներ
- Staff portal-ի `staff_chat_messages` ալիքը միացված է Admin Messages էջին։
- Admin-ը տեսնում է աշխատակիցների առանձին զրույցները և կարող է պատասխանել։
- Նոր staff հաղորդագրությունը ստեղծում է Admin notification։
- Առաջադրանքի note / waiting / completed փոփոխությունները ստեղծում են Admin notification։
- Work Distribution էջում երևում է առաջադրանքի վերջին note-ը։
- Staff Messages էջում լռելյայն ընտրվում է Admin-ը։

## 4. Ծառայություններ / Marketing / Website Content modal-ներ
- Native `<dialog>`-ները փոխարինվել են միասնական controlled modal overlay-ով։
- Աշխատում են Open / Close / Backdrop / Escape / Submit։
- Չկա `method="dialog"` async save conflict։
- CRUD-ը գնում է Admin-only `admin_master_data_list()` / `admin_master_data_save()` RPC-ներով։

## Supabase — պարտադիր քայլ
Եթե արդեն հաջողությամբ գործարկել եք 035 migration-ը, հիմա SQL Editor-ում գործարկեք միայն՝

`supabase/036_admin_data_ui_notifications_fix.sql`

Migration-ը նախատեսված է կրկին գործարկվելու համար ևս՝ functions/triggers-ը անվտանգ վերաստեղծվում են։

## Թարմացվող հիմնական ֆայլերը
- `admin/admin/js/work-distribution.js`
- `admin/admin/js/orders.js`
- `admin/admin/js/messages.js`
- `admin/staff/js/staff.js`
- `admin/staff/messages.html`
- `admin/admin/master-data.html`
- `admin/admin/marketing.html`
- `admin/admin/website-content.html`
- `admin/admin/js/master-data.js`
- `admin/admin/js/marketing.js`
- `admin/admin/js/website-content.js`
- `admin/shared/css/erp-redesign.css`
- `admin/shared/js/ui.js`
- `supabase/036_admin_data_ui_notifications_fix.sql`

## Static verification
- Admin HTML files: 40
- Broken local links: 0
- Duplicate IDs: 0
- Missing RPC references: 0
- JavaScript syntax failures: 0

Նշում․ իրական Supabase տվյալների վրա end-to-end փորձարկումը պետք է անել migration-ը ձեր project-ում գործարկելուց հետո։
