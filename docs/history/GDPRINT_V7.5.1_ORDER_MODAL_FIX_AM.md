# GDprint v7.5.1 — Website order modal fix

Խնդիր
- Ֆայլերի upload բլոկի ավելացումից հետո երկար պատվերի modal-ներում footer-ը (`Պատվիրել` + `Արժեք`) դուրս էր մղվում modal-ի տեսանելի մասից և կտրվում էր `overflow:hidden`-ով։

Շտկում
- `.modal-content`-ը services էջերում դարձվել է հստակ flex-column container։
- Միայն `.modal-body`-ն է scroll անում և ունի `min-height:0`։
- `.modal-header` և `.gd-order-modal-footer` միշտ մնում են տեսանելի։
- Mobile footer-ը wrap է անում, որպեսզի կոճակը և գինը տեղավորվեն փոքր էկրանին։
- RU/EN Plotter Cutting modal-ին ավելացվել է բացակայող գնի բլոկը և 20,000 AMD/քմ հաշվիչը։
- Website order submit-ը հիմա գինը կարդում է նաև direct footer price-ից կամ `.gd-calculated-total` hidden field-ից։
- CSS/JS asset-ներին ավելացվել է `?v=7.5.1` cache busting։

SQL migration պետք չէ։
