# GDprint ADMIN v7.3.3b — Employee modal fix

Ուղղվել է Admin → Աշխատակիցներ էջի «Գրաֆիկ / վճարում / ծանուցում» կոճակը։

Պատճառը՝ `staff-more-modal` HTML բլոկը սխալմամբ ներդրված էր `task-modal`-ի ներսում։ Երբ task modal-ը փակ էր (`display:none`), child modal-ին `open` class տալը չէր կարող այն ցուցադրել։

Ուղղումներ.
- `staff-more-modal` տեղափոխվել է առանձին top-level modal շերտ։
- Ավելացվել է backdrop click close։
- Ավելացվել է Escape close։
- Բոլոր գործողության կոճակները օգտագործում են explicit event listeners։
- Modal-ը բացվում է մինչև compensation query-ի ավարտը։
- Compensation query error-ը ցուցադրվում է toast/console-ով, բայց modal-ը չի փակվում։
- Մաքրվել է modal HTML nesting-ը և aria-hidden state-ը։

Այս fix-ի համար նոր SQL migration պետք չէ։
Browser-ում թարմ ֆայլերը տեղադրելուց հետո արեք Ctrl+F5։
