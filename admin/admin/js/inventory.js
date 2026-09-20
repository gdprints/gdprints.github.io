let INVENTORY_ITEMS=[];
let INVENTORY_RULES=[];
let INVENTORY_ALLOCATIONS=[];
const UNIT_LABELS={piece:"հատ",box:"տուփ",roll:"ռուլոն",meter:"մետր",sqm:"մ²"};
const PURPOSE_LABELS={printing:"Տպագրություն",plotter:"Պլոտերային հատում",both:"Տպագրություն + պլոտեր"};
const RULE_STATUS_LABELS={reserved:"Պահուստ",shortage:"Պակաս",consumed:"Ելք",released:"Ազատված"};
const CALC_LABELS={quantity:"Քանակ × գործակից",area:"Մակերես × քանակ",fixed:"Ֆիքսված"};
const STAGE_LABELS={prepress:"Prepress",digital_print:"Digital Print",large_format:"Large Format",finishing:"Finishing",quality_control:"Quality Control",packing:"Packing",delivery:"Delivery"};
function invMoney(v){return `${Math.round(Number(v||0)).toLocaleString("hy-AM")} AMD`;}
function invNum(v){const n=Number(v||0);return Number.isInteger(n)?String(n):n.toLocaleString("hy-AM",{maximumFractionDigits:3});}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function modalOpen(id){document.getElementById(id)?.classList.add("open");document.body.style.overflow="hidden";}
function modalClose(id){document.getElementById(id)?.classList.remove("open");document.body.style.overflow="";}
function reservedForItem(id){return INVENTORY_ALLOCATIONS.filter(a=>a.item_id===id&&["reserved","shortage"].includes(a.status)).reduce((s,a)=>s+Number(a.reserved_quantity||0),0);}
function itemById(id){return INVENTORY_ITEMS.find(x=>x.id===id);}

window.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".inv-modal-backdrop.open").forEach(m=>modalClose(m.id));});

document.addEventListener("DOMContentLoaded",async()=>{
  const auth=await requireRole(["admin"]); if(!auth)return;
  if(document.getElementById("user-name"))document.getElementById("user-name").textContent=auth.profile.full_name||"Ադմին";
  if(document.getElementById("user-avatar"))document.getElementById("user-avatar").textContent=(auth.profile.full_name||"A").trim().charAt(0).toUpperCase();

  document.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>modalClose(b.dataset.closeModal)));
  document.querySelectorAll(".inv-modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)modalClose(m.id);}));
  document.getElementById("add-material-btn")?.addEventListener("click",openNewMaterial);
  document.getElementById("material-form")?.addEventListener("submit",saveMaterial);
  document.getElementById("movement-form")?.addEventListener("submit",saveMovement);
  document.getElementById("refresh-inventory")?.addEventListener("click",loadInventory);
  document.getElementById("inventory-search")?.addEventListener("input",renderInventory);
  document.getElementById("inventory-unit-filter")?.addEventListener("change",renderInventory);
  document.getElementById("inventory-stock-filter")?.addEventListener("change",renderInventory);
  document.getElementById("inventory-purpose-filter")?.addEventListener("change",renderInventory);
  document.getElementById("add-rule-btn")?.addEventListener("click",openNewRule);
  document.getElementById("rule-form")?.addEventListener("submit",saveRule);
  document.getElementById("refresh-allocations")?.addEventListener("click",loadAllocations);
  await loadInventory();
});

async function loadInventory(){
  const body=document.getElementById("inventory-body");
  body.innerHTML='<tr><td colspan="7" class="inv-empty">Բեռնվում է…</td></tr>';
  const [itemsRes,allocRes,rulesRes]=await Promise.all([
    supabaseClient.from("inventory_items").select("*").order("name",{ascending:true}),
    supabaseClient.from("order_inventory_allocations").select("*,orders(order_number,service_name,workflow_stage,status),inventory_items(name,size,unit),service_inventory_rules(label,consume_stage)").order("created_at",{ascending:false}).limit(100),
    supabaseClient.from("service_inventory_rules").select("*").order("service_key").order("match_value")
  ]);
  if(itemsRes.error){console.error(itemsRes.error);body.innerHTML='<tr><td colspan="7" class="inv-empty">Պահեստը չի բեռնվում։ Ստուգեք Supabase migration-ները։</td></tr>';return;}
  INVENTORY_ITEMS=itemsRes.data||[];
  if(allocRes.error){
    console.warn("Inventory automation not ready:",allocRes.error);
    INVENTORY_ALLOCATIONS=[];
    document.getElementById("inventory-allocations-list").innerHTML='<div class="inv-empty">Ավտոմատացումը դեռ ակտիվացված չէ։ Գործարկեք 043 migration-ը։</div>';
  }else INVENTORY_ALLOCATIONS=allocRes.data||[];
  if(rulesRes.error){
    console.warn("Inventory rules not ready:",rulesRes.error);
    INVENTORY_RULES=[];
    document.getElementById("inventory-rules-list").innerHTML='<div class="inv-empty">Կանոնները հասանելի չեն։ Գործարկեք 043 migration-ը։</div>';
  }else INVENTORY_RULES=rulesRes.data||[];
  renderStats();renderInventory();renderRules();renderAllocations();fillRuleItemOptions();
}

