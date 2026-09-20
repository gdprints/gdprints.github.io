# GDprint ADMIN v7.0 — Phase 5

Այս փուլը ամբողջացնում է աշխատակցի ընդհանուր «Իմ էջը» և ֆինանսական/կադրային կառավարման կարևոր մասերը։

## Supabase
Գործարկել նախորդ migration-ներից հետո՝ `supabase/032_staff_profile_finance_notifications.sql`։

## Ավելացված է
- Աշխատակցի աշխատանքի սկիզբ, հանձնարարությունների ամփոփ վիճակագրություն։
- Աշխատանքային գրաֆիկի դիտում։
- Աշխատավարձ/բոնուս՝ միայն Admin-ի visibility թույլտվությամբ։
- Անձնական ծանուցումներ և «կարդացված» կարգավիճակ։
- Super Admin-ից աշխատավարձ/բոնուս, visibility, գրաֆիկ և ծանուցում կառավարելու modal։
- Finance աշխատակցի ledger UI՝ payment/refund/expense/salary/commission/supplier և cash/bank/online/delivery մեթոդներով։
- Backend RLS/RPC պաշտպանություն։

## Կարևոր
Աշխատավարձի/բոնուսի visibility-ն իրականացված է server-side RPC-ով. աշխատակցին թաքցված գումարը bundle-ում չի վերադարձվում։
