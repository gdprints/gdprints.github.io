-- GDprint v7.6.1 — add 8 design services everywhere
-- Run AFTER 044_retire_18_services.sql. Safe to re-run.

insert into public.service_catalog(
  code,name_hy,name_ru,name_en,category,base_price,unit,min_qty,active,website_visible,sort_order,pricing_config
) values
  ('plotter_file_design','Պլոտերային հատման ֆայլ','Файл для плоттерной резки','Plotter Cut File','Դիզայն',3000,'ծառայություն',1,true,true,100,'{"pricing_type": "from", "starting_from": 3000}'::jsonb),
  ('mug_design','Բաժակի դիզայն','Дизайн кружки','Mug Design','Դիզայն',3000,'ծառայություն',1,true,true,101,'{"pricing_type": "fixed", "fixed_price": 3000}'::jsonb),
  ('business_card_design','Այցեքարտի դիզայն','Дизайн визитки','Business Card Design','Դիզայն',4000,'ծառայություն',1,true,true,102,'{"pricing_type": "fixed", "fixed_price": 4000}'::jsonb),
  ('banner_design','Բանների դիզայն','Дизайн баннера','Banner Design','Դիզայն',7000,'ծառայություն',1,true,true,103,'{"pricing_type": "fixed", "fixed_price": 7000}'::jsonb),
  ('outdoor_ad_design','Արտաքին գովազդի դիզայն','Дизайн наружной рекламы','Outdoor Advertising Design','Դիզայն',10000,'ծառայություն',1,true,true,104,'{"pricing_type": "from", "starting_from": 10000}'::jsonb),
  ('rollup_design','Roll Up դիզայն','Дизайн Roll Up','Roll-Up Design','Դիզայն',10000,'ծառայություն',1,true,true,105,'{"pricing_type": "fixed", "fixed_price": 10000}'::jsonb),
  ('corporate_identity','Կորպորատիվ ոճ','Корпоративный стиль','Corporate Identity','Դիզայն',18000,'ծառայություն',1,true,true,106,'{"pricing_type": "fixed", "fixed_price": 18000}'::jsonb),
  ('logo_design','Լոգոյի դիզայն','Дизайн логотипа','Logo Design','Դիզայն',30000,'ծառայություն',1,true,true,107,'{"pricing_type": "fixed", "fixed_price": 30000}'::jsonb)
on conflict(code) do update set
  name_hy=excluded.name_hy,
  name_ru=excluded.name_ru,
  name_en=excluded.name_en,
  category=excluded.category,
  base_price=excluded.base_price,
  unit=excluded.unit,
  min_qty=excluded.min_qty,
  active=true,
  website_visible=true,
  sort_order=excluded.sort_order,
  pricing_config=excluded.pricing_config,
  updated_at=now();

create or replace function public.gd_customer_price(p_service_key text,p_details jsonb)
returns numeric language plpgsql immutable as $$
declare
 q int; amount numeric:=0; s text; w numeric; h numeric; rate numeric; border numeric; material text; eyes int;
 sqm numeric;