async function loadAllocations(){
  const box=document.getElementById("inventory-allocations-list");
  box.innerHTML='<div class="inv-empty">Բեռնվում է…</div>';
  const {data,error}=await supabaseClient.from("order_inventory_allocations")
    .select("*,orders(order_number,service_name,workflow_stage,status),inventory_items(name,size,unit),service_inventory_rules(label,consume_stage)")
    .order("created_at",{ascending:false}).limit(100);
  if(error){box.innerHTML=`<div class="inv-empty">${esc(error.message)}</div>`;return;}
  INVENTORY_ALLOCATIONS=data||[];renderStats();renderInventory();renderAllocations();
}

function renderStats(){
  const cost=INVENTORY_ITEMS.reduce((s,x)=>s+Number(x.quantity||0)*Number(x.cost_price||0),0);
  const sale=INVENTORY_ITEMS.reduce((s,x)=>s+Number(x.quantity||0)*Number(x.sale_price||0),0);
  const low=INVENTORY_ITEMS.filter(x=>Math.max(0,Number(x.quantity||0)-reservedForItem(x.id))<=Number(x.min_stock||0)).length;
  const reserved=INVENTORY_ALLOCATIONS.filter(a=>["reserved","shortage"].includes(a.status)).reduce((s,a)=>s+Number(a.reserved_quantity||0),0);
  document.getElementById("inv-stat-items").textContent=INVENTORY_ITEMS.length;
  document.getElementById("inv-stat-cost").textContent=invMoney(cost);
  document.getElementById("inv-stat-sale").textContent=invMoney(sale);
  document.getElementById("inv-stat-margin").textContent=invMoney(sale-cost);
  document.getElementById("inv-stat-low").textContent=low;
  const r=document.getElementById("inv-stat-reserved");if(r)r.textContent=invNum(reserved);
}

