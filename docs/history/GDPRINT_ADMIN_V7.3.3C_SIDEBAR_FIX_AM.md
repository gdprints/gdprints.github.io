# GDprint Admin v7.3.3c — Sidebar / Theme / Responsive Fix

Այս hotfix-ը ուղղում է Admin sidebar-ի երեք հիմնական խնդիրները։

## Ուղղումներ

1. **Միասնական sidebar բոլոր Admin էջերում**
   - Բոլոր 20 Admin էջերը հիմա ունեն նույն ամբողջական navigation ցանկը։
   - Էջից էջ անցնելիս մենյուն այլևս չի կրճատվում կամ փոխվում։
   - Յուրաքանչյուր էջում միայն ընթացիկ բաժինն է active։

2. **Light / Dark theme**
   - Light mode-ում sidebar-ը բաց/սպիտակ է՝ մուգ տեքստով։
   - Dark mode-ում sidebar-ը մուգ է՝ բաց տեքստով։
   - GDprint logo-ն ավտոմատ փոխվում է light/dark տարբերակով։
   - Sidebar border, hover, footer և scrollbar-ը նույնպես հետևում են theme-ին։

3. **Responsive / Mobile drawer**
   - <= 860px sidebar-ը դառնում է slide-in drawer։
   - Ավելացված է backdrop/scrim։
   - Փակվում է backdrop սեղմելով, Escape-ով կամ navigation link ընտրելով։
   - Բացված drawer-ի ժամանակ body scroll-ը արգելափակվում է։
   - Topbar/content/table/modal responsive behavior-ը ուժեղացվել է։

4. **Բացակայող theme toggle**
   - Եթե հին Admin էջում theme button չկա, shared `ui.js`-ը այն ավտոմատ ավելացնում է topbar-ին։

## Փոփոխված հիմնական ֆայլերը

- `admin/shared/css/erp-redesign.css`
- `admin/shared/js/ui.js`
- `admin/admin/*.html` — sidebar-ը միասնականացվել է բոլոր Admin էջերում։

## SQL

Այս փոփոխության համար **նոր SQL migration պետք չէ**։

Տեղադրելուց հետո browser-ում կատարեք **Ctrl+F5**։
