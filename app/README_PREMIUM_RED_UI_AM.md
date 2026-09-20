# GDprint Customer App — Premium Red UI v7.4

Այս տարբերակը կառուցված է `GDprint_ADMIN_v7.3.3e_MOBILE_MENU_FULL.zip` նախագծի վրա։

## Հաստատված դիզայնային ուղղություն
- մուգ graphite / black հիմնական միջավայր,
- GDprint կարմիր accent,
- սպիտակ/մոխրագույն typography,
- premium card UI,
- կարմիր active states և call-to-action կոճակներ,
- mobile-first responsive bottom navigation,
- dark drawer menu,
- richer service catalog՝ նախագծում առկա տպագրական SVG mockup-ներով։

## Փոփոխված Customer App շերտ
- `app/assets/css/premium-red.css` — նոր ամբողջական visual layer,
- `app/assets/js/app.js` — brand wordmark, catalog artwork և unified navigation,
- `app/assets/js/customer.js` — push prompt-ը տեղափոխված է red theme-ի,
- `app/manifest.webmanifest` — նոր PWA theme colors,
- `app/sw.js` — cache version `v7-4-red` և նոր stylesheet/assets,
- բոլոր `app/*.html` էջերը միացնում են `premium-red.css` stylesheet-ը։

## Գործող ֆունկցիոնալությունը պահպանված է
Supabase/auth/order logic-ը դիտավորյալ չի փոխվել. պահպանված են՝
- Login / Register,
- Home,
- ծառայությունների կատալոգ,
- ծառայության հաշվիչ,
- ֆայլերի upload,
- պատվերի հաստատում,
- պատվերների պատմություն,
- order tracking,
- design proof,
- delivery info,
- payment status,
- հասցեներ,
- notifications / Web Push,
- profile։

## Տեղադրում
SQL migration պետք չէ։ Upload/replace արեք նախագծի ֆայլերը և browser/PWA cache-ը թարմացրեք։
Service Worker-ի cache անունը փոխվել է, ուստի նոր deploy-ից հետո հին cached UI-ը կփոխարինվի։


## v7.4.1 brand/assets update
- Text wordmark-ը փոխարինվել է կայքի իրական `assets/img/logo.png` լոգոյով։
- 30 ծառայությունների համար օգտագործվում են կայքի իրական `assets/img/services/*.png` նկարները։
- App-only փաթեթը ինքնաբավ է՝ logo-ն և service artwork-ները պատճենված են `app/assets/img/`։
