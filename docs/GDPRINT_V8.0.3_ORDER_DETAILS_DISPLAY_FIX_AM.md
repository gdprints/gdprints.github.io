# GDprint v8.0.3 — Պատվերի մանրամասների ցուցադրման շտկում

Այս տարբերակը չի ջնջում ERP/պահեստի համար անհրաժեշտ canonical դաշտերը (`size`, `quantity`, `material`, ...), այլ մաքրում է դրանց ցուցադրումը UI-ում։

## Ինչ էր տեղի ունենում
Պատվերի `order_details.details` JSON-ը պահում է և՛ հաճախորդին հասկանալի դաշտերը, և՛ համակարգային canonical/metadata դաշտերը։ Օրինակ՝ `Թղթի չափս=A6`-ի կողքին պահվում է նաև `size=A6`, իսկ RPC-ն ավելացնում է `_created_via`, `_created_from`, `_server_price`։ Admin/Manager/Tracking էջերը նախկինում տպում էին JSON-ի բոլոր key-երը։

## Ինչ է փոխվել
- Ավելացվել է `admin/shared/js/order-details.js` ընդհանուր formatter։
- `_created_via`, `_created_from`, `_server_price`, `_repeated_from` և ապագա `_...` համակարգային metadata-ն UI-ում թաքցվում է։
- `_price_display` մնում է տեսանելի՝ մարդուն հասկանալի «Հաշվարկված գին (կայքից)» անունով։
- `size` + `Թղթի չափս` և `quantity` + `Տպագրության քանակը` կրկնությունները միավորվում են մեկ տողի մեջ։
- Նույն formatter-ը կիրառվում է Super Admin, Manager, Staff և public order tracking-ում։
- HY/RU/EN label mapping ավելացված է։
- HTML escaping ավելացված է order detail արժեքների համար։
- Admin service-worker cache-ը բարձրացվել է `gdprint-admin-v8-0-3`։

## SQL
Նոր SQL migration պետք չէ։ Տվյալների բազայի կառուցվածքն ու հին պատվերները չեն փոփոխվում։ Նույն հին պատվերներն էլ նոր UI-ում մաքուր կերևան։
