let ALL_PARTNERS=[];

(async function(){
  const auth=await requireRole(["admin"]);
  if(!auth)return;
  document.getElementById("user-name").textContent=auth.profile.full_name||"Ադմին";
  document.getElementById("user-avatar").textContent=initials(auth.profile.full_name||"A");
  bindPartnerFilters();
  await loadPartners();
})();

async function loadPartners(){
  const host=document.getElementById("partners-content");
  host.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-muted)">Բեռնվում է...</div>';
  const {data,error}=await supabaseClient.rpc("admin_partner_applications");
  if(error){
    console.error("admin_partner_applications",error);
    host.innerHTML=`<div class="card glass"><b>Գործընկերների տվյալները չեն բեռնվել</b><div class="page-sub" style="margin-top:8px">${esc(error.message)}</div><div class="page-sub" style="margin-top:8px">Supabase-ում գործարկեք 041_partner_applications_sync_fix.sql migration-ը։</div></div>`;
    return;
  }
  ALL_PARTNERS=Array.isArray(data)?data:[];
  document.getElementById("partners-count-sub").textContent=`${ALL_PARTNERS.length} հայտ`;
  renderPartners();
}

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function fmtDate(v){try{return new Date(v).toLocaleString("hy-AM");}catch{return "—";}}
function fmtVolume(v){const n=Number(v);return Number.isFinite(n)&&n>0?`${n.toLocaleString("hy-AM")} մ²/ամիս`:"—";}

function renderPartners(){
  const q=(document.getElementById("partner-search")?.value||"").toLowerCase().trim();
  const f=document.getElementById("partner-filter")?.value||"";
  const rows=ALL_PARTNERS.filter(x=>(!f||x.status===f)&&(!q||[x.first_name,x.last_name,x.company,x.phone,x.email,x.tin,x.plan].some(v=>String(v||"").toLowerCase().includes(q))));
  const el=document.getElementById("partners-content");
  if(!rows.length){el.innerHTML='<div class="empty-state"><div class="e-title">Հայտեր չեն գտնվել</div></div>';return;}
  el.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px">${rows.map(p=>`<article class="card glass">
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
      <div><div class="card-title">${esc(((p.first_name||"")+" "+(p.last_name||"")).trim()||"Անանուն")}</div><div class="page-sub">${esc(p.company||"Առանց ընկերության")}</div></div>
      <span class="mono">${esc((p.plan||"").toUpperCase())}</span>
    </div>
    <div style="margin-top:14px;font-size:13px;line-height:1.8">
      <div>📞 ${esc(p.phone||"—")}</div><div>✉️ ${esc(p.email||"—")}</div>
      <div>🏢 ${esc(p.company_type||"—")} ${p.tin?"· ՀՎՀՀ "+esc(p.tin):""}</div>
      <div>📍 ${esc(p.address||"—")}</div>
      <div>📦 Ծավալ՝ ${esc(fmtVolume(p.expected_volume))}</div>
      <div>🌐 Լեզու՝ ${esc((p.language||"hy").toUpperCase())}${p.source?" · Աղբյուր՝ "+esc(p.source):""}</div>
      <div>🕒 ${esc(fmtDate(p.created_at))}</div>
      ${p.comments?`<div style="margin-top:8px;color:var(--text-muted)">${esc(p.comments)}</div>`:""}
    </div>
    <div style="margin-top:14px"><select class="partner-status" data-id="${p.id}" style="width:100%;padding:9px;border:1px solid var(--border);border-radius:8px;background:var(--surface-solid);color:var(--text)">${[["new","Նոր"],["contacted","Կապ հաստատված"],["approved","Հաստատված"],["rejected","Մերժված"]].map(([v,l])=>`<option value="${v}" ${p.status===v?"selected":""}>${l}</option>`).join("")}</select></div>
  </article>`).join("")}</div>`;
  el.querySelectorAll('.partner-status').forEach(s=>s.addEventListener('change',()=>updatePartnerStatus(s)));
}

async function updatePartnerStatus(sel){
  const p=ALL_PARTNERS.find(x=>String(x.id)===String(sel.dataset.id));
  const old=p?.status||"new";
  const {data,error}=await supabaseClient.rpc("admin_set_partner_application_status",{p_id:sel.dataset.id,p_status:sel.value});
  if(error||data!==true){toast("Չհաջողվեց՝ "+(error?.message||"անհայտ սխալ"),"error");sel.value=old;return;}
  if(p)p.status=sel.value;
  try{await logActivity(`Փոխեց գործընկերոջ հայտի կարգավիճակը՝ ${old} → ${sel.value}`,"partner_applications",sel.dataset.id);}catch{}
  toast("Կարգավիճակը պահպանված է ✓","success");
}

function bindPartnerFilters(){
  document.getElementById("partner-search")?.addEventListener("input",renderPartners);
  document.getElementById("partner-filter")?.addEventListener("change",renderPartners);
}