function renderInventory(){
  const q=(document.getElementById("inventory-search")?.value||"").trim().toLowerCase();
  const unit=document.getElementById("inventory-unit-filter")?.value||"";
  const stock=document.getElementById("inventory-stock-filter")?.value||"";
  const purpose=document.getElementById("inventory-purpose-filter")?.value||"";
  const rows=INVENTORY_ITEMS.filter(x=>{
    const hay=[x.name,x.material_type,x.size,x.category,x.supplier,x.color,PURPOSE_LABELS[x.purpose]].join(" ").toLowerCase();
    if(q&&!hay.includes(q))return false;if(unit&&x.unit!==unit)return false;if(purpose&&x.purpose!==purpose)return false;
    const available=Math.max(0,Number(x.quantity||0)-reservedForItem(x.id)),min=Number(x.min_stock||0);
    if(stock==="low"&&!(available<=min))return false;if(stock==="out"&&available!==0)return false;if(stock==="ok"&&!(available>min))return false;
    return true;
  });
  const body=document.getElementById("inventory-body");
  if(!rows.length){body.innerHTML='<tr><td colspan="7" class="inv-empty">Նյութ չի գտնվել</td></tr>';return;}
  body.innerHTML=rows.map(x=>{
    const qty=Number(x.quantity||0),reserved=reservedForItem(x.id),available=Math.max(0,qty-reserved),min=Number(x.min_stock||0),stateClass=available===0?"inv-out":available<=min?"inv-low":"inv-good";
    const stateText=available===0?"Հասանելի չկա":available<=min?"Քիչ հասանելի":"Հասանելի";
    const stockCost=qty*Number(x.cost_price||0);
    return `<tr>
    <td><div class="inv-material-name">${esc(x.name)}</div><div class="inv-muted">${esc(x.category||"Առանց կատեգորիայի")}${x.color?` · ${esc(x.color)}`:""}${x.purpose?` · ${esc(PURPOSE_LABELS[x.purpose]||x.purpose)}`:""}${x.supplier?` · ${esc(x.supplier)}`:""}</div></td>
    <td><div>${esc(x.material_type)}</div><div class="inv-muted">${esc(x.size)}${x.roll_width_m?` · լայն. ${invNum(x.roll_width_m)}մ`:""}${x.roll_length_m?` · ռուլոն ${invNum(x.roll_length_m)}մ`:""}</div></td>
    <td><div class="${stateClass}">Հասանելի՝ ${invNum(available)} ${UNIT_LABELS[x.unit]||esc(x.unit)}</div><div class="inv-available">Ֆիզիկական՝ <strong>${invNum(qty)}</strong> · պահուստ՝ <strong>${invNum(reserved)}</strong> · նվազ. ${invNum(x.min_stock||0)}</div><div class="inv-muted">${stateText}</div></td>
    <td><div class="inv-price-main">${invMoney(x.cost_price)}</div><div class="inv-price-sub">1 ${UNIT_LABELS[x.unit]||x.unit}</div></td>
    <td><div class="inv-price-main">${invMoney(x.sale_price)}</div><div class="inv-price-sub">1 ${UNIT_LABELS[x.unit]||x.unit}</div></td>
    <td><div class="inv-price-main">${invMoney(stockCost)}</div><div class="inv-price-sub">ինքնարժեքով</div></td>
    <td><div class="inv-actions">
    <button class="inv-mini-btn in" onclick="openMovement('${x.id}','in')">+ Մուտք</button>
    <button class="inv-mini-btn out" onclick="openMovement('${x.id}','out')">− Ելք</button>
    <button class="inv-mini-btn" onclick="openHistory('${x.id}')">Պատմություն</button>
    <button class="inv-mini-btn" onclick="openEditMaterial('${x.id}')">Խմբագրել</button>
    <button class="inv-mini-btn danger" onclick="deleteMaterial('${x.id}')">Ջնջել</button>
    </div></td></tr>`;
  }).join("");
}

function renderRules(){
  const box=document.getElementById("inventory-rules-list");if(!box)return;
  if(!INVENTORY_RULES.length){box.innerHTML='<div class="inv-empty">Ավտոմատացման կանոն չկա</div>';return;}
  box.innerHTML=INVENTORY_RULES.map(r=>{
    const item=itemById(r.inventory_item_id);
    const match=r.match_field?`${r.match_field} = ${r.match_value||"—"}`:"բոլոր պատվերները";
    return `<div class="inv-rule-row">
      <div><div class="inv-material-name">${esc(r.label)}</div><div class="inv-muted">${esc(r.service_key)} · ${esc(match)}</div></div>
      <div><div>${esc(item?.name||"Նյութ ընտրված չէ")}</div><div class="inv-muted">${esc(item?.size||"")} ${item?`· ${UNIT_LABELS[item.unit]||item.unit}`:""}</div></div>
      <div><b>${esc(CALC_LABELS[r.calculation_type]||r.calculation_type)}</b><div class="inv-muted">× ${invNum(r.multiplier)}</div></div>
      <div>${esc(STAGE_LABELS[r.consume_stage]||r.consume_stage)}<div class="inv-muted">${r.active?"Ակտիվ":"Անջատված"}</div></div>
      <button class="inv-mini-btn" onclick="openEditRule('${r.id}')">Խմբագրել</button>
    </div>`;
  }).join("");
}

function renderAllocations(){
  const box=document.getElementById("inventory-allocations-list");if(!box)return;
  if(!INVENTORY_ALLOCATIONS.length){box.innerHTML='<div class="inv-empty">Պատվերի նյութական պահուստ դեռ չկա</div>';return;}
  box.innerHTML=INVENTORY_ALLOCATIONS.slice(0,30).map(a=>{
    const o=a.orders||{},item=a.inventory_items||{},rule=a.service_inventory_rules||{};
    const unit=UNIT_LABELS[item.unit]||item.unit||"";
    const canRetry=a.status==="shortage";
    return `<div class="inv-allocation-row">
      <div class="inv-allocation-top"><div><b>${esc(o.order_number||"Պատվեր")}</b><div class="inv-muted">${esc(o.service_name||"")} · ${esc(item.name||"")}${item.size?` · ${esc(item.size)}`:""}</div></div><span class="inv-status ${esc(a.status)}">${esc(RULE_STATUS_LABELS[a.status]||a.status)}</span></div>
      <div class="inv-available">Պլան՝ <strong>${invNum(a.planned_quantity)} ${esc(unit)}</strong> · պահուստ՝ <strong>${invNum(a.reserved_quantity)} ${esc(unit)}</strong> · ելք՝ <strong>${invNum(a.consumed_quantity)} ${esc(unit)}</strong>${Number(a.waste_quantity||0)>0?` · խոտան՝ <strong>${invNum(a.waste_quantity)} ${esc(unit)}</strong>`:""}</div>
      <div class="inv-muted">${esc(a.note||rule.label||"")}</div>
      ${canRetry?`<div class="inv-actions" style="margin-top:8px"><button class="inv-mini-btn" onclick="retryAllocation('${a.order_id}','${esc(rule.consume_stage||"digital_print")}','${esc(o.workflow_stage||"")}')">Վերահաշվել / փորձել կրկին</button></div>`:""}
    </div>`;
  }).join("");
}

