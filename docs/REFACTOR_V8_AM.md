# GDprint v8.0 Code Architecture Refactor

Հիմքը՝ v7.6.4։ Այս տարբերակը հիմնականում կառուցվածքային refactor է, ոչ թե business logic-ի վերագրում։

Կատարված հիմնական փոփոխությունները՝

- 97 HTML ֆայլից դուրս են բերվել inline CSS/JS/event handler-ները։
- 892 inline style attribute տեղափոխվել է page-specific CSS ֆայլերի մեջ։
- 88 `<style>` block տեղափոխվել է CSS ֆայլերի մեջ։
- 99 inline JavaScript block տեղափոխվել է JS ֆայլերի մեջ։
- 48 HTML event handler (`onclick/oninput/onchange`) տեղափոխվել է page JS event handler ֆայլերի մեջ։
- HY/RU/EN էջերում հանվել է մյուս լեզուների կրկնվող `data-lang` DOM-ը։
- Ստեղծվել է `data/services.json`՝ 20 ակտիվ ծառայությունների canonical catalog-ի համար։
- Customer App-ի ծառայությունների ցուցակը catalog-ից է կառուցվում։
- Manager-ի 20 ծառայությունների քարտերն ամբողջությամբ գեներացվում են նույն catalog-ից։
- Service image/name metadata-ն կապվել է shared catalog-ի հետ։
- Audit/changelog/test ֆայլերը առանձնացվել են production root-ից։
- Ավելացվել է Windows մեկ-click catalog sync (`tools/sync_services.bat`)։

Refactor-ը SQL migration չի պահանջում։ v7.6.4-ի Supabase migration-ները պահպանված են նույն նախագծում։
