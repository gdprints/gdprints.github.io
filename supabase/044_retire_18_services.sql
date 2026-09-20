-- GDprint v7.6.0 — retire 18 services everywhere without deleting historical orders
-- Run AFTER 043. Safe to re-run.

-- Remove the retired services from admin master data and automatic inventory rules.
delete from public.service_inventory_rules where service_key in (
  'booklet_printing',
  'calendar',
  'certificate_award',
  'flier_printing',
  'flyer',
  'folder_printing',
  'guide_printing',
  'label_printing',
  'manual_printing',
  'map_printing',
  'medical_forms',
  'note_sheets',
  'paper_bags',
  'postcard_printing',
  'poster_printing',
  'printable_forms',
  'thick_paper_bags',
  'ticket_printing'
);

delete from public.service_catalog where code in (
  'booklet_printing',
  'calendar',
  'certificate_award',
  'flier_printing',
  'flyer',
  'folder_printing',
  'guide_printing',
  'label_printing',
  'manual_printing',
  'map_printing',
  'medical_forms',
  'note_sheets',
  'paper_bags',
  'postcard_printing',
  'poster_printing',
  'printable_forms',
  'thick_paper_bags',
  'ticket_printing'
);

-- Disable service-targeted campaigns if their target is exactly a retired service code.
update public.marketing_campaigns
set active=false, updated_at=now()
where target in (
  'booklet_printing',
  'calendar',
  'certificate_award',
  'flier_printing',
  'flyer',
  'folder_printing',
  'guide_printing',
  'label_printing',
  'manual_printing',
  'map_printing',
  'medical_forms',
  'note_sheets',
  'paper_bags',
  'postcard_printing',
  'poster_printing',
  'printable_forms',
  'thick_paper_bags',
  'ticket_printing'
);

-- Prevent stale/cached website, manager or app clients from creating a new retired-service order.
create or replace function public.gd_block_retired_service_order()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.service_key in (
    'booklet_printing',
  'calendar',
  'certificate_award',
  'flier_printing',
  'flyer',
  'folder_printing',
  'guide_printing',
  'label_printing',
  'manual_printing',
  'map_printing',
  'medical_forms',
  'note_sheets',
  'paper_bags',
  'postcard_printing',
  'poster_printing',
  'printable_forms',
  'thick_paper_bags',
  'ticket_printing'
  ) then
    raise exception 'This GDprint service has been retired: %', new.service_key;
  end if;
  return new;
end $$;

drop trigger if exists trg_block_retired_service_order on public.orders;
create trigger trg_block_retired_service_order
before insert on public.orders
for each row execute function public.gd_block_retired_service_order();

-- Customer-app server pricing now exposes only active customer-app services.
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
 else p_key end$$;

-- Keep the Customer App order RPC aligned with the 12 remaining services.
-- Services without a fixed online price are still accepted with amount=0 and are finalized by Admin/Manager.
create or replace function public.create_customer_order(p_service_key text,p_details jsonb,p_description text default '')
returns table(id uuid,order_number text,total_amount numeric,status text,service_name text)
language plpgsql security definer set search_path=public as $$
declare
 v_customer public.customers%rowtype; v_amount numeric; v_no text; v_order public.orders%rowtype; v_prefix text;
begin
 select * into v_customer from public.customers where auth_user_id=auth.uid() limit 1;
 if v_customer.id is null then raise exception 'Customer account not found'; end if;
 if p_service_key not in (
   'wide_format','plotter_cutting','business_cards','photo_printing','rollup','canvas',
   'poster_placement','cup_printing','kinder_box_printing','tshirt_printing','x_banner','self_adhesive_sticker'
 ) then raise exception 'Unknown or retired service'; end if;
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

-- Health check for the retirement migration.
create or replace function public.gd_retired_services_health()
returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object(
 'retired_catalog_rows',(select count(*) from public.service_catalog where code in ('booklet_printing','calendar','certificate_award','flier_printing','flyer','folder_printing','guide_printing','label_printing','manual_printing','map_printing','medical_forms','note_sheets','paper_bags','postcard_printing','poster_printing','printable_forms','thick_paper_bags','ticket_printing')),
 'retired_inventory_rules',(select count(*) from public.service_inventory_rules where service_key in ('booklet_printing','calendar','certificate_award','flier_printing','flyer','folder_printing','guide_printing','label_printing','manual_printing','map_printing','medical_forms','note_sheets','paper_bags','postcard_printing','poster_printing','printable_forms','thick_paper_bags','ticket_printing')),
 'historical_orders_preserved',(select count(*) from public.orders where service_key in ('booklet_printing','calendar','certificate_award','flier_printing','flyer','folder_printing','guide_printing','label_printing','manual_printing','map_printing','medical_forms','note_sheets','paper_bags','postcard_printing','poster_printing','printable_forms','thick_paper_bags','ticket_printing'))
);$$;
grant execute on function public.gd_retired_services_health() to authenticated;
