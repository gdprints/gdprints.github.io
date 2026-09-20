# GDprint v7.5.4 — LTP-992313 targeted repair

1. Supabase SQL Editor-ում գործարկել `supabase/040_targeted_order_source_repair.sql`։
2. Վերջնական SELECT-ում LTP-992313-ի համար պետք է լինի՝
   - source_channel = website
   - created_by_type = customer
   - created_by_manager_id = NULL
3. Upload անել թարմացված admin/shared/js/analytics.js և admin/admin/js/managers.js ֆայլերը կամ ամբողջ ZIP-ը։
4. Browser-ում Ctrl+F5 / PWA restart։

Analytics-ը և Managers էջը v7.5.4-ից սկսած manager commission են հաշվում միայն source_channel='manager' պատվերների համար։
