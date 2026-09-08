/* ============================================================
   Admin Dashboard — stats, Kanban board, order drawer
   ============================================================ */

let ALL_ORDERS = [];
let ACTIVE_ORDER = null;

(async function init(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;

  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);
  document.getElementById("today-date").textContent = new Date().toLocaleDateString("hy-AM", { weekday: "long", day: "numeric", month: "long" });

  await loadEverything();

  document.getElementById("refresh-btn").addEventListener("click", loadEverything);
  document.getElementById("save-order-btn").addEventListener("click", saveOrder);
  document.getElementById("post-comment-btn").addEventListener("click", postComment);
  document.getElementById("upload-proof-btn")?.addEventListener("click", uploadDesignProof);
  document.getElementById("notif-bell").addEventListener("click", () => {
    document.getElementById("notif-dot").style.display = "none";
  });
  initUploadZone(document.getElementById("upload-zone"), handleFileUpload);

  // Live updates: new orders appear automatically, no refresh needed.
  subscribeToOrders((payload) => {
    if (payload.eventType === "INSERT"){
      toast("🆕 Նոր պատվեր՝ " + (payload.new?.order_number || ""), "info");
      document.getElementById("notif-dot").style.display = "block";
    }
    loadOrders();
  });
})();

async function loadEverything(){
  await Promise.all([loadOrders(), loadPartnerBadge(), loadManagerCount()]);
  await loadAttention();
}

async function loadOrders(){
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*, profiles:created_by_manager_id(full_name)")
    .order("created_at", { ascending: false });

  if (error){
    console.error(error);
    toast("Պատվերները չհաջողվեց բեռնել՝ " + error.message, "error");
    return;
  }
  ALL_ORDERS = data || [];
  renderStats();
  renderKanban();
}

async function loadPartnerBadge(){
  const { count } = await supabaseClient.from("partner_applications").select("*", { count: "exact", head: true }).eq("status", "new");
  document.getElementById("partners-badge").textContent = count ?? "0";
}
async function loadManagerCount(){
  const { count } = await supabaseClient.from("profiles").select("*", { count: "exact", head: true }).eq("role", "manager");
  document.getElementById("stat-managers").textContent = count ?? "0";
}

/* ---------- Stats ---------- */
function renderStats(){
  const today = new Date().toDateString();
  const todayOrders = ALL_ORDERS.filter(o => new Date(o.created_at).toDateString() === today);
  const thisMonth = new Date().getMonth();
  const monthRevenue = ALL_ORDERS
    .filter(o => new Date(o.created_at).getMonth() === thisMonth && o.status !== "cancelled")
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  document.getElementById("stat-today").textContent = todayOrders.length;
  document.getElementById("stat-revenue").textContent = formatMoney(monthRevenue);
  document.getElementById("stat-pending").textContent = ALL_ORDERS.filter(o => o.status === "pending").length;
  document.getElementById("stat-ready").textContent = ALL_ORDERS.filter(o => o.status === "ready").length;
  document.getElementById("orders-total-sub").textContent = `${ALL_ORDERS.length} պատվեր ընդհանուր`;
}

/* ---------- Compact table view (replaces the horizontal-scrolling Kanban) ---------- */
let ACTIVE_STATUS_FILTER = "all";

function renderKanban(){
  renderStatusChips();
  renderOrdersTable();
}

function renderStatusChips(){
  const el = document.getElementById("status-chips");
  const chips = ["all", ...STATUS_ORDER];
  el.innerHTML = chips.map(key => {
    const count = key === "all" ? ALL_ORDERS.length : ALL_ORDERS.filter(o => o.status === key).length;
    const label = key === "all" ? "Բոլորը" : statusLabel(key);
    return `<button class="chip ${ACTIVE_STATUS_FILTER === key ? "active" : ""}" data-status="${key}">${label} (${count})</button>`;
  }).join("");

  el.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      ACTIVE_STATUS_FILTER = chip.dataset.status;
      renderKanban();
    });
  });
}

