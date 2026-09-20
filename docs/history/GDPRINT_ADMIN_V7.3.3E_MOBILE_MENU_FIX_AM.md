# GDprint ADMIN v7.3.3e — Mobile menu overlay fix

Շտկված խնդիր՝ հեռախոսի վրա hamburger կոճակով sidebar-ը բացվում էր, բայց սև թափանցիկ overlay-ը հայտնվում էր նաև sidebar-ի վրայից և խլում click-երը։

## Պատճառը
`.app-shell`-ը ստեղծում էր առանձին stacking context (`z-index: 1`), իսկ `.sidebar-scrim`-ը JavaScript-ը ավելացնում էր անմիջապես `<body>`-ի մեջ `z-index: 58`-ով։ Այդ պատճառով body-ի scrim-ը կարող էր ծածկել ամբողջ `.app-shell`-ը՝ ներառյալ sidebar-ը, նույնիսկ եթե sidebar-ի ներսի z-index-ը 70 էր։

## Շտկումը
- `sidebar-scrim`-ը հիմա տեղափոխվում/ստեղծվում է հենց `.app-shell`-ի ներսում։
- Mobile stacking order՝ main `z-index:1`, scrim `58`, sidebar `70`։
- Բացված sidebar-ը ունի explicit `pointer-events:auto`։
- Scrim opacity-ը թեթևացվել է՝ `.34`։
- Mobile scrim blur-ը հանվել է։
- Scrim-ի վրա սեղմելիս sidebar-ը շարունակում է փակվել։
- Esc և menu link click close behavior-ը պահպանվել են։

SQL migration պետք չէ։ Փոխարինելուց հետո խորհուրդ է տրվում Ctrl+F5 / browser cache refresh։
