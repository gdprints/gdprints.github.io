# GDprint ADMIN v6.8 — Phase 3

Այս փուլը ամբողջացնում է արտադրական աշխատակիցների մասնագիտացված աշխատանքային կենտրոնը՝ ADMIN փաստաթղթի 3–7 բաժինների հիմքով։

## Ավելացված
- Designer / Prepress՝ Preflight checklist (չափս, bleed, CMYK, resolution, fonts, cut contour), preview/final ֆայլերի առկա համակարգի կապ։
- Digital Print՝ start/printed/reprint/defect, տպված քանակ, խոտան, նյութ, սարքի խնդիր/սպասարկում/կանգ։
- Large Format / Plotter՝ printed/cut/laminated/defect, նյութ/waste, սարքավորման խնդիրներ։
- Finishing՝ կտրում, լամինացիա, ծալում, բիգովկա, կարում, սոսնձում, պերֆորացիա, փաթեթավորում և ավարտ։
- Quality Control՝ քանակ/չափս/գույն/finishing ստուգում, ընդունում կամ rework վերադարձ, խոտանի քանակ և պատճառ։
- Packing՝ քանակ/որակ/փաթեթավորում/ready-for-delivery checklist, փաթեթների քանակ, Label/QR/Order ID։
- Յուրաքանչյուր production role-ի համար նույն `production.html` էջը role-aware UI-ով։
- Audit տվյալների նոր աղյուսակներ՝ production_job_logs, preflight_checks, quality_checks, packing_checks, equipment_issues։
- RLS + SECURITY DEFINER RPC-ներ, որպեսզի աշխատակիցը գործողություն կատարի միայն իրեն նշանակված պատվերի վրա։

## Supabase
Նախ գործարկեք 001–029 migration-ները, հետո՝ `supabase/030_production_workspaces.sql`։

## Հաջորդ փուլ
Courier-ի ամբողջական առաքման արդյունքներ/վճարում, Finance-ի վճարումներ/ծախս/աշխատավարձ/commission/report export, IT/System Admin-ի իրական dashboard, և աշխատակցի ընդհանուր «Իմ էջը»՝ գրաֆիկ/արդյունավետություն/աշխատավարձ visibility-ով։
