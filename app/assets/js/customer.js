let GDCustomer = { session:null, customer:null };
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showAppMessage(text,type='error'){let el=document.getElementById('app-message');if(!el){el=document.createElement('div');el.id='app-message';document.body.appendChild(el)}el.className='app-message '+type;el.textContent=text;el.style.display='block';setTimeout(()=>el.style.display='none',5000)}
async function currentCustomer(){
  const {data:{session}}=await supabaseClient.auth.getSession(); if(!session)return null;
  const {data,error}=await supabaseClient.from('customers').select('*').eq('auth_user_id',session.user.id).maybeSingle();
  if(error) throw error; if(!data)return null; GDCustomer={session,customer:data}; return GDCustomer;
}
async function requireCustomer(){try{const c=await currentCustomer();if(!c){location.href='index.html';return null}setTimeout(refreshNotificationBadge,0);setTimeout(maybeOfferCustomerPush,1800);return c}catch(e){console.error(e);location.href='index.html';return null}}
async function customerSignIn(email,password){
  const {error}=await supabaseClient.auth.signInWithPassword({email,password}); if(error)throw error;
  let c=await currentCustomer();
  if(!c){
    const {data:{user}}=await supabaseClient.auth.getUser();
    const m=user?.user_metadata||{};
    if(m.account_type==='customer' && m.full_name && m.phone){
      const {error:re}=await supabaseClient.rpc('register_customer_account',{p_full_name:m.full_name,p_phone:m.phone});
      if(re)throw re; c=await currentCustomer();
    }
  }
  if(!c){await supabaseClient.auth.signOut();throw new Error('Այս հաշիվը հաճախորդի հաշիվ չէ։')} return c;
}
async function customerRegister(v){
  const {data,error}=await supabaseClient.auth.signUp({email:v.email,password:v.password,options:{data:{account_type:'customer',full_name:v.full_name,phone:v.phone}}}); if(error)throw error;
  if(data.session){
    const {error:re}=await supabaseClient.rpc('register_customer_account',{p_full_name:v.full_name,p_phone:v.phone}); if(re)throw re;
  }
  return data;
}
async function customerLogout(){await supabaseClient.auth.signOut();location.href='index.html'}
async function loadMyOrders(limit=100){const {data,error}=await supabaseClient.from('orders').select('*').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[]}
async function loadOrderByNumber(no){const {data,error}=await supabaseClient.from('orders').select('*').eq('order_number',no).maybeSingle();if(error)throw error;return data}
async function loadOrderHistory(id){const {data,error}=await supabaseClient.from('order_status_history').select('*').eq('order_id',id).order('changed_at',{ascending:true});if(error)return[];return data||[]}
async function loadCustomerNotifications(){const {data,error}=await supabaseClient.from('customer_app_notifications').select('*').order('created_at',{ascending:false}).limit(60);if(error)throw error;return data||[]}
async function markCustomerNotificationsRead(){await supabaseClient.from('customer_app_notifications').update({is_read:true}).eq('is_read',false)}
function draftId(){let id=sessionStorage.getItem('gdDraftId');if(!id){id=crypto.randomUUID();sessionStorage.setItem('gdDraftId',id)}return id}
async function uploadDraftFile(file){
  const c=await requireCustomer(); if(!c)throw new Error('Մուտք գործեք');
  const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_'); const path=`${c.session.user.id}/${draftId()}/${Date.now()}_${safe}`;
  const {error}=await supabaseClient.storage.from('customer-order-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'}); if(error)throw error;
  return {storage_path:path,file_name:file.name,file_type:file.type||'',file_size:file.size};
}
async function submitCustomerOrder(draft,files=[]){
  const delivery=draft.delivery||{method:'pickup',address_id:null};
  // Core order creation must stay independent from delivery.
  const {data,error}=await supabaseClient.rpc('create_customer_order',{
    p_service_key:draft.service_key,
    p_details:draft.details||{},
    p_description:draft.description||''
  });
  if(error)throw new Error(error.message||'Պատվերի գրանցումը չհաջողվեց');
  const order=data && (Array.isArray(data)?data[0]:data);
  if(!order?.id)throw new Error('Պատվերը չստեղծվեց');

  // Persist pickup/delivery as an immutable order snapshot after core order creation.
  try{
    const {error:de}=await supabaseClient.rpc('save_customer_order_delivery_snapshot',{
      p_order_id:order.id,
      p_delivery_method:delivery.method||'pickup',
      p_address_id:delivery.method==='delivery'?(delivery.address_id||null):null,
      p_snapshot:delivery.method==='delivery'?(delivery.snapshot||{}):{}
    });
    if(de) throw de;
    sessionStorage.removeItem('gdDeliveryWarning');
  }catch(e){
    console.error('GDprint delivery snapshot failed:',e);
    sessionStorage.setItem('gdDeliveryWarning','1');
    sessionStorage.setItem('gdDeliveryError',e?.message||String(e));
  }

  for(const f of files){
    const {error:fe}=await supabaseClient.from('order_files').insert({order_id:order.id,file_name:f.file_name,storage_path:f.storage_path});
    if(fe)console.warn('order file link:',fe);
  }
  sessionStorage.removeItem('gdOrderDraft');
  sessionStorage.removeItem('gdUploadedFiles');
  sessionStorage.removeItem('gdDraftId');
  return order;
}
async function signedFileUrl(path,seconds=900){if(!path)return'';const {data,error}=await supabaseClient.storage.from('customer-order-files').createSignedUrl(path,seconds);if(error)return'';return data.signedUrl}

