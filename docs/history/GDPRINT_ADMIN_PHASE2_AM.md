# GDprint ADMIN / ERP — Phase 2

Այս փուլը կառուցվել է ADMIN փաստաթղթի Super Admin core-ի հիման վրա։

Ավելացվել է՝
- Super Admin → Պատվերներ (`admin/admin/orders.html`)
  - որոնում և ֆիլտրեր
  - workflow stage
  - priority
  - deadline
  - ներքին նշումներ
  - վերջնական գնի Admin հաստատում
  - ուշացած/չվճարված պատվերների հաշվարկ
- Super Admin → Աշխատանքների բաշխում (`work-distribution.html`)
  - աշխատակիցների ծանրաբեռնվածություն
  - բաց առաջադրանքներ
  - վերանշանակում
  - priority փոփոխում
- Super Admin → Ֆինանսներ (`finance.html`)
  - այսօրվա/ամսվա եկամուտ
  - չվճարված պատվերներ
  - ընկերության ծախսերի գրանցում և պատմություն
- Employees role list-ում ավելացվել է `quality_control`։
- Նոր Supabase migration՝ `029_admin_erp_core.sql`։

## Տեղադրում
Supabase SQL Editor-ում հերթականությամբ պետք է արդեն աշխատած լինեն 001–028 migration-ները, ապա աշխատեցնել `029_admin_erp_core.sql`։

## Կարևոր
Սա չի փոխարինում առկա պատվերի drawer/file/proof համակարգը. նոր Orders էջը ավելացնում է ERP workflow կառավարման շերտը՝ չկոտրելով առկա ֆունկցիոնալը։
