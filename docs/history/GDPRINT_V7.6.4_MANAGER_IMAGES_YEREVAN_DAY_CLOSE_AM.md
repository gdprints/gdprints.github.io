# GDprint v7.6.4

## 1. Manager ծառայությունների քարտեր
- Manager → Նոր պատվեր էջի բոլոր 20 ծառայությունները հիմա իրական service image-ով են։
- Առաջին 8 inline SVG icon-ները փոխարինվել են համապատասխան Servicesimg նկարներով։
- Բոլոր քարտերը օգտագործում են նույն photo-card geometry-ը։

## 2. Deadline / ժամային գոտի
- Պատվերի և աշխատակցին նշանակվող աշխատանքի deadline-ը մեկնաբանվում է որպես Asia/Yerevan (UTC+04:00)։
- Supabase-ում շարունակում է պահպանվել UTC timestamptz, բայց մուտքագրումն ու ցուցադրումը Հայաստանի ժամանակով է։
- Ժամերը ցուցադրվում են 24-ժամյա HH:mm ձևաչափով (hour12:false)։
- Admin orders, work distribution, staff tasks/production և employee last-login ցուցադրումները համաժամեցված են։

## 3. Օրվա փակում
- Բոլոր authenticated Admin / Manager / Staff էջերում ավելացվել է «Փակել օրը»։
- Modal-ը ցույց է տալիս ավարտված, բաց և ընթացքի մեջ աշխատանքների թվերը։
- Կարելի է թողնել օրվա ամփոփ նշում։
- Փակման պահը գրանցվում է Asia/Yerevan օրվա տրամաբանությամբ, 24-ժամյա ժամով։
- Կրկնակի սեղմումը նույն օրը չի ստեղծում կրկնակի record (user_id + work_date unique)։
- Ադմինը ունի admin_staff_day_closures(date) RPC՝ փակման պատմությունը ստուգելու համար։
- Admin → Աշխատակիցներ էջում յուրաքանչյուր աշխատակցի մոտ երևում է՝ այսօր օրը փակե՞լ է և ժամը։

## Տեղադրում
1. Գործարկել `supabase/046_yerevan_time_workday_close.sql`։
2. Տեղադրել նոր ֆայլերը կամ FULL փաթեթը։
3. Ctrl+F5 / PWA refresh։
