/* ============================================================
   Shared UI helpers — theme, toasts, status system, formatting
   ============================================================ */

function syncThemeLogo(theme){
  const currentTheme = theme || document.documentElement.getAttribute("data-theme") || "dark";

  document.querySelectorAll("[data-theme-logo]").forEach((logo) => {
    // Prefer explicit per-page paths when provided. This makes the shared
    // theme code work both from /admin/ (login/register) and from nested
    // /admin/admin/ or /admin/manager/ pages without brittle relative paths.
    const lightSrc = logo.dataset.logoLight || "../img/logo-light.png";
    const darkSrc  = logo.dataset.logoDark  || "../img/logo-dark.png";
    const logoSrc = currentTheme === "light" ? lightSrc : darkSrc;

    if (logo.getAttribute("src") !== logoSrc) {
      logo.setAttribute("src", logoSrc);
    }
  });
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("gdprint-theme", theme);
  syncThemeLogo(theme);
}

function initTheme(){
  const saved = localStorage.getItem("gdprint-theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  syncThemeLogo(saved);
  const toggle = document.getElementById("theme-toggle");
  if (toggle){
    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }
}

function ensureToastStack(){
  let stack = document.querySelector(".toast-stack");
  if (!stack){ stack = document.createElement("div"); stack.className = "toast-stack"; document.body.appendChild(stack); }
  return stack;
}
function toast(message, type = "info"){
  const stack = ensureToastStack();
  const el = document.createElement("div");
  el.className = `toast ${type} glass`;
  el.innerHTML = `<span class="reg-mark"></span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .25s ease"; setTimeout(() => el.remove(), 250); }, 3200);
}

/* ---------- The 8-status order lifecycle (matches fresh schema defaults) ---------- */
const STATUS_ORDER = ["pending", "confirmed", "printing", "processing", "ready", "shipping", "delivered", "cancelled"];
const STATUS_MAP = {
  pending:    { label: "Սպասում է հաստատման", icon: "⏳", cls: "pill-new" },
  confirmed:  { label: "Հաստատված է",          icon: "✅", cls: "pill-progress" },
  printing:   { label: "Տպագրվում է",           icon: "🖨️", cls: "pill-progress" },
  processing: { label: "Մշակվում է",            icon: "✂️", cls: "pill-progress" },
  ready:      { label: "Պատրաստ է",             icon: "📦", cls: "pill-ready" },
  shipping:   { label: "Առաքվում է",            icon: "🚚", cls: "pill-ready" },
  delivered:  { label: "Առաքված է",             icon: "✅", cls: "pill-done" },
  cancelled:  { label: "Չեղարկված է",           icon: "❌", cls: "pill-cancelled" },
};
function statusLabel(status){
  const known = STATUS_MAP[(status || "").toLowerCase()];
  return known ? `${known.icon} ${known.label}` : (status || "—");
}
function statusPill(status){
  const known = STATUS_MAP[(status || "").toLowerCase()];
  const cls = known ? known.cls : "pill-done";
  return `<span class="pill ${cls}"><span class="reg-mark"></span>${statusLabel(status)}</span>`;
}

const PAYMENT_STATUS_MAP = {
  unpaid:  { label: "Չվճարված", cls: "pill-cancelled" },
  deposit: { label: "Կանխավճար", cls: "pill-progress" },
  paid:    { label: "Վճարված է", cls: "pill-ready" },
};
function paymentPill(status){
  const known = PAYMENT_STATUS_MAP[(status || "unpaid").toLowerCase()] || PAYMENT_STATUS_MAP.unpaid;
  return `<span class="pill ${known.cls}"><span class="reg-mark"></span>${known.label}</span>`;
}

function fileTypeFromName(name){ return (name || "").split(".").pop().toLowerCase() || "file"; }
function isImageType(type){ return ["jpg","jpeg","png","webp","gif"].includes(type); }
function fileIcon(type){ return { pdf:"📄", ai:"🎨", cdr:"🖍", psd:"🖼", zip:"🗂", eps:"🎨", svg:"🖼" }[type] || "📁"; }
function initials(name){ return (name || "?").trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase()).join(""); }
function formatMoney(n){ return new Intl.NumberFormat("hy-AM").format(n || 0) + " դր."; }
function formatDate(d){ if (!d) return "—"; return new Date(d).toLocaleDateString("hy-AM", { day:"2-digit", month:"short", year:"numeric" }); }
function timeAgo(d){
  if (!d) return "—";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "հենց նոր";
  if (diff < 3600) return Math.floor(diff/60) + " րոպե առաջ";
  if (diff < 86400) return Math.floor(diff/3600) + " ժամ առաջ";
  return Math.floor(diff/86400) + " օր առաջ";
}

/* ---------- Activity log ---------- */
async function logActivity(action, targetTable, targetId){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;
  await supabaseClient.from("activity_log").insert({
    actor_id: session.user.id, action, target_table: targetTable, target_id: targetId,
  });
}

/* ---------- Generate + display an order number the moment a modal opens ---------- */
function ensureOrderNumber(form){
  // Once captured, ALWAYS return this same cached value for this form —
  // never re-read the live input again. This protects against any other
  // script on the page (e.g. a legacy "copy" button handler left over
  // from before this system existed) later overwriting the input's
  // displayed value after the real order number has already been set.
  if (form.dataset.gdOrderNumber) return form.dataset.gdOrderNumber;

  const idField = form.querySelector('input[name="order_number"], input[name="ID"]');
  let value = idField?.value?.trim();
  if (!value){
    // Each form carries its own prefix via data-prefix (e.g. "LTP" for
    // wide-format, "PLT" for plotter cutting) so order numbers stay
    // recognizable per service, matching the original numbering scheme.
    // Falls back to "GD" only if a form has no data-prefix set.
    const prefix = form.dataset.prefix || "GD";
    value = `${prefix}-` + Math.floor(100000 + Math.random() * 900000);
    if (idField) idField.value = value;
  }
  form.dataset.gdOrderNumber = value;
  return value;
}

/* ---------- Sidebar (mobile toggle) ---------- */
function initSidebar(){
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const menuToggle = document.getElementById("menu-toggle");
  if (menuToggle){
    menuToggle.addEventListener("click", () => sidebar.classList.toggle("mobile-open"));
    document.addEventListener("click", (e) => {
      if (sidebar.classList.contains("mobile-open") && !sidebar.contains(e.target) && !menuToggle.contains(e.target)){
        sidebar.classList.remove("mobile-open");
      }
    });
  }
}

/* ---------- Drawer ---------- */
function openDrawer(){
  document.getElementById("drawer-overlay")?.classList.add("open");
  document.getElementById("order-drawer")?.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeDrawer(){
  document.getElementById("drawer-overlay")?.classList.remove("open");
  document.getElementById("order-drawer")?.classList.remove("open");
  document.body.style.overflow = "";
}
function initDrawerCloseHandlers(){
  document.getElementById("drawer-overlay")?.addEventListener("click", closeDrawer);
  document.getElementById("drawer-close")?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
}

/* ---------- Drag & drop upload zone ---------- */
function initUploadZone(zoneEl, onFiles){
  if (!zoneEl) return;
  const input = zoneEl.querySelector("input[type=file]");
  zoneEl.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => onFiles(Array.from(input.files)));
  ["dragenter", "dragover"].forEach(evt => zoneEl.addEventListener(evt, (e) => { e.preventDefault(); zoneEl.classList.add("drag-over"); }));
  ["dragleave", "drop"].forEach(evt => zoneEl.addEventListener(evt, (e) => { e.preventDefault(); zoneEl.classList.remove("drag-over"); }));
  zoneEl.addEventListener("drop", (e) => { const files = Array.from(e.dataTransfer.files); if (files.length) onFiles(files); });
}

document.addEventListener("DOMContentLoaded", () => { initTheme(); initSidebar(); initDrawerCloseHandlers(); });

/* ---------- Notification center ---------- */
let GD_NOTIFICATIONS = [];
let GD_NOTIFICATION_PROFILE = null;
let GD_NOTIFICATION_CHANNEL = null;

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function notificationIcon(type){
  return ({
    manager_registration: "👤",
    manager_approved: "✅",
    manager_rejected: "⚠️",
    order: "🧾",
    message: "💬",
    info: "🔔"
  })[type] || "🔔";
}

function ensureNotificationCenter(){
  const topbar = document.querySelector(".topbar");
  if (!topbar || document.getElementById("notification-wrap")) return null;
  const theme = document.getElementById("theme-toggle");
  const wrap = document.createElement("div");
  wrap.id = "notification-wrap";
  wrap.className = "notification-wrap";
  wrap.innerHTML = `
    <button class="icon-btn" id="notification-toggle" type="button" title="Ծանուցումներ" aria-label="Ծանուցումներ" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span class="notification-badge" id="notification-badge">0</span>
    </button>
    <div class="notification-panel" id="notification-panel">
      <div class="notification-head"><strong>Ծանուցումներ</strong><button class="notification-mark-all" id="notification-mark-all" type="button">Նշել բոլորը կարդացված</button></div>
      <div class="notification-list" id="notification-list"><div class="notification-empty">Բեռնվում է...</div></div>
    </div>`;
  if (theme) topbar.insertBefore(wrap, theme); else topbar.appendChild(wrap);

  const toggle = wrap.querySelector("#notification-toggle");
  const panel = wrap.querySelector("#notification-panel");
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  panel.addEventListener("click", e => e.stopPropagation());
  document.addEventListener("click", () => { panel.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); });
  wrap.querySelector("#notification-mark-all").addEventListener("click", markAllNotificationsRead);
  return wrap;
}

function renderNotifications(){
  const list = document.getElementById("notification-list");
  const badge = document.getElementById("notification-badge");
  if (!list || !badge) return;
  const unread = GD_NOTIFICATIONS.filter(n => !n.is_read).length;
  badge.textContent = unread > 99 ? "99+" : String(unread);
  badge.classList.toggle("show", unread > 0);
  if (!GD_NOTIFICATIONS.length){
    list.innerHTML = '<div class="notification-empty">Նոր ծանուցումներ չկան</div>';
    return;
  }
  list.innerHTML = GD_NOTIFICATIONS.map(n => `
    <button type="button" class="notification-item ${n.is_read ? "" : "unread"}" data-notification-id="${escapeHtml(n.id)}" data-link="${escapeHtml(n.link || "")}">
      <div class="notification-item-title"><span>${notificationIcon(n.type)}</span><span>${escapeHtml(n.title)}</span></div>
      <div class="notification-item-message">${escapeHtml(n.message)}</div>
      <div class="notification-item-time">${escapeHtml(timeAgo(n.created_at))}</div>
    </button>`).join("");
  list.querySelectorAll("[data-notification-id]").forEach(el => el.addEventListener("click", async () => {
    const id = el.dataset.notificationId;
    const item = GD_NOTIFICATIONS.find(n => n.id === id);
    if (item && !item.is_read){
      item.is_read = true; renderNotifications();
      await supabaseClient.from("notifications").update({ is_read:true }).eq("id", id);
    }
    const link = el.dataset.link;
    if (link) window.location.href = link;
  }));
}

async function loadNotifications(){
  if (!GD_NOTIFICATION_PROFILE) return;
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("id,type,title,message,link,is_read,created_at")
    .eq("recipient_id", GD_NOTIFICATION_PROFILE.id)
    .order("created_at", { ascending:false })
    .limit(40);
  if (error){
    console.warn("Notifications unavailable:", error.message);
    const list = document.getElementById("notification-list");
    if (list) list.innerHTML = '<div class="notification-empty">Ծանուցումները դեռ կարգավորված չեն</div>';
    return;
  }
  GD_NOTIFICATIONS = data || [];
  renderNotifications();
}

async function markAllNotificationsRead(){
  if (!GD_NOTIFICATION_PROFILE) return;
  const unreadIds = GD_NOTIFICATIONS.filter(n => !n.is_read).map(n => n.id);
  if (!unreadIds.length) return;
  GD_NOTIFICATIONS.forEach(n => n.is_read = true);
  renderNotifications();
  const { error } = await supabaseClient.from("notifications").update({ is_read:true }).in("id", unreadIds);
  if (error) toast("Չհաջողվեց թարմացնել ծանուցումները", "error");
}

async function initNotifications(){
  if (!document.querySelector(".app-shell") || typeof getCurrentProfile !== "function") return;
  ensureNotificationCenter();
  const auth = await getCurrentProfile();
  if (!auth?.profile) return;
  GD_NOTIFICATION_PROFILE = auth.profile;
  await loadNotifications();

  // Instant updates when Realtime is enabled for notifications.
  try {
    GD_NOTIFICATION_CHANNEL = supabaseClient.channel("gd-notifications-" + auth.profile.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"notifications", filter:`recipient_id=eq.${auth.profile.id}` }, payload => {
        GD_NOTIFICATIONS.unshift(payload.new);
        GD_NOTIFICATIONS = GD_NOTIFICATIONS.slice(0, 40);
        renderNotifications();
      })
      .subscribe();
  } catch (_) {}

  // Also refresh on focus as a reliable fallback.
  window.addEventListener("focus", loadNotifications);
}

document.addEventListener("DOMContentLoaded", initNotifications);