function renderOrdersTable(){
  const body = document.getElementById("orders-body");
  const list = ACTIVE_STATUS_FILTER === "all" ? ALL_ORDERS : ALL_ORDERS.filter(o => o.status === ACTIVE_STATUS_FILTER);

  if (!list.length){
    body.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">Պատվերներ չկան</td></tr>`;
    return;
  }

  body.innerHTML = list.map(o => `
    <tr>
      <td class="mono" style="cursor:pointer;" onclick="openOrderDrawer('${o.id}')">${o.order_number}</td>
      <td style="cursor:pointer;" onclick="openOrderDrawer('${o.id}')">
        <div class="cell-customer"><div class="avatar">${initials(o.customer_name)}</div><span>${o.customer_name || "—"}</span></div>
      </td>
      <td style="cursor:pointer;" onclick="openOrderDrawer('${o.id}')">${o.service_name || o.service_key || "—"}</td>
      <td class="mono" style="cursor:pointer;" onclick="openOrderDrawer('${o.id}')">${formatMoney(o.total_amount)}</td>
      <td style="cursor:pointer;" onclick="openOrderDrawer('${o.id}')">${o.profiles?.full_name ? "👤 " + o.profiles.full_name : "🌐 Կայք"}</td>
      <td>
        <select class="status-quick-select" data-id="${o.id}" style="padding:5px 8px; border-radius:6px; border:1px solid var(--border); background:var(--surface-solid); color:var(--text); font-size:12.5px;">
          ${STATUS_ORDER.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}
        </select>
      </td>
      <td class="mono" style="color:var(--text-muted); cursor:pointer;" onclick="openOrderDrawer('${o.id}')">${formatDate(o.created_at)}</td>
    </tr>
  `).join("");

  body.querySelectorAll(".status-quick-select").forEach(sel => {
    sel.addEventListener("click", (e) => e.stopPropagation());
    sel.addEventListener("change", () => changeOrderStatus(sel.dataset.id, sel.value));
  });
}

async function changeOrderStatus(orderId, newStatus){
  const order = ALL_ORDERS.find(o => o.id === orderId);
  if (!order || order.status === newStatus) return;
  const oldStatus = order.status;

  const { error } = await supabaseClient.from("orders").update({ status: newStatus }).eq("id", orderId);
  if (error){ toast("Չհաջողվեց փոխել վիճակը", "error"); return; }

  await supabaseClient.from("order_status_history").insert({ order_id: orderId, old_status: oldStatus, new_status: newStatus });
  logActivity(`Փոխեց կարգավիճակը՝ ${statusLabel(oldStatus)} → ${statusLabel(newStatus)} (${order.order_number})`, "orders", orderId);
  order.status = newStatus;
  renderStats();
  renderKanban();
  toast(`${order.order_number} → ${statusLabel(newStatus)}`, "success");
}

/* ---------- Drawer ---------- */
async function openOrderDrawer(orderId){
  const order = ALL_ORDERS.find(o => o.id === orderId);
  if (!order) return;
  ACTIVE_ORDER = order;

  document.getElementById("drawer-order-number").textContent = order.order_number;
  renderQrCode(document.getElementById("drawer-qr"), order.order_number, 56);
  document.getElementById("drawer-status-pill").innerHTML = statusPill(order.status) + paymentPill(order.payment_status);
  document.getElementById("f-customer").value = order.customer_name || "—";
  document.getElementById("f-phone").value = order.customer_phone || "—";
  document.getElementById("f-email").value = order.customer_email || "—";
  document.getElementById("f-service").value = order.service_name || order.service_key || "—";
  document.getElementById("f-language").value = (order.language || "hy").toUpperCase();
  document.getElementById("f-total").value = order.total_amount || 0;
  document.getElementById("f-cost").value = order.cost_amount ?? "";
  document.getElementById("f-payment").value = order.payment_status || "unpaid";
  document.getElementById("f-description").value = order.description || "";

  const statusSelect = document.getElementById("f-status");
  statusSelect.innerHTML = STATUS_ORDER.map(s => `<option value="${s}">${statusLabel(s)}</option>`).join("");
  statusSelect.value = order.status;

  const managerWrap = document.getElementById("f-manager-wrap");
  if (order.created_by_type === "manager" && order.profiles?.full_name){
    managerWrap.style.display = "block";
    document.getElementById("f-manager").value = order.profiles.full_name;
  } else {
    managerWrap.style.display = "block";
    document.getElementById("f-manager").value = "Կայքից (հաճախորդ)";
  }

  openDrawer();
  loadOrderExtraDetails(orderId);
  loadOrderTimeline(orderId);
  loadOrderFiles(orderId);
  loadOrderComments(orderId);
  loadDesignProof(orderId);
  loadOrderDeliveryDetails(orderId);
}

