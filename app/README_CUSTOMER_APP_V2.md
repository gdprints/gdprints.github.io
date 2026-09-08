# GDprint Customer App v2

Այս տարբերակը prototype չէ. այն միացված է նույն Supabase նախագծին և նախատեսված է իրական Customer հաշիվների համար։

## Տեղադրում
1. Supabase → SQL Editor → մեկ անգամ Run անել `supabase/005_customer_mobile_app.sql`։
2. Տեղադրել ամբողջ նախագիծը նույն hosting-ում։ Customer հավելվածի մուտքը `/app/` է։
3. Supabase Auth → URL Configuration-ում Site URL / Redirect URLs ավելացնել production domain-ի `/app/` հասցեն, եթե Email confirmation-ը միացված է։
4. Storage-ում ավտոմատ կստեղծվի private `customer-order-files` bucket (50MB/file)։

## Անվտանգություն
- Customer-ը տեսնում է միայն իր CRM customer row-ը և իր պատվերները։
- Customer-ը չի կարող browser/API-ից ուղղակի ստեղծել կամ փոփոխել order-ի գինը. order-ը ստեղծվում է SECURITY DEFINER RPC-ով և գինը հաշվարկվում է server-side։
- Plotter և Calendar ծառայությունները մնում են պայմանագրային՝ 0 total_amount մինչև Admin-ի վերջնական գինը։
- Customer-ի ֆայլերը private storage-ում են։

## Իրական հաշվիչներ
Միացված են current GDprint կանոնները՝ Wide Format, Business Cards, Photo, Printable Forms, Cups, Poster Placement, Roll-up, Canvas, Flyer։ Plotter/Calendar-ը պայմանագրային են, ինչպես գործող ծառայությունների էջում։
