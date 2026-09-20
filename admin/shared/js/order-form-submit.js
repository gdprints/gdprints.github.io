/* ============================================================
   order-form-submit.js
   ONE shared submit handler for all print and design service forms AND
   the partner-package wizard — used on the public site (HY/RU/EN)
   and on the manager's "new order" page.

   Field collection is generic (works no matter which of the 11
   services the form is for):
     - full name  -> input[name="Անուն Ազգանուն"]
     - phone      -> input[name="Հեռ. համար"]
     - email      -> input[type="email"]
     - description-> the form's single <textarea>
     - price      -> text inside the form's .result element (if present)
     - everything else -> collected into order_details.details (JSON)

   IMPORTANT ASSUMPTION (please confirm): the RU/EN site forms use
   the SAME `name` attributes as the HY forms (only visible labels
   are translated). If RU/EN forms instead translate the `name`
   attributes themselves, the selectors above need to change —
   send one RU or EN form's HTML to check before relying on this
   in production.

   Determines context automatically:
     - No Supabase session  -> created_by_type = 'customer' (site)
     - Logged-in manager    -> created_by_type = 'manager', tagged
                                with their profile id
   ============================================================ */

/* Canonical Armenian display name per service — always shown this way
   in admin/manager panels regardless of which language site the order
   came from. Centralizing this here means the 11×3 HTML forms only
   need to carry `data-service-key`, never a separate display-name
   attribute that would have to be kept in sync everywhere. */
const SERVICE_NAMES = {
  "wide_format": "Լայնաֆորմատ տպագրություն",
  "plotter_cutting": "Պլոտերային հատում",
  "business_cards": "Այցեքարտերի տպագրություն",
  "photo_printing": "Լուսանկարների տպագրություն",
  "cup_printing": "Բաժակի վրա տպագրություն",
  "rollup": "Rull UP Stand տպագրություն",
  "canvas": "Կտավի վրա տպագրություն",
  "poster_placement": "Գովազդի տեղադրում",
  "tshirt_printing": "Շապիկների վրա տպագրություն",
  "x_banner": "X-բաներների տպագրություն",
  "self_adhesive_sticker": "Ինքնակպչուն սթիքերների տպագրություն",
  "kinder_box_printing": "Kinder տուփերի տպագրություն",
  "plotter_file_design": "Պլոտերային հատման ֆայլ",
  "mug_design": "Բաժակի դիզայն",
  "business_card_design": "Այցեքարտի դիզայն",
  "banner_design": "Բանների դիզայն",
  "outdoor_ad_design": "Արտաքին գովազդի դիզայն",
  "rollup_design": "Roll Up դիզայն",
  "corporate_identity": "Կորպորատիվ ոճ",
  "logo_design": "Լոգոյի դիզայն",
};
function serviceNameFor(key){
  if (SERVICE_NAMES[key]) return SERVICE_NAMES[key];
  // Preserve a readable value for future keys instead of "Անհայտ ծառայություն".
  return String(key || "service")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, ch => ch.toUpperCase());
}


