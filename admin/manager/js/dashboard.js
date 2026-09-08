/* ============================================================
   Manager Dashboard — own orders, earnings, target, leaderboard
   RLS already restricts orders to created_by_manager_id = self,
   so no extra filtering is needed on the query itself.
   ============================================================ */

let MY_PROFILE = null;
let MY_ORDERS = [];
let ACTIVE_ORDER = null;

(async function init(){
  const auth = await requireRole(["manager"]);
  if (!auth) return;
  MY_PROFILE = auth.profile;

  document.getElementById("user-name").textContent = MY_PROFILE.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(MY_PROFILE.full_name || auth.session.user.email);
  document.getElementById("today-date").textContent = new Date().toLocaleDateString("hy-AM", { weekday: "long", day: "numeric", month: "long" });

  await Promise.all([loadMyOrders(), loadLeaderboard()]);

  document.getElementById("save-status-btn").addEventListener("click", saveStatus);

  // Live updates: when admin enters a cost, marks payment as paid, or
  // changes status, the manager's stats/earnings refresh automatically.
  subscribeToOrders((payload) => {
    if (payload.eventType === "UPDATE" && payload.new?.created_by_manager_id === MY_PROFILE.id){
      toast(`📦 ${payload.new.order_number} — թարմացվել է`, "info");
    }
    loadMyOrders();
  });
})();

/* ---------- Earning calculation ----------
   Only computed once both conditions are met:
     1. Admin has entered cost_amount
     2. payment_status === 'paid' (fully paid, not just deposit)
   Otherwise returns null so the UI can show "Հաշվարկվում է". */
function computeEarning(order){
  if (order.cost_amount == null || order.payment_status !== "paid") return null;
  const profit = (Number(order.total_amount) || 0) - Number(order.cost_amount);
  const pct = Number(MY_PROFILE.commission_percent) || 10;
  return Math.max(0, profit) * (pct / 100);
}

async function loadMyOrders(){
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error){
    console.error(error);
    toast("Պատվերները չհաջողվեց բեռնել՝ " + error.message, "error");
    return;
  }
  MY_ORDERS = data || [];
  renderStats();
  renderOrdersTable();
}

function renderStats(){
  const today = new Date().toDateString();
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const todayOrders = MY_ORDERS.filter(o => new Date(o.created_at).toDateString() === today);
  const monthOrders = MY_ORDERS.filter(o => new Date(o.created_at).getMonth() === thisMonth && new Date(o.created_at).getFullYear() === thisYear);
  const monthRevenue = monthOrders.filter(o => o.status !== "cancelled").reduce((s,o) => s + (Number(o.total_amount)||0), 0);

  const todayEarning = todayOrders.reduce((s,o) => s + (computeEarning(o) || 0), 0);
  const monthEarning = monthOrders.reduce((s,o) => s + (computeEarning(o) || 0), 0);

  document.getElementById("stat-today-count").textContent = todayOrders.length;
  document.getElementById("stat-month-count").textContent = monthOrders.length;
  document.getElementById("stat-month-revenue").textContent = formatMoney(monthRevenue);
  document.getElementById("stat-today-earning").textContent = formatMoney(todayEarning);
  document.getElementById("stat-month-earning").textContent = formatMoney(monthEarning);
  document.getElementById("orders-count-sub").textContent = `${MY_ORDERS.length} պատվեր ընդհանուր`;

  const target = Number(MY_PROFILE.monthly_target) || 0;
  const pct = target > 0 ? Math.min(100, Math.round((monthEarning / target) * 100)) : 0;
  document.getElementById("target-progress-label").textContent = target > 0 ? `${formatMoney(monthEarning)} / ${formatMoney(target)}` : "Նպատակ սահմանված չէ";
  document.getElementById("target-progress-pct").textContent = target > 0 ? `${pct}%` : "—";
  document.getElementById("target-progress-bar").style.width = `${pct}%`;
}

function renderOrdersTable(){
  const body = document.getElementById("orders-body");
  if (!MY_ORDERS.length){
    body.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">Դեռ պատվեր չկա</td></tr>`;
    return;
  }
  body.innerHTML = MY_ORDERS.map(o => {
    const earning = computeEarning(o);
    return `
    <tr onclick="openOrderDrawer('${o.id}')">
      <td class="mono">${o.order_number}</td>
      <td>
        <div class="cell-customer"><div class="avatar">${initials(o.customer_name)}</div><span>${o.customer_name || "—"}</span></div>
      </td>
      <td>${o.service_name || o.service_key || "—"}</td>
      <td class="mono">${formatMoney(o.total_amount)}</td>
      <td>${statusPill(o.status)}</td>
      <td class="mono" style="color:${earning === null ? "var(--text-muted)" : "var(--success)"};">${earning === null ? "Հաշվարկվում է" : formatMoney(earning)}</td>
    </tr>`;
  }).join("");
}