async function saveOrder(){
  if (!ACTIVE_ORDER) return;
  const btn = document.getElementById("save-order-btn");
  btn.disabled = true; btn.textContent = "Պահպանվում է...";

  const newStatus = document.getElementById("f-status").value;
  const updates = {
    total_amount: Number(document.getElementById("f-total").value) || 0,
    cost_amount: document.getElementById("f-cost").value === "" ? null : Number(document.getElementById("f-cost").value),
    payment_status: document.getElementById("f-payment").value,
    status: newStatus,
  };

  const { error } = await supabaseClient.from("orders").update(updates).eq("id", ACTIVE_ORDER.id);
  if (error){ btn.disabled = false; btn.textContent = "Պահպանել փոփոխությունները"; toast("Չհաջողվեց պահպանել՝ " + error.message, "error"); return; }

  const feeWrap = document.getElementById("f-delivery-fee-wrap");
  if (feeWrap && feeWrap.style.display !== "none"){
    const deliveryFee = Math.max(0, Number(document.getElementById("f-delivery-fee")?.value) || 0);
    const { data: feeResult, error: feeError } = await supabaseClient.rpc("admin_set_order_delivery_fee", { p_order_id: ACTIVE_ORDER.id, p_delivery_fee: deliveryFee });
    if (feeError){ btn.disabled = false; btn.textContent = "Պահպանել փոփոխությունները"; toast("Պատվերը պահպանվեց, բայց առաքման արժեքը չպահպանվեց՝ " + feeError.message, "error"); return; }
    ACTIVE_ORDER.delivery_fee = Number(feeResult?.delivery_fee ?? deliveryFee) || 0;
  }
  btn.disabled = false; btn.textContent = "Պահպանել փոփոխությունները";

  if (newStatus !== ACTIVE_ORDER.status){
    await supabaseClient.from("order_status_history").insert({ order_id: ACTIVE_ORDER.id, old_status: ACTIVE_ORDER.status, new_status: newStatus });
  }
  logActivity(`Խմբագրեց պատվերը (${ACTIVE_ORDER.order_number}) — ծախս/վճարում/գին/կարգավիճակ`, "orders", ACTIVE_ORDER.id);

  Object.assign(ACTIVE_ORDER, updates);
  toast("Պահպանված է ✓", "success");
  document.getElementById("drawer-status-pill").innerHTML = statusPill(updates.status) + paymentPill(updates.payment_status);
  loadOrderTimeline(ACTIVE_ORDER.id);
  await loadOrders();
}

