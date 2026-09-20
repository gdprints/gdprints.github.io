# GDprint կոդային կանոններ

1. HTML-ում չավելացնել `<style>` կամ inline `style=`։ Օգտագործել համապատասխան page CSS կամ shared CSS։
2. HTML-ում չավելացնել inline `<script>` կամ `onclick/onchange/oninput`։ Օգտագործել page JS։
3. Ընդհանուր ֆունկցիան տեղափոխել `assets/js/core`, `admin/shared/js`, կամ `app/assets/js`։
4. Ծառայության անուն/նկար/key/կատեգորիա փոխել նախ `data/services.json`-ում։
5. Գաղտնի key/service-role երբեք չպահել client-side JSON/JS-ում։
6. Deadline-ները պահել timezone-aware և UI-ում ցուցադրել `Asia/Yerevan`, 24 ժամ։
7. Page-specific ֆայլը չօգտագործել այլ էջում. ընդհանուր կոդը բարձրացնել shared/core մակարդակ։
