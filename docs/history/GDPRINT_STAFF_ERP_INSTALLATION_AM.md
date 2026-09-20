# GDprint Staff ERP v6.4 — Տեղադրման ուղեցույց

Այս տարբերակը ընդլայնում է առկա GDprint Admin/Manager համակարգը՝ առանց զրոյից վերագրելու կայքը։ Ավելացվել է աշխատակիցների միասնական authentication, role-based access, Admin approval, աշխատանքների բաշխում, արտադրական հերթ, ներքին հաղորդագրություններ, login history և role-specific գործիքներ։

## 1. Պարտադիր database migration
Supabase Dashboard → SQL Editor-ում բացել և ամբողջությամբ աշխատեցնել՝

`supabase/024_staff_erp.sql`

Migration-ը պետք է աշխատեցնել միայն այն բանից հետո, երբ առկա 001–023 migration-ները արդեն կիրառված են։

## 2. Աշխատակիցների գրանցում
Մուտքի էջ՝ `admin/login.html`

Գրանցում՝ `admin/register.html`

Գաղտնաբառի վերականգնում՝ `admin/forgot-password.html`

Նոր աշխատակիցը գրանցվելուց հետո մնում է Pending։ Super Admin-ը բացում է՝

`admin/admin/employees.html`

և ընտրում է իրական դերը, approval-ը և account status-ը։

## 3. Դերեր
- Super Admin
- Manager
- Designer / Prepress
- Digital Print Operator
- Large Format / Plotter Operator
- Finishing
- Packing
- Courier
- Warehouse
- Finance
- IT Admin

Admin-ը չի կարող պատահաբար կորցնել իր սեփական admin դերը՝ դրա համար կա database-side պաշտպանություն։

## 4. Աշխատակիցների աշխատանքային էջեր
Ընդհանուր staff portal՝ `admin/staff/dashboard.html`

- `tasks.html` — իրեն նշանակված աշխատանքներ
- `messages.html` — ներքին հաղորդագրություններ
- `profile.html` — անձնական տվյալներ, Employee ID, login history, password reset
- `files.html` — Designer / արտադրական դերերի նշանակված պատվերների ֆայլեր և upload
- `warehouse.html` — Warehouse նյութերի մնացորդ + մուտք/ելք
- `delivery.html` — Courier հասցե/հեռախոս/քարտեզ + delivery task status
- `finance.html` — Finance ֆինանսական ամփոփում

Manager-ը շարունակում է օգտագործել գործող `admin/manager/` բաժինը։ Super Admin-ը՝ գործող `admin/admin/` բաժինը։

## 5. Աշխատակիցների հաշվի վիճակներ
- Pending — սպասում է հաստատման
- Approved + Active — լիարժեք մուտք
- Rejected — գրանցումը մերժված է
- Blocked — արգելափակված
- Suspended — ժամանակավորապես կասեցված
- Disabled — անջատված
- Terminated — աշխատանքային հաշիվը փակված

## 6. Employee ID
Համակարգը ավտոմատ ստեղծում է՝

`GD-EMP-0001`, `GD-EMP-0002`, ...

## 7. Աշխատանքների workflow
Super Admin → Employees → «Նշանակել աշխատանք»։

Աշխատակիցը կարող է իր task-ը անցկացնել՝

Assigned → In Progress → Waiting / Completed

Պահպանվում են assignee, assigned_by, stage, priority, deadline, status, timestamps և event history։

## 8. Անվտանգություն
- Role checks արվում են ոչ միայն UI-ում, այլ նաև Supabase RLS / SECURITY DEFINER RPC-ներով։
- Staff-ը տեսնում է միայն իրեն նշանակված production tasks-ը և դրանց անհրաժեշտ ֆայլերը։
- Finance տվյալները հասանելի են Finance role-ին հատուկ RPC-ով։
- Courier-ը ստանում է միայն իրեն նշանակված պատվերների delivery snapshot-ը։
- Warehouse-ը կարող է կարդալ պահեստը և գրանցել stock movement, բայց ոչ Admin-ի մյուս բաժինները։
- Password-ը պահվում է Supabase Auth-ում, ոչ երբեք plain text database դաշտում։
- Password reset-ը կատարվում է մեկանգամյա Supabase recovery link-ով։

## 9. Supabase Auth URL կարգավորում
Supabase → Authentication → URL Configuration-ում ավելացնել production կայքի հասցեն և reset URL-ը, օրինակ՝

`https://YOUR-DOMAIN/admin/reset-password.html`

Եթե սա չարվի, recovery email-ի հղումը կարող է չվերադառնալ ճիշտ էջ։

## 10. Email
Forgot Password-ի համար Supabase Auth email provider-ը պետք է աշխատի։ Production-ում խորհուրդ է տրվում կարգավորել սեփական SMTP provider, որպեսզի նամակների առաքումը կայուն լինի։

## 11. Testing checklist
1. Register նոր աշխատակցով։
2. Համոզվել, որ առանց approval login-ը չի բացում staff portal-ը։
3. Admin → Employees-ից ընտրել role և Approved + Active։
4. Նորից login անել և ստուգել ճիշտ redirect-ը։
5. Նշանակել task և փոխել դրա status-ը աշխատակցի էջից։
6. Designer/production role-ով upload անել նշանակված order-ի ֆայլ։
7. Warehouse role-ով stock movement անել։
8. Courier role-ով բացել delivery task և հասցեի քարտեզը։
9. Finance role-ով ստուգել ֆինանսական ամփոփումը։
10. Forgot Password → email → Reset Password workflow։
11. Block/Suspend account և ստուգել, որ մուտքը փակվում է։
12. Ստուգել mobile layout-ը։

## Կարևոր
Static ֆայլերը syntax/link մակարդակով ստուգված են այս build-ում։ Live database behavior-ի վերջնական ստուգումը պետք է անել ձեր Supabase project-ում `024_staff_erp.sql` կիրառելուց հետո, որովհետև այստեղ Supabase production database-ին ուղիղ հասանելիություն չի օգտագործվել։
