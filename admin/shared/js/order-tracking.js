/* ============================================================
   order-tracking.js — Customer order tracking widget
   Drop the matching HTML block (see site-tracking-section.html)
   anywhere on services.html / RU/services.html / EN/services.html.
   Requires, in this order:
     <script src="shared/js/vendor/supabase.js"></script>
     <script src="shared/js/supabase.js"></script>
     <script src="shared/js/ui.js"></script>     (for STATUS_ORDER/labels — safe with no sidebar/theme elements present)
     <script src="shared/js/order-tracking.js"></script>
   ============================================================ */

let GDT_ORDER = null;

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("gdt-open-btn");
  const closeBtn = document.getElementById("gdt-modal-close");
  const overlay = document.getElementById("gdt-modal-overlay");
  if (!overlay) return; // widget not present on this page

  openBtn?.addEventListener("click", openGdtModal);
  closeBtn?.addEventListener("click", closeGdtModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeGdtModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) closeGdtModal(); });

  const btn = document.getElementById("gdt-search-btn");
  const input = document.getElementById("gdt-order-input");
  btn.addEventListener("click", searchOrder);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") searchOrder(); });

  document.getElementById("gdt-comment-btn")?.addEventListener("click", postCustomerComment);
  document.getElementById("gdt-comment-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") postCustomerComment(); });
  document.getElementById("gdt-approve-btn")?.addEventListener("click", () => sendQuickMessage("✅ Հաճախորդը հաստատեց դիզայնը"));
  document.getElementById("gdt-changes-btn")?.addEventListener("click", () => sendQuickMessage("⚠️ Հաճախորդը փոփոխություն է խնդրում — մանրամասները մեկնաբանության մեջ"));

  // Opened via a QR code (?track=GD-123456) — auto-fill and search
  // immediately instead of making the customer type the number again.
  const trackParam = new URLSearchParams(window.location.search).get("track");
  if (trackParam){
    input.value = trackParam;
    openGdtModal();
    searchOrder();
  }
});

