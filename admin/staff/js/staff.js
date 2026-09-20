let STAFF_AUTH=null, STAFF_TASKS=[], STAFF_ORDER_CONTEXTS=new Map();
const ROLE_HELP={
 designer:"Դիզայն / Prepress → հաճախորդի ֆայլերի ստուգում → preview → ուղղումներ → print-ready ֆայլ → հաջորդ փուլ",
 digital_print:"Տպագրության հերթ → նյութ / քանակ / ֆայլի ստուգում → տպագրություն → խոտանի նշում → finishing / packing",
 large_format:"Wide-format / Plotter հերթ → չափս / նյութ / contour → տպագրություն կամ կտրում → լամինացիա → finishing",
 finishing:"Կտրում → լամինացիա → ծալում / բիգովկա / կարում / սոսնձում → ուղարկել QC",
 quality_control:"Պատրաստի արտադրանքի ստուգում → քանակ / չափս / գույն / finishing → ընդունել կամ վերադարձնել վերամշակման → packing",
 packing:"Քանակի ստուգում → որակի ստուգում → փաթեթավորում → Order ID/label → delivery / pickup",
 courier:"Առաքման սպասող → զանգ / հասցե → առաքումը սկսել → հանձնել կամ վերադարձի պատճառ → ավարտ",
 warehouse:"Նյութերի մնացորդ → մուտք / ելք → ցածր մնացորդ → պատվերի նյութերի ապահովում → գույքագրում",
 finance:"Վճարումներ → չվճարված պատվերներ → ծախսեր / աշխատավարձ / commission → հաշվետվություններ",
 it_admin:"Server / Database / Backup / SSL / DNS / Firewall / Logs → incident → recovery",
 manager:"Նոր պատվեր → հաճախորդի ստուգում → Admin price approval → արտադրական փուլ → հաճախորդի կապ → ավարտ",
 admin:"Ամբողջ համակարգի վերահսկում"
};
const STATUS_LABEL={assigned:"Նշանակված",in_progress:"Ընթացքի մեջ",waiting:"Սպասում",completed:"Ավարտված",cancelled:"Չեղարկված"};
const PRIORITY_LABEL={low:"Ցածր",normal:"Սովորական",high:"Բարձր",urgent:"ՇՏԱՊ"};
function h(v){return String(v??"").replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function roleLabel(r){return GD_ROLE_LABELS?.[r]||r||"—"}
function fmtDate(v){return v?gdFormatDateTime(v):"—"}


function injectRoleNav(){
  const bars=document.querySelectorAll('.staff-toolbar');
  let href='',label=''; const r=STAFF_AUTH.profile.role;
  if(['designer','digital_print','large_format','finishing','quality_control','packing'].includes(r)){href='production.html';label='Աշխատանքային կենտրոն';}
  if(r==='warehouse'){href='warehouse.html';label='Պահեստ';}
  if(r==='courier'){href='delivery.html';label='Առաքումներ';}
  if(r==='finance'){href='finance.html';label='Ֆինանսներ';}
  if(r==='it_admin'){href='it-admin.html';label='System';}
  if(!href)return;
  bars.forEach(bar=>{if(!bar.querySelector(`a[href="${href}"]`)){const a=document.createElement('a');a.href=href;a.className='btn btn-ghost';a.textContent=label;bar.insertBefore(a,bar.lastElementChild);}});
}

async function boot(){
  STAFF_AUTH=await requireStaff(); if(!STAFF_AUTH)return;
  if(STAFF_AUTH.profile.role==='admin'){window.location.href='../admin/dashboard.html';return;}
  if(STAFF_AUTH.profile.role==='manager'){window.location.href='../manager/dashboard.html';return;}
  document.querySelectorAll('#role-line').forEach(x=>x.textContent=`${STAFF_AUTH.profile.employee_id||'—'} · ${roleLabel(STAFF_AUTH.profile.role)} · ${STAFF_AUTH.profile.full_name||STAFF_AUTH.session.user.email}`);
  injectRoleNav();
  const p=location.pathname;
  if(p.endsWith('/dashboard.html')) await loadDashboard();
  if(p.endsWith('/tasks.html')) await loadTasksPage();
  if(p.endsWith('/messages.html')) await loadMessages();
  if(p.endsWith('/profile.html')) await loadProfile();
  if(p.endsWith('/files.html')) await loadFiles();
  if(p.endsWith('/warehouse.html')) await loadWarehouse();
  if(p.endsWith('/delivery.html')) await loadDelivery();
  if(p.endsWith('/finance.html')) await loadFinance();
  if(p.endsWith('/it-admin.html')) await loadITAdmin();
}

async function getTasks(){
  const {data,error}=await supabaseClient.rpc('staff_my_assignments');
  if(error){console.error(error);return [];}return data||[];
}
async function getOrderContexts(){
  const {data,error}=await supabaseClient.rpc('staff_my_order_contexts');
  if(error){
    console.error('staff_my_order_contexts',error);
    if(error.code==='PGRST202' && typeof toast==='function') toast('Staff ERP backend-ը թերի է․ գործարկեք 037_staff_admin_bridge_repair.sql','error');
    return new Map();
  }
  return new Map((data||[]).map(x=>[x.order_id,x]));
}
function detailLabel(k){
  const row=window.GDOrderDetails?.entries?.({[k]:k},{lang:'hy'})?.[0];
  return row?.label||String(k||'').replaceAll('_',' ');
}
function detailValue(v){return window.GDOrderDetails?.formatValue?.(v)??String(v??'');}
function visibleDetails(ctx){
  if(window.GDOrderDetails){
    return GDOrderDetails.entries(ctx?.details||{},{lang:'hy'}).map(row=>[row.label,row.value]);
  }
  return Object.entries(ctx?.details||{}).filter(([k,v])=>!String(k).startsWith('_')&&v!==''&&v!==null&&v!==undefined);
}
function orderContextHtml(t){
  if(!t.order_id)return '';
  const c=STAFF_ORDER_CONTEXTS.get(t.order_id); if(!c)return '<div class="order-context staff-muted">Պատվերի լրացուցիչ տվյալները չեն բեռնվել։</div>';
  const details=visibleDetails(c);
  const first=details.slice(0,4);
  const summary=first.length?`<div class="order-quick">${first.map(([k,v])=>`<span><b>${h(k)}:</b> ${h(v)}</span>`).join('')}</div>`:'';
  const all=details.length?details.map(([k,v])=>`<div class="order-detail-row"><span>${h(k)}</span><strong>${h(v)}</strong></div>`).join(''):'<div class="staff-muted">Լրացուցիչ տեխնիկական տվյալներ չկան։</div>';
  return `${summary}<details class="order-context"><summary>Պատվերի ամբողջ տվյալները</summary><div class="order-context-grid"><div><span>Պատվերի համար</span><strong>${h(c.order_number||'—')}</strong></div><div><span>Ծառայություն</span><strong>${h(c.service_name||c.service_key||'—')}</strong></div><div><span>Հաճախորդ</span><strong>${h(c.customer_name||'—')}</strong></div><div><span>Պատվերի վիճակ</span><strong>${h(c.order_status||'—')}</strong></div><div><span>Պատվերի ամսաթիվ</span><strong>${h(fmtDate(c.order_created_at))}</strong></div><div><span>Լեզու</span><strong>${h((c.language||'hy').toUpperCase())}</strong></div><div><span>Կցված ֆայլեր</span><strong>${Number(c.file_count||0)}</strong></div><div><span>Դիզայնի տարբերակներ</span><strong>${Number(c.proof_count||0)}</strong></div></div>${c.description?`<div class="order-description"><span>Պատվերի նկարագրություն</span><p>${h(c.description)}</p></div>`:''}<div class="order-details-list">${all}</div><div class="task-actions"><a class="btn btn-ghost btn-sm" href="files.html">Բացել արտադրական ֆայլերը</a></div></details>`;
}
function taskHtml(t){
  const overdue=t.deadline&&new Date(t.deadline)<new Date()&&!['completed','cancelled'].includes(t.status);
  const c=t.order_id?STAFF_ORDER_CONTEXTS.get(t.order_id):null;
  const service=c?.service_name||c?.service_key||t.service_key||'';
  return `<div class="task"><div class="task-top"><div><div class="task-title">${h(t.title)}</div><div class="staff-muted">${h(t.order_number||'Առանց պատվերի')}${service?' · '+h(service):''} · ${h(t.stage)}</div></div><span class="badge">${overdue?'ՈՒՇԱՑԱԾ':PRIORITY_LABEL[t.priority]||t.priority}</span></div><div class="task-meta"><span class="badge">${STATUS_LABEL[t.status]||t.status}</span>${t.deadline?`<span class="badge">Deadline: ${h(fmtDate(t.deadline))}</span>`:''}</div>${t.notes?`<div class="assignment-note"><b>Աշխատանքի նշում</b><p>${h(t.notes)}</p></div>`:''}${orderContextHtml(t)}<div class="task-actions">${t.status==='assigned'?`<button class="btn btn-primary btn-sm" onclick="changeTask('${t.id}','in_progress')">Սկսել</button>`:''}${t.status==='in_progress'?`<button class="btn btn-ghost btn-sm" onclick="changeTask('${t.id}','waiting')">Սպասում</button><button class="btn btn-primary btn-sm" onclick="changeTask('${t.id}','completed')">Ավարտել</button>`:''}${t.status==='waiting'?`<button class="btn btn-primary btn-sm" onclick="changeTask('${t.id}','in_progress')">Շարունակել</button>`:''}</div></div>`;
}
async function changeTask(id,status){
  const task=STAFF_TASKS.find(x=>x.id===id);
  if(status==='completed'&&task&&['digital_print','large_format','finishing','quality_control','packing','delivery'].includes(task.stage)){
    if(task.stage==='delivery'){location.href='delivery.html';return;}
    location.href='production.html';return;
  }
  const note=status==='completed'?prompt('Կատարված աշխատանքի կարճ նշում (ըստ ցանկության)')||'':status==='waiting'?prompt('Ինչի՞ն է սպասում աշխատանքը')||'':'';
  const {error}=await supabaseClient.rpc('staff_update_assignment',{p_assignment_id:id,p_status:status,p_note:note});
  if(error){alert(error.message);return;} if(typeof toast==='function')toast('Կարգավիճակը թարմացվեց','success'); await refreshTasks();
}
async function refreshTasks(){if(location.pathname.endsWith('/dashboard.html'))return loadDashboard();if(location.pathname.endsWith('/tasks.html'))return loadTasksPage();}
async function loadDashboard(){
  const n=document.getElementById('hello'); if(n)n.textContent=`Բարի աշխատանք, ${STAFF_AUTH.profile.full_name||'աշխատակից'}`;
  const rh=document.getElementById('role-help'); if(rh)rh.textContent=ROLE_HELP[STAFF_AUTH.profile.role]||'Ձեր անձնական աշխատանքային էջը։';
  [STAFF_TASKS,STAFF_ORDER_CONTEXTS]=await Promise.all([getTasks(),getOrderContexts()]); const today=gdYerevanDateKey();
  const assigned=STAFF_TASKS.filter(x=>x.status==='assigned').length, prog=STAFF_TASKS.filter(x=>x.status==='in_progress').length, done=STAFF_TASKS.filter(x=>x.status==='completed'&&gdYerevanDateKey(x.completed_at||x.updated_at)===today).length, late=STAFF_TASKS.filter(x=>x.deadline&&new Date(x.deadline)<new Date()&&!['completed','cancelled'].includes(x.status)).length;
  for(const [id,val] of [['kpi-assigned',assigned],['kpi-progress',prog],['kpi-done',done],['kpi-late',late]]){const e=document.getElementById(id);if(e)e.textContent=val;}
  const list=document.getElementById('priority-list'); const rows=STAFF_TASKS.filter(x=>!['completed','cancelled'].includes(x.status)).sort((a,b)=>(a.priority==='urgent'?-2:0)-(b.priority==='urgent'?-2:0)||(new Date(a.deadline||'2999')-new Date(b.deadline||'2999'))).slice(0,6); if(list)list.innerHTML=rows.length?rows.map(taskHtml).join(''):'<div class="staff-card">Բաց աշխատանք չկա։</div>';
}
async function loadTasksPage(){
  [STAFF_TASKS,STAFF_ORDER_CONTEXTS]=await Promise.all([getTasks(),getOrderContexts()]); const f=document.getElementById('task-filter'); f?.addEventListener('change',renderTasks); renderTasks();
}
function renderTasks(){const f=document.getElementById('task-filter')?.value||'open';let rows=STAFF_TASKS;if(f==='open')rows=rows.filter(x=>!['completed','cancelled'].includes(x.status));if(f==='completed')rows=rows.filter(x=>x.status==='completed');const el=document.getElementById('tasks-list');el.innerHTML=rows.length?rows.map(taskHtml).join(''):'<div class="staff-card">Աշխատանք չի գտնվել։</div>';}

async function loadMessages(){
  const sel=document.getElementById('chat-recipient');
  const box=document.getElementById('chat-messages');
  let PEOPLE=[];

  async function fetchBundle(){
    const {data,error}=await supabaseClient.rpc('staff_chat_bundle');
    if(error){
      console.error('staff_chat_bundle',error);
      box.textContent=error.code==='PGRST202'?'Հաղորդագրությունների backend-ը բացակայում է։ Գործարկեք 037_staff_admin_bridge_repair.sql':error.message;
      return null;
    }
    return data||{people:[],messages:[]};
  }

  async function refresh(keepRecipient=true){
    const selected=keepRecipient?sel.value:'';
    const bundle=await fetchBundle(); if(!bundle)return;
    PEOPLE=Array.isArray(bundle.people)?bundle.people:[];
    const others=PEOPLE.filter(x=>x.id!==STAFF_AUTH.profile.id).sort((a,b)=>(a.role==='admin'?-1:0)-(b.role==='admin'?-1:0));
    sel.innerHTML='<option value="">Բոլոր աշխատակիցներին / ընդհանուր</option>';
    others.forEach(x=>sel.insertAdjacentHTML('beforeend',`<option value="${x.id}">${x.role==='admin'?'★ ':''}${h(x.full_name||x.employee_id)} — ${h(roleLabel(x.role))}</option>`));
    const admin=others.find(x=>x.role==='admin');
    if(selected && others.some(x=>x.id===selected)) sel.value=selected;
    else if(admin) sel.value=admin.id;

    const map=new Map(PEOPLE.map(p=>[p.id,p]));
    const visible=Array.isArray(bundle.messages)?bundle.messages:[];
    box.innerHTML=visible.map(m=>{const who=map.get(m.sender_id);return `<div class="chat-msg ${m.sender_id===STAFF_AUTH.profile.id?'me':''}"><strong>${h(who?.full_name||who?.employee_id||'GDprint')}</strong> <span class="staff-muted">${h(fmtDate(m.created_at))}</span>${m.recipient_id===null?'<span class="staff-muted"> · Ընդհանուր</span>':''}<div>${h(m.message)}</div></div>`}).join('')||'Հաղորդագրություն չկա։';
    box.scrollTop=box.scrollHeight;
  }

  document.getElementById('chat-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const inp=document.getElementById('chat-input'); const msg=inp.value.trim(); if(!msg)return;
    const recipient=sel.value||null;
    const {error}=await supabaseClient.rpc('staff_chat_send',{p_recipient_id:recipient,p_message:msg});
    if(error){alert(error.message);return;}
    inp.value=''; if(typeof toast==='function')toast(recipient?'Հաղորդագրությունն ուղարկվեց':'Ընդհանուր հաղորդագրությունն ուղարկվեց','success');
    await refresh(true);
  });
  await refresh(false);
}
async function loadProfile(){
  document.getElementById('pf-employee').value=STAFF_AUTH.profile.employee_id||'';document.getElementById('pf-role').value=roleLabel(STAFF_AUTH.profile.role);document.getElementById('pf-name').value=STAFF_AUTH.profile.full_name||'';document.getElementById('pf-email').value=STAFF_AUTH.session.user.email||'';document.getElementById('pf-phone').value=STAFF_AUTH.profile.phone||'';
  document.getElementById('profile-form').addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabaseClient.rpc('staff_update_profile',{p_full_name:document.getElementById('pf-name').value,p_phone:document.getElementById('pf-phone').value});if(error){alert(error.message);return;}if(typeof toast==='function')toast('Պահպանված է','success');});
  document.getElementById('send-reset').addEventListener('click',async()=>{const redirectTo=new URL('../reset-password.html',location.href).href;const {error}=await supabaseClient.auth.resetPasswordForEmail(STAFF_AUTH.session.user.email,{redirectTo});if(error){alert(error.message);return;}alert('Վերականգնման հղումն ուղարկված է email-ին։');});
  const [{data},{data:bundle,error:bundleError}]=await Promise.all([supabaseClient.from('staff_login_history').select('*').eq('user_id',STAFF_AUTH.profile.id).order('created_at',{ascending:false}).limit(20),supabaseClient.rpc('staff_my_profile_bundle')]);const el=document.getElementById('login-history');el.innerHTML=(data||[]).map(x=>`<div class="task"><strong>${h(x.event_type)}</strong><div class="staff-muted">${h(fmtDate(x.created_at))}</div></div>`).join('')||'<div class="staff-muted">Պատմություն դեռ չկա։</div>';
  if(bundleError){console.error(bundleError);return;}
  const a=bundle?.assignments||{}, c=bundle?.compensation||{}; document.getElementById('pf-hire').textContent=bundle?.profile?.hire_date||'—';document.getElementById('pf-total').textContent=a.total??0;document.getElementById('pf-done').textContent=a.completed??0;document.getElementById('pf-open').textContent=`${a.open??0} / ${a.late??0}`;
  const sch=document.getElementById('pf-schedule');sch.innerHTML=(bundle?.schedules||[]).map(x=>`<div class="task"><strong>${h(x.work_date)}</strong><div>${h(x.start_time||'—')} – ${h(x.end_time||'—')}</div>${x.note?`<div class="staff-muted">${h(x.note)}</div>`:''}</div>`).join('')||'<div class="staff-card">Գրաֆիկ դեռ չի սահմանվել։</div>';
  const comp=document.getElementById('pf-comp');let parts=[];if(c.show_salary)parts.push(`<div><span class="staff-muted">Աշխատավարձ</span><div class="money-strong">${amd(c.salary)}</div></div>`);if(c.show_bonus)parts.push(`<div><span class="staff-muted">Բոնուս</span><div class="money-strong">${amd(c.bonus)}</div></div>`);comp.innerHTML=parts.length?`<div class="phase5-row">${parts.join('')}</div>`:'Տվյալները հասանելի են միայն տնօրենի թույլտվությամբ։';
  const nn=document.getElementById('pf-notifications');nn.innerHTML=(bundle?.notifications||[]).map(x=>`<div class="task ${x.is_read?'':'notice-unread'}"><div class="task-top"><div><div class="task-title">${h(x.title)}</div><div class="staff-muted">${h(fmtDate(x.created_at))}</div></div>${x.is_read?'':`<button class="btn btn-ghost btn-sm" onclick="markNotice('${x.id}')">Կարդացված</button>`}</div>${x.message?`<p>${h(x.message)}</p>`:''}</div>`).join('')||'<div class="staff-card">Ծանուցում չկա։</div>';
}


