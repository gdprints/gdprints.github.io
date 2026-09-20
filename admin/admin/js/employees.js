let EMP=[],TASKS=[],ORDERS=[],AUTH=null,DAYCLOSE=new Map();
const ROLES=['admin','manager','designer','digital_print','large_format','finishing','quality_control','packing','courier','warehouse','finance','it_admin'];
const RL={admin:'Super Admin',manager:'Մենեջեր',designer:'Designer / Prepress',digital_print:'Digital Print Operator',large_format:'Large Format / Plotter',finishing:'Finishing',quality_control:'Quality Control',packing:'Packing',courier:'Courier',warehouse:'Warehouse',finance:'Finance',it_admin:'IT Admin'};
const STAGES={manager:'intake',designer:'prepress',digital_print:'digital_print',large_format:'large_format',finishing:'finishing',quality_control:'quality_control',packing:'packing',courier:'delivery',warehouse:'warehouse',finance:'finance',it_admin:'it_support',admin:'quality_control'};
function e(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function initials(v){return String(v||'GD').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
function countOpen(id){return TASKS.filter(x=>x.assignee_id===id&&!['completed','cancelled'].includes(x.status)).length}
function countDone(id){return TASKS.filter(x=>x.assignee_id===id&&x.status==='completed').length}
function roleOptions(sel){return ROLES.map(r=>`<option value="${r}" ${r===sel?'selected':''}>${RL[r]}</option>`).join('')}
async function boot(){
  AUTH=await requireRole(['admin']);if(!AUTH)return;
  document.getElementById('user-name').textContent=AUTH.profile.full_name||'Ադմին';
  document.getElementById('user-avatar').textContent=initials(AUTH.profile.full_name);
  document.getElementById('emp-role-filter').insertAdjacentHTML('beforeend',ROLES.map(r=>`<option value="${r}">${RL[r]}</option>`).join(''));
  document.getElementById('emp-search').addEventListener('input',render);
  document.getElementById('emp-role-filter').addEventListener('change',render);
  document.getElementById('emp-status-filter').addEventListener('change',render);
  document.getElementById('refresh-employees').addEventListener('click',load);

  const taskModal=document.getElementById('task-modal');
  const moreModal=document.getElementById('staff-more-modal');
  document.getElementById('task-close').addEventListener('click',()=>closeModal(taskModal));
  document.getElementById('staff-more-close').addEventListener('click',closeMore);
  taskModal.addEventListener('click',ev=>{if(ev.target===taskModal)closeModal(taskModal)});
  moreModal.addEventListener('click',ev=>{if(ev.target===moreModal)closeMore()});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if(moreModal.classList.contains('open'))closeMore();else if(taskModal.classList.contains('open'))closeModal(taskModal)}});
  document.getElementById('save-comp-btn').addEventListener('click',saveComp);
  document.getElementById('save-schedule-btn').addEventListener('click',saveSchedule);
  document.getElementById('send-notice-btn').addEventListener('click',sendNotice);
  document.getElementById('task-form').addEventListener('submit',createTask);
  await load();
}
function openModal(el){el.classList.add('open');el.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function closeModal(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');if(!document.querySelector('.modalx.open'))document.body.style.overflow=''}
async function load(){
 const [p,t,o,c]=await Promise.all([supabaseClient.from('profiles').select('*').order('created_at',{ascending:false}),supabaseClient.from('staff_assignments').select('*').order('created_at',{ascending:false}),supabaseClient.from('orders').select('id,order_number,service_key,status,created_at').order('created_at',{ascending:false}).limit(200),supabaseClient.rpc('admin_staff_day_closures',{p_work_date:null})]);
 if(p.error){document.getElementById('employees').innerHTML=`<div class="emp-card">${e(p.error.message)}<br><small>Supabase-ում աշխատեցրեք 024_staff_erp.sql migration-ը։</small></div>`;return;} EMP=(p.data||[]).filter(x=>ROLES.includes(x.role));TASKS=t.data||[];ORDERS=o.data||[];DAYCLOSE=new Map((c.data||[]).map(x=>[x.user_id,x]));document.getElementById('stat-all').textContent=EMP.length;document.getElementById('stat-pending').textContent=EMP.filter(x=>x.approval_status==='pending').length;document.getElementById('stat-active').textContent=EMP.filter(x=>x.approval_status==='approved'&&x.account_status==='active').length;document.getElementById('stat-tasks').textContent=TASKS.filter(x=>!['completed','cancelled'].includes(x.status)).length;document.getElementById('task-order').innerHTML='<option value="">Առանց պատվերի</option>'+ORDERS.map(x=>`<option value="${x.id}">${e(x.order_number||x.id.slice(0,8))} · ${e(x.service_key||'')}</option>`).join('');render();
}
function render(){const q=document.getElementById('emp-search').value.trim().toLowerCase(),rf=document.getElementById('emp-role-filter').value,sf=document.getElementById('emp-status-filter').value;let rows=EMP.filter(x=>{const hay=[x.full_name,x.email,x.phone,x.employee_id,RL[x.role]].join(' ').toLowerCase();if(q&&!hay.includes(q))return false;if(rf&&x.role!==rf)return false;if(sf==='pending'&&x.approval_status!=='pending')return false;if(sf==='approved'&&x.approval_status!=='approved')return false;if(['blocked','suspended','disabled','terminated'].includes(sf)&&x.account_status!==sf)return false;return true;});const box=document.getElementById('employees');if(!rows.length){box.innerHTML='<div class="emp-card">Աշխատակից չի գտնվել։</div>';return;}box.innerHTML=rows.map(x=>`<div class="emp-card" data-id="${x.id}"><div class="emp-top"><div class="emp-avatar">${e(initials(x.full_name))}</div><div style="min-width:0;flex:1"><div style="font-weight:800">${e(x.full_name||'Առանց անվան')}</div><div class="emp-meta">${e(x.employee_id||'ID չի տրված')} · ${e(x.email||'—')} · ${e(x.phone||'—')}</div><div class="emp-meta">Approval: <b>${e(x.approval_status||'—')}</b> · Account: <b>${e(x.account_status||'—')}</b> · Last login: ${x.last_login_at?gdFormatDateTime(x.last_login_at):'—'}</div><div class="emp-meta">Այսօրվա փակում՝ ${DAYCLOSE.has(x.id)?`<b style="color:var(--success)">Փակված ${e(DAYCLOSE.get(x.id).closed_time_yerevan||'')}</b>`:'<span>Չի փակվել</span>'}</div></div></div><div class="emp-stats"><div class="emp-stat"><span class="emp-meta">Բաց</span><b>${countOpen(x.id)}</b></div><div class="emp-stat"><span class="emp-meta">Ավարտված</span><b>${countDone(x.id)}</b></div><div class="emp-stat"><span class="emp-meta">Դեր</span><b style="font-size:12px">${e(RL[x.role])}</b></div></div><div class="emp-controls"><div class="field"><label>Դեր</label><select class="x-role">${roleOptions(x.role)}</select></div><div class="field"><label>Approval</label><select class="x-approval"><option value="pending" ${x.approval_status==='pending'?'selected':''}>Pending</option><option value="approved" ${x.approval_status==='approved'?'selected':''}>Approved</option><option value="rejected" ${x.approval_status==='rejected'?'selected':''}>Rejected</option></select></div><div class="field"><label>Account status</label><select class="x-account"><option value="active" ${x.account_status==='active'?'selected':''}>Active</option><option value="blocked" ${x.account_status==='blocked'?'selected':''}>Blocked</option><option value="suspended" ${x.account_status==='suspended'?'selected':''}>Suspended</option><option value="disabled" ${x.account_status==='disabled'?'selected':''}>Disabled</option><option value="terminated" ${x.account_status==='terminated'?'selected':''}>Terminated</option></select></div><div class="field"><label>Պաշտոն / Job title</label><input class="x-title" value="${e(x.job_title||'')}"></div><div class="field"><label>Աշխատանքի սկիզբ</label><input class="x-hire" type="date" value="${e(x.hire_date||'')}"></div></div><div class="emp-actions"><button class="btn btn-primary btn-sm" onclick="saveEmp('${x.id}')">Պահպանել / Հաստատել</button>${x.role!=='admin'?`<button class="btn btn-ghost btn-sm" onclick="openTask('${x.id}')">+ Նշանակել աշխատանք</button><button class="btn btn-ghost btn-sm" onclick="openMore('${x.id}')">Գրաֆիկ / վճարում / ծանուցում</button>`:''}${x.id!==AUTH.profile.id?`<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteEmp('${x.id}')">Ջնջել հաշիվը</button>`:''}</div></div>`).join('')}
async function saveEmp(id){const c=document.querySelector(`[data-id="${id}"]`),x=EMP.find(v=>v.id===id);if(!c||!x)return;const args={p_user_id:id,p_role:c.querySelector('.x-role').value,p_approval_status:c.querySelector('.x-approval').value,p_account_status:c.querySelector('.x-account').value,p_job_title:c.querySelector('.x-title').value||null,p_hire_date:c.querySelector('.x-hire').value||null};const {error}=await supabaseClient.rpc('admin_set_staff_account',args);if(error){alert(error.message);return;}if(typeof toast==='function')toast('Աշխատակցի հաշիվը պահպանվեց','success');await load()}
function openTask(id){const x=EMP.find(v=>v.id===id);if(!x)return;document.getElementById('task-assignee').value=id;document.getElementById('task-employee').textContent=`${x.employee_id||''} · ${x.full_name||x.email}`;document.getElementById('task-stage').value=STAGES[x.role]||'quality_control';openModal(document.getElementById('task-modal'))}
async function createTask(ev){ev.preventDefault();const d=document.getElementById('task-deadline').value;const {error}=await supabaseClient.rpc('admin_create_staff_assignment',{p_assignee_id:document.getElementById('task-assignee').value,p_order_id:document.getElementById('task-order').value||null,p_stage:document.getElementById('task-stage').value,p_title:document.getElementById('task-title').value.trim(),p_notes:document.getElementById('task-notes').value.trim()||null,p_priority:document.getElementById('task-priority').value,p_deadline:d?gdYerevanInputToIso(d):null});if(error){alert(error.message);return;}closeModal(document.getElementById('task-modal'));ev.target.reset();if(typeof toast==='function')toast('Աշխատանքը նշանակվեց','success');await load()}
async function deleteEmp(id){const x=EMP.find(v=>v.id===id);if(!x||!confirm(`Վերջնական ջնջե՞լ ${x.full_name||x.email} հաշիվը։`))return;const code=prompt('Հաստատելու համար գրեք DELETE');if(code!=='DELETE')return;const {error}=await supabaseClient.rpc('admin_delete_staff_account',{p_user_id:id});if(error){alert(error.message);return;}await load()}
document.addEventListener('DOMContentLoaded',boot);window.saveEmp=saveEmp;window.openTask=openTask;window.deleteEmp=deleteEmp;

async function openMore(id){
  const x=EMP.find(v=>v.id===id);if(!x)return;
  const modal=document.getElementById('staff-more-modal');
  document.getElementById('more-id').value=id;
  document.getElementById('more-employee').textContent=`${x.employee_id||''} · ${x.full_name||x.email}`;
  document.getElementById('more-salary').value=0;
  document.getElementById('more-bonus').value=0;
  document.getElementById('more-show-salary').checked=false;
  document.getElementById('more-show-bonus').checked=false;
  document.getElementById('more-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('more-start').value='';
  document.getElementById('more-end').value='';
  document.getElementById('more-note').value='';
  openModal(modal);
  const {data,error}=await supabaseClient.from('staff_compensation_visibility').select('*').eq('user_id',id).maybeSingle();
  if(error){console.error('staff_compensation_visibility',error);toast?.('Վճարման տվյալները չբեռնվեցին․ '+error.message,'warning');return;}
  document.getElementById('more-salary').value=data?.salary||0;
  document.getElementById('more-bonus').value=data?.bonus||0;
  document.getElementById('more-show-salary').checked=!!data?.show_salary;
  document.getElementById('more-show-bonus').checked=!!data?.show_bonus;
}
function closeMore(){closeModal(document.getElementById('staff-more-modal'))}
async function saveComp(){const {error}=await supabaseClient.rpc('admin_save_staff_compensation',{p_user_id:moreId(),p_salary:Number(document.getElementById('more-salary').value||0),p_bonus:Number(document.getElementById('more-bonus').value||0),p_show_salary:document.getElementById('more-show-salary').checked,p_show_bonus:document.getElementById('more-show-bonus').checked});if(error)return alert(error.message);toast?.('Աշխատավարձ/բոնուսը պահպանվեց','success');}
function moreId(){return document.getElementById('more-id').value}
async function saveSchedule(){const {error}=await supabaseClient.rpc('admin_upsert_staff_schedule',{p_user_id:moreId(),p_work_date:document.getElementById('more-date').value,p_start:document.getElementById('more-start').value||null,p_end:document.getElementById('more-end').value||null,p_note:document.getElementById('more-note').value||null});if(error)return alert(error.message);toast?.('Գրաֆիկը պահպանվեց','success');}
async function sendNotice(){const title=document.getElementById('more-notice-title').value.trim();if(!title)return alert('Գրեք վերնագիրը');const {error}=await supabaseClient.rpc('admin_notify_staff',{p_user_id:moreId(),p_title:title,p_message:document.getElementById('more-notice-message').value.trim()||null,p_kind:'info'});if(error)return alert(error.message);document.getElementById('more-notice-title').value='';document.getElementById('more-notice-message').value='';toast?.('Ծանուցումն ուղարկվեց','success');}
window.openMore=openMore;window.closeMore=closeMore;window.saveComp=saveComp;window.saveSchedule=saveSchedule;window.sendNotice=sendNotice;
