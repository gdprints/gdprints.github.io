/* ============================================================
   Admin Managers — per-manager stats + editable commission/target
   Admin has full RLS access to all orders, so stats are computed
   directly here (no need for the leaderboard RPC, which is for
   managers who can't see each other's raw orders).
   ============================================================ */

let ALL_MANAGERS = [];
let ALL_ORDERS = [];

(async function init(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);

  await loadData();
})();

async function loadData(){
  const [{ data: managers, error: mErr }, { data: orders, error: oErr }] = await Promise.all([
    supabaseClient.from("profiles").select("*").eq("role", "manager").order("full_name"),
    supabaseClient.from("orders").select("*").not("created_by_manager_id", "is", null),
  ]);

  if (mErr || oErr){
    console.error(mErr || oErr);
    document.getElementById("managers-content").innerHTML = `<div style="text-align:center; padding:60px; color:var(--text-muted);">Չհաջողվեց բեռնել՝ ${(mErr||oErr).message}</div>`;
    return;
  }
  ALL_MANAGERS = managers || [];
  ALL_ORDERS = orders || [];
  document.getElementById("managers-count-sub").textContent = `${ALL_MANAGERS.length} մենեջեր`;
  render();
}

function computeEarning(order, commissionPercent){
  if (order.cost_amount == null || order.payment_status !== "paid") return null;
  const profit = (Number(order.total_amount) || 0) - Number(order.cost_amount);
  return Math.max(0, profit) * (commissionPercent / 100);
}

function approvalMeta(status){
  const s = status || "pending";
  if (s === "approved") return { label: "Հաստատված", cls: "pill-ready" };
  if (s === "rejected") return { label: "Մերժված", cls: "pill-cancelled" };
  return { label: "Սպասում է հաստատման", cls: "pill-progress" };
}

