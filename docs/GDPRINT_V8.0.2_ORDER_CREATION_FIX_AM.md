# GDprint v8.0.2 — Պատվերի գրանցման կենտրոնական շտկում

## Ինչ էր կոտրված
`trg_guard_customer_order_write` trigger-ը հաճախորդի Supabase session-ի առկայության դեպքում արգելափակում էր `orders` աղյուսակի գրառումները՝ վերադարձնելով՝
`Customer orders can only be changed through approved GDprint actions`։

Public Website և Manager «Նոր պատվեր» էջերը դեռ ուղղակի INSERT էին անում `orders`, `order_details`, `order_status_history` աղյուսակներում։ Customer App-ը օգտագործում էր RPC, բայց անվտանգության հին guard/marker կապը չափազանց փխրուն էր։

## Ինչ է փոխվել
- Ավելացվել է `047_order_creation_actions_fix.sql`։
- Website + Manager պատվերների համար ստեղծվել է մեկ canonical RPC՝ `create_gd_order(...)`։
- Customer App-ի `create_customer_order(...)` RPC-ն վերասահմանվել է և բացահայտ պահպանում է `source_channel='customer_app'`։
- `guard_customer_order_write()`-ը դարձել է role-aware․ Staff/Admin/Manager-ը չեն շփոթվում customer account-ի հետ։
- Customer-ի UPDATE/DELETE պաշտպանությունը պահպանվել է։
- Website/Manager ֆայլերի upload policy-ն այժմ ճանաչում է նաև manager-ի սեփական նոր պատվերը։
- Website/Manager browser code-ը այլևս direct INSERT չի անում `orders` աղյուսակում։
- Admin և Customer PWA cache version-ը բարձրացվել է `8.0.2`։

## Տեղադրում
1. Supabase → SQL Editor-ում գործարկել `supabase/047_order_creation_actions_fix.sql`։
2. Կայք/պանել/հավելված ֆայլերը փոխարինել FULL կամ HOTFIX փաթեթից։
3. Browser-ում Ctrl+F5։ Եթե PWA-ն դեռ հին cache ունի՝ փակել/վերաբացել հավելվածը մեկ անգամ։

## Ստուգում
SQL Editor-ում՝
```sql
select public.gd_order_creation_health();
```
Սպասվող հիմնական արժեքները՝
- `version`: `8.0.2`
- `create_gd_order_ready`: `true`
- `create_customer_order_ready`: `true`
- `guard_trigger_ready`: `true`

Այնուհետև փորձարկել 3 աղբյուրից՝ Website, Manager → Նոր պատվեր, Customer App։