/* ---------- Extra details (order_details.details) ---------- */
async function loadOrderExtraDetails(orderId){
  const el = document.getElementById("drawer-extra-details");
  const { data, error } = await supabaseClient.from("order_details").select("*").eq("order_id", orderId).order("id", { ascending: false }).limit(1).maybeSingle();

  if (error || !data?.details || !Object.keys(data.details).length){
    el.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Լրացուցիչ մանրամասներ չկան</div>`;
    return;
  }
  el.innerHTML = Object.entries(data.details).filter(([,v]) => v !== "" && v != null).map(([k,v]) => `
    <div style="display:flex; justify-content:space-between; gap:14px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13.5px;">
      <span style="color:var(--text-muted); flex-shrink:0;">${k === "_price_display" ? "Հաշվարկված գին (կայքից)" : k}</span>
      <span style="text-align:right; font-weight:500; word-break:break-word;">${v}</span>
    </div>
  `).join("");
}

/* ---------- Timeline ---------- */
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

/* ---------- Files ---------- */
async function loadOrderFiles(orderId){
  const el = document.getElementById("drawer-gallery");
  const { data, error } = await supabaseClient.from("order_files").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  if (error){
    console.error(error);
    el.innerHTML = `<div class="empty-state" style="padding:20px 0;grid-column:1/-1"><div class="e-title">Ֆայլերը չհաջողվեց բեռնել</div></div>`;
    return;
  }
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

    return `<div class="gd-order-file-card" data-file-id="${f.id}">
      ${preview}
      <div class="gd-file-meta">
        <div class="gd-file-name" title="${safeName}">${safeName}</div>
        <div class="gd-file-actions">
          <button type="button" class="btn btn-ghost btn-sm" onclick="downloadOrderFile('${f.id}')">Ներբեռնել</button>
          <button type="button" class="btn btn-sm gd-file-delete-btn" onclick="deleteOrderFile('${f.id}')">Ջնջել</button>
        </div>
      </div>
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name || 'GDprint-file';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    } else if (file.file_url){
      const a = document.createElement('a');
      a.href = file.file_url;
      a.download = file.file_name || 'GDprint-file';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    } else {
      throw new Error('Ֆայլի հասցեն բացակայում է');
    }
    toast('Ֆայլը ներբեռնվում է', 'success');
  } catch (e){
    console.error(e);
    toast('Ֆայլը չհաջողվեց ներբեռնել', 'error');
  }
}

