/* ============================================================
   order-form-submit.js
   ONE shared submit handler for all 11 print-service forms AND
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
  wide_format:      "Լայնաֆորմատ տպագրություն",
  plotter_cutting:  "Պլոտերային հատում",
  business_cards:   "Այցեքարտերի տպագրություն",
  photo_printing:   "Լուսանկարների տպագրություն",
  printable_forms:  "Ձևաթղթերի տպագրություն",
  calendar:         "Օրացույցի տպագրություն",
  rollup:           "Rull UP Stand տպագրություն",
  canvas:           "Կտավի վրա տպագրություն",
  poster_placement: "Գովազդի տեղադրում",
  cup_printing:     "Բաժակի վրա տպագրություն",
  flyer:            "Թռուցիկների տպագրություն",
};
function serviceNameFor(key){ return SERVICE_NAMES[key] || "Անհայտ ծառայություն"; }

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form.gd-order-form").forEach((form) => {
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
   11 print-service orders
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

    const priceText = form.querySelector(".result")?.textContent || "";
    const priceMatch = priceText.replace(/[,\s]/g, "").match(/(\d+)/);
    const totalAmount = priceMatch ? Number(priceMatch[1]) : 0;

    // Generic capture of every other field (material, size, quantity,
    // paper type, chosen design, links, etc.) into order_details.
    const details = {};
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      const key = el.name || el.id;
      if (!key) return;
      if (["ID", "order_number"].includes(key)) return;
      if (el === fullNameEl || el === phoneEl || el === emailEl || el === descriptionEl) return;
      if (key.startsWith("_")) return;
      if (["submit", "button", "hidden"].includes(el.type)) return;
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
    details._price_display = priceText.trim();

    // Who is creating this order?
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isManager = !!session;

    // Link (or create) the customer row so repeat orders from the same
    // phone number aggregate under one customer, instead of orders.customer_id
    // staying empty or duplicating a new customer row every time.
    let customerId = null;
    try {
      const { data: custId, error: custErr } = await supabaseClient
        .rpc("get_or_create_customer", { p_full_name: fullName, p_phone: phone, p_email: email });
      if (custErr) throw custErr;
      customerId = custId;
    } catch (custErr) {
      console.warn("Could not link customer (order will still be saved):", custErr);
    }

    const orderRow = {
      order_number: orderNumber,
      customer_id: customerId,
      customer_name: fullName,
      customer_phone: phone,
      customer_email: email,
      created_by_type: isManager ? "manager" : "customer",
      created_by_manager_id: isManager ? session.user.id : null,
      service_key: serviceKey,
      service_name: serviceName,
      language: currentLanguage(),
      total_amount: totalAmount,
      description: description,
      status: "pending",
    };

    const { data: inserted, error: orderErr } = await supabaseClient
      .from("orders").insert(orderRow).select().single();
    if (orderErr) throw orderErr;

    await supabaseClient.from("order_details").insert({ order_id: inserted.id, details });
    await supabaseClient.from("order_status_history").insert({
      order_id: inserted.id, old_status: null, new_status: "pending",
      changed_by: isManager ? session.user.id : null,
    });

    showFormMessage(form, "✅ Ձեր պատվերը հաջողությամբ գրանցվել է։ Համար՝ " + orderNumber, "success");
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
