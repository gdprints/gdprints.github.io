# GDprint ADMIN v7.2 — Phase 7

Այս փուլը կատարվել է ADMIN(1).docx փաստաթղթի պահանջների և v7.1 նախագծի համեմատական audit-ով։

## Այս փուլում փակված բացերը
- Super Admin / Customers՝ CRM նշումներ, կապի պատմություն, զեղչի գրառում, վճարումների պատմություն։
- Super Admin / Orders՝ առանձին Archive վիճակ և արխիվից վերականգնում։
- Manager՝ հաճախորդների որոնում/էջ, կապի պատմություն (call/email/WhatsApp/Viber/note), գնային առաջարկի հարցում և Admin approval-ի backend հիմք։
- Production՝ Digital Print-ի Pause և Send next stage, Large Format-ի Send finishing գործողությունների semantics։
- RLS՝ manager-ը CRM-ում չի կարող discount տեսակի գրառում ստեղծել, իսկ գնային առաջարկը կարող է միայն pending ուղարկել։ Admin-ը ունի review իրավասություն։

## Նոր migration
Supabase SQL Editor-ում 001–033-ից հետո գործարկել՝
`supabase/034_document_gap_closure.sql`

## Փաստաթղթի կարևոր նկատառում
ADMIN(1).docx-ում դերերի համարակալումը 8-ից անմիջապես անցնում է 10-ի։ 9-րդ դերի պահանջ փաստաթուղթը չի սահմանում։ Նախագծում արդեն գոյություն ունեցող Warehouse role-ը պահպանվել է, բայց այն չի ներկայացվում որպես փաստաթղթից ստացված 9-րդ դեր։

## Հաջորդ audit
Phase 8-ում պետք է անցնել ինտեգրացիոն/ընդունման թեստերի՝ role-by-role RLS, order lifecycle, file permissions, finance totals, notification delivery և mobile/PWA smoke tests։
