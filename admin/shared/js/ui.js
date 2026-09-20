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

function renderThemeToggle(theme){
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  toggle.innerHTML = `
    <svg class="gd-theme-sun" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path></svg>
    <svg class="gd-theme-moon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  toggle.setAttribute("aria-label", theme === "dark" ? "Անցնել ցերեկային ռեժիմի" : "Անցնել գիշերային ռեժիմի");
  toggle.title = theme === "dark" ? "Ցերեկային ռեժիմ" : "Գիշերային ռեժիմ";
}

function ensureThemeToggle(){
  let toggle = document.getElementById("theme-toggle");
  if (toggle) return toggle;
  const topbar = document.querySelector(".topbar");
  if (!topbar) return null;
  toggle = document.createElement("button");
  toggle.className = "icon-btn";
  toggle.id = "theme-toggle";
  toggle.type = "button";
  toggle.style.marginLeft = "auto";
  topbar.appendChild(toggle);
  return toggle;
}

function initTheme(){
  const saved = localStorage.getItem("gdprint-theme");
  const initial = saved === "light" || saved === "dark" ? saved : "light";
  document.documentElement.setAttribute("data-theme", initial);
  ensureThemeToggle();
  syncThemeLogo(initial);
  renderThemeToggle(initial);
  const toggle = document.getElementById("theme-toggle");
  if (toggle){
    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      renderThemeToggle(next);
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
function formatDate(d){ if (!d) return "—"; return new Intl.DateTimeFormat("hy-AM", { timeZone:"Asia/Yerevan", day:"2-digit", month:"short", year:"numeric" }).format(new Date(d)); }
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
  const appShell = sidebar.closest(".app-shell");
  let scrim = document.querySelector(".sidebar-scrim");
  if (!scrim){
    scrim = document.createElement("div");
    scrim.className = "sidebar-scrim";
    scrim.setAttribute("aria-hidden", "true");
  }
  // Keep the mobile scrim in the same stacking context as the sidebar.
  // If it lives directly under <body>, it can cover the entire .app-shell
  // (including the sidebar) even when the sidebar has a larger child z-index.
  if (appShell && scrim.parentElement !== appShell){
    appShell.appendChild(scrim);
  } else if (!appShell && !scrim.parentElement){
    document.body.appendChild(scrim);
  }
  const setOpen = (open) => {
    sidebar.classList.toggle("mobile-open", !!open);
    document.body.classList.toggle("sidebar-open", !!open);
    menuToggle?.setAttribute("aria-expanded", open ? "true" : "false");
  };
  if (menuToggle){
    menuToggle.setAttribute("aria-controls", "sidebar");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!sidebar.classList.contains("mobile-open"));
    });
  }
  scrim.addEventListener("click", () => setOpen(false));
  sidebar.querySelectorAll("a.nav-item").forEach(a => a.addEventListener("click", () => {
    if (window.innerWidth <= 860) setOpen(false);
  }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  window.addEventListener("resize", () => { if (window.innerWidth > 860) setOpen(false); });
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


function ensureStaffChrome(){
  const wrap=document.querySelector('.staff-wrap');
  if(!wrap || document.querySelector('.staff-global-topbar')) return;
  document.body.classList.add('staff-erp-page');

  const toolbar=document.querySelector('.staff-toolbar');
  if(toolbar && !toolbar.querySelector('.staff-sidebar-brand')){
    const brand=document.createElement('a');
    brand.className='staff-sidebar-brand';
    brand.href='dashboard.html';
    brand.setAttribute('aria-label','GDprint');
    brand.innerHTML=`<img class="theme-logo" data-theme-logo data-logo-light="../img/logo-light.png" data-logo-dark="../img/logo-light.png" src="../img/logo-light.png" alt="GDprint"><span>Staff Portal</span>`;
    toolbar.insertBefore(brand,toolbar.firstChild);
  }

  const top=document.createElement('header');
  top.className='topbar staff-global-topbar';
  const pageTitle=document.querySelector('.staff-head h1')?.textContent?.trim()||'Աշխատակցի էջ';
  top.innerHTML=`<button class="icon-btn staff-menu-toggle" id="staff-menu-toggle" type="button" aria-label="Բացել մենյուն">☰</button><div class="staff-global-page"><div class="page-title">${escapeHtml(pageTitle)}</div><div class="page-sub">GDprint Staff Portal</div></div><div class="staff-global-actions"><button class="icon-btn" id="theme-toggle" type="button" title="Փոխել թեման" aria-label="Փոխել թեման"><span class="gd-theme-sun">☀</span><span class="gd-theme-moon">☾</span></button></div>`;
  document.body.insertBefore(top,wrap);

  const menu=top.querySelector('#staff-menu-toggle');
  menu?.addEventListener('click',()=>{
    toolbar?.classList.toggle('staff-menu-open');
    document.body.classList.toggle('staff-menu-visible',toolbar?.classList.contains('staff-menu-open'));
  });
  document.addEventListener('click',(e)=>{
    if(window.innerWidth>860 || !toolbar?.classList.contains('staff-menu-open')) return;
    if(toolbar.contains(e.target) || menu?.contains(e.target)) return;
    toolbar.classList.remove('staff-menu-open');
    document.body.classList.remove('staff-menu-visible');
  });
}

document.addEventListener("DOMContentLoaded", () => { ensureStaffChrome(); initTheme(); initSidebar(); initDrawerCloseHandlers(); });

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
    staff_message: "💬",
    staff_update: "🛠",
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
  if (theme && theme.parentElement === topbar) topbar.insertBefore(wrap, theme);
  else if (theme && theme.closest(".staff-global-actions")?.parentElement === topbar) topbar.insertBefore(wrap, theme.closest(".staff-global-actions"));
  else topbar.appendChild(wrap);

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
  if (!(document.querySelector(".app-shell") || document.querySelector(".staff-wrap")) || typeof getCurrentProfile !== "function") return;
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


/* ============================================================
   GDprint v7.6.4 — Armenia time + end-of-day closure
   All staff/Admin/Manager timestamps are interpreted/displayed in Asia/Yerevan.
   ============================================================ */
const GD_TIME_ZONE = "Asia/Yerevan";

function gdDatePartsInYerevan(value){
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:GD_TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"
  }).formatToParts(d);
  return Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
}

function gdFormatDateTime(value){
  if(!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("hy-AM", {
    timeZone:GD_TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", hourCycle:"h23", hour12:false
  }).format(d);
}

function gdFormatTime(value){
  if(!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if(Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("hy-AM", {
    timeZone:GD_TIME_ZONE, hour:"2-digit", minute:"2-digit", hourCycle:"h23", hour12:false
  }).format(d);
}

function gdYerevanDateKey(value = new Date()){
  const p = gdDatePartsInYerevan(value);
  return p ? `${p.year}-${p.month}-${p.day}` : "";
}

function gdIsoToYerevanInput(value){
  if(!value) return "";
  const p = gdDatePartsInYerevan(value);
  return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` : "";
}

