(async()=>{if(!await requireRole(['admin']))return;probe.onclick=check;registerBackup.onclick=()=>record('backup','success','Manual backup գրանցված',{source:'admin'});restoreTest.onclick=()=>record('restore_test','info','Restore test գրանցված',{});securityCheck.onclick=async()=>{await check();record('security_check','info','Security health check կատարված',{https:location.protocol==='https:'})};incident.onclick=()=>{const t=prompt('Incident-ի նկարագրություն');if(t)record('incident','warning',t,{})};await check();await loadOps()})();
async function check(){web.textContent=navigator.onLine?'ONLINE':'OFFLINE';const t=performance.now();const {error}=await supabaseClient.from('profiles').select('id',{head:true,count:'exact'}).limit(1);db.textContent=error?'ERROR':`${Math.round(performance.now()-t)}ms`;const {data}=await supabaseClient.auth.getSession();auth.textContent=data.session?'OK':'NO';const b=await supabaseClient.from('backup_registry').select('created_at').order('created_at',{ascending:false}).limit(1);lastBackup.textContent=b.data?.[0]?new Date(b.data[0].created_at).toLocaleString('hy-AM'):'Չկա'}
async function record(type,status,title,details){const {data:{user}}=await supabaseClient.auth.getUser();const {error}=await supabaseClient.from('system_operations').insert({operation_type:type,status,title,details,created_by:user?.id});if(!error&&type==='backup')await supabaseClient.from('backup_registry').insert({backup_type:'manual',status:'registered',notes:title,created_by:user?.id});toast(error?error.message:'Գրանցված է',error?'error':'success');await check();await loadOps()}
async function loadOps(){const {data}=await supabaseClient.from('system_operations').select('*').order('created_at',{ascending:false}).limit(50);ops.innerHTML=(data||[]).map(x=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><b>${x.title}</b> · ${x.status}<div style="font-size:12px;color:var(--text-muted)">${x.operation_type} · ${new Date(x.created_at).toLocaleString('hy-AM')}</div></div>`).join('')||'Գործողություններ չկան'}

async function loadIntegrationHealth(){
  const el=document.getElementById('integration-health'); if(!el)return;
  const {data,error}=await supabaseClient.rpc('admin_integration_health');
  if(error){el.innerHTML=`<div style="color:var(--danger)">${error.message}<br><small>Գործարկեք 035_integration_hardening.sql</small></div>`;return;}
  const obj=data?.required_objects||{};
  const cards=[
    ['Տարբերակ',data?.phase||'—',true],
    ['Role/Stage mismatch',data?.role_stage_mismatches??'—',Number(data?.role_stage_mismatches||0)===0],
    ['Employee ID բացակայում է',data?.staff_missing_employee_id??'—',Number(data?.staff_missing_employee_id||0)===0],
    ['Ուշացած բաց առաջադրանք',data?.late_open_tasks??'—',Number(data?.late_open_tasks||0)===0],
    ['Սպասող գնային առաջարկ',data?.pending_quote_requests??'—',true],
    ['Workflow stage բացակայում է',data?.orders_without_workflow_stage??'—',Number(data?.orders_without_workflow_stage||0)===0],
    ['Workflow history',data?.workflow_history_rows??0,true]
  ];
  const objects=Object.entries(obj).map(([k,v])=>`<span class="badge" style="margin:3px;${v?'':'color:var(--danger)'}">${k}: ${v?'OK':'MISSING'}</span>`).join('');
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">${cards.map(x=>`<div style="border:1px solid var(--border);border-radius:12px;padding:12px"><div class="page-sub">${x[0]}</div><b style="font-size:18px;${x[2]?'':'color:var(--danger)'}">${x[1]}</b></div>`).join('')}</div><div style="margin-top:12px">${objects}</div>`;
}
const _gdOldCheck=check;check=async function(){await _gdOldCheck();await loadIntegrationHealth();};
