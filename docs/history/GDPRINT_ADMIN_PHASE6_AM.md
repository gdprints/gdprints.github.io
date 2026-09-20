# GDprint ADMIN v7.1 — Phase 6

## Ավելացված բաժիններ
1. **Ծառայություններ և գներ** — service catalog, 3 լեզու, base price, unit, min qty, website visibility, active state։
2. **Զեղչեր / առաջարկներ / գովազդներ** — campaign type, promo code, discount, start/end, target, banner/CTA։
3. **Կայքի բովանդակություն** — HY/RU/EN content registry (`content_key + locale`)։
4. **System Center** — website/DB/auth health probe, backup registry, restore/security/incident audit։
5. Նոր Supabase migration՝ `033_admin_master_modules.sql`։

## Տեղադրում
Supabase SQL Editor-ում նախ պետք է կիրառված լինեն 001–032 migration-ները, ապա գործարկել `supabase/033_admin_master_modules.sql`։

## Կարևոր տեխնիկական սահմանափակում
Կայքը static/browser միջավայրում է, ուստի CPU/RAM/Disk/RAID իրական server metrics browser-ից անվտանգ և վստահելի ձևով հասանելի չեն։ System Center-ը հիմա ստուգում է Website/Supabase DB/Auth վիճակը և պահում operations audit։ CPU/RAM/Disk/RAID-ի համար հետագայում պետք է միացնել hosting/server monitoring API կամ agent։

## Չջնջված/պահպանված
Նախորդ բոլոր Phase 1–5 էջերը, migration-ները, Supabase auth/RLS, Customer App, orders/files, production, delivery, finance և staff profile համակարգերը պահպանված են։