function gdYerevanInputToIso(value){
  if(!value) return null;
  // Armenia is UTC+04:00. datetime-local has no timezone, therefore bind it
  // explicitly to Yerevan before converting to the UTC timestamptz stored by Supabase.
  const normalized = String(value).length === 16 ? `${value}:00` : String(value);
  const d = new Date(`${normalized}+04:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

window.GD_TIME_ZONE = GD_TIME_ZONE;
window.gdFormatDateTime = gdFormatDateTime;
window.gdFormatTime = gdFormatTime;
window.gdYerevanDateKey = gdYerevanDateKey;
window.gdIsoToYerevanInput = gdIsoToYerevanInput;
window.gdYerevanInputToIso = gdYerevanInputToIso;

let GD_DAY_STATE = null;

function ensureDayCloseModal(){
  if(document.getElementById("gd-day-close-modal")) return;
  const modal=document.createElement("div");
  modal.id="gd-day-close-modal";
  modal.className="gd-day-modal";
  modal.setAttribute("aria-hidden","true");
  modal.innerHTML=`
    <div class="gd-day-card" role="dialog" aria-modal="true" aria-labelledby="gd-day-title">
      <div class="gd-day-head">
        <div><div class="gd-day-title" id="gd-day-title">Օրվա փակում</div><div class="gd-day-sub">Ժամային գոտի՝ Հայաստան · Asia/Yerevan · 24 ժամ</div></div>
        <button class="btn btn-ghost btn-sm" type="button" id="gd-day-x">Փակել</button>
      </div>
      <div class="gd-day-summary" id="gd-day-summary">Բեռնվում է…</div>
      <label class="gd-day-note">Օրվա ամփոփում / նշում (ըստ ցանկության)
        <textarea id="gd-day-note" rows="3" placeholder="Օրինակ՝ ընթացիկ աշխատանքները փոխանցված են հաջորդ օրվան"></textarea>
      </label>
      <div class="gd-day-warning" id="gd-day-warning"></div>
      <div class="gd-day-actions">
        <button class="btn btn-ghost" type="button" id="gd-day-cancel">Չեղարկել</button>
        <button class="btn btn-primary" type="button" id="gd-day-confirm">Փակել աշխատանքային օրը</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close=()=>{modal.classList.remove("open");modal.setAttribute("aria-hidden","true");};
  modal.addEventListener("click",e=>{if(e.target===modal)close();});
  modal.querySelector("#gd-day-x").addEventListener("click",close);
  modal.querySelector("#gd-day-cancel").addEventListener("click",close);
  modal.querySelector("#gd-day-confirm").addEventListener("click",gdConfirmDayClose);
}

function daySummaryHtml(s){
  return `<div class="gd-day-kpis">
    <div><span>Ավարտված այսօր</span><strong>${Number(s?.completed_today||0)}</strong></div>
    <div><span>Բաց աշխատանք</span><strong>${Number(s?.open_tasks||0)}</strong></div>
    <div><span>Ընթացքի մեջ</span><strong>${Number(s?.in_progress_tasks||0)}</strong></div>
  </div>`;
}

async function gdLoadDayState(){
  const {data,error}=await supabaseClient.rpc("staff_day_status");
  if(error){
    if(String(error.message||"").includes("staff_day_status")) console.warn("Run 046_yerevan_time_workday_close.sql");
    return null;
  }
  GD_DAY_STATE=data||{};
  renderDayCloseButton();
  return GD_DAY_STATE;
}

function renderDayCloseButton(){
  const btn=document.getElementById("gd-day-close-btn");
  if(!btn) return;
  if(GD_DAY_STATE?.is_closed){
    btn.classList.add("is-closed");
    btn.innerHTML=`<span class="gd-day-dot"></span><span>Օրը փակված է · ${GD_DAY_STATE.closed_time_yerevan||gdFormatTime(GD_DAY_STATE.closed_at)}</span>`;
    btn.title=`Փակվել է Հայաստանի ժամանակով ${GD_DAY_STATE.closed_time_yerevan||gdFormatTime(GD_DAY_STATE.closed_at)}`;
  }else{
    btn.classList.remove("is-closed");
    btn.innerHTML='<span class="gd-day-dot"></span><span>Փակել օրը</span>';
    btn.title="Փակել այսօրվա աշխատանքային օրը";
  }
}

async function gdOpenDayClose(){
  ensureDayCloseModal();
  const modal=document.getElementById("gd-day-close-modal");
  const summary=document.getElementById("gd-day-summary");
  const warning=document.getElementById("gd-day-warning");
  const confirm=document.getElementById("gd-day-confirm");
  modal.classList.add("open"); modal.setAttribute("aria-hidden","false");
  summary.textContent="Բեռնվում է…"; warning.textContent=""; confirm.disabled=true;
  const state=await gdLoadDayState();
  if(!state){
    summary.innerHTML='<div class="gd-day-error">Օրվա փակման համակարգը դեռ ակտիվ չէ։ Գործարկեք 046 migration-ը։</div>';
    return;
  }
  summary.innerHTML=daySummaryHtml(state);
  if(state.is_closed){
    warning.textContent=`Այս օրը արդեն փակված է ${state.closed_time_yerevan||gdFormatTime(state.closed_at)}-ին (Հայաստանի ժամանակով)։`;
    confirm.style.display="none";
  }else{
    confirm.style.display="inline-flex"; confirm.disabled=false;
    if(Number(state.in_progress_tasks||0)>0) warning.textContent=`Ուշադրություն․ ${state.in_progress_tasks} աշխատանք դեռ «Ընթացքի մեջ» է։ Օրը կարող եք փակել, իսկ աշխատանքը կմնա բաց։`;
    else if(Number(state.open_tasks||0)>0) warning.textContent=`Բաց մնացած ${state.open_tasks} աշխատանքը կպահպանվի և հասանելի կլինի հաջորդ աշխատանքային օրը։`;
  }
}

async function gdConfirmDayClose(){
  const btn=document.getElementById("gd-day-confirm");
  const note=document.getElementById("gd-day-note")?.value?.trim()||null;
  btn.disabled=true; btn.textContent="Փակվում է…";
  const {data,error}=await supabaseClient.rpc("staff_close_day",{p_note:note});
  if(error){ toast(error.message||"Օրը փակել չհաջողվեց","error"); btn.disabled=false;btn.textContent="Փակել աշխատանքային օրը";return; }
  GD_DAY_STATE={...(GD_DAY_STATE||{}),...(data||{}),is_closed:true};
  renderDayCloseButton();
  document.getElementById("gd-day-close-modal")?.classList.remove("open");
  toast(`Աշխատանքային օրը փակվեց ${data?.closed_time_yerevan||""} (Հայաստանի ժամանակով)`,`success`);
  btn.disabled=false; btn.textContent="Փակել աշխատանքային օրը";
}

async function initDayClose(){
  if(!(document.querySelector(".app-shell")||document.querySelector(".staff-wrap"))) return;
  const topbar=document.querySelector(".topbar");
  const staffHead=document.querySelector(".staff-head");
  if(!topbar&&!staffHead) return;
  if(document.getElementById("gd-day-close-btn")) return;
  const btn=document.createElement("button");
  btn.id="gd-day-close-btn";btn.type="button";btn.className="gd-day-close-btn";
  btn.innerHTML='<span class="gd-day-dot"></span><span>Փակել օրը</span>';
  btn.addEventListener("click",gdOpenDayClose);
  if(topbar){
    const theme=document.getElementById("theme-toggle");
    if(theme) theme.insertAdjacentElement("afterend",btn); else topbar.appendChild(btn);
  }else{
    const logout=staffHead.querySelector("[data-logout]");
    if(logout) staffHead.insertBefore(btn,logout); else staffHead.appendChild(btn);
  }
  await gdLoadDayState();
}

document.addEventListener("DOMContentLoaded",()=>setTimeout(initDayClose,60));