async function loadFiles(){
  const allowed=['designer','digital_print','large_format','finishing','quality_control','packing'];
  if(!allowed.includes(STAFF_AUTH.profile.role)){window.location.href='dashboard.html';return;}
  const [{data,error},{data:tasks,error:taskError}]=await Promise.all([supabaseClient.rpc('staff_assigned_files'),supabaseClient.rpc('staff_my_assignments')]);
  const el=document.getElementById('files-list'); if(error){el.textContent=error.message;return;}
  const orderSel=document.getElementById('file-order');
  const unique=new Map();(tasks||[]).filter(t=>t.order_id).forEach(t=>unique.set(t.order_id,{id:t.order_id,no:t.order_number||t.order_id.slice(0,8),service:t.service_key||''}));
  orderSel.innerHTML=[...unique.values()].map(o=>`<option value="${o.id}">${h(o.no)} · ${h(o.service)}</option>`).join('')||'<option value="">Նշանակված պատվեր չկա</option>';
  const proofBtn=document.getElementById('staff-proof-upload');if(proofBtn&&STAFF_AUTH.profile.role==='designer')proofBtn.style.display='inline-flex';
  document.getElementById('staff-file-upload')?.addEventListener('click',()=>uploadAssignedFile(false));
  proofBtn?.addEventListener('click',()=>uploadAssignedFile(true));
  const rows=data||[]; el.innerHTML=rows.length?rows.map(f=>`<div class="task"><div class="task-top"><div><div class="task-title">${h(f.file_name||'Ֆայլ')}</div><div class="staff-muted">${h(f.order_number||'—')} · ${h(f.service_key||'')} · ${h(f.file_kind)}</div></div><span class="badge">${h(fmtDate(f.created_at))}</span></div><div class="task-actions"><button class="btn btn-primary btn-sm" data-path="${h(f.storage_path||'')}" data-url="${h(f.file_url||'')}" onclick="downloadStaffFile(this)">Բացել / ներբեռնել</button></div></div>`).join(''):'<div class="staff-card">Ձեզ նշանակված պատվերների համար ֆայլ չկա։</div>';
}
async function uploadAssignedFile(asProof){
  const orderId=document.getElementById('file-order')?.value,file=document.getElementById('staff-file-input')?.files?.[0];
  if(!orderId)return alert('Ընտրեք նշանակված պատվերը');if(!file)return alert('Ընտրեք ֆայլը');
  const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');const path=`${STAFF_AUTH.profile.id}/staff/${orderId}/${Date.now()}_${safe}`;
  const {error:up}=await supabaseClient.storage.from('customer-order-files').upload(path,file,{contentType:file.type||'application/octet-stream'});if(up){alert(up.message);return;}
  if(asProof){const {error}=await supabaseClient.rpc('staff_publish_design_proof',{p_order_id:orderId,p_file_name:file.name,p_storage_path:path});if(error){alert(error.message);return;}}
  else {const {error}=await supabaseClient.from('order_files').insert({order_id:orderId,file_name:file.name,storage_path:path});if(error){alert(error.message);return;}}
  document.getElementById('staff-file-input').value='';if(typeof toast==='function')toast(asProof?'Դիզայնն ուղարկվեց հաճախորդի հաստատման':'Ֆայլը վերբեռնվեց','success');await loadFiles();
}
async function downloadStaffFile(btn){
  const path=btn.dataset.path,url=btn.dataset.url;btn.disabled=true;
  try{
    if(path){const {data,error}=await supabaseClient.storage.from('customer-order-files').createSignedUrl(path,120);if(error)throw error;window.open(data.signedUrl,'_blank','noopener');}
    else if(url){window.open(url,'_blank','noopener');}
    else throw new Error('Ֆայլի հասցեն բացակայում է');
  }catch(err){alert(err.message||'Ֆայլը չբացվեց');}finally{btn.disabled=false;}
}