function render(){
  const container = document.getElementById("managers-content");
  if (!ALL_MANAGERS.length){
    container.innerHTML = `<div class="empty-state"><div class="e-title">Դեռ մենեջեր չկա</div><div>Մենեջերները ինքնուրույն կգրանցվեն register.html-ից</div></div>`;
    return;
  }

  const today = new Date().toDateString();
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px,1fr)); gap:18px;">
    ${ALL_MANAGERS.map(m => {
      const myOrders = ALL_ORDERS.filter(o => o.created_by_manager_id === m.id);
      const todayOrders = myOrders.filter(o => new Date(o.created_at).toDateString() === today);
      const monthOrders = myOrders.filter(o => new Date(o.created_at).getMonth() === thisMonth && new Date(o.created_at).getFullYear() === thisYear);
      const monthRevenue = monthOrders.filter(o => o.status !== "cancelled").reduce((s,o) => s + (Number(o.total_amount)||0), 0);
      const commission = Number(m.commission_percent) || 10;
      const todayEarning = todayOrders.reduce((s,o) => s + (computeEarning(o, commission) || 0), 0);
      const monthEarning = monthOrders.reduce((s,o) => s + (computeEarning(o, commission) || 0), 0);
      const target = Number(m.monthly_target) || 0;
      const pct = target > 0 ? Math.min(100, Math.round((monthEarning/target)*100)) : 0;
      const approval = approvalMeta(m.approval_status);

      return `
      <div class="card glass" data-manager-id="${m.id}">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <div class="avatar" style="width:44px; height:44px; font-size:15px;">${initials(m.full_name)}</div>
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <div style="font-weight:700; font-size:15px;">${m.full_name || "—"}</div>
              <span class="pill ${approval.cls}" style="font-size:10.5px;"><span class="reg-mark"></span>${approval.label}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); overflow-wrap:anywhere;">${m.phone || "—"} · ${m.email || "—"}</div>
          </div>
        </div>

        ${m.approval_status !== "approved" ? `
        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button class="btn btn-primary btn-sm m-approve" data-id="${m.id}" style="flex:1;">✓ Հաստատել</button>
          ${m.approval_status !== "rejected" ? `<button class="btn btn-ghost btn-sm m-reject" data-id="${m.id}" style="flex:1;">Մերժել</button>` : `<button class="btn btn-ghost btn-sm m-approve" data-id="${m.id}" style="flex:1;">Վերահաստատել</button>`}
        </div>` : ''}
        <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
          <span class="pill ${m.account_status === 'blocked' ? 'pill-cancelled' : 'pill-ready'}" style="margin-right:auto;">${m.account_status === 'blocked' ? 'Արգելափակված' : 'Ակտիվ'}</span>
          <button class="btn btn-ghost btn-sm m-block" data-id="${m.id}" data-block="${m.account_status !== 'blocked'}">${m.account_status === 'blocked' ? 'Ապաարգելափակել' : 'Արգելափակել'}</button>
          <button class="btn btn-ghost btn-sm m-delete" data-id="${m.id}" style="color:var(--danger);">Ջնջել հաշիվը</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
          <div><div class="stat-label">Այսօր</div><div style="font-weight:700; font-size:16px;">${todayOrders.length} պատվեր</div></div>
          <div><div class="stat-label">Այս ամիս</div><div style="font-weight:700; font-size:16px;">${monthOrders.length} պատվեր</div></div>
          <div><div class="stat-label">Ապահովված եկամուտ (ամիս)</div><div style="font-weight:700; font-size:14px;" class="mono">${formatMoney(monthRevenue)}</div></div>
          <div><div class="stat-label">Իր վաստակը (ամիս)</div><div style="font-weight:700; font-size:14px; color:var(--success);" class="mono">${formatMoney(monthEarning)}</div></div>
        </div>
        <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:14px;">Այսօրվա վաստակը՝ <span class="mono" style="color:var(--success);">${formatMoney(todayEarning)}</span></div>

        <div style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
            <span>Ամսական վաստակի նպատակ</span><span class="mono" style="color:var(--text-muted);">${pct}%</span>
          </div>
          <div style="height:8px; border-radius:999px; background:var(--surface-solid); overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:linear-gradient(135deg, var(--ink-cyan), var(--ink-magenta)); border-radius:999px;"></div>
          </div>
        </div>

        <div class="field-row" style="margin-bottom:8px;">
          <div class="field" style="margin-bottom:0;"><label>Commission %</label><input type="number" class="m-commission" value="${commission}" min="0" max="100" step="0.5"></div>
          <div class="field" style="margin-bottom:0;"><label>Ամսական վաստակի նպատակ (դր.)</label><input type="number" class="m-target" value="${target}" min="0" step="1000"></div>
        </div>
        <button class="btn btn-ghost btn-sm btn-block m-save" data-id="${m.id}">Պահպանել</button>
      </div>`;
    }).join("")}
  </div>`;

  container.querySelectorAll(".m-save").forEach(btn => {
    btn.addEventListener("click", () => saveManagerSettings(btn));
  });
  container.querySelectorAll(".m-approve").forEach(btn => {
    btn.addEventListener("click", () => changeApproval(btn, "approved"));
  });
  container.querySelectorAll(".m-reject").forEach(btn => {
    btn.addEventListener("click", () => changeApproval(btn, "rejected"));
  });
  container.querySelectorAll(".m-block").forEach(btn => btn.addEventListener("click", () => toggleBlock(btn)));
  container.querySelectorAll(".m-delete").forEach(btn => btn.addEventListener("click", () => deleteManager(btn)));
}

async function changeApproval(btn, action){
  const managerId = btn.dataset.id;
  const manager = ALL_MANAGERS.find(x => x.id === managerId);
  if (!manager) return;

  const label = action === "approved" ? "Հաստատվում է..." : "Մերժվում է...";
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;

  try {
    // IMPORTANT: approval itself is done by a SECURITY DEFINER RPC.
    // Therefore it does not depend on an Edge Function / Resend being configured.
    const { data, error } = await supabaseClient.rpc("set_manager_approval", {
      p_manager_id: managerId,
      p_status: action
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Գործողությունը չհաջողվեց");

    manager.approval_status = action;
    const verb = action === "approved" ? "հաստատված է" : "մերժված է";

    // Email is best-effort and intentionally independent from approval.
    // If the function is not deployed or email secrets are missing, approval still succeeds.
    let emailSent = false;
    let emailWarning = "";
    try {
      const { data: mailData, error: mailError } = await supabaseClient.functions.invoke("manager-email", {
        body: { manager_id: managerId, action }
      });
      if (mailError) throw mailError;
      emailSent = !!mailData?.email_sent;
      if (!emailSent) emailWarning = mailData?.error || "Email-ը չի ուղարկվել";
    } catch (mailErr) {
      console.warn("Manager email warning:", mailErr);
      emailWarning = mailErr?.message || String(mailErr);
    }

    if (emailSent) {
      toast(`${manager.full_name || "Մենեջերը"} ${verb} ✓ Ողջույնի նամակն ուղարկվել է`, "success");
    } else {
      toast(`${manager.full_name || "Մենեջերը"} ${verb} ✓ Email-ը չի ուղարկվել${emailWarning ? ": " + emailWarning : ""}`, "info");
    }
    render();
  } catch (err) {
    console.error("Manager approval error:", err);
    const msg = err?.message || String(err);
    const hint = /set_manager_approval|function.*does not exist|schema cache/i.test(msg)
      ? " — Supabase-ում Run արա supabase/003_manager_approval_rpc.sql ֆայլը"
      : "";
    toast("Չհաջողվեց հաստատել՝ " + msg + hint, "error");
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

async function saveManagerSettings(btn){
  const card = btn.closest("[data-manager-id]");
  const managerId = btn.dataset.id;
  const commission = Number(card.querySelector(".m-commission").value) || 0;
  const target = Number(card.querySelector(".m-target").value) || 0;

  btn.disabled = true; btn.textContent = "Պահպանվում է...";
  const { error } = await supabaseClient.from("profiles").update({ commission_percent: commission, monthly_target: target }).eq("id", managerId);
  btn.disabled = false; btn.textContent = "Պահպանել";

  if (error){ toast("Չհաջողվեց՝ " + error.message, "error"); return; }
  const m = ALL_MANAGERS.find(x => x.id === managerId);
  logActivity(`Փոխեց ${m?.full_name || "մենեջերի"} commission-ը (${commission}%) և անձնական վաստակի նպատակը (${formatMoney(target)})`, "profiles", managerId);
  if (m){ m.commission_percent = commission; m.monthly_target = target; }
  toast("Պահպանված է ✓", "success");
  render();
}


async function toggleBlock(btn){
  const id=btn.dataset.id, blocked=btn.dataset.block==='true';
  const m=ALL_MANAGERS.find(x=>x.id===id); if(!m)return;
  if(!confirm(`${blocked?'Արգելափակե՞լ':'Ապաարգելափակե՞լ'} ${m.full_name||'մենեջերի'} հաշիվը։`)) return;
  btn.disabled=true;
  const {data,error}=await supabaseClient.rpc('set_manager_blocked',{p_manager_id:id,p_blocked:blocked});
  if(error){toast('Չհաջողվեց՝ '+error.message,'error');btn.disabled=false;return;}
  m.account_status=blocked?'blocked':'active'; toast(blocked?'Հաշիվը արգելափակված է':'Հաշիվը ակտիվացված է','success'); render();
}
async function deleteManager(btn){
  const id=btn.dataset.id, m=ALL_MANAGERS.find(x=>x.id===id); if(!m)return;
  if(!confirm(`ՎԵՐՋՆԱԿԱՆ ջնջե՞լ ${m.full_name||m.email} հաշիվը։ Այս գործողությունը կջնջի նաև Supabase Auth user-ը և հետադարձելի չէ։`)) return;
  const typed=prompt('Հաստատելու համար գրիր DELETE'); if(typed!=='DELETE') return;
  btn.disabled=true;
  const {data,error}=await supabaseClient.rpc('delete_manager_account',{p_manager_id:id});
  if(error){toast('Չհաջողվեց ջնջել՝ '+error.message,'error');btn.disabled=false;return;}
  ALL_MANAGERS=ALL_MANAGERS.filter(x=>x.id!==id); toast('Մենեջերի հաշիվը ամբողջությամբ ջնջված է','success'); render();
}
