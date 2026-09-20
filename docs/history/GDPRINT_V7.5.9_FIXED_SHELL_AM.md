# GDprint Admin v7.5.9 — Fixed Sidebar / Topbar

Այս թարմացումը շտկում է Admin/Manager layout-ի scrolling-ը։

## Փոփոխություններ
- Sidebar-ը desktop-ում մնում է ֆիքսված viewport-ի բարձրությամբ։
- Top bar-ը չի scroll լինում էջի կոնտենտի հետ։
- Scroll-ը կատարվում է միայն `.content` հատվածում։
- Sidebar-ի երկար մենյուն ունի իր առանձին ներքին scroll-ը միայն անհրաժեշտության դեպքում։
- Mobile drawer-ի աշխատանքը պահպանված է։
- Service Worker cache-ը բարձրացվել է `gdprint-admin-v7-5-9` տարբերակի։
- Admin/Manager/Staff այն HTML էջերը, որոնք օգտագործում են `erp-redesign.css`, ստացել են `?v=7.5.9` cache-busting query։

## Տեղադրում
1. Hotfix ZIP-ի պարունակությունը պատճենել նախագծի root-ի վրա՝ պահպանելով պանակների կառուցվածքը։
2. Վերբեռնել GitHub Pages / hosting։
3. Բացել Admin-ը և կատարել `Ctrl + F5` մեկ անգամ։
4. Եթե PWA/Admin-ը բաց էր նախորդ տարբերակով, փակել և նորից բացել էջը։

SQL migration պետք չէ։