let WH_ITEMS=[];
async function loadWarehouse(){
  if(STAFF_AUTH.profile.role!=='warehouse'){window.location.href='dashboard.html';return;}
  const {data,error}=await supabaseClient.from('inventory_items').select('*').order('name');
  const el=document.getElementById('warehouse-list');if(error){el.innerHTML=`<div class="staff-card">${h(error.message)}</div>`;return;}WH_ITEMS=data||[];document.getElementById('wh-search')?.addEventListener('input',renderWarehouse);renderWarehouse();
}
function renderWarehouse(){
 const q=(document.getElementById('wh-search')?.value||'').toLowerCase();const rows=WH_ITEMS.filter(x=>[x.name,x.category,x.material_type,x.size,x.color,x.supplier].join(' ').toLowerCase().includes(q));const el=document.getElementById('warehouse-list');el.innerHTML=rows.length?rows.map(x=>`<div class="task"><div class="task-top"><div><div class="task-title">${h(x.name)}</div><div class="staff-muted">${h(x.material_type)} · ${h(x.size)}${x.color?' · '+h(x.color):''}</div></div><span class="badge">Մնացորդ՝ ${Number(x.quantity||0).toLocaleString('hy-AM')} ${h(x.unit)}</span></div><div class="task-meta"><span class="badge">Նվազագույն՝ ${Number(x.min_stock||0).toLocaleString('hy-AM')}</span>${Number(x.quantity||0)<=Number(x.min_stock||0)?'<span class="badge">ՔԻՉ ՄՆԱՑՈՐԴ</span>':''}</div><div class="task-actions"><button class="btn btn-ghost btn-sm" onclick="moveStock('${x.id}','in')">+ Մուտք</button><button class="btn btn-ghost btn-sm" onclick="moveStock('${x.id}','out')">− Ելք</button></div></div>`).join(''):'<div class="staff-card">Նյութ չի գտնվել։</div>';
}
async function moveStock(id,dir){const qty=Number(prompt(dir==='in'?'Մուտքագրվող քանակը':'Դուրս գրվող քանակը')||0);if(!(qty>0))return;const note=prompt('Նշում / պատվերի համար (ըստ ցանկության)')||null;const {error}=await supabaseClient.rpc('inventory_move_stock',{p_item_id:id,p_direction:dir,p_quantity:qty,p_note:note});if(error){alert(error.message);return;}if(typeof toast==='function')toast('Պահեստի շարժը գրանցվեց','success');await loadWarehouse();}

