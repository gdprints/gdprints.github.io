# GDprint — Password Recovery / Supabase URL Configuration

Այս build-ում password reset-ը production-ում ուղարկվում է՝

`https://gdprint.am/admin/reset-password.html`

Supabase Dashboard-ում պարտադիր կարգավորել՝

1. Authentication → URL Configuration
2. **Site URL** → `https://gdprint.am`
3. **Redirect URLs** բաժնում ավելացնել՝
   - `https://gdprint.am/admin/reset-password.html`
   - `https://gdprint.am/admin/**`
   - ցանկության դեպքում GitHub Pages փորձարկման համար՝ `https://gdprint.github.io/admin/**`
   - local development-ի համար՝ `http://localhost:3000/**`

Եթե Site URL-ը թողնված է `http://localhost:3000`, և production redirect URL-ը allow list-ում չկա, Supabase-ը recovery հղումը կարող է վերադարձնել localhost։

Կարգավորումից հետո պահանջեք ՆՈՐ password-reset email։ Հին recovery հղումը մի օգտագործեք։
