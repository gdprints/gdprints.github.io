# GDprint v8.0 — կազմակերպված կոդային կառուցվածք

Այս տարբերակը refactor է v7.6.4-ի վրա. business logic-ը և Supabase migration-ները պահպանված են, բայց HTML-ից առանձնացված են inline CSS/JS/event handler-ները։

## Հիմնական կանոնը
- **HTML** — միայն էջի կառուցվածք և տվյալ լեզվի տեսանելի բովանդակություն։
- **CSS** — միայն `.css` ֆայլերում։
- **JavaScript** — միայն `.js` ֆայլերում։
- **JSON** — ծառայությունների, ընդհանուր կարգավորումների և locale տվյալների համար։
- **Supabase SQL** — database/RLS/RPC/business logic։

## Կառուցվածք
```text
/
├─ data/
│  ├─ services.json              # ծառայությունների canonical աղբյուր
│  ├─ site-settings.json         # ընդհանուր timezone/locale/currency
│  ├─ locales/{hy,ru,en}.json
│  └─ generated/services.catalog.js  # ավտոմատ գեներացվող runtime catalog
├─ assets/
│  ├─ css/pages/{hy,ru,en}/      # public էջերի page-specific CSS
│  └─ js/pages/{hy,ru,en}/       # public էջերի page-specific JS
├─ app/
│  └─ assets/{css,js}/pages/     # Customer App page-specific code
├─ admin/
│  └─ shared/{css,js}/pages/     # Admin/Manager/Staff page-specific code
├─ supabase/                     # migrations/RPC/RLS
├─ docs/history/                 # հին changelog-ներ
├─ docs/audits/                  # audit/report JSON-ներ
└─ tools/sync_services.bat       # services.json → runtime catalog
```

## Ծառայություն փոխելիս
1. Փոփոխել `data/services.json`։
2. Windows-ում գործարկել `tools\sync_services.bat`։
3. Եթե նոր ծառայության համար նոր պատվերի form է պետք, ավելացնել համապատասխան locale HTML form/modal-ը։

## Ժամային գոտի
Համակարգի canonical timezone-ը `Asia/Yerevan` է, 24-ժամյա ձևաչափով։

## Չխմբագրել ձեռքով
`data/generated/services.catalog.js` ավտոմատ գեներացվող ֆայլ է։