async function deleteOrderFile(fileId){
  if (!ACTIVE_ORDER) return;
  const ok = confirm('Ջնջե՞լ այս ֆայլը Supabase Storage-ից և տվյալների բազայից։ Գործողությունը հնարավոր չէ հետարկել։');
  if (!ok) return;

  const card = document.querySelector(`.gd-order-file-card[data-file-id="${fileId}"]`);
  const deleteBtn = card?.querySelector('.gd-file-delete-btn');
  if (deleteBtn){ deleteBtn.disabled = true; deleteBtn.textContent = 'Ջնջվում է…'; }

  try{
    const { data:file, error:readError } = await supabaseClient
      .from('order_files')
      .select('*')
      .eq('id', fileId)
      .single();
    if (readError || !file) throw readError || new Error('Ֆայլը չի գտնվել');

    // 1. First remove the physical object from private Storage.
    if (file.storage_path){
      const { data:removed, error:storageError } = await supabaseClient
        .storage
        .from('customer-order-files')
        .remove([file.storage_path]);
      if (storageError) throw new Error(`Storage: ${storageError.message}`);

      // Supabase Storage may return no error even when no object was removed.
      // Verify by trying to download it. A successful download means it still exists.
      const { data:stillThere, error:verifyStorageError } = await supabaseClient
        .storage
        .from('customer-order-files')
        .download(file.storage_path);
      if (!verifyStorageError && stillThere){
        throw new Error('Storage-ից ֆայլը չի ջնջվել։ Ստուգեք migration 016-ը և Admin իրավունքը։');
      }
    }

    // 2. Delete metadata directly through the Admin RLS policy.
    //    This keeps the same authenticated browser context that successfully
    //    deleted the Storage object and avoids SECURITY DEFINER/auth.uid()
    //    edge cases seen on some Supabase projects.
    const { data:deletedRows, error:deleteDbError } = await supabaseClient
      .from('order_files')
      .delete()
      .eq('id', fileId)
      .select('id');
    if (deleteDbError) throw new Error(`Database: ${deleteDbError.message}`);

    // If RLS returned zero rows, use the hardened Admin RPC as a fallback.
    if (!deletedRows || deletedRows.length === 0){
      const { data:rpcDeleted, error:rpcError } = await supabaseClient
        .rpc('admin_delete_order_file_record', { p_file_id: fileId });
      if (rpcError) throw new Error(`Database: ${rpcError.message}`);
      if (rpcDeleted !== true) throw new Error('Տվյալների բազայի գրառումը չի ջնջվել');
    }

    // 3. Verify that the row is really gone.
    const { data:verifyRow, error:verifyDbError } = await supabaseClient
      .from('order_files')
      .select('id')
      .eq('id', fileId)
      .maybeSingle();
    if (verifyDbError) throw verifyDbError;
    if (verifyRow) throw new Error('Ֆայլի գրառումը դեռ առկա է տվյալների բազայում');

    try { await logActivity(`Ջնջեց պատվերի ֆայլը՝ ${file.file_name || fileId}`, 'order_files', fileId); } catch (_) {}

    card?.remove();
    toast('Ֆայլը վերջնական ջնջված է Storage-ից և տվյալների բազայից', 'success');

    const gallery = document.getElementById('drawer-gallery');
    if (gallery && !gallery.querySelector('.gd-order-file-card')){
      gallery.innerHTML = `<div class="empty-state" style="padding:20px 0; grid-column:1/-1;"><div class="e-title">Ֆայլեր չկան</div></div>`;
    }
  } catch (e){
    console.error('deleteOrderFile failed:', e);
    toast(`Ֆայլը չհաջողվեց ջնջել${e?.message ? ': '+e.message : ''}`, 'error');
    if (deleteBtn){ deleteBtn.disabled = false; deleteBtn.textContent = 'Ջնջել'; }
    // Reload to show the real server state, not stale UI.
    await loadOrderFiles(ACTIVE_ORDER.id);
  }
}

async function handleFileUpload(files){
  if (!ACTIVE_ORDER){ toast("Նախ բացեք պատվերը", "error"); return; }
  toast(`Վերբեռնվում է ${files.length} ֆայլ...`, "info");
  for (const file of files){
    const path = `${ACTIVE_ORDER.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabaseClient.storage.from("order-files").upload(path, file);
    if (upErr){ toast(`Սխալ՝ ${file.name}`, "error"); continue; }
    const { data: pub } = supabaseClient.storage.from("order-files").getPublicUrl(path);
    await supabaseClient.from("order_files").insert({ order_id: ACTIVE_ORDER.id, file_name: file.name, file_url: pub.publicUrl });
  }
  toast("Վերբեռնումն ավարտված է ✓", "success");
  loadOrderFiles(ACTIVE_ORDER.id);
}

/* ---------- Comments ---------- */
async function loadOrderComments(orderId){
  const el = document.getElementById("drawer-comments");
  const { data } = await supabaseClient.from("order_messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  if (!data?.length){ el.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Դեռ մեկնաբանություններ չկան</div>`; return; }
  el.innerHTML = data.map(m => `
    <div style="padding:10px 12px; border-radius:8px; background:var(--surface-solid); margin-bottom:8px;">
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:3px; text-transform:uppercase; letter-spacing:.03em;">${m.author_type === "customer" ? "Հաճախորդ" : "Անձնակազմ"}</div>
      <div style="font-size:13.5px;">${m.message}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:4px; font-family:var(--font-mono);">${timeAgo(m.created_at)}</div>
    </div>
  `).join("");
}

async function postComment(){
  const input = document.getElementById("f-new-comment");
  const message = input.value.trim();
  if (!message || !ACTIVE_ORDER) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  const { error } = await supabaseClient.from("order_messages").insert({
    order_id: ACTIVE_ORDER.id, author_type: "staff", author_id: session.user.id, message,
  });
  if (error){ toast("Չհաջողվեց ուղարկել", "error"); return; }
  input.value = "";
  loadOrderComments(ACTIVE_ORDER.id);
}


