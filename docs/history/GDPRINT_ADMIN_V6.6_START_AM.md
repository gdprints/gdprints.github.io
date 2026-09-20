# GDprint Admin / Staff ERP v6.6 — աշխատանքի մեկնարկ

Այս build-ը պատրաստվել է ADMIN փաստաթղթի քարտեզի և առկա v6.5.4 կայքի հիման վրա։ Առկա Admin/Manager/Supabase համակարգը պահպանվել է և զարգացվում է փուլերով՝ առանց գործող պատվերների համակարգը զրոյից փոխարինելու։

## Այս փուլում կատարվածը
- Ուսումնասիրվել է առկա `admin/`, `admin/manager/`, `admin/staff/` կառուցվածքը և Supabase migrations 001–027-ը։
- Պահպանվել է միասնական authentication + role based redirect մոտեցումը։
- Ավելացվել է առանձին `quality_control` աշխատակցի դեր, քանի որ գործող workflow-ում արդեն կար `quality_control` արտադրական փուլ, բայց աշխատակցի role-ը բացակայում էր։
- Quality Control-ը ներառվել է staff portal-ում, employee role ընտրության մեջ և Employee ID տրամաբանության մեջ։
- Ավելացվել է migration `supabase/028_quality_control_role.sql`։

## Supabase-ում կիրառելու հերթականությունը
Եթե 001–027 migration-ները արդեն կիրառված են, այս build-ի համար նորից աշխատեցնել միայն՝

`supabase/028_quality_control_role.sql`

## Հաջորդ կառուցվող մոդուլները
1. Super Admin Dashboard-ը համապատասխանեցնել ADMIN փաստաթղթի KPI-ներին։
2. Orders բաժինը բաժանել ըստ ամբողջ workflow-ի փուլերի։
3. Employee էջում ավելացնել աշխատանքային պատմություն, արդյունավետություն, գրաֆիկ, աշխատավարձ/բոնուս visibility։
4. Designer/Prepress-ի համար ամբողջական preflight checklist + proof/version history։
5. Digital/Large Format/Finishing/QC/Packing role-specific production actions և defect/reprint history։
6. Courier delivery states և payment-at-delivery։
7. Finance՝ payments/expenses/salary/commission/report exports։
8. IT՝ սահմանափակ technical dashboard՝ առանց հաճախորդների բիզնես տվյալների ավտոմատ հասանելիության։

## Կարևոր
Այս ZIP-ը development build է։ Database migration-ը production Supabase-ում կիրառելուց առաջ խորհուրդ է տրվում backup անել։