function websiteUploadLabels(){
  const lang=currentLanguage();
  return lang==='ru'
    ? {title:'Файлы заказа',hint:'PDF, AI, PSD, PNG, JPG и другие файлы. До 50 MB на файл.',pick:'Выберите файлы',selected:'Выбрано файлов'}
    : lang==='en'
      ? {title:'Order files',hint:'PDF, AI, PSD, PNG, JPG and other print files. Up to 50 MB per file.',pick:'Choose files',selected:'Files selected'}
      : {title:'Պատվերի ֆայլեր',hint:'PDF, AI, PSD, PNG, JPG և այլ տպագրական ֆայլեր։ Մեկ ֆայլը՝ մինչև 50MB։',pick:'Ընտրել ֆայլեր',selected:'Ընտրված ֆայլեր'};
}
function ensureWebsiteFilePicker(form){
  if(form.querySelector('.gd-website-upload')) return;
  const labels=websiteUploadLabels();
  const box=document.createElement('div');
  box.className='gd-website-upload';
  box.innerHTML=`<div class="gd-upload-title">${labels.title}</div><div class="gd-upload-hint">${labels.hint}</div><label class="gd-upload-pick"><span>${labels.pick}</span><input class="gd-order-file-input" type="file" multiple accept=".pdf,.ai,.eps,.svg,.psd,.cdr,.png,.jpg,.jpeg,.webp,.tif,.tiff,.zip,.rar,.doc,.docx,.xls,.xlsx,.ppt,.pptx"></label><div class="gd-upload-list" aria-live="polite"></div>`;
  const modalBody=form.querySelector('.modal-body');
  const footer=form.querySelector('.modal-footer');
  // The upload area belongs to the form body. Only submit/price controls belong in modal-footer.
  if(modalBody) modalBody.appendChild(box);
  else if(footer?.parentElement===form) form.insertBefore(box,footer);
  else form.appendChild(box);
  const input=box.querySelector('.gd-order-file-input'), list=box.querySelector('.gd-upload-list');
  input.addEventListener('change',()=>{
    const files=[...input.files];
    list.innerHTML=files.length?`<strong>${labels.selected}: ${files.length}</strong>`+files.map(f=>`<div>${escapeWebsiteFileName(f.name)} <span>${Math.max(1,Math.round(f.size/1024))} KB</span></div>`).join(''):'';
  });
}
function escapeWebsiteFileName(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function selectedWebsiteFiles(form){return [...(form.querySelector('.gd-order-file-input')?.files||[])];}
function validateWebsiteFiles(files){
  for(const file of files){
    if(file.size>50*1024*1024) throw new Error(`${file.name} ֆայլը գերազանցում է 50MB-ը։`);
  }
}
async function uploadWebsiteOrderFiles(order,orderNumber,files){
  const uploaded=[];
  for(const file of files){
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_');
    const uid=(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2));
    const path=`website/${orderNumber}/${Date.now()}_${uid}_${safe}`;
    const {error:upErr}=await supabaseClient.storage.from('customer-order-files').upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
    if(upErr){
      console.error('GDprint storage upload error', {message:upErr.message,statusCode:upErr.statusCode,error:upErr.error,path,file:file.name,size:file.size,type:file.type});
      throw new Error(`Ֆայլի վերբեռնումը չհաջողվեց (${upErr.message || 'Storage error'})`);
    }
    const {error:linkErr}=await supabaseClient.rpc('attach_website_order_file',{p_order_id:order.id,p_order_number:orderNumber,p_file_name:file.name,p_storage_path:path});
    if(linkErr){
      console.error('GDprint file metadata attach error', {message:linkErr.message,code:linkErr.code,details:linkErr.details,hint:linkErr.hint,path,file:file.name});
      throw new Error(`Ֆայլը վերբեռնվել է, բայց պատվերին կապելը չհաջողվեց (${linkErr.message || 'Database error'})`);
    }
    uploaded.push({file_name:file.name,storage_path:path});
  }
  return uploaded;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form.gd-order-form").forEach((form) => {
    ensureWebsiteFilePicker(form);
    form.addEventListener("submit", (e) => handleOrderSubmit(e, form));
  });
  document.querySelectorAll("form.gd-partner-form").forEach((form) => {
    form.addEventListener("submit", (e) => handlePartnerSubmit(e, form));
  });
});

function currentLanguage(){
  const lang = document.documentElement.lang;
  return ["hy", "ru", "en"].includes(lang) ? lang : "hy";
}

/* ============================================================
   print and design service orders
   ============================================================ */