function fillRuleItemOptions(selected=""){
  const sel=document.getElementById("rule-item");if(!sel)return;
  sel.innerHTML='<option value="">Ընտրեք նյութը</option>'+INVENTORY_ITEMS.map(x=>`<option value="${x.id}" ${x.id===selected?'selected':''}>${esc(x.name)} · ${esc(x.size)} · ${invNum(Math.max(0,Number(x.quantity||0)-reservedForItem(x.id)))} ${esc(UNIT_LABELS[x.unit]||x.unit)} հասանելի</option>`).join("");
}

function openNewRule(){
  document.getElementById("rule-form")?.reset();
  document.getElementById("rule-id").value="";
  document.getElementById("rule-modal-title").textContent="Նոր ավտոմատացման կանոն";
  document.getElementById("rule-multiplier").value="1";
  document.getElementById("rule-calculation").value="quantity";
  document.getElementById("rule-stage").value="digital_print";
  document.getElementById("rule-active").value="true";
  fillRuleItemOptions();modalOpen("rule-modal");
}
function openEditRule(id){
  const r=INVENTORY_RULES.find(x=>x.id===id);if(!r)return;
  document.getElementById("rule-id").value=r.id;
  document.getElementById("rule-modal-title").textContent="Խմբագրել ավտոմատացման կանոնը";
  document.getElementById("rule-code").value=r.rule_code||"";
  document.getElementById("rule-label").value=r.label||"";
  document.getElementById("rule-service-key").value=r.service_key||"";
  fillRuleItemOptions(r.inventory_item_id||"");
  document.getElementById("rule-match-field").value=r.match_field||"";
  document.getElementById("rule-match-value").value=r.match_value||"";
  document.getElementById("rule-calculation").value=r.calculation_type||"quantity";
  document.getElementById("rule-multiplier").value=r.multiplier??1;
  document.getElementById("rule-stage").value=r.consume_stage||"digital_print";
  document.getElementById("rule-active").value=String(r.active!==false);
  modalOpen("rule-modal");
}
async function saveRule(e){
  e.preventDefault();const btn=document.getElementById("save-rule-btn");btn.disabled=true;btn.textContent="Պահպանվում է…";
  try{
    const id=document.getElementById("rule-id").value;
    const payload={
      rule_code:document.getElementById("rule-code").value.trim(),label:document.getElementById("rule-label").value.trim(),service_key:document.getElementById("rule-service-key").value.trim(),
      inventory_item_id:document.getElementById("rule-item").value||null,match_field:document.getElementById("rule-match-field").value||null,match_value:document.getElementById("rule-match-value").value.trim()||null,
      calculation_type:document.getElementById("rule-calculation").value,multiplier:Number(document.getElementById("rule-multiplier").value||1),consume_stage:document.getElementById("rule-stage").value,active:document.getElementById("rule-active").value==="true"
    };
    if(!payload.rule_code||!payload.label||!payload.service_key||!payload.inventory_item_id)throw new Error("Լրացրեք պարտադիր դաշտերը");
    const q=id?supabaseClient.from("service_inventory_rules").update(payload).eq("id",id):supabaseClient.from("service_inventory_rules").insert(payload);
    const {error}=await q;if(error)throw error;
    modalClose("rule-modal");toast?.("Կանոնը պահպանվեց","success");await loadInventory();
  }catch(err){console.error(err);toast?.(err.message||"Չհաջողվեց պահպանել կանոնը","error");}
  finally{btn.disabled=false;btn.textContent="Պահպանել";}
}