function openGdtModal(){
  document.getElementById("gdt-modal-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("gdt-order-input")?.focus();
}
function closeGdtModal(){
  document.getElementById("gdt-modal-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

async function searchOrder(){
  const input = document.getElementById("gdt-order-input");
  const orderNumber = input.value.trim();
  const resultEl = document.getElementById("gdt-result");
  const btn = document.getElementById("gdt-search-btn");
  if (!orderNumber) return;

  btn.disabled = true; btn.textContent = "Փնտրվում է...";
  resultEl.classList.add("show");
  resultEl.innerHTML = `<div class="gdt-card"><div class="gdt-spinner"></div><div class="gdt-empty">Փնտրվում է...</div></div>`;

  const { data: order, error } = await supabaseClient
    .from("orders").select("*").eq("order_number", orderNumber).maybeSingle();

  btn.disabled = false; btn.textContent = "Փնտրել";

  if (error || !order){
    resultEl.innerHTML = `<div class="gdt-card"><div class="gdt-error">Այս համարով պատվեր չի գտնվել։ Ստուգեք համարը և փորձեք կրկին։</div></div>`;
    GDT_ORDER = null;
    return;
  }

  GDT_ORDER = order;
  renderOrderResult(order);
  loadTrackingExtraDetails(order.id);
  loadTrackingGallery(order.id);
  loadTrackingComments(order.id);
}

function renderOrderResult(order){
  const resultEl = document.getElementById("gdt-result");
  const statusKey = (order.status || "pending").toLowerCase();
  const cancelled = statusKey === "cancelled";

  const stepsHtml = cancelled
    ? `<div class="gdt-pill gdt-pill-cancelled">${statusLabel("cancelled")}</div>`
    : `<div class="gdt-steps">${STATUS_ORDER.filter(s => s !== "cancelled").map((s, i, arr) => {
        const doneIdx = arr.indexOf(statusKey);
        return `<div class="gdt-step ${i <= doneIdx ? "done" : ""}"><div class="gdt-step-dot"></div><div class="gdt-step-label">${STATUS_MAP[s].icon}</div></div>`;
      }).join("")}</div>`;

  resultEl.innerHTML = `
    <div class="gdt-col-left">
      <div class="gdt-card">
        <div class="gdt-head">
          <div class="gdt-order-num">${order.order_number}</div>
          <div class="gdt-pill gdt-pill-${statusKey}">${statusLabel(order.status)}</div>
        </div>
        ${stepsHtml}
        <div class="gdt-row"><span>Հաճախորդ</span><span>${order.customer_name || "—"}</span></div>
        <div class="gdt-row"><span>Ծառայություն</span><span>${order.service_name || "—"}</span></div>
        <div class="gdt-row"><span>Գին</span><span>${formatMoney(order.total_amount)}</span></div>
        ${order.description ? `<div class="gdt-row"><span>Նկարագրություն</span><span>${order.description}</span></div>` : ""}
        <div id="gdt-extra-details"></div>
        <div id="gdt-rating-wrap"></div>
        <div class="gdt-qr-wrap">
          <div class="gdt-qr" id="gdt-qr"></div>
          <div class="gdt-qr-label">Scan՝ այս էջը ուրիշ սարքից բացելու համար</div>
        </div>
      </div>
    </div>

    <div class="gdt-col-right">
      <div class="gdt-card">
        <div class="gdt-card-title">Ֆայլեր / Preview</div>
        <div class="gdt-gallery" id="gdt-gallery"></div>
      </div>

      <div class="gdt-card">
        <div class="gdt-card-title">Մեկնաբանություններ</div>
        <div class="gdt-comments" id="gdt-comments"></div>
        <div class="gdt-comment-form">
          <input type="text" id="gdt-comment-input" placeholder="Գրել մեկնաբանություն...">
          <button id="gdt-comment-btn">Ուղարկել</button>
        </div>
        <div class="gdt-action-row">
          <button class="gdt-btn gdt-btn-approve" id="gdt-approve-btn">✅ Հաստատել դիզայնը</button>
          <button class="gdt-btn gdt-btn-changes" id="gdt-changes-btn">✏️ Խնդրել փոփոխություն</button>
        </div>
      </div>
    </div>
  `;

  renderQrCode(document.getElementById("gdt-qr"), buildTrackingUrl(order.order_number), 110);
  loadRatingWidget(order);

  // Re-bind handlers since the buttons were just recreated by innerHTML above.
  document.getElementById("gdt-comment-btn").addEventListener("click", postCustomerComment);
  document.getElementById("gdt-comment-input").addEventListener("keydown", (e) => { if (e.key === "Enter") postCustomerComment(); });
  document.getElementById("gdt-approve-btn").addEventListener("click", () => sendQuickMessage("✅ Հաճախորդը հաստատեց դիզայնը"));
  document.getElementById("gdt-changes-btn").addEventListener("click", () => sendQuickMessage("⚠️ Հաճախորդը փոփոխություն է խնդրում — մանրամասները մեկնաբանության մեջ"));
}

/* Builds a shareable URL that, when opened, auto-fills and searches
   the order number — used both for the QR code and could be shared
   as a plain link too. */
function buildTrackingUrl(orderNumber){
  const url = new URL(window.location.href);
  url.searchParams.set("track", orderNumber);
  return url.toString();
}

async function loadTrackingExtraDetails(orderId){
  const el = document.getElementById("gdt-extra-details");
  if (!el) return;
  const { data } = await supabaseClient.from("order_details").select("*").eq("order_id", orderId).order("id", { ascending: false }).limit(1).maybeSingle();
  if (!data?.details) return;
  el.innerHTML = Object.entries(data.details)
    .filter(([k,v]) => v !== "" && v != null && k !== "_price_display")
    .map(([k,v]) => `<div class="gdt-row"><span>${k}</span><span>${v}</span></div>`).join("");
}

async function loadTrackingGallery(orderId){
  const el = document.getElementById("gdt-gallery");
  if (!el) return;
  const { data } = await supabaseClient.from("order_files").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  if (!data?.length){ el.innerHTML = `<div class="gdt-empty" style="grid-column:1/-1; padding:14px;">Ֆայլեր դեռ չկան</div>`; return; }
  el.innerHTML = data.map(f => {
    const ext = (f.file_name || "").split(".").pop().toLowerCase();
    const isImg = ["jpg","jpeg","png","webp","gif"].includes(ext);
    return isImg
      ? `<a href="${f.file_url}" target="_blank"><img src="${f.file_url}" alt="${f.file_name}"></a>`
      : `<a href="${f.file_url}" target="_blank"><div class="gdt-file-tile">${ext.toUpperCase()}</div></a>`;
  }).join("");
}

async function loadTrackingComments(orderId){
  const el = document.getElementById("gdt-comments");
  if (!el) return;
  const { data } = await supabaseClient.from("order_messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
  if (!data?.length){ el.innerHTML = `<div class="gdt-empty">Դեռ մեկնաբանություններ չկան</div>`; return; }
  el.innerHTML = data.map(m => `
    <div class="gdt-comment ${m.author_type}">
      <div class="gdt-comment-meta">${m.author_type === "customer" ? "Դուք" : "GDprint"}</div>
      <div>${m.message}</div>
    </div>
  `).join("");
  el.scrollTop = el.scrollHeight;
}

async function postCustomerComment(){
  const input = document.getElementById("gdt-comment-input");
  const message = input.value.trim();
  if (!message || !GDT_ORDER) return;
  const { error } = await supabaseClient.from("order_messages").insert({ order_id: GDT_ORDER.id, author_type: "customer", message });
  if (error){ alert("Չհաջողվեց ուղարկել։"); return; }
  input.value = "";
  loadTrackingComments(GDT_ORDER.id);
}

async function sendQuickMessage(text){
  if (!GDT_ORDER) return;
  await supabaseClient.from("order_messages").insert({ order_id: GDT_ORDER.id, author_type: "customer", message: text });
  loadTrackingComments(GDT_ORDER.id);
}

/* ---------- Post-delivery rating ----------
   Only shown once an order reaches "delivered". If the customer
   already rated it, shows their stars read-only instead of the form. */
let GDT_SELECTED_STARS = 0;

async function loadRatingWidget(order){
  const el = document.getElementById("gdt-rating-wrap");
  if (!el) return;

  if ((order.status || "").toLowerCase() !== "delivered"){
    el.innerHTML = "";
    return;
  }

  const { data: existing } = await supabaseClient
    .from("customer_ratings").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (existing){
    el.innerHTML = `
      <div class="gdt-rating-block">
        <div class="gdt-rating-title">Ձեր գնահատականը</div>
        <div class="gdt-stars-static">${renderStaticStars(existing.rating)}</div>
        ${existing.comment ? `<div class="gdt-rating-comment">"${existing.comment}"</div>` : ""}
      </div>
    `;
    return;
  }

  GDT_SELECTED_STARS = 0;
  el.innerHTML = `
    <div class="gdt-rating-block">
      <div class="gdt-rating-title">⭐ Ինչպե՞ս գնահատեցիք պատվերը</div>
      <div class="gdt-stars" id="gdt-stars">
        ${[1,2,3,4,5].map(n => `<span class="gdt-star" data-star="${n}" draggable="false">${starSvg(false)}</span>`).join("")}
      </div>
      <input type="text" id="gdt-rating-comment" placeholder="Կարծիք (ոչ պարտադիր)...">
      <button id="gdt-rating-submit" class="gdt-btn gdt-btn-approve" disabled>Ուղարկել գնահատականը</button>
    </div>
  `;

  const starEls = el.querySelectorAll(".gdt-star");
  starEls.forEach(star => {
    star.addEventListener("mouseenter", () => paintStars(Number(star.dataset.star)));
    star.addEventListener("mouseleave", () => paintStars(GDT_SELECTED_STARS));
    star.addEventListener("click", () => {
      GDT_SELECTED_STARS = Number(star.dataset.star);
      paintStars(GDT_SELECTED_STARS);
      document.getElementById("gdt-rating-submit").disabled = false;
    });
  });

  document.getElementById("gdt-rating-submit").addEventListener("click", () => submitRating(order.id));
}

function paintStars(count){
  document.querySelectorAll("#gdt-stars .gdt-star").forEach(s => {
    const filled = Number(s.dataset.star) <= count;
    s.innerHTML = starSvg(filled);
    s.classList.toggle("filled", filled);
  });
}

function renderStaticStars(rating){
  return [1,2,3,4,5].map(n => `<span class="${n <= rating ? "filled" : ""}">${starSvg(n <= rating)}</span>`).join("");
}

/* SVG star icon — deliberately NOT a text character, so the site's
   selection/drag-blocking script (which intercepts text selection
   attempts) never fires when clicking these. */
function starSvg(filled){
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5" style="pointer-events:none;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
}

async function submitRating(orderId){
  if (!GDT_SELECTED_STARS) return;
  const btn = document.getElementById("gdt-rating-submit");
  btn.disabled = true; btn.textContent = "Ուղարկվում է...";

  const comment = document.getElementById("gdt-rating-comment").value.trim();
  const { error } = await supabaseClient.from("customer_ratings").insert({ order_id: orderId, rating: GDT_SELECTED_STARS, comment: comment || null });

  if (error){
    btn.disabled = false; btn.textContent = "Ուղարկել գնահատականը";
    alert("Չհաջողվեց ուղարկել գնահատականը։");
    return;
  }

  document.getElementById("gdt-rating-wrap").innerHTML = `
    <div class="gdt-rating-block">
      <div class="gdt-rating-title">Շնորհակալություն կարծիքի համար! 🙏</div>
      <div class="gdt-stars-static">${renderStaticStars(GDT_SELECTED_STARS)}</div>
    </div>
  `;
}
