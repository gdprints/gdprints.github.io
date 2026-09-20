-- ============================================================
-- GDprint Customer App v7.5 — messages + customer security bridge
-- Run AFTER 037 / 037B. Safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- Customer-safe message bundle. JSON return avoids signature drift problems.
create or replace function public.customer_order_message_bundle(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  cid uuid := public.current_customer_id();
  o public.orders%rowtype;
  payload jsonb;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  select * into o from public.orders where id=p_order_id and customer_id=cid;
  if o.id is null then raise exception 'Order not found'; end if;

  select jsonb_build_object(
    'order', jsonb_build_object(
      'id',o.id,'order_number',o.order_number,'service_name',o.service_name,
      'status',o.status,'created_at',o.created_at
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,
        'author_type',m.author_type,
        'message',m.message,
        'created_at',m.created_at
      ) order by m.created_at asc)
      from public.order_messages m where m.order_id=o.id
    ), '[]'::jsonb)
  ) into payload;
  return payload;
end $$;
revoke all on function public.customer_order_message_bundle(uuid) from public;
grant execute on function public.customer_order_message_bundle(uuid) to authenticated;

create or replace function public.customer_message_threads()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  cid uuid := public.current_customer_id();
  payload jsonb;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.last_message_at desc nulls last, x.created_at desc),'[]'::jsonb)
  into payload
  from (
    select
      o.id as order_id,
      o.order_number,
      o.service_name,
      o.status,
      o.created_at,
      lm.message as last_message,
      lm.author_type as last_author_type,
      lm.created_at as last_message_at
    from public.orders o
    left join lateral (
      select m.message,m.author_type,m.created_at
      from public.order_messages m
      where m.order_id=o.id
      order by m.created_at desc
      limit 1
    ) lm on true
    where o.customer_id=cid
      and (lm.created_at is not null or o.created_at >= now()-interval '90 days')
    order by lm.created_at desc nulls last,o.created_at desc
    limit 80
  ) x;
  return payload;
end $$;
revoke all on function public.customer_message_threads() from public;
grant execute on function public.customer_message_threads() to authenticated;

create or replace function public.customer_send_order_message(p_order_id uuid,p_message text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  cid uuid := public.current_customer_id();
  mid uuid;
  ono text;
begin
  if cid is null then raise exception 'Customer account not found'; end if;
  if coalesce(trim(p_message),'')='' then raise exception 'Message is empty'; end if;
  select order_number into ono from public.orders where id=p_order_id and customer_id=cid;
  if ono is null then raise exception 'Order not found'; end if;

  insert into public.order_messages(order_id,author_type,message)
  values(p_order_id,'customer',trim(p_message)) returning id into mid;

  begin
    insert into public.notifications(recipient_id,type,title,message,link)
    select p.id,'customer_message','Հաճախորդի նոր հաղորդագրություն',
           '#'||ono||' — '||left(trim(p_message),120),
           'orders.html'
    from public.profiles p
    where p.role='admin' and coalesce(p.account_status,'active')<>'blocked';
  exception when others then null; end;
  return mid;
end $$;
revoke all on function public.customer_send_order_message(uuid,text) from public;
grant execute on function public.customer_send_order_message(uuid,text) to authenticated;

-- Keep legacy function but route it through the stronger bridge.
create or replace function public.add_customer_order_message(p_order_id uuid,p_message text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.customer_send_order_message(p_order_id,p_message);
  return true;
end $$;
revoke all on function public.add_customer_order_message(uuid,text) from public;
grant execute on function public.add_customer_order_message(uuid,text) to authenticated;

-- Notify Customer App whenever staff/admin writes in an order conversation.
create or replace function public.notify_customer_staff_order_message()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare cid uuid; ono text;
begin
  if coalesce(new.author_type,'')='customer' then return new; end if;
  select customer_id,order_number into cid,ono from public.orders where id=new.order_id;
  if cid is null then return new; end if;
  insert into public.customer_app_notifications(customer_id,order_id,type,title,message)
  values(cid,new.order_id,'message','Նոր հաղորդագրություն GDprint-ից',
         '#'||coalesce(ono,'')||' — '||left(coalesce(new.message,''),160));
  return new;
end $$;
drop trigger if exists trg_notify_customer_staff_order_message on public.order_messages;
create trigger trg_notify_customer_staff_order_message
  after insert on public.order_messages
  for each row execute function public.notify_customer_staff_order_message();

-- Explicit grants useful after schema drift / restores.
grant execute on function public.repeat_customer_order(uuid) to authenticated;
grant execute on function public.update_customer_profile(text,text) to authenticated;

-- Refresh PostgREST schema cache.
notify pgrst, 'reload schema';
