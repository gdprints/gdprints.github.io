# GDprint v9 — Control Center

1. Նախ պետք է արդեն Run արված լինեն `001`, `002`, `003` migration-ները։
2. Supabase → SQL Editor → New query բացիր։
3. Տեղադրիր `004_admin_control_center.sql` ֆայլի ամբողջ պարունակությունը և Run արա մեկ անգամ։
4. Refresh արա Admin panel-ը։ Կհայտնվի «Վերահսկման կենտրոն» էջը։

## Կարևոր
- Manager-ը DB մակարդակում չի կարող փոխել արդեն գրանցված պատվերի `total_amount`-ը։
- Manager-ի `can_change_price` և `can_apply_discount` իրավունքները միշտ false են պահվում DB trigger-ով։
- Admin → Managers-ից կարելի է արգելափակել/ապաարգելափակել կամ ամբողջությամբ ջնջել manager account-ը։ Delete RPC-ն ջնջում է նաև `auth.users` գրառումը։
- Արգելափակված manager-ը հաջորդ պաշտպանված էջի բացման պահին sign out է արվում։
- Audit log-ը գրանցում է պատվերի գնի, ծախսի, վճարման և կարգավիճակի փոփոխությունները։

Եթե SQL Editor-ը `delete_manager_account` ֆունկցիայի ստեղծման ժամանակ ցույց տա auth schema permission error, մի շարունակիր manager delete-ը UI-ից. տվյալ Supabase նախագծի ownership կարգավորումը պետք է ստուգվի առանձին։ Մնացած migration-ը կարող է կիրառվել անկախ այդ ֆունկցիայից՝ այդ բլոկը ժամանակավորապես բաց թողնելով։