begin
 case p_service_key
  when 'business_cards' then
    q:=greatest(1000,coalesce((p_details->>'quantity')::int,1000)); amount:=q*8;
  when 'photo_printing' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); s:=coalesce(p_details->>'size','A4');
    amount:=q*(case s when 'A4' then 400 when 'A5' then 200 when 'A6' then 100 else 400 end);
  when 'cup_printing' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); amount:=q*(case when q>50 then 1900 else 2000 end);
  when 'poster_placement' then
    sqm:=greatest(.1,coalesce((p_details->>'square_meters')::numeric,.1)); amount:=round(sqm*4200);
  when 'rollup' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); s:=coalesce(p_details->>'size','80x200');
    amount:=q*(case s when '60x160' then 10150 when '80x200' then 16900 when '85x200' then 18000 when '100x200' then 21100 when '120x200' then 25350 when '150x200' then 31700 else 0 end);
  when 'canvas' then
    q:=greatest(1,coalesce((p_details->>'quantity')::int,1)); s:=coalesce(p_details->>'size','30x40');
    amount:=q*(case s when '20x30' then 5460 when '30x40' then 5850 when '40x50' then 6370 when '50x70' then 6890 when '60x80' then 7410 when '70x100' then 7930 when '100x150' then 14820 when '20x20' then 5670 when '25x35' then 6100 when '35x35' then 6620 when '40x60' then 6620 when '60x60' then 7700 when '80x120' then 9180 when '100x100' then 10400 when '120x180' then 19700 else 0 end);
  when 'wide_format' then
    w:=greatest(.5,coalesce((p_details->>'width')::numeric,.5)); h:=greatest(.5,coalesce((p_details->>'height')::numeric,.5));
    rate:=coalesce((p_details->>'package_rate')::numeric,4500); if rate not in (4500,6000,8000,10000) then rate:=4500; end if;
    border:=case when coalesce((p_details->>'border_cut')::numeric,0)=100 then 100 else 0 end; material:=coalesce(p_details->>'material','Banner');
    amount:=w*h*rate; if border>0 then amount:=amount+2*(w+h)*border; end if;
    if material='Banner+ողակ' then
      eyes:=greatest(8,coalesce(nullif(p_details->>'eyelet_count','')::int,(floor(greatest(w-.024,0)/.3)::int+2)+(floor(greatest(h-.024,0)/.3)::int+2)));
      amount:=amount+eyes*100;
    end if; amount:=round(amount);
  when 'plotter_cutting','kinder_box_printing','tshirt_printing','x_banner','self_adhesive_sticker' then amount:=0;
  when 'plotter_file_design' then amount:=3000;
  when 'mug_design' then amount:=3000;
  when 'business_card_design' then amount:=4000;
  when 'banner_design' then amount:=7000;
  when 'outdoor_ad_design' then amount:=10000;
  when 'rollup_design' then amount:=10000;
  when 'corporate_identity' then amount:=18000;
  when 'logo_design' then amount:=30000;
  else raise exception 'Unknown or retired service';
 end case;
 return amount;
exception when invalid_text_representation then raise exception 'Invalid service parameters';
end $$;
grant execute on function public.gd_customer_price(text,jsonb) to authenticated;

create or replace function public.gd_service_name(p_key text)
returns text language sql immutable as $$select case p_key
 when 'wide_format' then 'Լայնաֆորմատ տպագրություն'
 when 'plotter_cutting' then 'Պլոտերային հատում'
 when 'business_cards' then 'Այցեքարտերի տպագրություն'
 when 'photo_printing' then 'Լուսանկարների տպագրություն'
 when 'rollup' then 'Roll-Up Stand'
 when 'canvas' then 'Կտավի վրա տպագրություն'
 when 'poster_placement' then 'Գովազդի տեղադրում'
 when 'cup_printing' then 'Բաժակի վրա տպագրություն'
 when 'kinder_box_printing' then 'Kinder տուփերի պատրաստում'
 when 'tshirt_printing' then 'Շապիկների տպագրություն'
 when 'x_banner' then 'X-banner տպագրություն'
 when 'self_adhesive_sticker' then 'Ինքնակպչուն սթիքերների տպագրություն'
 when 'plotter_file_design' then 'Պլոտերային հատման ֆայլ'
 when 'mug_design' then 'Բաժակի դիզայն'
 when 'business_card_design' then 'Այցեքարտի դիզայն'
 when 'banner_design' then 'Բանների դիզայն'
 when 'outdoor_ad_design' then 'Արտաքին գովազդի դիզայն'
 when 'rollup_design' then 'Roll Up դիզայն'
 when 'corporate_identity' then 'Կորպորատիվ ոճ'
 when 'logo_design' then 'Լոգոյի դիզայն'
 else p_key end$$;

create or replace function public.create_customer_order(p_service_key text,p_details jsonb,p_description text default '')
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text)
language plpgsql security definer set search_path=public as $$
declare
 v_customer public.customers%rowtype; v_amount numeric; v_no text; v_order public.orders%rowtype; v_prefix text;
