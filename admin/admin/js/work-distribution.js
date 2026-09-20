let EMPLOYEES = [];
let ASSIGNMENTS = [];

const STAGES = ['intake','prepress','digital_print','large_format','finishing','quality_control','packing','delivery','warehouse','finance','it_support'];
const STAGE_LABELS = {
  intake:'Intake', prepress:'Prepress / Design', digital_print:'Digital Print', large_format:'Large Format / Plotter',
  finishing:'Finishing', quality_control:'Quality Control', packing:'Packing', delivery:'Delivery', warehouse:'Warehouse', finance:'Finance', it_support:'IT Support'
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let els = {};

async function boot(){
  if (!await requireRole(['admin'])) return;
  els = {
    staff: document.getElementById('staff'),
    tasks: document.getElementById('tasks'),
    stageFilter: document.getElementById('stage-filter')
  };
  els.stageFilter.insertAdjacentHTML('beforeend', STAGES.map(x => `<option value="${x}">${STAGE_LABELS[x] || x}</option>`).join(''));
  els.stageFilter.addEventListener('change', render);
  await load();
}

async function load(){
  els.tasks.innerHTML = '<div class="page-sub">Բեռնվում է…</div>';
  els.staff.innerHTML = '<div class="page-sub">Բեռնվում է…</div>';
  const { data, error } = await supabaseClient.rpc('admin_work_distribution_bundle');
  if (error){
    const msg = `Տվյալները չբեռնվեցին՝ ${esc(error.message)}<br><small>Գործարկեք 036_admin_data_ui_notifications_fix.sql migration-ը։</small>`;
    els.staff.innerHTML = `<div class="staff-row">${msg}</div>`;
    els.tasks.innerHTML = `<div class="task">${msg}</div>`;
    console.error('admin_work_distribution_bundle', error);
    return;
  }
  EMPLOYEES = Array.isArray(data?.employees) ? data.employees : [];
  ASSIGNMENTS = Array.isArray(data?.assignments) ? data.assignments : [];
  render();
}

function render(){
  els.staff.innerHTML = EMPLOYEES.map(x => {
    const openCount = ASSIGNMENTS.filter(t => t.assignee_id === x.id && !['completed','cancelled'].includes(t.status)).length;
    const p = Math.min(100, openCount * 20);
    return `<div class="staff-row">
      <b>${esc(x.full_name || x.employee_id || 'Աշխատակից')}</b>
      <div class="page-sub">${esc(x.role)} · ${openCount} բաց</div>
      <div class="bar" style="margin-top:8px"><i style="width:${p}%"></i></div>
    </div>`;
  }).join('') || '<div class="page-sub">Ակտիվ աշխատակից չկա։</div>';

  const stage = els.stageFilter.value;
  const open = ASSIGNMENTS.filter(x => !['completed','cancelled'].includes(x.status) && (!stage || x.stage === stage));
  els.tasks.innerHTML = open.map(x => {
    const user = EMPLOYEES.find(e => e.id === x.assignee_id);
    const note = x.latest_note ? `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--surface);font-size:12px"><b>Վերջին նշում․</b> ${esc(x.latest_note)}${x.latest_note_at ? `<div class="page-sub">${gdFormatDateTime(x.latest_note_at)}</div>` : ''}</div>` : '';
    return `<div class="task">
      <div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(x.title)}</b><span>${esc(x.priority)}</span></div>
      <div class="page-sub">${esc(STAGE_LABELS[x.stage] || x.stage)} · ${esc(user?.full_name || user?.employee_id || '—')} · ${x.deadline ? gdFormatDateTime(x.deadline) : 'Deadline չկա'}</div>
      ${note}
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <select data-action="reassign" data-id="${esc(x.id)}">${EMPLOYEES.map(e => `<option value="${esc(e.id)}" ${e.id === x.assignee_id ? 'selected' : ''}>${esc(e.full_name || e.employee_id)} · ${esc(e.role)}</option>`).join('')}</select>
        <select data-action="priority" data-id="${esc(x.id)}">${['low','normal','high','urgent'].map(p => `<option value="${p}" ${p === x.priority ? 'selected' : ''}>${p}</option>`).join('')}</select>
      </div>
    </div>`;
  }).join('') || '<div class="page-sub">Բաց աշխատանք չկա։</div>';

  els.tasks.querySelectorAll('[data-action="reassign"]').forEach(el => el.addEventListener('change', () => reassign(el.dataset.id, el.value)));
  els.tasks.querySelectorAll('[data-action="priority"]').forEach(el => el.addEventListener('change', () => setPriority(el.dataset.id, el.value)));
}

async function reassign(id, user){
  const { error } = await supabaseClient.from('staff_assignments').update({ assignee_id:user }).eq('id', id);
  if (error){ if(typeof toast==='function') toast(error.message,'error'); else alert(error.message); return; }
  await load();
}

async function setPriority(id, p){
  const { error } = await supabaseClient.from('staff_assignments').update({ priority:p }).eq('id', id);
  if (error){ if(typeof toast==='function') toast(error.message,'error'); else alert(error.message); return; }
  await load();
}

document.addEventListener('DOMContentLoaded', boot);