async function loadDelivery(){
  if(STAFF_AUTH.profile.role!=='courier'){window.location.href='dashboard.html';return;}
  const {data,error}=await supabaseClient.rpc('courier_my_deliveries');const el=document.getElementById('delivery-list');if(error){el.textContent=error.message;return;}const rows=data||[];el.innerHTML=rows.length?rows.map(d=>{const addr=[d.city,d.address_line].filter(Boolean).join(', '),map='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(addr);return `<div class="task"><div class="task-top"><div><div class="task-title">${h(d.order_number||'Պատվեր')}</div><div class="staff-muted">${h(d.recipient_name||'—')} · ${h(d.phone||'—')}</div></div><span class="badge">${STATUS_LABEL[d.task_status]||h(d.task_status)}</span></div><p>${h(addr||'Pickup / հասցե չկա')}</p><div class="task-actions">${d.phone?`<a class="btn btn-ghost btn-sm" href="tel:${h(d.phone)}">Զանգել</a>`:''}${addr?`<a class="btn btn-ghost btn-sm" href="${map}" target="_blank">Քարտեզ</a>`:''}<button class="btn btn-ghost btn-sm" onclick="deliveryEvent('${d.assignment_id}','arrived')">Հասել եմ հասցե</button>${d.task_status==='assigned'?`<button class="btn btn-primary btn-sm" onclick="deliveryEvent('${d.assignment_id}','started')">Սկսել</button>`:''}<button class="btn btn-primary btn-sm" onclick="deliveryEvent('${d.assignment_id}','delivered')">Հանձնված</button><button class="btn btn-ghost btn-sm" onclick="deliveryEvent('${d.assignment_id}','customer_absent')">Հաճախորդը բացակայում է</button><button class="btn btn-ghost btn-sm" onclick="deliveryEvent('${d.assignment_id}','wrong_address')">Սխալ հասցե</button><button class="btn btn-ghost btn-sm" onclick="deliveryEvent('${d.assignment_id}','returned')">Վերադարձ տպարան</button><button class="btn btn-ghost btn-sm" onclick="deliveryEvent('${d.assignment_id}','payment')">Վճարում</button></div></div>`}).join(''):'<div class="staff-card">Առաքում չկա։</div>';
}
async function deliveryEvent(id,event){let note='',payment=0;if(['customer_absent','wrong_address','returned'].includes(event))note=prompt('Նշում / պատճառ')||'';if(event==='payment')payment=Number(prompt('Ստացված գումարը (AMD)')||0);const {error}=await supabaseClient.rpc('courier_record_event',{p_assignment_id:id,p_event:event,p_note:note||null,p_payment:payment});if(error)return alert(error.message);toast?.('Գործողությունը գրանցվեց','success');await loadDelivery();}
function amd(v){return `${Math.round(Number(v||0)).toLocaleString('hy-AM')} AMD`}
async function loadFinance(){
  if(STAFF_AUTH.profile.role!=='finance'){window.location.href='dashboard.html';return;}
  const {data,error}=await supabaseClient.rpc('finance_order_summary');const el=document.getElementById('finance-list');if(error){el.textContent=error.message;return;}const rows=data||[];const active=rows.filter(x=>x.status!=='cancelled');const rev=active.reduce((s,x)=>s+Number(x.total_amount||0)+Number(x.delivery_fee||0),0),cost=active.reduce((s,x)=>s+Number(x.cost_amount||0),0);document.getElementById('fin-revenue').textContent=amd(rev);document.getElementById('fin-cost').textContent=amd(cost);document.getElementById('fin-unpaid').textContent=rows.filter(x=>x.payment_status!=='paid'&&x.status!=='cancelled').length;document.getElementById('fin-paid').textContent=rows.filter(x=>x.payment_status==='paid').length;el.innerHTML=rows.slice(0,150).map(x=>`<div class="task"><div class="task-top"><div><div class="task-title">${h(x.order_number||'—')} · ${h(x.customer_name||'—')}</div><div class="staff-muted">${h(x.service_name||'—')} · ${h(fmtDate(x.created_at))}</div></div><span class="badge">${h(x.payment_status||'—')}</span></div><div class="task-meta"><span class="badge">Գին՝ ${amd(x.total_amount)}</span><span class="badge">Առաքում՝ ${amd(x.delivery_fee)}</span><span class="badge">Ծախս՝ ${amd(x.cost_amount)}</span></div></div>`).join('')||'<div class="staff-card">Պատվեր չկա։</div>';
  const tx=await supabaseClient.from('finance_transactions').select('*').order('created_at',{ascending:false}).limit(150);const txel=document.getElementById('fin-transactions');if(txel)txel.innerHTML=tx.error?h(tx.error.message):(tx.data||[]).map(t=>`<div class="task"><div class="task-top"><div><div class="task-title">${h(t.kind)} · ${amd(t.amount)}</div><div class="staff-muted">${h(t.method)} · ${h(fmtDate(t.created_at))}</div></div></div>${t.note?`<p>${h(t.note)}</p>`:''}</div>`).join('')||'<div class="staff-card">Գործարք չկա։</div>';
  const form=document.getElementById('fin-tx-form');if(form&&!form.dataset.bound){form.dataset.bound='1';form.addEventListener('submit',async ev=>{ev.preventDefault();const {error}=await supabaseClient.rpc('finance_add_transaction',{p_order_id:document.getElementById('fin-order-id').value.trim()||null,p_kind:document.getElementById('fin-kind').value,p_method:document.getElementById('fin-method').value,p_amount:Number(document.getElementById('fin-amount').value),p_note:document.getElementById('fin-note').value.trim()||null});if(error)return alert(error.message);form.reset();toast?.('Գործարքը գրանցվեց','success');await loadFinance();});}
}
window.downloadStaffFile=downloadStaffFile;window.moveStock=moveStock;window.uploadAssignedFile=uploadAssignedFile;

document.addEventListener('DOMContentLoaded',boot);
window.changeTask=changeTask;

async function loadITAdmin(){if(STAFF_AUTH.profile.role!=='it_admin'){location.href='dashboard.html';return;}const form=document.getElementById('incident-form');async function refresh(){const {data,error}=await supabaseClient.from('system_incidents').select('*').order('created_at',{ascending:false}).limit(100);document.getElementById('incident-list').innerHTML=error?h(error.message):(data||[]).map(x=>`<div class="task"><div class="task-title">${h(x.title)}</div><div class="staff-muted">${h(x.category)} · ${h(x.status)} · ${h(fmtDate(x.created_at))}</div><p>${h(x.details||'')}</p></div>`).join('')||'<div class="staff-card">Միջադեպ չկա։</div>';}form.addEventListener('submit',async e=>{e.preventDefault();const {error}=await supabaseClient.from('system_incidents').insert({category:document.getElementById('inc-category').value,title:document.getElementById('inc-title').value,details:document.getElementById('inc-details').value,created_by:STAFF_AUTH.profile.id});if(error)return alert(error.message);form.reset();await refresh();});await refresh();}
window.deliveryEvent=deliveryEvent;

async function markNotice(id){const {error}=await supabaseClient.rpc('staff_mark_notification_read',{p_id:id});if(error)return alert(error.message);await loadProfile();} window.markNotice=markNotice;
