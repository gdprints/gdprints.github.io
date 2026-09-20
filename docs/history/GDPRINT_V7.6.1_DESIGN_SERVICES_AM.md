# GDprint v7.6.1 — Դիզայնի 8 ծառայությունների ավելացում

Հիմք՝ **v7.6.0**, որտեղ 18 հին ծառայությունները հեռացված էին։

## Ավելացված ծառայությունները

1. Պլոտերային հատման ֆայլ — **3,000 ՀՀ դրամից** (`plotter_file_design`, PFD)
2. Բաժակի դիզայն — **3,000 ՀՀ դրամ** (`mug_design`, MGD)
3. Այցեքարտի դիզայն — **4,000 ՀՀ դրամ** (`business_card_design`, BCD)
4. Բանների դիզայն — **7,000 ՀՀ դրամ** (`banner_design`, BND)
5. Արտաքին գովազդի դիզայն — **10,000 ՀՀ դրամից** (`outdoor_ad_design`, OAD)
6. Roll Up դիզայն — **10,000 ՀՀ դրամ** (`rollup_design`, RUD)
7. Կորպորատիվ ոճ — **18,000 ՀՀ դրամ** (`corporate_identity`, CID)
8. Լոգոյի դիզայն — **30,000 ՀՀ դրամ** (`logo_design`, LGD)

## Որտեղ են ավելացվել

- Կայքի HY / RU / EN `services.html` էջեր՝ նոր **Դիզայնի ծառայություններ** կատեգորիայով։
- Կայքի բոլոր public header-ների «Ծառայություններ» mega menu-ում՝ նոր **Դիզայն** սյունակ։
- HY / RU / EN գնագոյացման էջերում՝ ծառայությունից անմիջապես պատվերի անցման հղումներ։
- Customer App-ում՝ 8 նոր ծառայություն, համապատասխան գներ և պատվերի դաշտեր։
- Manager → «Նոր պատվեր» էջում՝ 8 նոր դիզայնի ծառայություն և պատվերի modal-ներ։
- Shared order submit համակարգում՝ նոր canonical service name-ները։
- Supabase `service_catalog`, customer-app pricing և order RPC-ներում՝ migration `045_add_design_services.sql`։

## «... դրամից» ծառայությունների վարքագիծը

`Պլոտերային հատման ֆայլ` և `Արտաքին գովազդի դիզայն` ծառայությունների համար նշված գումարը **սկսած արժեք** է։ Customer App-ը այն ցուցադրում է որպես «Սկսած ...», իսկ վերջնական գինը կարող է հաստատվել Admin/Manager-ի կողմից աշխատանքի բարդությունը գնահատելուց հետո։

## Տեղադրում

1. Նախ պետք է արդեն գործարկված լինի `044_retire_18_services.sql` migration-ը։
2. Supabase → SQL Editor-ում գործարկել `supabase/045_add_design_services.sql`։
3. Կայք/Admin/App ֆայլերը թարմացնել v7.6.1 տարբերակով։
4. Browser-ում անել `Ctrl + F5`։ Customer/Admin PWA-ի cache version-ները նույնպես թարմացվել են։
5. Ստուգում՝

```sql
select public.gd_design_services_health();
```

Սպասվող հիմնական արդյունքը՝ `design_catalog_rows = 8`, `design_expected = 8`, `all_design_prices_ok = true`։

## Audit

Տեխնիկական ստուգումը՝ `DESIGN_SERVICES_AUDIT.json`։ HY/RU/EN ծառայությունների էջերում կա 20 ծառայություն, որոնցից 8-ը դիզայնի ծառայություններ են։ Customer App-ում նույնպես կա 20 ծառայություն։