async function retryAllocation(orderId,consumeStage,currentStage){
  try{
    const {error:planErr}=await supabaseClient.rpc("admin_inventory_replan_order",{p_order_id:orderId});if(planErr)throw planErr;
    if(currentStage===consumeStage){
      const {error:consumeErr}=await supabaseClient.rpc("admin_inventory_retry_consumption",{p_order_id:orderId,p_stage:consumeStage});if(consumeErr)throw consumeErr;
    }
    toast?.("Նյութերը վերահաշվարկվեցին","success");await loadInventory();
  }catch(err){console.error(err);toast?.(err.message||"Վերահաշվարկը չհաջողվեց","error");}
}

function openNewMaterial(){
  document.getElementById("material-form").reset();document.getElementById("material-id").value="";document.getElementById("material-modal-title").textContent="Նոր նյութ";document.getElementById("initial-quantity-field").style.display="";document.getElementById("material-unit").value="piece";document.getElementById("material-purpose").value="";document.getElementById("material-color").value="";document.getElementById("material-roll-width").value="";document.getElementById("material-roll-length").value="";document.getElementById("material-min-stock").value="0";document.getElementById("material-initial-qty").value="0";modalOpen("material-modal");
}
function openEditMaterial(id){
  const x=itemById(id);if(!x)return;
  document.getElementById("material-id").value=x.id;document.getElementById("material-modal-title").textContent="Խմբագրել նյութը";document.getElementById("material-name").value=x.name||"";document.getElementById("material-type").value=x.material_type||"";document.getElementById("material-size").value=x.size||"";document.getElementById("material-unit").value=x.unit||"piece";document.getElementById("material-category").value=x.category||"";document.getElementById("material-purpose").value=x.purpose||"";document.getElementById("material-color").value=x.color||"";document.getElementById("material-roll-width").value=x.roll_width_m??"";document.getElementById("material-roll-length").value=x.roll_length_m??"";document.getElementById("material-supplier").value=x.supplier||"";document.getElementById("material-cost").value=x.cost_price??0;document.getElementById("material-sale").value=x.sale_price??0;document.getElementById("material-min-stock").value=x.min_stock??0;document.getElementById("material-notes").value=x.notes||"";document.getElementById("initial-quantity-field").style.display="none";modalOpen("material-modal");
}
async function saveMaterial(e){
  e.preventDefault();const btn=document.getElementById("save-material-btn");btn.disabled=true;btn.textContent="Պահպանվում է…";
  try{
    const id=document.getElementById("material-id").value;
    const payload={name:document.getElementById("material-name").value.trim(),material_type:document.getElementById("material-type").value.trim(),size:document.getElementById("material-size").value.trim(),unit:document.getElementById("material-unit").value,category:document.getElementById("material-category").value.trim()||null,purpose:document.getElementById("material-purpose").value||null,color:document.getElementById("material-color").value.trim()||null,roll_width_m:Number(document.getElementById("material-roll-width").value||0)||null,roll_length_m:Number(document.getElementById("material-roll-length").value||0)||null,supplier:document.getElementById("material-supplier").value.trim()||null,cost_price:Number(document.getElementById("material-cost").value||0),sale_price:Number(document.getElementById("material-sale").value||0),min_stock:Number(document.getElementById("material-min-stock").value||0),notes:document.getElementById("material-notes").value.trim()||null};
    if(!payload.name||!payload.material_type||!payload.size)throw new Error("Լրացրեք պարտադիր դաշտերը");
    if(id){const {error}=await supabaseClient.from("inventory_items").update(payload).eq("id",id);if(error)throw error;toast?.("Նյութը թարմացվեց","success");}
    else{payload.quantity=0;const {data,error}=await supabaseClient.from("inventory_items").insert(payload).select("id").single();if(error)throw error;const initial=Number(document.getElementById("material-initial-qty").value||0);if(initial>0){const {error:moveError}=await supabaseClient.rpc("inventory_move_stock",{p_item_id:data.id,p_direction:"in",p_quantity:initial,p_note:"Սկզբնական մնացորդ"});if(moveError)throw moveError;}toast?.("Նյութը ավելացվեց պահեստ","success");}
    modalClose("material-modal");await loadInventory();
  }catch(err){console.error(err);toast?.(err.message||"Չհաջողվեց պահպանել","error");}finally{btn.disabled=false;btn.textContent="Պահպանել";}
}
function openMovement(id,direction){
  const x=itemById(id);if(!x)return;const reserved=reservedForItem(id),available=Math.max(0,Number(x.quantity||0)-reserved);
  document.getElementById("movement-item-id").value=id;document.getElementById("movement-direction").value=direction;document.getElementById("movement-title").textContent=direction==="in"?"Նյութի մուտք":"Նյութի ելք";document.getElementById("movement-sub").textContent=`${x.name}${x.color?` · ${x.color}`:""} · ֆիզիկական ${invNum(x.quantity)} · պահուստ ${invNum(reserved)} · հասանելի ${invNum(available)} ${UNIT_LABELS[x.unit]||x.unit}`;document.getElementById("movement-qty").value="";document.getElementById("movement-note").value="";document.getElementById("movement-save-btn").textContent=direction==="in"?"Ավելացնել պահեստ":"Դուրս գրել";modalOpen("movement-modal");
}
async function saveMovement(e){
  e.preventDefault();const btn=document.getElementById("movement-save-btn");btn.disabled=true;
  try{const itemId=document.getElementById("movement-item-id").value,direction=document.getElementById("movement-direction").value,qty=Number(document.getElementById("movement-qty").value||0);if(!(qty>0))throw new Error("Քանակը պետք է 0-ից մեծ լինի");
    if(direction==="out"){const x=itemById(itemId),available=Math.max(0,Number(x?.quantity||0)-reservedForItem(itemId));if(qty>available&&!confirm(`Այս ելքը (${qty}) գերազանցում է ազատ հասանելի մնացորդը (${invNum(available)}) և կարող է վնասել պատվերների պահուստը։ Շարունակե՞լ։`))return;}
    const {error}=await supabaseClient.rpc("inventory_move_stock",{p_item_id:itemId,p_direction:direction,p_quantity:qty,p_note:document.getElementById("movement-note").value.trim()||null});if(error)throw error;modalClose("movement-modal");toast?.(direction==="in"?"Մուտքը գրանցվեց":"Ելքը գրանցվեց","success");await loadInventory();
  }catch(err){console.error(err);toast?.(err.message||"Գործողությունը չհաջողվեց","error");}finally{btn.disabled=false;}
}
async function openHistory(id){
  const x=itemById(id);if(!x)return;document.getElementById("history-sub").textContent=x.name;const list=document.getElementById("history-list");list.innerHTML="Բեռնվում է…";modalOpen("history-modal");
  const {data,error}=await supabaseClient.from("inventory_movements").select("*").eq("item_id",id).order("created_at",{ascending:false}).limit(100);if(error){list.textContent=error.message;return;}if(!data?.length){list.innerHTML='<div class="inv-empty">Շարժեր դեռ չկան</div>';return;}
  list.innerHTML=data.map(m=>`<div class="inv-history-row"><div><div class="inv-history-type ${m.direction==="in"?"inv-good":"inv-out"}">${m.direction==="in"?"Մուտք":"Ելք"}</div><div class="inv-muted">${new Date(m.created_at).toLocaleString("hy-AM")}</div></div><div>${esc(m.note||"Առանց նշման")}${m.movement_type?`<div class="inv-muted">Տեսակ՝ ${esc(m.movement_type)}</div>`:""}<div class="inv-muted">Մնացորդ՝ ${invNum(m.balance_after)} ${UNIT_LABELS[x.unit]||x.unit}</div></div><div class="inv-history-qty">${m.direction==="in"?"+":"−"}${invNum(m.quantity)} ${UNIT_LABELS[x.unit]||x.unit}</div></div>`).join("");
}
async function deleteMaterial(id){
  const x=itemById(id);if(!x)return;if(Number(x.quantity||0)!==0){toast?.("Նյութը ջնջելուց առաջ ֆիզիկական մնացորդը պետք է լինի 0","error");return;}if(reservedForItem(id)>0){toast?.("Այս նյութը պահուստավորված է պատվերների համար և չի կարող ջնջվել","error");return;}const typed=prompt(`«${x.name}» նյութը և ամբողջ շարժերի պատմությունը ջնջելու համար գրեք՝ ՋՆՋԵԼ`);if(typed!=="ՋՆՋԵԼ")return;const {error}=await supabaseClient.from("inventory_items").delete().eq("id",id);if(error){toast?.(error.message,"error");return;}toast?.("Նյութը ջնջվեց","success");await loadInventory();
}

window.openMovement=openMovement;window.openHistory=openHistory;window.openEditMaterial=openEditMaterial;window.deleteMaterial=deleteMaterial;window.openEditRule=openEditRule;window.retryAllocation=retryAllocation;