begin
 select * into v_customer from public.customers where auth_user_id=auth.uid() limit 1;
 if v_customer.id is null then raise exception 'Customer account not found'; end if;
 if p_service_key not in ('wide_format','plotter_cutting','business_cards','photo_printing','rollup','canvas','poster_placement','cup_printing','kinder_box_printing','tshirt_printing','x_banner','self_adhesive_sticker','plotter_file_design','mug_design','business_card_design','banner_design','outdoor_ad_design','rollup_design','corporate_identity','logo_design') then raise exception 'Unknown or retired service'; end if;
 v_amount:=public.gd_customer_price(p_service_key,coalesce(p_details,'{}'::jsonb));
 v_prefix:=case p_service_key
   when 'wide_format' then 'LTP'
   when 'plotter_cutting' then 'PLT'
   when 'business_cards' then 'BC'
   when 'photo_printing' then 'PH'
   when 'rollup' then 'RL'
   when 'canvas' then 'CNV'
   when 'poster_placement' then 'POST'
   when 'cup_printing' then 'CUP'
   when 'kinder_box_printing' then 'KIN'
   when 'tshirt_printing' then 'TSH'
   when 'x_banner' then 'XBN'
   when 'self_adhesive_sticker' then 'STK'
   when 'plotter_file_design' then 'PFD'
   when 'mug_design' then 'MGD'
   when 'business_card_design' then 'BCD'
   when 'banner_design' then 'BND'
   when 'outdoor_ad_design' then 'OAD'
   when 'rollup_design' then 'RUD'
   when 'corporate_identity' then 'CID'
   when 'logo_design' then 'LGD'
   else 'GD' end;
 v_no:=v_prefix||'-'||to_char(clock_timestamp(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 perform set_config('app.customer_order_rpc','1',true);
 insert into public.orders(order_number,customer_id,customer_name,customer_phone,customer_email,created_by_type,created_by_manager_id,service_key,service_name,language,total_amount,description,status)
 values(v_no,v_customer.id,v_customer.full_name,v_customer.phone,v_customer.email,'customer',null,p_service_key,public.gd_service_name(p_service_key),'hy',v_amount,coalesce(p_description,''),'pending') returning * into v_order;
 insert into public.order_details(order_id,details) values(v_order.id,coalesce(p_details,'{}'::jsonb)||jsonb_build_object('_server_price',v_amount,'_created_from','customer_app'));
 insert into public.order_status_history(order_id,old_status,new_status,changed_by) values(v_order.id,null,'pending',null);
 insert into public.customer_app_notifications(customer_id,order_id,type,title,message) values(v_customer.id,v_order.id,'order_created','Պատվերն ընդունված է','Ձեր '||v_no||' պատվերը հաջողությամբ գրանցվել է։');
 begin
   insert into public.notifications(recipient_id,type,title,message,link)
   select id,'new_customer_order','Նոր պատվեր Customer App-ից',v_no||' — '||public.gd_service_name(p_service_key),'dashboard.html' from public.profiles where role='admin';
 exception when others then null; end;
 return query select v_order.id,v_order.order_number,v_order.total_amount,v_order.status,v_order.service_name;
end $$;
revoke all on function public.create_customer_order(text,jsonb,text) from public;
grant execute on function public.create_customer_order(text,jsonb,text) to authenticated;

create or replace function public.gd_design_services_health()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
  'design_catalog_rows',(select count(*) from public.service_catalog where code in ('plotter_file_design','mug_design','business_card_design','banner_design','outdoor_ad_design','rollup_design','corporate_identity','logo_design') and active=true),
  'design_expected',8,
  'all_design_prices_ok',(select count(*)=8 from public.service_catalog where code in ('plotter_file_design','mug_design','business_card_design','banner_design','outdoor_ad_design','rollup_design','corporate_identity','logo_design') and base_price>0),
  'checked_at',now()
)$$;
grant execute on function public.gd_design_services_health() to authenticated;

notify pgrst, 'reload schema';