async function refreshNotificationBadge(){
  const el=document.getElementById('customer-notif-badge'); if(!el||!GDCustomer.customer)return;
  const {count}=await supabaseClient.from('customer_app_notifications').select('*',{count:'exact',head:true}).eq('is_read',false);
  const n=count||0; el.textContent=n>99?'99+':n; el.classList.toggle('hide',n===0);
}
function subscribeCustomerNotifications(){
  if(!GDCustomer.customer)return null;
  return supabaseClient.channel('gd-customer-notifications-'+GDCustomer.customer.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'customer_app_notifications',filter:'customer_id=eq.'+GDCustomer.customer.id},()=>{refreshNotificationBadge()})
    .subscribe();
}


/* === v3 customer actions === */
async function loadActiveOffers(){const {data,error}=await supabaseClient.from('customer_offers').select('*').eq('is_active',true).lte('starts_at',new Date().toISOString()).or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`).order('priority',{ascending:false}).limit(10);if(error){console.warn(error);return[]}return data||[]}
async function loadAddresses(){const {data,error}=await supabaseClient.from('customer_addresses').select('*').order('is_default',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;return data||[]}
async function saveAddress(v){const {data,error}=await supabaseClient.rpc('save_customer_address',{p_id:v.id||null,p_label:v.label,p_recipient_name:v.recipient_name,p_phone:v.phone,p_city:v.city,p_address_line:v.address_line,p_note:v.note||'',p_is_default:!!v.is_default});if(error)throw error;return data}
async function deleteAddress(id){const {error}=await supabaseClient.rpc('delete_customer_address',{p_id:id});if(error)throw error}
async function loadLatestProof(orderId){const {data,error}=await supabaseClient.from('order_design_proofs').select('*').eq('order_id',orderId).order('version',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data}
async function respondToProof(proofId,decision,comment=''){const {error}=await supabaseClient.rpc('respond_to_design_proof',{p_proof_id:proofId,p_decision:decision,p_comment:comment});if(error)throw error}

async function loadOrderDelivery(orderId){const {data,error}=await supabaseClient.from('order_delivery_details').select('*').eq('order_id',orderId).maybeSingle();if(error){console.warn(error);return null}return data}
function paymentStatusLabel(s){return ({paid:'Վճարված է',deposit:'Մասամբ վճարված / կանխավճար',unpaid:'Չվճարված'})[s]||'Չվճարված'}
async function loadPaymentRequest(orderId){const {data,error}=await supabaseClient.from('customer_payment_requests').select('*').eq('order_id',orderId).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data}
async function getPushConfig(){const {data,error}=await supabaseClient.rpc('get_customer_app_public_config');if(error)return{};return data||{}}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4),base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'),rawData=atob(base64),outputArray=new Uint8Array(rawData.length);for(let i=0;i<rawData.length;i++)outputArray[i]=rawData.charCodeAt(i);return outputArray}
async function enablePushNotifications(){if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Այս սարքը Web Push չի աջակցում');const cfg=await getPushConfig();if(!cfg.vapid_public_key)throw new Error('Push ծառայության public key-ը դեռ չի կարգավորվել Admin-ի կողմից');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Ծանուցումների թույլտվությունը չի տրվել');const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapid_public_key)});const j=sub.toJSON();const {error}=await supabaseClient.rpc('save_customer_push_subscription',{p_endpoint:j.endpoint,p_p256dh:j.keys?.p256dh||'',p_auth:j.keys?.auth||'',p_user_agent:navigator.userAgent});if(error)throw error;return true}
async function disablePushNotifications(){if(!('serviceWorker'in navigator))return;const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(sub){await supabaseClient.rpc('delete_customer_push_subscription',{p_endpoint:sub.endpoint});await sub.unsubscribe()}}
async function pushEnabled(){if(!('serviceWorker'in navigator))return false;const reg=await navigator.serviceWorker.ready;return !!(await reg.pushManager.getSubscription())}

/* === v5.1 friendly one-click Push opt-in === */
async function maybeOfferCustomerPush(){
  try{
    if(!GDCustomer.customer||!('Notification'in window)||!('PushManager'in window)||Notification.permission==='denied'||localStorage.getItem('gd_customer_push_asked')||await pushEnabled())return;
    if(document.getElementById('gdCustomerPushPrompt'))return;
    const x=document.createElement('div');x.id='gdCustomerPushPrompt';x.style.cssText='position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)';
    x.innerHTML='<div style="width:min(430px,100%);padding:26px;border-radius:24px;background:#111318;border:1px solid rgba(212,175,55,.3);color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.45)"><div style="font-size:11px;font-weight:800;letter-spacing:.12em;color:#d4af37;margin-bottom:8px">GDPRINT NOTIFICATIONS</div><h2 style="margin:0 0 12px;color:#fff">Միացնել իրական ծանուցումները</h2><p style="color:#c4c7cd;line-height:1.6;font-size:14px">Ստացեք պատվերի կարգավիճակի, պատրաստ լինելու, դիզայնի և առաքման մասին ծանուցումներ հեռախոսի վրա՝ նույնիսկ երբ հավելվածը փակ է։</p><div style="display:flex;gap:10px;margin-top:20px"><button id="gdPushYes" style="flex:1;min-height:48px;border:0;border-radius:13px;background:linear-gradient(135deg,#ecd36a,#c89a1e);font-weight:800">Միացնել</button><button id="gdPushLater" style="min-height:48px;padding:0 18px;border-radius:13px;border:1px solid #333;background:#1b1d21;color:#fff">Հետո</button></div><div id="gdPushErr" style="display:none;margin-top:12px;color:#ffb4b4;font-size:12px"></div></div>';
    document.body.appendChild(x);
    document.getElementById('gdPushLater').onclick=()=>{localStorage.setItem('gd_customer_push_asked','1');x.remove()};
    document.getElementById('gdPushYes').onclick=async e=>{e.currentTarget.disabled=true;try{await enablePushNotifications();x.remove();showAppMessage('Ծանուցումները միացված են','success')}catch(err){const m=document.getElementById('gdPushErr');m.textContent=err.message||String(err);m.style.display='block';e.currentTarget.disabled=false}};
  }catch(e){console.warn('Push offer',e)}
}