/* ---------- Leaderboard (aggregate RPC, safe to see across managers) ---------- */
async function loadLeaderboard(){
  const el = document.getElementById("leaderboard-list");
  const { data, error } = await supabaseClient.rpc("get_manager_leaderboard");
  if (error || !data?.length){
    el.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Դեռ տվյալներ չկան</div>`;
    return;
  }
  el.innerHTML = data.map((m, i) => `
    <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; ${m.manager_id === MY_PROFILE.id ? "background:rgba(0,184,217,0.1); border:1px solid var(--ink-cyan);" : ""}">
      <span class="mono" style="width:20px; color:var(--text-muted); font-size:12px;">#${i+1}</span>
      <div class="avatar" style="width:28px; height:28px; font-size:10px;">${initials(m.full_name)}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:12.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.full_name || "—"}${m.manager_id === MY_PROFILE.id ? " (Դուք)" : ""}</div>
        <div style="font-size:11px; color:var(--text-muted);">${m.orders_this_month} պատվեր</div>
      </div>
      <div class="mono" style="font-size:12px; font-weight:700;">${formatMoney(m.revenue_this_month)}</div>
    </div>
  `).join("");
}

/* ---------- Drawer (status update only — cost/payment are admin-controlled) ---------- */
async function openOrderDrawer(orderId){
  const order = MY_ORDERS.find(o => o.id === orderId);
  if (!order) return;
  ACTIVE_ORDER = order;

  document.getElementById("drawer-order-number").textContent = order.order_number;
  document.getElementById("drawer-status-pill").innerHTML = statusPill(order.status) + paymentPill(order.payment_status);
  document.getElementById("f-customer").value = order.customer_name || "—";
  document.getElementById("f-phone").value = order.customer_phone || "—";
  document.getElementById("f-email").value = order.customer_email || "—";
  document.getElementById("f-service").value = order.service_name || order.service_key || "—";
  document.getElementById("f-total").value = formatMoney(order.total_amount);
  const earning = computeEarning(order);
  document.getElementById("f-earning").value = earning === null ? "Հաշվարկվում է (սպասում է ծախսի/վճարման հաստատման)" : formatMoney(earning);

  const statusSelect = document.getElementById("f-status");
  statusSelect.innerHTML = STATUS_ORDER.map(s => `<option value="${s}">${statusLabel(s)}</option>`).join("");
  statusSelect.value = order.status;

  openDrawer();
  loadOrderExtraDetails(orderId);
  loadOrderTimeline(orderId);
  loadOrderFiles(orderId);
  loadOrderDeliveryDetails(orderId);
}

async function saveStatus(){
  if (!ACTIVE_ORDER) return;
  const btn = document.getElementById("save-status-btn");
  const newStatus = document.getElementById("f-status").value;
  if (newStatus === ACTIVE_ORDER.status){ toast("Փոփոխություն չկա", "info"); return; }

  btn.disabled = true; btn.textContent = "Պահպանվում է...";
  const { error } = await supabaseClient.from("orders").update({ status: newStatus }).eq("id", ACTIVE_ORDER.id);
  btn.disabled = false; btn.textContent = "Թարմացնել վիճակը";

  if (error){ toast("Չհաջողվեց՝ " + error.message, "error"); return; }

  await supabaseClient.from("order_status_history").insert({ order_id: ACTIVE_ORDER.id, old_status: ACTIVE_ORDER.status, new_status: newStatus });
  ACTIVE_ORDER.status = newStatus;
  document.getElementById("drawer-status-pill").innerHTML = statusPill(newStatus) + paymentPill(ACTIVE_ORDER.payment_status);
  toast("Վիճակը թարմացված է ✓", "success");
  loadOrderTimeline(ACTIVE_ORDER.id);
  await loadMyOrders();
}

async function loadOrderExtraDetails(orderId){
  const el = document.getElementById("drawer-extra-details");
  const { data } = await supabaseClient.from("order_details").select("*").eq("order_id", orderId).order("id", { ascending: false }).limit(1).maybeSingle();
  if (!data?.details || !Object.keys(data.details).length){
    el.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Լրացուցիչ մանրամասներ չկան</div>`;
    return;
  }
  el.innerHTML = Object.entries(data.details).filter(([,v]) => v !== "" && v != null).map(([k,v]) => `
    <div style="display:flex; justify-content:space-between; gap:14px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13.5px;">
      <span style="color:var(--text-muted);">${k === "_price_display" ? "Հաշվարկված գին" : k}</span>
      <span style="text-align:right; font-weight:500; word-break:break-word;">${v}</span>
    </div>
  `).join("");
}

