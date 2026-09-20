# GDprint v7.5.7 — Partner status constraint fix

## Խնդիրը
Admin → «Գործընկերներ» էջում կարգավիճակը փոխելիս PostgreSQL-ը վերադարձնում էր՝
`new row for relation "partner_applications" violates check constraint "partner_applications_status_check"`։

Պատճառը՝ live database-ում արդեն կար նույն անունով հին CHECK constraint՝ հին թույլատրելի status-ներով։ 041 migration-ը այն չէր փոխարինում, եթե constraint-ը արդեն գոյություն ուներ։

## Ուղղումը
1. Գործարկել `supabase/042_partner_status_constraint_fix.sql`։
2. Այն հեռացնում է legacy constraint-ը։
3. Նորմալացնում է հին status-ները։
4. Վերաստեղծում է ճիշտ constraint-ը՝ `new / contacted / approved / rejected`։
5. Վերաստեղծում է `admin_set_partner_application_status()` RPC-ը նույն validation-ով։
6. Վերջում ցույց է տալիս constraint-ի definition-ը և status-ների քանակները։

Frontend-ի փոփոխություն այս fix-ի համար պետք չէ։