async function handleOrderSubmit(e, form){
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : "";
  if (submitBtn){ submitBtn.disabled = true; submitBtn.innerHTML = '<span class="reg-mark"></span> Ուղարկվում է...'; }

  try {
    const serviceKey = form.dataset.serviceKey || "unknown";
    const serviceName = serviceNameFor(serviceKey);
    const orderNumber = ensureOrderNumber(form); // reuses number shown at modal-open, never regenerates
    const websiteFiles = selectedWebsiteFiles(form);
    validateWebsiteFiles(websiteFiles);

    // Prefer id (code-facing, not translated) over name (translated
    // to "Ամբողջական անունը" in the RU form, unlike phone/email/description
    // whose name attributes stayed consistent across languages).
    // Language-agnostic identity lookup: HY/RU/EN labels and name attributes differ.
    const fullNameEl = form.querySelector('#fullName') ||
      form.querySelector('input[name="Անուն Ազգանուն"]') ||
      form.querySelector('input[type="text"]:not([readonly]):not([disabled])');
    const phoneEl = form.querySelector('#telNumber') || form.querySelector('input[type="tel"]');
    const emailEl = form.querySelector('input[type="email"]');
    const descriptionEl = form.querySelector('textarea');
    const fullName = (fullNameEl?.value || "").trim();
    const phone = (phoneEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const description = (descriptionEl?.value || "").trim();

    // Price may be rendered either inside .result (legacy calculators), directly
    // in the modal footer (new market calculators), or mirrored to a hidden
    // .gd-calculated-total input. Read all three forms safely.
    const hiddenPrice = form.querySelector(".gd-calculated-total")?.value || "";
    const visiblePrice = form.querySelector(".result")?.textContent
      || form.querySelector(".gd-order-modal-footer p")?.textContent
      || "";
    const priceText = (hiddenPrice && /\d/.test(hiddenPrice)) ? hiddenPrice : visiblePrice;
    const numericPrice = String(priceText).replace(/[^0-9]/g, "");
    const totalAmount = numericPrice ? Number(numericPrice) : 0;

    // Generic capture of every other field (material, size, quantity,
    // paper type, chosen design, links, etc.) into order_details.
    const details = {};
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      const key = el.name || el.id;
      if (!key) return;
      if (["ID", "order_number"].includes(key)) return;
      if (el === fullNameEl || el === phoneEl || el === emailEl || el === descriptionEl) return;
      if (key.startsWith("_")) return;
      if (["submit", "button", "hidden", "file"].includes(el.type)) return;
      if (el.tagName === "TEXTAREA") return;
      // For <select> elements, store the visible option TEXT (e.g. "Starter"),
      // not the raw value attribute (e.g. "4500") — several of the 11 forms
      // use a numeric/coded value for pricing purposes while showing a
      // different human-readable label, which would otherwise show up
      // as a confusing bare number in admin/manager/tracking views.
      details[key] = el.tagName === "SELECT"
        ? (el.options[el.selectedIndex]?.text || el.value)
        : el.value;
    });
    // Canonical production/inventory fields. Website forms historically use
    // Armenian field names even on RU/EN pages; keep the original values above
    // but mirror the common parameters under stable keys for ERP automation.
    const canonicalSizeEl = form.querySelector('[name="Թղթի չափս"], [name="Չափս"], [name="size"], #size');
    const canonicalQtyEl = form.querySelector('[name="Տպագրության քանակը"], [name="Տպման քանակը"], [name="Տպաքանակ"], [name="Քանակ"], [name="quantity"], #qanak');
    const canonicalWidthEl = form.querySelector('[name="Լայնություն"], [name="width"], #width');
    const canonicalHeightEl = form.querySelector('[name="Բարձրություն"], [name="height"], #height');
    const canonicalMaterialEl = form.querySelector('[name="Նյութ"], [name="material"], #material');
    const canonicalPaperTypeEl = form.querySelector('[name="Թղթի տեսակ"], [name="paper_type"]');
    if (canonicalSizeEl) details.size = canonicalSizeEl.tagName === 'SELECT' ? (canonicalSizeEl.options[canonicalSizeEl.selectedIndex]?.text || canonicalSizeEl.value) : canonicalSizeEl.value;
    if (canonicalQtyEl && canonicalQtyEl.value !== '') details.quantity = Number(canonicalQtyEl.value) || canonicalQtyEl.value;
    if (canonicalWidthEl && canonicalWidthEl.value !== '') details.width = Number(canonicalWidthEl.value) || canonicalWidthEl.value;
    if (canonicalHeightEl && canonicalHeightEl.value !== '') details.height = Number(canonicalHeightEl.value) || canonicalHeightEl.value;
    if (canonicalMaterialEl) details.material = canonicalMaterialEl.tagName === 'SELECT' ? (canonicalMaterialEl.options[canonicalMaterialEl.selectedIndex]?.text || canonicalMaterialEl.value) : canonicalMaterialEl.value;
    if (canonicalPaperTypeEl) details.paper_type = canonicalPaperTypeEl.tagName === 'SELECT' ? (canonicalPaperTypeEl.options[canonicalPaperTypeEl.selectedIndex]?.text || canonicalPaperTypeEl.value) : canonicalPaperTypeEl.value;
    details._price_display = priceText.trim();

    // Who is creating this order?
    const { data: { session } } = await supabaseClient.auth.getSession();
    // A customer may already have a Customer App session in the same browser.
    // That must NOT turn a public website order into a manager-created order.
    const isManagerPage = /\/admin\/manager\//i.test(location.pathname);
    const isManager = !!session && isManagerPage;
    details._created_from = isManager ? "manager" : "website";

    // Canonical DB action. Website and Manager creation both go through one
    // SECURITY DEFINER RPC instead of writing orders/order_details directly.
    // This keeps customer-session security, manager attribution and inventory
    // automation consistent across all entry points.
    const { data: createdRows, error: orderErr } = await supabaseClient.rpc("create_gd_order", {
      p_service_key: serviceKey,
      p_details: details,
      p_description: description,
      p_full_name: fullName,
      p_phone: phone,
      p_email: email || "",
      p_language: currentLanguage(),
      p_client_total: totalAmount,
      p_requested_channel: isManager ? "manager" : "website",
      p_order_number: orderNumber,
    });
    if (orderErr) throw orderErr;
    const inserted = Array.isArray(createdRows) ? createdRows[0] : createdRows;
    if (!inserted?.id) throw new Error("Պատվերը չստեղծվեց");
    const savedOrderNumber = inserted.order_number || orderNumber;
    const idField = form.querySelector('input[name="order_number"], input[name="ID"]');
    if (idField) idField.value = savedOrderNumber;
    form.dataset.gdOrderNumber = savedOrderNumber;

    let uploadedCount=0;
    if(websiteFiles.length){
      try{
        const linked=await uploadWebsiteOrderFiles(inserted,savedOrderNumber,websiteFiles);
        uploadedCount=linked.length;
      }catch(fileErr){
        console.error('Website order file upload failed:',fileErr);
        showFormMessage(form, `✅ Պատվերը գրանցվել է՝ ${savedOrderNumber}, բայց ֆայլերի վերբեռնումը չավարտվեց։ Խնդրում ենք կապվել GDprint-ի հետ և նշել պատվերի համարը։`, "error");
        return;
      }
    }

    showFormMessage(form, "✅ Ձեր պատվերը հաջողությամբ գրանցվել է։ Համար՝ " + savedOrderNumber + (uploadedCount ? ` · Ֆայլեր՝ ${uploadedCount}` : ""), "success");
    form.reset();
    delete form.dataset.gdOrderNumber; // form.reset() doesn't clear dataset — must clear it explicitly
    ensureOrderNumber(form); // fresh number ready if the same modal is reused without closing

    if (typeof onOrderCreated === "function") onOrderCreated(inserted); // optional hook for manager UI refresh
  } catch (err) {
    console.error(err);
    showFormMessage(form, "⚠️ Չհաջողվեց ուղարկել պատվերը՝ " + (err.message || ""), "error");
  } finally {
    if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalText; }
  }
}