async function loadAttention(){
  const el = document.getElementById("attention-grid");
  if (!el) return;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todayOrders = ALL_ORDERS.filter(o => {
    const d = new Date(o.created_at);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey && o.status !== "cancelled";
  });
  const unpaid = todayOrders.filter(o => o.payment_status !== "paid");
  const late = ALL_ORDERS.filter(o =>
    !["ready", "completed", "cancelled"].includes(o.status) &&
    o.deadline && new Date(o.deadline).getTime() < now.getTime()
  );

  const safeCount = async (query) => {
    try {
      const { count, error } = await query;
      if (error) { console.warn("Attention count query:", error.message); return 0; }
      return count || 0;
    } catch (err) {
      console.warn("Attention count failed:", err);
      return 0;
    }
  };

  const [pendingManagers, approvals, partners] = await Promise.all([
    safeCount(supabaseClient.from("profiles").select("*", { count:"exact", head:true }).eq("role","manager").eq("approval_status","pending")),
    safeCount(supabaseClient.from("approval_requests").select("*", { count:"exact", head:true }).eq("status","pending")),
    safeCount(supabaseClient.from("partner_applications").select("*", { count:"exact", head:true }).eq("status","new"))
  ]);

  const debt = unpaid.reduce((sum,o) => sum + (Number(o.total_amount)||0), 0);
  const icon = {
    unpaid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    late:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    manager:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    approval:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z"/><path d="M9 12l2 2 4-4"/></svg>',
    partner:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 8h-4V4M4 16h4v4"/><path d="M5.5 9a7 7 0 0 1 11.8-2.3L20 9M4 15l2.7 2.3A7 7 0 0 0 18.5 15"/></svg>'
  };

  const cards = [
    {label:"Չվճարված պատվերներ", number:unpaid.length, meta: debt ? `Այսօր՝ ${formatMoney(debt)}` : "Այսօրվա պարտք չկա", href:"dashboard.html", tone:unpaid.length ? "danger" : "success", badge: unpaid.length ? "Վճարում" : "Լավ է", icon:icon.unpaid},
    {label:"Ուշացած պատվերներ", number:late.length, meta:late.length ? "Պահանջում է արագ ստուգում" : "Ուշացած պատվեր չկա", href:"dashboard.html", tone:late.length ? "danger" : "success", badge:late.length ? "Շտապ" : "Լավ է", icon:icon.late},
    {label:"Նոր մենեջերներ", number:pendingManagers, meta:pendingManagers ? "Սպասում է ադմինի հաստատմանը" : "Հաստատման սպասող չկա", href:"managers.html", tone:pendingManagers ? "warning" : "success", badge:"Հաստատում", icon:icon.manager},
    {label:"Admin approval", number:approvals, meta:approvals ? "Սպասող կառավարման հարցում" : "Սպասող հարցում չկա", href:"control-center.html", tone:approvals ? "warning" : "success", badge:"Control", icon:icon.approval},
    {label:"Գործընկերների հայտեր", number:partners, meta:partners ? "Նոր հայտ՝ վերանայման համար" : "Նոր հայտ չկա", href:"partners.html", tone:partners ? "info" : "success", badge:"Նոր", icon:icon.partner}
  ];

  el.innerHTML = cards.map(c => `
    <a class="attention-item" data-tone="${c.tone}" href="${c.href}">
      <div class="attention-item-top"><span class="attention-icon">${c.icon}</span><span class="attention-badge">${c.badge}</span></div>
      <div class="attention-number">${c.number}</div>
      <div class="attention-label">${c.label}</div>
      <div class="attention-meta">${c.meta}</div>
    </a>`).join("");
}


