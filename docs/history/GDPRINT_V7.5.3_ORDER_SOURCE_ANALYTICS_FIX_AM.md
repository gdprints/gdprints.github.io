# GDprint v7.5.3 — Order Source / Analytics / Manager Commission Fix

## Ինչ է շտկվել

1. Պատվերներին ավելացվել է `source_channel`՝ `website`, `customer_app`, `manager`, `admin`։
2. Կայքից գրանցված պատվերը այլևս չի կարող ստանալ manager commission։
3. Customer App-ի պատվերը նույնպես չի վերագրվում manager-ին։
4. Manager commission-ը հաշվարկվում է միայն այն դեպքում, երբ միաժամանակ՝
   - `created_by_type = 'manager'`
   - `created_by_manager_id IS NOT NULL`
   - `source_channel = 'manager'`
5. Manager Dashboard-ը և Analytics-ը ֆիլտրում են միայն իրական manager պատվերները։
6. Admin Dashboard-ում աղբյուրը ցուցադրվում է՝ Կայք / Customer App / Մենեջեր։
7. Leaderboard RPC-ն նույնպես հաշվում է միայն manager source պատվերները։
8. Կայքի HY/RU/EN էջերում order submit JS cache version-ը բարձրացվել է v7.5.3։
9. Admin PWA cache-ը բարձրացվել է `gdprint-admin-v7-5-3`։

## Տեղադրման հերթականություն

**Կարևոր՝ նախ SQL, հետո կայքի նոր ֆայլերը։**

Supabase SQL Editor-ում գործարկեք՝

`supabase/039_order_source_commission_fix.sql`

Հետո upload արեք v7.5.3 ֆայլերը և browser-ում կատարեք Ctrl+F5։

## Արդեն սխալ վերագրված պատվերի ուղղում

Migration 039-ը ավտոմատ ճանաչում և ուղղում է այն կայքային պատվերները, որոնց ֆայլերի `storage_path`-ը սկսվում է `website/`-ով։

Եթե կոնկրետ հին պատվերը **ֆայլ չունի** և նախկինում սխալ վերագրվել է մենեջերին, SQL Editor-ում կարելի է ուղղել պատվերի համարով՝

```sql
update public.orders
set source_channel='website',
    created_by_type='customer',
    created_by_manager_id=null
where order_number='ՓՈԽԱՐԻՆԵՔ_ՊԱՏՎԵՐԻ_ՀԱՄԱՐՈՎ';
```

Դրանից հետո Analytics-ում այն այլևս չի մտնի մենեջերի պատվերների/վաստակի հաշվարկի մեջ։
