let ORDERS = [];
let ACTIVE_ORDER = null;

const STAGES = ['intake','approval','prepress','digital_print','large_format','finishing','quality_control','packing','delivery','completed','cancelled'];
const STAGE_LABELS = {intake:'Նոր / Intake',approval:'Հաստատման սպասող',prepress:'Դիզայն / Prepress',digital_print:'Թվային տպագրություն',large_format:'Լայնաֆորմատ',finishing:'Հետտպագրական',quality_control:'Որակի ստուգում',packing:'Փաթեթավորում',delivery:'Առաքում',completed:'Ավարտված',cancelled:'Չեղարկված'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let el = {};

async function boot(){
  if (!await requireRole(['admin'])) return;
  el = {
    q:document.getElementById('q'), stage:document.getElementById('stage'), priority:document.getElementById('priority'), payment:document.getElementById('payment'), status:document.getElementById('status'), archive:document.getElementById('archive'), rows:document.getElementById('rows'),
    sAll:document.getElementById('s-all'), sActive:document.getElementById('s-active'), sLate:document.getElementById('s-late'), sUnpaid:document.getElementById('s-unpaid'),
    modal:document.getElementById('modal'), mTitle:document.getElementById('m-title'), mCustomer:document.getElementById('m-customer'), mStage:document.getElementById('m-stage'), mPriority:document.getElementById('m-priority'), mDeadline:document.getElementById('m-deadline'), mNotes:document.getElementById('m-notes'), mPrice:document.getElementById('m-price'), mPriceInfo:document.getElementById('m-price-info'), mClose:document.getElementById('m-close'), saveFlow:document.getElementById('save-flow'), approvePrice:document.getElementById('approve-price'), archiveOrder:document.getElementById('archive-order')
  };

  el.stage.innerHTML = '<option value="">Բոլոր փուլերը</option>' + STAGES.map(x => `<option value="${x}">${STAGE_LABELS[x]}</option>`).join('');
  el.mStage.innerHTML = STAGES.map(x => `<option value="${x}">${STAGE_LABELS[x]}</option>`).join('');
  el.status.innerHTML = '<option value="">Բոլոր status</option>' + ['pending','confirmed','in_progress','ready','completed','cancelled'].map(x => `<option value="${x}">${x}</option>`).join('');
  [el.q,el.stage,el.priority,el.payment,el.status,el.archive].forEach(x => x.addEventListener(x === el.q ? 'input' : 'change', render));
  el.mClose.addEventListener('click', closeModal);
  el.modal.addEventListener('click', e => { if(e.target === el.modal) closeModal(); });
  el.saveFlow.addEventListener('click', saveFlow);
  el.approvePrice.addEventListener('click', approvePrice);
  el.archiveOrder.addEventListener('click', toggleArchive);
  await load();
}

async function load(){
  el.rows.innerHTML = '<tr><td colspan="8">Բեռնվում է…</td></tr>';
  const { data, error } = await supabaseClient.rpc('admin_orders_erp_list');
  if(error){
    el.rows.innerHTML = `<tr><td colspan="8">${esc(error.message)}<br><small>Գործարկեք 036_admin_data_ui_notifications_fix.sql migration-ը։</small></td></tr>`;
    console.error('admin_orders_erp_list', error);
    return;
  }
  ORDERS = Array.isArray(data) ? data : [];
  render();
}

function render(){
  const now = Date.now();
  const qq = el.q.value.toLowerCase().trim();
  const filtered = ORDERS.filter(o =>
    (!qq || [o.order_number,o.customer_name,o.customer_phone,o.service_name,o.service_key].join(' ').toLowerCase().includes(qq)) &&
    (!el.stage.value || (o.workflow_stage || 'intake') === el.stage.value) &&
    (!el.priority.value || (o.priority || 'normal') === el.priority.value) &&
    (!el.payment.value || (el.payment.value === 'paid' ? o.payment_status === 'paid' : o.payment_status !== 'paid')) &&
    (!el.status.value || o.status === el.status.value) &&
    (el.archive.value === 'all' || (el.archive.value === 'archived' ? !!o.is_archived : !o.is_archived))
  );

  el.sAll.textContent = ORDERS.length;
  el.sActive.textContent = ORDERS.filter(o => !['completed','cancelled'].includes(o.status)).length;
  el.sLate.textContent = ORDERS.filter(o => o.deadline && new Date(o.deadline).getTime() < now && !['completed','cancelled'].includes(o.status)).length;
  el.sUnpaid.textContent = ORDERS.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').length;

  el.rows.innerHTML = filtered.length ? filtered.map(o => `<tr data-order-id="${esc(o.id)}" style="cursor:pointer">
    <td><b>${esc(o.order_number || '—')}</b></td><td>${esc(o.customer_name || '—')}</td><td>${esc(o.service_name || o.service_key || '—')}</td>
    <td>${Number(o.total_amount || 0).toLocaleString('hy-AM')} ֏</td><td>${esc(STAGE_LABELS[o.workflow_stage || 'intake'] || o.workflow_stage || 'intake')}</td>
    <td class="prio-${esc(o.priority || 'normal')}">${esc(o.priority || 'normal')}</td><td>${o.deadline ? gdFormatDateTime(o.deadline) : '—'}</td><td>${esc(o.payment_status || 'unpaid')}</td>
  </tr>`).join('') : '<tr><td colspan="8">Պատվեր չի գտնվել։</td></tr>';
  el.rows.querySelectorAll('[data-order-id]').forEach(row => row.addEventListener('click', () => openOrder(row.dataset.orderId)));
}

function openOrder(id){
  ACTIVE_ORDER = ORDERS.find(x => x.id === id);
  if(!ACTIVE_ORDER) return;
  el.mTitle.textContent = ACTIVE_ORDER.order_number || 'Պատվեր';
  el.mCustomer.textContent = `${ACTIVE_ORDER.customer_name || '—'} · ${ACTIVE_ORDER.service_name || ACTIVE_ORDER.service_key || '—'}`;
  el.mStage.value = ACTIVE_ORDER.workflow_stage || 'intake';
  el.mPriority.value = ACTIVE_ORDER.priority || 'normal';
  el.mDeadline.value = ACTIVE_ORDER.deadline ? gdIsoToYerevanInput(ACTIVE_ORDER.deadline) : '';
  el.mNotes.value = ACTIVE_ORDER.internal_notes || '';
  el.mPrice.value = ACTIVE_ORDER.total_amount || 0;
  el.mPriceInfo.textContent = ACTIVE_ORDER.final_price_approved_at ? 'Վերջին հաստատում՝ ' + gdFormatDateTime(ACTIVE_ORDER.final_price_approved_at) : 'Գինը դեռ Admin-ի կողմից առանձին չի հաստատվել';
  el.archiveOrder.textContent = ACTIVE_ORDER.is_archived ? 'Վերականգնել արխիվից' : 'Տեղափոխել արխիվ';
  el.modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(){ el.modal.classList.remove('open'); document.body.style.overflow = ''; }

async function saveFlow(){
  if(!ACTIVE_ORDER) return;
  const deadline = el.mDeadline.value ? gdYerevanInputToIso(el.mDeadline.value) : null;
  const { error } = await supabaseClient.rpc('admin_set_order_workflow',{p_order_id:ACTIVE_ORDER.id,p_stage:el.mStage.value,p_priority:el.mPriority.value,p_deadline:deadline,p_internal_notes:el.mNotes.value || null});
  if(error){ if(typeof toast==='function') toast(error.message,'error'); else alert(error.message); return; }
  closeModal(); await load(); if(typeof toast==='function') toast('Workflow-ը պահպանվեց','success');
}

async function approvePrice(){
  if(!ACTIVE_ORDER) return;
  const { error } = await supabaseClient.rpc('admin_approve_final_price',{p_order_id:ACTIVE_ORDER.id,p_total:Number(el.mPrice.value) || 0});
  if(error){ if(typeof toast==='function') toast(error.message,'error'); else alert(error.message); return; }
  await load();
  openOrder(ACTIVE_ORDER.id);
  if(typeof toast==='function') toast('Վերջնական գինը հաստատվեց','success');
}

async function toggleArchive(){
  if(!ACTIVE_ORDER) return;
  const { error } = await supabaseClient.rpc('admin_set_order_archived',{p_order_id:ACTIVE_ORDER.id,p_archived:!ACTIVE_ORDER.is_archived});
  if(error){ if(typeof toast==='function') toast(error.message,'error'); else alert(error.message); return; }
  closeModal(); await load();
}

document.addEventListener('DOMContentLoaded',boot);