/* === Customer App v3: design approval + payment requests === */
async function loadDesignProof(orderId){
  const el=document.getElementById('drawer-proof-status'); if(!el)return;
  const {data,error}=await supabaseClient.from('order_design_proofs').select('*').eq('order_id',orderId).order('version',{ascending:false}).limit(1).maybeSingle();
  if(error){el.textContent='Չհաջողվեց բեռնել';return} if(!data){el.textContent='Դիզայն դեռ չի ուղարկվել հաստատման';return}
  const labels={pending:'Սպասում է հաճախորդի պատասխանին',approved:'Հաճախորդը հաստատել է',changes_requested:'Հաճախորդը փոփոխություն է պահանջել'};
  el.innerHTML=`<b>${labels[data.status]||data.status}</b> • տարբերակ ${data.version}${data.customer_comment?`<br><span style="color:var(--text)">Մեկնաբանություն՝ ${data.customer_comment}</span>`:''}`;
}
async function uploadDesignProof(){
  if(!ACTIVE_ORDER)return; const input=document.getElementById('proof-file'),file=input.files?.[0]; if(!file)return toast('Ընտրեք դիզայնի ֆայլը','error');
  const btn=document.getElementById('upload-proof-btn');btn.disabled=true;btn.textContent='Վերբեռնվում է...';
  try{const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_'),path=`${ACTIVE_ORDER.customer_id||'customer'}/${ACTIVE_ORDER.id}/proof_${Date.now()}_${safe}`;
    const {error:up}=await supabaseClient.storage.from('customer-order-files').upload(path,file,{contentType:file.type||'application/octet-stream'});if(up)throw up;
    const {error}=await supabaseClient.rpc('staff_publish_design_proof',{p_order_id:ACTIVE_ORDER.id,p_file_name:file.name,p_storage_path:path});if(error)throw error;
    input.value='';toast('Դիզայնն ուղարկված է հաճախորդի հաստատման','success');loadDesignProof(ACTIVE_ORDER.id);
  }catch(e){toast(e.message,'error')}finally{btn.disabled=false;btn.textContent='Ուղարկել հաստատման'}
}

async function loadOrderDeliveryDetails(orderId){
  const el=document.getElementById('drawer-delivery'); if(!el)return; el.textContent='Բեռնվում է...';
  const feeWrap=document.getElementById('f-delivery-fee-wrap'),feeInput=document.getElementById('f-delivery-fee');
  if(feeWrap)feeWrap.style.display='none'; if(feeInput)feeInput.value='0';
  const {data,error}=await supabaseClient.from('order_delivery_details').select('*').eq('order_id',orderId).maybeSingle();
  if(error){el.textContent='Առաքման տվյալները հասանելի չեն';console.warn(error);return}
  if(!data){el.innerHTML='<b style="color:var(--text)">Առաքման տվյալներ նշված չեն</b>';return}
  if(data.delivery_method==='pickup'){el.innerHTML='<b style="color:var(--text)">Ինքնուրույն ստացում</b><div style="margin-top:4px">Հաճախորդը պատվերը ստանալու է GDprint-ից։</div>';return}
  if(feeWrap)feeWrap.style.display='block'; const canonicalFee=Number(ACTIVE_ORDER?.delivery_fee ?? data.delivery_fee ?? 0)||0; if(feeInput)feeInput.value=canonicalFee;
  el.innerHTML=`<b style="color:var(--text)">Առաքում հասցեով</b><div style="margin-top:7px;line-height:1.65"><strong>${escapeHtml(data.recipient_name||'—')}</strong> · ${escapeHtml(data.phone||'—')}<br>${escapeHtml(data.address_line||'—')}${data.note?'<br><span>'+escapeHtml(data.note)+'</span>':''}</div><div style="margin-top:8px;font-weight:700;color:var(--text)">Առաքում՝ ${formatMoney(Number(ACTIVE_ORDER?.delivery_fee ?? data.delivery_fee ?? 0)||0)}</div>`;
}
