/* ============================================================
   Admin Customers — list, search, per-customer order history
   ============================================================ */

let ALL_CUSTOMERS = [];
let ACTIVE_CUSTOMER_ID = null;

(async function init(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);

  await loadCustomers();
  document.getElementById("customer-search").addEventListener("input", renderCustomers);
  document.getElementById("delete-customer-btn")?.addEventListener("click", deleteActiveCustomerPermanently);
  document.getElementById("dc-save-crm")?.addEventListener("click", saveCustomerCrm);
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
  ACTIVE_CUSTOMER_ID = customerId;
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
  loadCustomerCrm(customerId);
  loadCustomerPayments(customerId);
}


function customerStoragePathFromPublicUrl(url, bucket){
  if (!url) return "";
  try{
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = url.indexOf(marker);
    if (i < 0) return "";
    return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  }catch(_){ return ""; }
}

async function collectCustomerStorageFiles(orderIds){
  const privatePaths = new Set();
  const legacyPublicPaths = new Set();
  if (!orderIds.length) return { privatePaths, legacyPublicPaths };

  // Chunk to keep PostgREST .in() URLs reasonably small.
  for (let i = 0; i < orderIds.length; i += 75){
    const chunk = orderIds.slice(i, i + 75);
    const [{data:files,error:fileErr},{data:proofs,error:proofErr}] = await Promise.all([
      supabaseClient.from("order_files").select("file_url,storage_path").in("order_id",chunk),
      supabaseClient.from("order_design_proofs").select("storage_path").in("order_id",chunk)
    ]);
    if (fileErr) throw fileErr;
    if (proofErr) throw proofErr;

    (files||[]).forEach(f=>{
      if (f.storage_path) privatePaths.add(f.storage_path);
      const p = customerStoragePathFromPublicUrl(f.file_url,"order-files");
      if (p) legacyPublicPaths.add(p);
    });
    (proofs||[]).forEach(p=>{ if (p.storage_path) privatePaths.add(p.storage_path); });
  }
  return { privatePaths, legacyPublicPaths };
}

async function deleteActiveCustomerPermanently(){
  const c = ALL_CUSTOMERS.find(x => x.id === ACTIVE_CUSTOMER_ID);
  if (!c) return;

  const label = c.email || c.phone || c.full_name || c.id;
  const typed = prompt(
    `Հաճախորդին ՎԵՐՋՆԱԿԱՆ ջնջելու համար գրեք ստորև նշված արժեքը՝\n${label}\n\n` +
    `Կջնջվեն նաև նրա բոլոր պատվերները, Customer App հաշիվը, հասցեները, ծանուցումները և կցված ֆայլերը։`
  );
  if (typed === null) return;
  if (String(typed).trim() !== String(label).trim()){
    toast("Հաստատման արժեքը չի համընկնում․ ջնջումը չեղարկվեց","error");
    return;
  }
  if (!confirm(`Վերջնական հաստատո՞ւմ եք «${c.full_name || label}» հաճախորդի ամբողջական ջնջումը։ Այս գործողությունը հետարկել հնարավոր չէ։`)) return;

  const btn = document.getElementById("delete-customer-btn");
  if (btn){ btn.disabled = true; btn.textContent = "Ջնջվում է…"; }

  try{
    const orderIds = (c.orders || []).map(o=>o.id).filter(Boolean);
    const {privatePaths,legacyPublicPaths} = await collectCustomerStorageFiles(orderIds);

    if (privatePaths.size){
      const {error} = await supabaseClient.storage.from("customer-order-files").remove([...privatePaths]);
      if (error) throw new Error(`customer-order-files Storage: ${error.message}`);
    }
    if (legacyPublicPaths.size){
      const {error} = await supabaseClient.storage.from("order-files").remove([...legacyPublicPaths]);
      if (error) throw new Error(`order-files Storage: ${error.message}`);
    }

    const {data:result,error} = await supabaseClient.rpc("admin_delete_customer_permanently",{
      p_customer_id:c.id
    });
    if (error) throw error;
    if (!result?.deleted) throw new Error("Հաճախորդի գրառումը չի ջնջվել");

    ACTIVE_CUSTOMER_ID = null;
    closeDrawer();
    toast(`${c.full_name || label} հաճախորդը ամբողջությամբ ջնջվեց`,"success");
    await loadCustomers();
  }catch(err){
    console.error("delete customer failed:",err);
    toast(`Չհաջողվեց ջնջել հաճախորդին${err?.message ? ": " + err.message : ""}`,"error");
  }finally{
    if (btn){ btn.disabled = false; btn.textContent = "Ջնջել հաճախորդին"; }
  }
}

async function loadCustomerCrm(customerId){
 const el=document.getElementById('dc-crm-history'); if(!el)return;
 const {data,error}=await supabaseClient.from('customer_crm_notes').select('*,profiles:created_by(full_name)').eq('customer_id',customerId).order('created_at',{ascending:false});
 if(error){el.innerHTML=`<div class="page-sub">CRM migration 034-ը դեռ գործարկված չէ կամ սխալ՝ ${escapeHtml(error.message)}</div>`;return;}
 el.innerHTML=(data||[]).length?(data||[]).map(x=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)"><b>${escapeHtml(x.kind)}</b>${x.discount_value!=null?` · ${formatMoney(x.discount_value)}`:''}<div>${escapeHtml(x.note)}</div><small class="page-sub">${escapeHtml(x.profiles?.full_name||'—')} · ${formatDate(x.created_at)}</small></div>`).join(''):'<div class="page-sub">CRM գրառումներ չկան</div>';
}
async function saveCustomerCrm(){
 if(!ACTIVE_CUSTOMER_ID)return; const note=document.getElementById('dc-crm-note').value.trim(); if(!note){toast('Գրեք նշումը','error');return;}
 const {data:{user}}=await supabaseClient.auth.getUser(); const kind=document.getElementById('dc-crm-kind').value; const discount=Number(document.getElementById('dc-discount').value||0);
 const {error}=await supabaseClient.from('customer_crm_notes').insert({customer_id:ACTIVE_CUSTOMER_ID,kind,note,discount_value:kind==='discount'?discount:null,created_by:user.id});
 if(error){toast(error.message,'error');return;} document.getElementById('dc-crm-note').value=''; toast('CRM գրառումը պահպանվեց','success'); loadCustomerCrm(ACTIVE_CUSTOMER_ID);
}
async function loadCustomerPayments(customerId){
 const el=document.getElementById('dc-payments-history'); if(!el)return; const c=ALL_CUSTOMERS.find(x=>x.id===customerId); const ids=(c?.orders||[]).map(x=>x.id);
 if(!ids.length){el.innerHTML='<div class="page-sub">Վճարումներ չկան</div>';return;}
 const {data,error}=await supabaseClient.from('finance_transactions').select('*').in('order_id',ids).in('kind',['payment','refund']).order('created_at',{ascending:false});
 if(error){el.innerHTML='<div class="page-sub">Վճարումների ledger-ը հասանելի չէ</div>';return;}
 el.innerHTML=(data||[]).length?(data||[]).map(x=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)"><span>${escapeHtml(x.kind)} · ${escapeHtml(x.method||'—')}</span><b>${formatMoney(x.amount)}</b></div>`).join(''):'<div class="page-sub">Վճարումների գրառում չկա</div>';
}
