# Որտե՞ղ ինչ փոխել — GDprint v8.0

Այս քարտեզը նախատեսված է, որ հետագայում ֆայլերը հեշտ գտնեք և պատահաբար նույն տվյալը մի քանի տեղ չփոխեք։

## Ծառայություններ
- **Անուն / նկար / կատեգորիա / ակտիվություն / հիմնական գին** → `data/services.json`
- Փոփոխելուց հետո Windows-ում գործարկել → `tools/sync_services.bat`
- Գեներացվող runtime catalog-ը → `data/generated/services.catalog.js` (`ձեռքով չխմբագրել`)
- Կայքի պատվերի հատուկ դաշտերը / modal-ը → համապատասխան `services.html`, `RU/services.html`, `EN/services.html`
- Customer App-ը և Manager-ի ծառայությունների ցուցակը catalog-ից են կարդում։

## Կայքի տեսք
- Ընդհանուր CSS → `assets/css/`
- Յուրաքանչյուր էջից հանված page-specific CSS → `assets/css/pages/hy/`, `assets/css/pages/ru/`, `assets/css/pages/en/`
- HTML-ում այլևս inline `<style>` կամ `style="..."` չկա։

## Կայքի JavaScript
- Ընդհանուր JS → `assets/js/`
- Ընդհանուր core helper-ներ → `assets/js/core/`
- Յուրաքանչյուր էջից առանձնացված JS → `assets/js/pages/<լեզու>/<էջ>/`
- HTML-ում այլևս inline `<script>`, `onclick`, `onchange`, `oninput` չկա։

## Customer App
- HTML → `app/*.html`
- Ընդհանուր CSS → `app/assets/css/`
- Page CSS → `app/assets/css/pages/`
- Ընդհանուր JS → `app/assets/js/`
- Page JS → `app/assets/js/pages/`
- Ծառայությունների catalog → `data/services.json`

## Admin / Manager / Staff
- Super Admin էջեր → `admin/admin/`
- Manager էջեր → `admin/manager/`
- Աշխատակիցների էջեր → `admin/staff/`
- Ընդհանուր Admin CSS/JS → `admin/shared/`
- HTML-ից առանձնացված page CSS → `admin/shared/css/pages/`
- HTML-ից առանձնացված page JS → `admin/shared/js/pages/`

## Supabase
- Migration/RPC/RLS → `supabase/`
- Հին/կրկնվող SQL backup → `supabase/legacy/`
- Գաղտնի service-role key, գաղտնաբառ կամ private key երբեք չտեղադրել client-side HTML/JS/JSON-ում։

## Ժամային գոտի
- Canonical timezone → `Asia/Yerevan`
- Ընդհանուր կարգավորում → `data/site-settings.json`
- UI-ում ժամը → 24-ժամյա ձևաչափ։

## Հին փաստաթղթեր և audit-ներ
- Changelog / history → `docs/history/`
- Audit report-ներ → `docs/audits/`
- Test screenshots → `docs/screenshots/`
