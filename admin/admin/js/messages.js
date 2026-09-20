/* ============================================================
   Admin Messages — manager/internal chat + Staff ERP inbox
   ============================================================ */

let MY_ID = null;
let ACTIVE_CONV = null;
let ACTIVE_PAIR = null;
let ACTIVE_STAFF = null;
let CONVERSATIONS = [];
let PEOPLE_BY_ID = {};
let STAFF_CHAT_CHANNEL = null;
let STAFF_CHAT_BUNDLE = {people:[],messages:[]};

const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STAFF_ROLES = new Set(['designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin']);

(async function init(){
  const auth = await requireRole(['admin']);
  if (!auth) return;
  MY_ID = auth.session.user.id;
  document.getElementById('user-name').textContent = auth.profile.full_name || auth.session.user.email.split('@')[0];
  document.getElementById('user-avatar').textContent = initials(auth.profile.full_name || auth.session.user.email);

  await renderConvList();
  document.getElementById('msg-send-btn').addEventListener('click', sendCurrentMessage);
  document.getElementById('msg-input').addEventListener('keydown', e => { if(e.key === 'Enter') sendCurrentMessage(); });

  subscribeToInternalMessages(payload => {
    const m = payload.new;
    if (m.sender_id === MY_ID) return;
    if (ACTIVE_PAIR && (m.sender_id === ACTIVE_PAIR.a || m.sender_id === ACTIVE_PAIR.b)) openPairConversation(ACTIVE_PAIR.a, ACTIVE_PAIR.b);
    else if (ACTIVE_CONV && (m.sender_id === ACTIVE_CONV || m.recipient_id === ACTIVE_CONV || (ACTIVE_CONV === BROADCAST_ID && !m.recipient_id))) openConversation(ACTIVE_CONV);
    else { toast('💬 Նոր հաղորդագրություն','info'); renderConvList(); }
  });

  try{
    STAFF_CHAT_CHANNEL = supabaseClient.channel('gd-admin-staff-chat')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'staff_chat_messages'},payload=>{
        const m=payload.new;
        if(ACTIVE_STAFF && (m.sender_id===ACTIVE_STAFF || m.recipient_id===ACTIVE_STAFF)) openStaffConversation(ACTIVE_STAFF);
        else { toast('💬 Նոր հաղորդագրություն աշխատակցից','info'); renderConvList(); }
      }).subscribe();
  }catch(_){ }
  window.addEventListener('focus',()=>{ if(ACTIVE_STAFF) openStaffConversation(ACTIVE_STAFF); });
})();

async function loadStaffChatBundle(){
  const {data,error}=await supabaseClient.rpc('staff_chat_bundle');
  if(error){
    console.error('staff_chat_bundle',error);
    if(error.code==='PGRST202') toast('Staff/Admin bridge-ը բացակայում է․ գործարկեք 037_staff_admin_bridge_repair.sql','error');
    return {people:[],messages:[]};
  }
  return data||{people:[],messages:[]};
}

