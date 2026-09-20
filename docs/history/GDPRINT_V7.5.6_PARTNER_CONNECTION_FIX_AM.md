# GDprint v7.5.6 — Partner connection fix

Պատճառը՝ `admin/shared/js/supabase.js`-ը client-ը ստեղծում էր `const supabaseClient` ձևով, իսկ հանրային partner submit script-ը ստուգում էր `window.supabaseClient`։ Top-level `const`-ը `window` property չի դառնում, ուստի form-ը միշտ ցույց էր տալիս, որ տվյալների համակարգին կապ չկա։

Ուղղվել է.
- `window.supabaseClient` now exposed by the shared Supabase bootstrap.
- Legacy `supabaseClient` binding remains available for Admin/App scripts.
- Partner form accepts either binding and calls RPC through the resolved client.
- HY/RU/EN partner pages use cache-busted v7.5.6 scripts.

Այս fix-ի համար նոր SQL migration պետք չէ։ 041 migration-ը պետք է արդեն գործարկված լինի։
