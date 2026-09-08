const SETTINGS_DEFAULTS = {
  company_name: "GDprint",
  support_phone: "",
  support_email: "",
  currency: "AMD",
  order_prefix: "GD",
  default_order_status: "pending",
  allow_manager_order_creation: true,
  default_commission_percent: 10,
  default_monthly_target: 0,
  maintenance_mode: false,
  order_notifications: true,
};

(async function initSettings(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);
  await loadSettings();
})();

function setStatus(text, type=""){
  const el = document.getElementById("settings-status");
  el.textContent = text;
  el.style.color = type === "error" ? "var(--danger)" : type === "success" ? "var(--success)" : "var(--text-muted)";
}
function setField(key, value){
  const el = document.getElementById(key); if (!el) return;
  if (el.type === "checkbox") el.checked = Boolean(value); else el.value = value ?? "";
}
function getField(key){
  const el = document.getElementById(key);
  if (el.type === "checkbox") return el.checked;
  if (el.type === "number") return Number(el.value) || 0;
  return el.value.trim();
}
async function loadSettings(){
  setStatus("Բեռնվում է...");
  const { data, error } = await supabaseClient.from("app_settings").select("key,value");
  if (error){
    console.error(error);
    Object.entries(SETTINGS_DEFAULTS).forEach(([k,v]) => setField(k,v));
    setStatus("Չհաջողվեց բեռնել app_settings-ը։ Կիրառեք ներառված Supabase SQL migration-ը։", "error");
    return;
  }
  const values = { ...SETTINGS_DEFAULTS };
  (data || []).forEach(row => { if (row.key in values) values[row.key] = row.value; });
  Object.entries(values).forEach(([k,v]) => setField(k,v));
  setStatus("Բեռնված է");
}

document.getElementById("settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = document.getElementById("save-settings-btn");
  btn.disabled = true; btn.textContent = "Պահպանվում է...";
  const rows = Object.keys(SETTINGS_DEFAULTS).map(key => ({ key, value: getField(key) }));
  const { error } = await supabaseClient.from("app_settings").upsert(rows, { onConflict: "key" });
  btn.disabled = false; btn.textContent = "Պահպանել կարգավորումները";
  if (error){ console.error(error); setStatus("Սխալ՝ " + error.message, "error"); return; }
  await logActivity("Թարմացրեց համակարգի կարգավորումները", "app_settings", null);
  setStatus("Պահպանված է ✓", "success"); toast("Կարգավորումները պահպանված են ✓", "success");
});

document.getElementById("reset-settings-btn").addEventListener("click", () => {
  Object.entries(SETTINGS_DEFAULTS).forEach(([k,v]) => setField(k,v));
  setStatus("Լռելյայն արժեքները դրված են․ սեղմեք «Պահպանել»։");
});
