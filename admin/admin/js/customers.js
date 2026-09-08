/* ============================================================
   Admin Customers — list, search, per-customer order history
   ============================================================ */

let ALL_CUSTOMERS = [];

(async function init(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);

  await loadCustomers();
  document.getElementById("customer-search").addEventListener("input", renderCustomers);
})();

async function loadCustomers(){
  const { data, error } = await supabaseClient
    .from("customers")
    .select("*, orders(id, order_number, service_name, total_amount, payment_status, status, created_at)")
    .order("created_at", { ascending: false });

  if (error){
    console.error(error);
    document.getElementById("customers-body").innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;">Հաճախորդներ չկան, կամ սխալ՝ ${error.message}</td></tr>`;
    return;
  }
  ALL_CUSTOMERS = data || [];
  renderCustomers();
}

function totalPaid(customer){
  return (customer.orders || []).filter(o => o.payment_status === "paid").reduce((s,o) => s + (Number(o.total_amount)||0), 0);
}

function renderCustomers(){
  const search = document.getElementById("customer-search").value.trim().toLowerCase();
  let list = ALL_CUSTOMERS;
  if (search){
    list = list.filter(c =>
      c.full_name?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search)
    );
  }

  document.getElementById("customers-count-sub").textContent = `${list.length} հաճախորդ`;
  const body = document.getElementById("customers-body");
  if (!list.length){
    body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;">Հաճախորդներ չեն գտնվել</td></tr>`;
    return;
  }

  body.innerHTML = list.map(c => `
    <tr onclick='openCustomerDrawer("${c.id}")'>
      <td><div class="cell-customer"><div class="avatar">${initials(c.full_name)}</div><span>${c.full_name || "—"}</span></div></td>
      <td class="mono">${c.phone || "—"}</td>
      <td>${c.email || "—"}</td>
      <td class="mono">${(c.orders || []).length}</td>
      <td class="mono">${formatMoney(totalPaid(c))}</td>
      <td class="mono" style="color:var(--text-muted);">${formatDate(c.created_at)}</td>
    </tr>
  `).join("");
}

function openCustomerDrawer(customerId){
  const c = ALL_CUSTOMERS.find(x => x.id === customerId);
  if (!c) return;

  document.getElementById("drawer-customer-name").textContent = c.full_name || "—";
  document.getElementById("drawer-customer-sub").textContent = `${(c.orders||[]).length} պատվեր · ${formatMoney(totalPaid(c))} վճարված`;
  document.getElementById("dc-phone").value = c.phone || "—";
  document.getElementById("dc-email").value = c.email || "—";

  const orders = [...(c.orders || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  const body = document.getElementById("dc-orders-body");
  body.innerHTML = orders.length
    ? orders.map(o => `
      <tr>
        <td class="mono">${o.order_number}</td>
        <td>${o.service_name || "—"}</td>
        <td class="mono">${formatMoney(o.total_amount)}</td>
        <td>${paymentPill(o.payment_status)}</td>
        <td>${statusPill(o.status)}</td>
        <td class="mono" style="color:var(--text-muted);">${formatDate(o.created_at)}</td>
      </tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Պատվերներ չկան</td></tr>`;

  openDrawer();
}