/* ============================================================
   Partner package applications (separate table, separate flow)
   ============================================================ */
async function handlePartnerSubmit(e, form){
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : "";
  if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = "Ուղարկվում է..."; }

  try {
    const row = {
      plan: form.querySelector('#selectedPlan, [name="plan"]')?.value || "",
      first_name: form.querySelector('[name="first_name"]')?.value?.trim() || "",
      last_name: form.querySelector('[name="last_name"]')?.value?.trim() || "",
      phone: form.querySelector('[name="phone"]')?.value?.trim() || "",
      email: form.querySelector('[name="email"]')?.value?.trim() || "",
      company: form.querySelector('[name="company"]')?.value?.trim() || "",
      company_type: form.querySelector('[name="company_type"]')?.value || "",
      tin: form.querySelector('[name="tin"]')?.value?.trim() || "",
      address: form.querySelector('[name="address"]')?.value?.trim() || "",
      expected_volume: Number(form.querySelector('[name="expected_volume"]')?.value) || null,
      source: form.querySelector('[name="source"]')?.value || "",
      comments: form.querySelector('[name="comments"]')?.value?.trim() || "",
      language: currentLanguage(),
      status: "new",
    };

    const { error } = await supabaseClient.from("partner_applications").insert(row);
    if (error) throw error;

    document.getElementById("partnerModalOverlay")?.classList.remove("active");
    document.getElementById("successModal")?.classList.add("active");
    form.reset();
  } catch (err) {
    console.error(err);
    alert("Չհաջողվեց ուղարկել հայտը՝ " + (err.message || ""));
  } finally {
    if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = originalText; }
  }
}

/* ---------- Inline success/error message under a form ---------- */
function showFormMessage(form, text, type){
  let box = form.querySelector(".gd-order-message");
  if (!box){
    box = document.createElement("div");
    box.className = "gd-order-message";
    box.style.marginTop = "10px";
    box.style.padding = "10px 14px";
    box.style.borderRadius = "8px";
    box.style.fontWeight = "600";
    form.appendChild(box);
  }
  box.style.background = type === "success" ? "#e6f9ee" : "#fdeaea";
  box.style.color = type === "success" ? "#1a7f4b" : "#c0392b";
  box.textContent = text;
}
