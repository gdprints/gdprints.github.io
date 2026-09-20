# GDprint ADMIN v7.3 — Phase 8

Այս փուլը ինտեգրացիոն hardening / end-to-end կապերի փուլն է։ Այն կառուցված է v7.2 Phase 7-ի վրա և չի ջնջում նախորդ ֆունկցիաները։

## Տեղադրում
1. Supabase SQL Editor-ում համոզվեք, որ 001–034 migration-ները կիրառված են։
2. Գործարկեք `supabase/035_integration_hardening.sql`։
3. Թարմացրեք կայքի ֆայլերը այս ZIP-ի տարբերակով։
4. Admin → System Center → «Ստուգել հիմա»։ Phase 8 Integration Health բաժնում required objects-ը պետք է լինեն `OK`։
5. Փորձարկեք առնվազն մեկ test order ամբողջ շղթայով։

## Phase 8-ում փակված իրական բացերը
- `quality_control` role-ը այժմ ընդունվում է նաև `admin_set_staff_account()` և push subscription backend-ում։
- Ավելացվել է assigned production staff-ի իրական Storage upload policy-ը՝ միայն իրեն նշանակված պատվերի staff path-ի համար։
- `admin_create_staff_assignment()` այժմ ստուգում է role ↔ stage համապատասխանությունը։
- Ավելացվել են նախագծում օգտագործվող, բայց migration-ներում բացակայող `get_or_create_customer()` և `get_manager_leaderboard()` RPC-ները։
- Production completion-ը այժմ իրական hand-off է անում հաջորդ փուլին։
- Finishing-ից՝ եթե կա ակտիվ Quality Control աշխատակից, անցնում է QC, հակառակ դեպքում անմիջապես Packing։
- QC approved → Packing, QC rework → ընտրված արտադրական փուլ։
- Packing ready → Delivery։
- Courier delivered → workflow `completed`, customer-visible order status `delivered`։
- Ավելացվել է `order_workflow_history` immutable-style audit trail։
- Generic Tasks էջից արտադրական աշխատանքի «Completed» նշումը այլևս չի կարող շրջանցել department workflow-ը։
- Ավելացվել է Admin → `quote-requests.html` էջը՝ Manager-ի գնային առաջարկների հաստատման/մերժման համար։
- Ավելացվել է `admin_review_manager_quote()` RPC և Manager notification։
- System Center-ում ավելացվել է `admin_integration_health()` ստուգումը։
- Manager `new-order.html`-ի legacy duplicate DOM id-ները եզակիացվել են՝ form-scoped submit fallback-ները պահպանելով։

## Static audit արդյունք
Ֆայլ՝ `PHASE8_AUDIT_REPORT.json`

- JS files checked: 41
- JS syntax failures: 0
- HTML files checked: 40
- Broken local references: 0
- Duplicate IDs: 0
- Missing RPC calls: 0
- Unguarded Admin/Manager/Staff pages: 0

## Role-by-role test matrix
### Super Admin
- Login / account guard
- Dashboard
- Orders + archive + workflow + priority + deadline
- Final price approval
- Customers / CRM
- Employees / role / approval / account status
- Work distribution role-stage validation
- Finance / inventory / services / marketing / website content
- Quote approvals
- System Center + integration health

### Manager
- Login after approval only
- Own orders
- New order
- Customer workspace / contact history
- Quote request → Admin review → Manager sees status
- Leaderboard RPC
- Financial restrictions remain enforced

### Designer / Prepress
- Assigned orders only
- Customer file read
- Staff file upload
- Preview/proof publish
- Preflight checklist

### Digital Print
- Assigned digital-print tasks only
- Start / pause / printed / defect / reprint
- Complete → Finishing
- Equipment issue

### Large Format
- Assigned large-format tasks only
- Print / cut / laminate / defect
- Complete → Finishing
- Equipment issue

### Finishing
- Finishing operations
- Complete → QC when QC is active, otherwise Packing

### Quality Control
- Assigned QC tasks only
- Cannot approve until all checks pass
- Approve → Packing
- Rework → Prepress / Digital / Large Format / Finishing

### Packing
- Assigned Packing task only
- Ready requires quantity + quality + packed + package count
- Ready → Delivery

### Courier
- Assigned delivery only
- Started / arrived / delivered / absent / wrong address / return
- Delivery payment can be registered
- Delivered → order completed

### Warehouse
- Inventory read
- In/out stock movement
- Cannot create negative stock

### Finance
- Finance summary / ledger
- Payment / refund / expense / salary / commission / supplier transaction types

### IT Admin
- System incidents
- Does not automatically receive business/customer access through the role

## Կարևոր
Այս միջավայրից իրական Supabase instance-ի վրա migration-ը գործարկել հնարավոր չէր, որովհետև Supabase project connection/service credentials չեն տրամադրվել։ Այդ պատճառով Phase 8-ում կատարվել է ամբողջական static/code-level audit։ Տեղադրումից հետո System Center-ի Integration Health-ը նախատեսված է արդեն live database-ի schema/data կապերը ստուգելու համար։


## 42P13 get_manager_leaderboard hotfix
Եթե `035_integration_hardening.sql`-ը տալիս է `cannot change return type of existing function`, նոր տարբերակում դա շտկված է․ migration-ը նախ կատարում է `DROP FUNCTION IF EXISTS public.get_manager_leaderboard();` և հետո ստեղծում է նոր signature-ը։ Առանձին արագ շտկման SQL-ը գտնվում է `supabase/FIX_035_manager_leaderboard.sql` ֆայլում։