async function renderConvList(){
  CONVERSATIONS = await loadConversationList(MY_ID);
  STAFF_CHAT_BUNDLE = await loadStaffChatBundle();
  const staffDirectory = Array.isArray(STAFF_CHAT_BUNDLE.people) ? STAFF_CHAT_BUNDLE.people : [];
  staffDirectory.forEach(p=>{ if(p.id!==MY_ID && !CONVERSATIONS.some(c=>c.id===p.id)) CONVERSATIONS.push({...p,unread:0}); });
  PEOPLE_BY_ID={};
  CONVERSATIONS.forEach(c => { PEOPLE_BY_ID[c.id] = c; });
  PEOPLE_BY_ID[MY_ID] = { full_name:'Դուք (Ադմին)', role:'admin' };

  // Existing manager/internal message system.
  const internalConvs = CONVERSATIONS.filter(c => c.id === BROADCAST_ID || c.role === 'manager' || c.role === 'admin');
  const myThreads = internalConvs.map(c => `
    <div class="conv-item ${!ACTIVE_PAIR && !ACTIVE_STAFF && ACTIVE_CONV === c.id ? 'active' : ''}" data-mode="mine" data-id="${safe(c.id)}">
      <div class="avatar" style="width:32px;height:32px;font-size:11px">${c.id === BROADCAST_ID ? '📢' : initials(c.full_name)}</div>
      <span class="name">${safe(c.full_name)}${c.role === 'manager' ? ' · Մենեջեր' : ''}</span>
      ${c.unread ? `<span class="nav-badge">${c.unread}</span>` : ''}
    </div>`).join('');

  // Dedicated ERP staff inbox: this is the table actually used by staff/messages.html.
  const staffPeople = CONVERSATIONS.filter(c => STAFF_ROLES.has(c.role));
  let staffUnread = {};
  (Array.isArray(STAFF_CHAT_BUNDLE.messages)?STAFF_CHAT_BUNDLE.messages:[]).filter(m=>m.recipient_id===MY_ID && !m.is_read).forEach(r=>staffUnread[r.sender_id]=(staffUnread[r.sender_id]||0)+1);
  const staffHtml = `<div class="nav-section-title" style="padding:14px 12px 6px">Աշխատակիցների հաղորդագրություններ</div>` +
    (staffPeople.length ? staffPeople.map(c => `
      <div class="conv-item ${ACTIVE_STAFF === c.id ? 'active' : ''}" data-mode="staff" data-id="${safe(c.id)}">
        <div class="avatar" style="width:32px;height:32px;font-size:10px">🛠</div>
        <span class="name">${safe(c.full_name || c.employee_id || 'Աշխատակից')} · ${safe(c.role)}</span>
        ${staffUnread[c.id] ? `<span class="nav-badge">${staffUnread[c.id]}</span>` : ''}
      </div>`).join('') : '<div class="page-sub" style="padding:8px 12px">Աշխատակից չկա</div>');

  const otherPairs = (await loadAllConversationPairs(PEOPLE_BY_ID)).filter(p => p.a !== MY_ID && p.b !== MY_ID);
  const otherThreadsHtml = otherPairs.length ? `<div class="nav-section-title" style="padding:14px 12px 6px">Այլ նամակագրություններ</div>` + otherPairs.map(p => `
    <div class="conv-item ${ACTIVE_PAIR?.a === p.a && ACTIVE_PAIR?.b === p.b ? 'active' : ''}" data-mode="pair" data-a="${safe(p.a)}" data-b="${safe(p.b)}">
      <div class="avatar" style="width:32px;height:32px;font-size:10px">👀</div><span class="name">${safe(p.aName)} ↔ ${safe(p.bName)}</span>
    </div>`).join('') : '';

  const el = document.getElementById('conv-list');
  el.innerHTML = myThreads + staffHtml + otherThreadsHtml;
  el.querySelectorAll('[data-mode="mine"]').forEach(item => item.addEventListener('click',()=>openConversation(item.dataset.id)));
  el.querySelectorAll('[data-mode="staff"]').forEach(item => item.addEventListener('click',()=>openStaffConversation(item.dataset.id)));
  el.querySelectorAll('[data-mode="pair"]').forEach(item => item.addEventListener('click',()=>openPairConversation(item.dataset.a,item.dataset.b)));
}

async function openConversation(otherId){
  ACTIVE_CONV = otherId; ACTIVE_PAIR = null; ACTIVE_STAFF = null;
  const conv = CONVERSATIONS.find(c => c.id === otherId);
  document.getElementById('active-conv-name').textContent = conv?.full_name || '—';
  document.getElementById('msg-input-row').style.display = 'flex';
  await markThreadRead(MY_ID,otherId);
  const messages = await loadMessages(MY_ID,otherId);
  document.getElementById('msg-scroll').innerHTML = renderMessageBubbles(messages,MY_ID);
  document.getElementById('msg-scroll').scrollTop = 999999;
  await renderConvList();
}

