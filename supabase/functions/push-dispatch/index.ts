// GDprint v5.1 automatic Web Push dispatcher.
// Deploy with JWT verification OFF. Security is the X-GDprint-Webhook-Secret header.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
Deno.serve(async(req)=>{
 try{
  const expected=Deno.env.get('PUSH_WEBHOOK_SECRET')||'';
  if(!expected || req.headers.get('x-gdprint-webhook-secret')!==expected) return json({error:'Forbidden'},403);
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')||'mailto:admin@gdprint.am',Deno.env.get('VAPID_PUBLIC_KEY')!,Deno.env.get('VAPID_PRIVATE_KEY')!);
  const hook=await req.json(); const rec=hook.record||hook;
  const table=hook.table||'';
  let subs:any[]=[]; let payload:any={title:rec.title||'GDprint',body:rec.message||'Դուք ունեք նոր ծանուցում'};
  if(table==='customer_app_notifications' || rec.customer_id){
    const {data}=await supabase.from('customer_push_subscriptions').select('*').eq('customer_id',rec.customer_id); subs=data||[];
    payload.url=rec.order_id?`./order.html?id=${encodeURIComponent(rec.order_id)}`:'./notifications.html';
  } else if(table==='notifications' || rec.recipient_id){
    const {data}=await supabase.from('staff_push_subscriptions').select('*').eq('user_id',rec.recipient_id); subs=data||[];
    payload.url=rec.link||'./dashboard.html';
  } else return json({ok:true,sent:0,reason:'Unsupported payload'});
  let sent=0,removed=0;
  for(const s of subs){
   try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(payload));sent++}
   catch(e){const code=(e as any)?.statusCode;if(code===404||code===410){const tbl=rec.customer_id?'customer_push_subscriptions':'staff_push_subscriptions';await supabase.from(tbl).delete().eq('id',s.id);removed++}}
  }
  return json({ok:true,sent,removed});
 }catch(e){return json({error:String((e as any)?.message||e)},500)}
});
