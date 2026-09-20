# GDprint Admin v7.5.2 — Dashboard buttons fix

Շտկված խնդիր՝ Admin Dashboard-ում `dashboard.js:61 Cannot set properties of null` error-ը կանգնեցնում էր ամբողջ initialization-ը, ինչի պատճառով կոճակների event listener-ները չէին միացվում։

## Փոփոխված ֆայլեր
- `admin/admin/js/dashboard.js`
- `admin/admin/dashboard.html`
- `admin/sw.js`

## Ինչ է շտկվել
1. `partners-badge` բացակայելու դեպքում `loadPartnerBadge()`-ը այլևս error չի տալիս։
2. `notif-bell` / `notif-dot` բացակայող optional տարրերը այլևս error չեն առաջացնում։
3. Կոճակների event listener-ները միացվում են մինչև Supabase տվյալների բեռնումը։
4. `loadEverything()`-ը օգտագործում է `Promise.allSettled`, որպեսզի մեկ widget-ի սխալը չկանգնեցնի ամբողջ Dashboard-ը։
5. Admin service worker cache-ը բարձրացվել է `gdprint-admin-v7-5-2`։
6. Dashboard script-ը բեռնվում է `js/dashboard.js?v=7.5.2` հասցեով՝ հին cache-ը շրջանցելու համար։

## Տեղադրում
Փոխարինեք նշված 3 ֆայլերը server/GitHub Pages նախագծում։ SQL migration պետք չէ։
Deploy-ից հետո արեք Ctrl+F5։ PWA/հեռախոսում ցանկալի է փակել Admin app/tab-ը և նորից բացել։ Եթե հին service worker-ը շարունակում է աշխատել՝ browser Site settings-ից մաքրեք տվյալ կայքի cache-ը մեկ անգամ։