async function loadOrderTimeline(orderId){
  const el = document.getElementById("drawer-timeline");
  const { data } = await supabaseClient.from("order_status_history").select("*").eq("order_id", orderId).order("changed_at", { ascending: false });
  if (!data?.length){ el.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Դեռ իրադարձություններ չկան</div>`; return; }
  el.innerHTML = data.map((ev, i) => `
    <div class="timeline-item ${i === 0 ? "done" : ""}">
      <div class="t-title">${ev.old_status ? `${statusLabel(ev.old_status)} → ${statusLabel(ev.new_status)}` : `Ստեղծվել է որպես ${statusLabel(ev.new_status)}`}</div>
      <div class="t-time">${timeAgo(ev.changed_at)}</div>
    </div>
  `).join("");
}

async function loadOrderFiles(orderId){
  const el = document.getElementById("drawer-gallery");
  const { data, error } = await supabaseClient.from("order_files").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  if (error){ el.innerHTML = `<div class="empty-state" style="padding:20px 0;grid-column:1/-1"><div class="e-title">Ֆայլերը չհաջողվեց բեռնել</div></div>`; return; }
  if (!data?.length){ el.innerHTML = `<div class="empty-state" style="padding:20px 0; grid-column:1/-1;"><div class="e-title">Ֆայլեր չկան</div></div>`; return; }
  const rendered = await Promise.all(data.map(async f => {
    const type = fileTypeFromName(f.file_name);
    let url = f.file_url || "";
    if (!url && f.storage_path){
      const { data: signed } = await supabaseClient.storage.from("customer-order-files").createSignedUrl(f.storage_path, 900);
      url = signed?.signedUrl || "";
    }
    const safeName = escapeHtml(f.file_name || 'Ֆայլ');
    const preview = url && isImageType(type)
      ? `<a class="gd-file-preview" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${safeName}"></a>`
      : `<div class="gd-file-preview gd-file-preview-generic"><span>${fileIcon(type)}</span><b>${escapeHtml(type.toUpperCase())}</b></div>`;
    return `<div class="gd-order-file-card">
      ${preview}
      <div class="gd-file-meta"><div class="gd-file-name" title="${safeName}">${safeName}</div>
      <div class="gd-file-actions"><button type="button" class="btn btn-ghost btn-sm" onclick="downloadOrderFile('${f.id}')">Ներբեռնել</button></div></div>
    </div>`;
  }));
  el.innerHTML = rendered.join("");
}

async function downloadOrderFile(fileId){
  try{
    const { data:file, error } = await supabaseClient.from('order_files').select('*').eq('id', fileId).single();
    if (error || !file) throw error || new Error('Ֆայլը չի գտնվել');
    if (file.storage_path){
      const { data:blob, error:downloadError } = await supabaseClient.storage.from('customer-order-files').download(file.storage_path);
      if (downloadError) throw downloadError;
      const url = URL.createObjectURL(blob); const a=document.createElement('a');
      a.href=url; a.download=file.file_name||'GDprint-file'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    } else if (file.file_url){
      const a=document.createElement('a'); a.href=file.file_url; a.download=file.file_name||'GDprint-file'; a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
    } else throw new Error('Ֆայլի հասցեն բացակայում է');
    toast('Ֆայլը ներբեռնվում է','success');
  }catch(e){ console.error(e); toast('Ֆայլը չհաջողվեց ներբեռնել','error'); }
}

async function loadOrderDeliveryDetails(orderId){
  const el=document.getElementById('drawer-delivery'); if(!el)return; el.textContent='Բեռնվում է...';
  const {data,error}=await supabaseClient.from('order_delivery_details').select('*').eq('order_id',orderId).maybeSingle();
  if(error){el.textContent='Առաքման տվյալները հասանելի չեն';console.warn(error);return}
  if(!data){el.innerHTML='<b style="color:var(--text)">Առաքման տվյալներ նշված չեն</b>';return} if(data.delivery_method==='pickup'){el.innerHTML='<b style="color:var(--text)">Ինքնուրույն ստացում</b><div style="margin-top:4px">Հաճախորդը պատվերը ստանալու է GDprint-ից։</div>';return}
  el.innerHTML=`<b style="color:var(--text)">Առաքում հասցեով</b><div style="margin-top:7px;line-height:1.65"><strong>${escapeHtml(data.recipient_name||'—')}</strong> · ${escapeHtml(data.phone||'—')}<br>${escapeHtml(data.address_line||'—')}${data.note?'<br><span>'+escapeHtml(data.note)+'</span>':''}</div><div style="margin-top:8px;font-weight:700;color:var(--text)">Առաքման արժեք՝ ${formatMoney(Number(ACTIVE_ORDER?.delivery_fee ?? data.delivery_fee ?? 0)||0)}</div>`;
}
