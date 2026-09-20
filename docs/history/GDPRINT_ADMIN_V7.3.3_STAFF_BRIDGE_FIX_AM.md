# GDprint ADMIN v7.3.3 — Staff/Admin Bridge Repair

Այս hotfix-ը ուղղում է live Supabase schema-ի և frontend-ի անհամապատասխանությունը։

## Գլխավոր խնդիր
Console-ում `PGRST202` էր ստացվում `staff_my_order_contexts()` RPC-ի համար։ Ֆունկցիան նախագծի հին migration-ում կար, բայց live Supabase schema-ում չկար կամ PostgREST schema cache-ը չէր տեսնում այն։

## Ինչ է ուղղվել
- Վերաստեղծվում է `staff_my_order_contexts()` RPC-ը։
- Վերաստեղծվում է `staff_directory()`։
- Ավելացվում է միասնական Staff/Admin chat bridge՝
  - `staff_chat_bundle()`
  - `staff_chat_send(uuid,text)`
  - `staff_chat_mark_read(uuid)`
- Staff -> Admin հաղորդագրությունը ավտոմատ ստեղծում է Admin notification։
- Staff և Admin Messages frontend-ները այլևս ուղղակիորեն չեն կախված `staff_chat_messages` table RLS-ից։
- Ավելացվել է `gd_staff_bridge_health()` diagnostic RPC։
- Migration-ի վերջում կատարվում է `NOTIFY pgrst, 'reload schema'`։

## Տեղադրում
Supabase → SQL Editor-ում ամբողջությամբ գործարկել՝

`supabase/037_staff_admin_bridge_repair.sql`

Այն նախատեսված է 036-ից հետո և անվտանգ է կրկին գործարկելու համար։

Հաջող գործարկումից հետո Admin account-ով կարող եք ստուգել՝

```sql
select public.gd_staff_bridge_health();
```

Պետք է RPC դաշտերը վերադարձվեն `true`, իսկ `active_admins`-ը լինի առնվազն 1։

Այնուհետև կայքի նոր ֆայլերը տեղադրել և browser-ում կատարել hard refresh (Ctrl+F5)։

## Ստուգման սցենար
1. Մուտք գործել աշխատակցի հաշվով։
2. Staff Dashboard/Tasks-ում չպետք է լինի `PGRST202 staff_my_order_contexts`։
3. Բացել Staff → Հաղորդագրություններ։ Admin-ը պետք է ավտոմատ ընտրված լինի։
4. Ուղարկել փորձնական հաղորդագրություն։
5. Admin → Հաղորդագրություններ բաժնում աշխատակցի thread-ը պետք է երևա։
6. Admin notification center-ում պետք է ստեղծվի «Նոր հաղորդագրություն աշխատակցից» notification։
7. Admin-ից պատասխանել աշխատակցին և Staff էջը թարմացնել՝ պատասխանն այնտեղ պետք է երևա։