async function openPairConversation(a,b){
  ACTIVE_PAIR={a,b}; ACTIVE_CONV=null; ACTIVE_STAFF=null;
  document.getElementById('active-conv-name').textContent=`👀 ${PEOPLE_BY_ID[a]?.full_name||'—'} ↔ ${PEOPLE_BY_ID[b]?.full_name||'—'} (դիտում)`;
  document.getElementById('msg-input-row').style.display='none';
  const messages=await loadMessagesBetween(a,b);
  document.getElementById('msg-scroll').innerHTML=renderMessageBubbles(messages,a);
  document.getElementById('msg-scroll').scrollTop=999999;
  await renderConvList();
}

async function openStaffConversation(staffId){
  ACTIVE_STAFF=staffId; ACTIVE_CONV=null; ACTIVE_PAIR=null;
  const person=CONVERSATIONS.find(c=>c.id===staffId);
  document.getElementById('active-conv-name').textContent=`🛠 ${person?.full_name || person?.employee_id || 'Աշխատակից'} · ${person?.role || ''}`;
  document.getElementById('msg-input-row').style.display='flex';

  STAFF_CHAT_BUNDLE=await loadStaffChatBundle();
  const allMessages=Array.isArray(STAFF_CHAT_BUNDLE.messages)?STAFF_CHAT_BUNDLE.messages:[];
  const messages=allMessages.filter(m =>
    (m.sender_id===staffId && (m.recipient_id===MY_ID || m.recipient_id===null)) ||
    (m.sender_id===MY_ID && m.recipient_id===staffId)
  );
  const {error:readError}=await supabaseClient.rpc('staff_chat_mark_read',{p_sender_id:staffId});
  if(readError) console.error('staff_chat_mark_read',readError);

  document.getElementById('msg-scroll').innerHTML = messages.length ? messages.map(m=>{
    const mine=m.sender_id===MY_ID;
    const sender=PEOPLE_BY_ID[m.sender_id]?.full_name || (mine?'Դուք':'Աշխատակից');
    return `<div style="display:flex;${mine?'justify-content:flex-end;':''}margin-bottom:10px"><div style="max-width:75%;padding:10px 14px;border-radius:14px;${mine?'background:linear-gradient(135deg,var(--ink-cyan),#0090ab);color:#fff;':'background:var(--surface-solid);border:1px solid var(--border);'}">
      ${mine?'':`<div style="font-size:11px;opacity:.75;margin-bottom:3px;font-weight:600">${safe(sender)}</div>`}<div style="font-size:13.5px">${safe(m.message)}</div><div style="font-size:10.5px;opacity:.7;margin-top:4px">${safe(timeAgo(m.created_at))}${m.recipient_id===null?' · Ընդհանուր':''}</div>
    </div></div>`;
  }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:30px">Այս աշխատակցից հաղորդագրություններ դեռ չկան</div>';
  document.getElementById('msg-scroll').scrollTop=999999;
  await renderConvList();
}

async function sendCurrentMessage(){
  const input=document.getElementById('msg-input');
  const text=input.value.trim();
  if(!text) return;
  if(ACTIVE_STAFF){
    const {error}=await supabaseClient.rpc('staff_chat_send',{p_recipient_id:ACTIVE_STAFF,p_message:text});
    if(error) return toast('Չհաջողվեց ուղարկել՝ '+error.message,'error');
    input.value=''; await openStaffConversation(ACTIVE_STAFF); return;
  }
  if(!ACTIVE_CONV) return;
  const {error}=await sendInternalMessage(MY_ID,ACTIVE_CONV,text);
  if(error) return toast('Չհաջողվեց ուղարկել՝ '+error.message,'error');
  input.value=''; await openConversation(ACTIVE_CONV);
}
