(function() {
  'use strict';

  /* ═══════════════════════════════════════════════
     PAGE INIT
  ════════════════════════════════════════════════ */
  document.addEventListener("DOMContentLoaded", async function() {
    requireRole(["manager"]);

    /* Sidebar user info */
    const r = await getCurrentProfile();
    if (r) {
      document.getElementById("user-name").textContent = r.profile.full_name || "Մենեջեր";
      document.getElementById("user-avatar").textContent = (r.profile.full_name || "M")[0].toUpperCase();
    }

    /* Generate order numbers when modal opens */
    const modalMap = {
      "modal-wide-format": { numEl:"num-wide-format", hidEl:"hidden-num-wide-format", prefix:"LTP" },
      "modal-plotter":     { numEl:"num-plotter",     hidEl:"hidden-num-plotter",     prefix:"PLT" },
      "modal-bizcard":     { numEl:"num-bizcard",     hidEl:"hidden-num-bizcard",     prefix:"AYC" },
      "modal-photo":       { numEl:"num-photo",       hidEl:"hidden-num-photo",       prefix:"LUS" },
      "modal-forms":       { numEl:"num-forms",       hidEl:"hidden-num-forms",       prefix:"DEV" },
      "modal-calendar":    { numEl:"num-calendar",    hidEl:"hidden-num-calendar",    prefix:"CAL" },
      "modal-rollup":      { numEl:"num-rollup",      hidEl:"hidden-num-rollup",      prefix:"RUP" },
      "modal-canvas":      { numEl:"num-canvas",      hidEl:"hidden-num-canvas",      prefix:"CNV" },
      "modal-poster":      { numEl:"num-poster",      hidEl:"hidden-num-poster",      prefix:"POST"},
      "modal-cup":         { numEl:"num-cup",         hidEl:"hidden-num-cup",         prefix:"CUP" },
      "modal-flyer":       { numEl:"num-flyer",       hidEl:"hidden-num-flyer",       prefix:"FLY" },
    };

    Object.entries(modalMap).forEach(function([modalId, cfg]) {
      const el = document.getElementById(modalId);
      if (!el) return;
      el.addEventListener("show.bs.modal", function() {
        const num = cfg.prefix + "-" + Math.floor(100000 + Math.random() * 900000);
        document.getElementById(cfg.numEl).textContent = num;
        const hid = document.getElementById(cfg.hidEl);
        if (hid) hid.value = num;
        const form = el.querySelector("form");
        if (form) form.dataset.gdOrderNumber = num;
      });
      el.addEventListener("hidden.bs.modal", function() {
        el.querySelectorAll(".gd-msg").forEach(function(m) {
          m.style.display = "none";
          m.textContent = "";
          m.className = "gd-msg";
        });
        el.querySelectorAll(".price-display").forEach(function(p) {
          if (!p.textContent.includes("Պայմ")) p.textContent = "Արժեք: 0 դր.";
        });
        el.querySelectorAll("form").forEach(function(f) { f.reset(); });
        el.querySelectorAll(".result").forEach(function(r) { r.remove(); });
      });
    });

    /* Copy order number buttons */
    document.querySelectorAll(".copy-num-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        const val = document.getElementById(this.dataset.copy)?.textContent || "";
        navigator.clipboard.writeText(val).then(function() {
          const orig = btn.textContent;
          btn.textContent = "✅ Պատճենվեց";
          setTimeout(function() { btn.textContent = orig; }, 1500);
        });
      });
    });

    /* Design modal for business cards */
    initDesignModal('bizcard');

    /* Update theme toggle icon */
    updateThemeIcon();

    /* ── Initialize price calculators ── */
    initPriceCalculators();
  });

  /* ═══════════════════════════════════════════════
     PRICE CALCULATORS (from price_am.js)
  ════════════════════════════════════════════════ */

  function initPriceCalculators() {
    // 1. Լայնաֆորմատ (Wide Format)
    const ltpWidth = document.getElementById('ltp-w');
    const ltpHeight = document.getElementById('ltp-h');
    const ltpPackage = document.getElementById('servicePackage');
    const ltpMaterial = document.getElementById('ltp-material');
    const ltpBorderCut = document.getElementById('borderCut');
    const ltpEyeletCount = document.getElementById('eyeletCount');
    const ltpEyeletWrapper = document.getElementById('eyeletWrapper');

    if (ltpWidth) ltpWidth.addEventListener('input', function() { ltpCalculateCost(true); });
    if (ltpHeight) ltpHeight.addEventListener('input', function() { ltpCalculateCost(true); });
    if (ltpPackage) ltpPackage.addEventListener('change', function() { ltpCalculateCost(); });
    if (ltpMaterial) ltpMaterial.addEventListener('change', function() { ltpCalculateCost(); });
    if (ltpBorderCut) ltpBorderCut.addEventListener('change', function() { ltpCalculateCost(); });
    if (ltpEyeletCount) {
      ltpEyeletCount.addEventListener('input', function() {
        this.dataset.manual = 'true';
        ltpCalculateCost();
      });
    }

    // 2. Լուսանկար (Photo)
    const photoSize = document.getElementById('lus-size');
    const photoQty = document.getElementById('lus-qty');
    if (photoSize) photoSize.addEventListener('change', function() { photoCalculate(); });
    if (photoQty) photoQty.addEventListener('input', function() { photoCalculate(); });

    // 3. Այցեքարտ (Business Card)
    const bcQty = document.getElementById('ayc-qty');
    if (bcQty) bcQty.addEventListener('input', function() { businessCardCalculate(); });

    // 4. Ձևաթղթեր (Forms)
    const formsType = document.getElementById('dev-type');
    const formsQty = document.getElementById('dev-qty');
    if (formsType) formsType.addEventListener('change', function() { formsCalculate(); });
    if (formsQty) formsQty.addEventListener('input', function() { formsCalculate(); });

    // 5. Roll-Up
    const rupSize = document.getElementById('rup-size');
    const rupQty = document.getElementById('rup-qty');
    if (rupSize) rupSize.addEventListener('change', function() { rollupCalculate(); });
    if (rupQty) rupQty.addEventListener('input', function() { rollupCalculate(); });

    // 6. Կտավ (Canvas)
    const cnvSize = document.getElementById('cnv-size');
    const cnvQty = document.getElementById('cnv-qty');
    if (cnvSize) cnvSize.addEventListener('change', function() { canvasCalculate(); });
    if (cnvQty) cnvQty.addEventListener('input', function() { canvasCalculate(); });

    // 7. Գովազդ (Poster)
    const postSqm = document.getElementById('post-sqm');
    if (postSqm) postSqm.addEventListener('input', function() { posterCalculate(); });

    // 8. Բաժակ (Cup)
    const cupQty = document.getElementById('cup-qty');
    if (cupQty) cupQty.addEventListener('input', function() { cupCalculate(); });

    // 9. Թռուցիկ (Flyer)
    const flySize = document.getElementById('fly-size');
    const flyQty = document.getElementById('fly-qty');
    if (flySize) flySize.addEventListener('change', function() { flyerCalculate(); });
    if (flyQty) flyQty.addEventListener('input', function() { flyerCalculate(); });

    // Initial calculations
    ltpCalculateCost();
    photoCalculate();
    businessCardCalculate();
    formsCalculate();
    rollupCalculate();
    canvasCalculate();
    posterCalculate();
    cupCalculate();
    flyerCalculate();
  }

  /* ── Helper functions ── */
  function fmt(n) {
    return new Intl.NumberFormat("hy-AM").format(Math.round(n)) + " դր.";
  }

  function pushResult(formId, amount) {
    const form = document.getElementById(formId);
    if (!form) return;
    let res = form.querySelector(".result");
    if (!res) {
      res = document.createElement("div");
      res.className = "result";
      res.style.display = "none";
      form.appendChild(res);
    }
    res.textContent = amount + " դր.";
  }

  /* ═══════════════════════════════════════════════
     1. ԼԱՅՆԱՖՈՐՄԱՏ (Wide Format) — from price_am.js
  ════════════════════════════════════════════════ */
  const MIN_EYELETS = 8;

  window.ltpCalculateCost = function(forceAutoEyelets) {
    const width = parseFloat(document.getElementById('ltp-w')?.value) || 0;
    const height = parseFloat(document.getElementById('ltp-h')?.value) || 0;
    const packageCost = parseFloat(document.getElementById('servicePackage')?.value) || 0;
    const material = document.getElementById('ltp-material')?.value || '';
    const borderPrice = parseFloat(document.getElementById('borderCut')?.value) || 0;
    const eyeletCountEl = document.getElementById('eyeletCount');
    const eyeletWrapper = document.getElementById('eyeletWrapper');
    const totalCostEl = document.getElementById('ltp-price');

    if (!totalCostEl) return;

    if (!width || !height || !packageCost) {
      totalCostEl.innerText = 'Արժեք: 0 դր.';
      pushResult("form-wide-format", 0);
      return;
    }

    let totalCost = width * height * packageCost;

    // ===== Եզրագծային կտրվածք =====
    if (borderPrice > 0) {
      totalCost += 2 * (width + height) * borderPrice;
    }

    // ===== Banner + Ողակ =====
    if (material === 'Banner+ողակ' || material === 'Banner+ողակ') {
      const offset = 0.024;
      const effW = Math.max(width - offset, 0);
      const effH = Math.max(height - offset, 0);

      const eyeletsW = Math.floor(effW / 0.3) + 2;
      const eyeletsH = Math.floor(effH / 0.3) + 2;
      const autoEyelets = (eyeletsW * 1) + (eyeletsH * 1);

      if (eyeletWrapper) eyeletWrapper.style.display = 'block';

      if (forceAutoEyelets || eyeletCountEl?.dataset.manual !== 'true') {
        if (eyeletCountEl) {
          eyeletCountEl.value = Math.max(autoEyelets, MIN_EYELETS);
        }
      }

      let finalEyelets = parseInt(eyeletCountEl?.value || autoEyelets);

      if (finalEyelets < MIN_EYELETS) {
        finalEyelets = MIN_EYELETS;
        if (eyeletCountEl) eyeletCountEl.value = finalEyelets;
        // Show warning via toast instead of modal
        if (typeof toast === 'function') {
          toast('⚠️ Ողակների քանակը շատ քիչ է, ավտոմատ կարգավորվեց', 'warning');
        }
      }

      totalCost += finalEyelets * 100;

    } else {
      if (eyeletWrapper) eyeletWrapper.style.display = 'none';
      if (eyeletCountEl) {
        eyeletCountEl.value = '';
        eyeletCountEl.dataset.manual = 'false';
      }
    }

    totalCostEl.innerText = 'Արժեք: ' + fmt(totalCost);
    pushResult("form-wide-format", totalCost);
  };

  /* ═══════════════════════════════════════════════
     2. ԼՈՒՍԱՆԿԱՐ (Photo) — from price_am.js
  ════════════════════════════════════════════════ */
  window.photoCalculate = function() {
    const sizeCost = parseFloat(document.getElementById('lus-size')?.value) || 0;
    const qty = parseInt(document.getElementById('lus-qty')?.value) || 0;
    const totalCostEl = document.getElementById('lus-price');

    if (!totalCostEl) return;

    if (!sizeCost || !qty || qty <= 0) {
      totalCostEl.innerText = 'Արժեք: 0 դր.';
      pushResult("form-photo", 0);
      return;
    }

    const total = sizeCost * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-photo", total);
  };

  /* ═══════════════════════════════════════════════
     3. ԱՅՑԵՔԱՐՏ (Business Card) — from price_am.js
  ════════════════════════════════════════════════ */
  window.businessCardCalculate = function() {
    const qty = parseInt(document.getElementById('ayc-qty')?.value) || 0;
    const totalCostEl = document.getElementById('ayc-price');
    const PRICE_PER_CARD = 8;
    const MIN_QTY = 1000;

    if (!totalCostEl) return;

    let finalQty = qty;
    if (finalQty < MIN_QTY) {
      finalQty = MIN_QTY;
      const input = document.getElementById('ayc-qty');
      if (input) input.value = MIN_QTY;
    }

    const total = finalQty * PRICE_PER_CARD;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-bizcard", total);
  };

  /* ═══════════════════════════════════════════════
     4. ՁԵՎԱԹՂԹԵՐ (Forms) — from price_am.js
  ════════════════════════════════════════════════ */
  window.formsCalculate = function() {
    const price = parseFloat(document.getElementById('dev-type')?.value) || 0;
    const qty = parseInt(document.getElementById('dev-qty')?.value) || 0;
    const totalCostEl = document.getElementById('dev-price');

    if (!totalCostEl) return;

    if (!price || !qty || qty <= 0) {
      totalCostEl.innerText = 'Արժեք: 0 դր.';
      pushResult("form-forms", 0);
      return;
    }

    const total = price * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-forms", total);
  };

  /* ═══════════════════════════════════════════════
     5. ROLL-UP — from price_am.js
  ════════════════════════════════════════════════ */
  window.rollupCalculate = function() {
    const select = document.getElementById('rup-size');
    const selectedOption = select?.options[select.selectedIndex];
    const price = parseInt(selectedOption?.dataset?.price) || 0;
    const qty = parseInt(document.getElementById('rup-qty')?.value) || 1;
    const totalCostEl = document.getElementById('rup-price');

    if (!totalCostEl) return;

    const total = price * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-rollup", total);
  };

  /* ═══════════════════════════════════════════════
     6. ԿՏԱՎ (Canvas) — from price_am.js
  ════════════════════════════════════════════════ */
  window.canvasCalculate = function() {
    const select = document.getElementById('cnv-size');
    const selectedOption = select?.options[select.selectedIndex];
    const price = parseInt(selectedOption?.dataset?.price) || 0;
    const qty = parseInt(document.getElementById('cnv-qty')?.value) || 1;
    const totalCostEl = document.getElementById('cnv-price');

    if (!totalCostEl) return;

    const total = price * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-canvas", total);
  };

  /* ═══════════════════════════════════════════════
     7. ԳՈՎԱԶԴ (Poster) — from price_am.js
  ════════════════════════════════════════════════ */
  window.posterCalculate = function() {
    const PRICE_PER_SQM = 4200;
    const sqm = parseFloat(document.getElementById('post-sqm')?.value) || 0;
    const totalCostEl = document.getElementById('post-price');

    if (!totalCostEl) return;

    if (!sqm || sqm <= 0) {
      totalCostEl.innerText = 'Արժեք: 0 դր.';
      pushResult("form-poster", 0);
      return;
    }

    const total = PRICE_PER_SQM * sqm;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-poster", total);
  };

  /* ═══════════════════════════════════════════════
     8. ԲԱԺԱԿ (Cup) — from price_am.js
  ════════════════════════════════════════════════ */
  window.cupCalculate = function() {
    const REGULAR_PRICE = 2000;
    const DISCOUNTED_PRICE = 1900;
    const qty = parseInt(document.getElementById('cup-qty')?.value) || 0;
    const totalCostEl = document.getElementById('cup-price');

    if (!totalCostEl) return;

    if (!qty || qty <= 0) {
      totalCostEl.innerText = 'Արժեք: 0 դր.';
      pushResult("form-cup", 0);
      return;
    }

    const pricePerPiece = qty > 50 ? DISCOUNTED_PRICE : REGULAR_PRICE;
    const total = pricePerPiece * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-cup", total);
  };

  /* ═══════════════════════════════════════════════
     9. ԹՌՈՒՑԻԿ (Flyer) — from price_am.js
  ════════════════════════════════════════════════ */
  window.flyerCalculate = function() {
    const sizeSelect = document.getElementById('fly-size');
    const rawSize = parseFloat(
      sizeSelect?.options[sizeSelect.selectedIndex]?.dataset?.price
    ) || 0;
    const qty = parseInt(document.getElementById('fly-qty')?.value) || 0;
    const totalCostEl = document.getElementById('fly-price');

    if (!totalCostEl) return;

    if (!rawSize || !qty || qty < 50) {
      totalCostEl.innerText = 'Արժեք: min 2000 հատ';
      pushResult("form-flyer", 0);
      return;
    }

    // Weight factor (default 1.0)
    let weightFactor = 1.0;
    const weightSelect = document.querySelector('#form-flyer [name="Թղթի խտություն"]');
    if (weightSelect) {
      const weight = weightSelect.value || '';
      if (weight.includes("115")) weightFactor = 1.0;
      else if (weight.includes("150")) weightFactor = 1.1;
      else if (weight.includes("170")) weightFactor = 1.3;
    }

    // Type factor
    let typeFactor = 1.0;
    const typeSelect = document.querySelector('#form-flyer [name="Թղթի տեսակը"]');
    if (typeSelect) {
      const type = typeSelect.value || '';
      if (type === "Անփայլ") typeFactor = 1.0;
      else if (type === "Փայլուն") typeFactor = 1.10;
    }

    // Base cost
    let baseCost = rawSize * qty * weightFactor * typeFactor;

    // Discount
    let discount = 0;
    if (qty >= 10000) discount = 0.15;
    else if (qty >= 5000) discount = 0.10;
    else if (qty >= 3000) discount = 0.05;

    let total = Math.round(baseCost - baseCost * discount);

    let displayText = 'Արժեք: ' + fmt(total);
    if (discount > 0) {
      displayText += ' (−' + (discount * 100) + '% զեղ.)';
    }
    totalCostEl.innerText = displayText;
    pushResult("form-flyer", total);
  };

  /* ═══════════════════════════════════════════════
     THEME TOGGLE
  ════════════════════════════════════════════════ */
  function updateThemeIcon() {
    const theme = document.documentElement.getAttribute("data-theme");
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    if (theme === "light") {
      toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    } else {
      toggle.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`;
    }
  }

  // Override ui.js theme toggle to update icon
  document.addEventListener("DOMContentLoaded", function() {
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      const newToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(newToggle, toggle);
      newToggle.addEventListener("click", function() {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("gdprint-theme", next);
        updateThemeIcon();
      });
    }
  });

  /* ═══════════════════════════════════════════════
     DESIGN SELECTOR for Business Cards
  ════════════════════════════════════════════════ */
  // Design data (samples — add all designs from form.html here)
  const designData = [
    // Business category
    { name: "Design 000", category: "business", img: "https://img.freepik.com/free-psd/black-business-card-with-silver-details_1435-30.jpg" },
    { name: "Design 001", category: "business", img: "https://img.freepik.com/free-vector/business-card-with-distorted-lines_23-2148563770.jpg" },
    { name: "Design 002", category: "business", img: "https://img.freepik.com/free-vector/modern-black-white-business-card-design_1017-14939.jpg" },
    { name: "Design 003", category: "business", img: "https://img.freepik.com/free-vector/clean-style-modern-business-card-template_1017-30352.jpg" },
    // Healthcare category
    { name: "Design 203", category: "healthcare", img: "https://img.freepik.com/free-vector/modern-simple-company-card_1115-103.jpg" },
    // Marketing category
    { name: "Design 304", category: "marketing", img: "https://img.freepik.com/free-psd/flat-design-social-media-business-card-template_23-2151227203.jpg" },
    // Education category
    { name: "Design 391", category: "education", img: "https://img.freepik.com/free-vector/modern-business-card-template-with-blue-marble-shapes_1393-87.jpg" },
  ];

  function initDesignModal(prefix) {
    const openBtn = document.getElementById("open-design-btn-" + prefix);
    const modal = document.getElementById("design-modal-" + prefix);
    if (!openBtn || !modal) return;

    openBtn.addEventListener("click", function() {
      modal.classList.add("open");
      renderDesigns(prefix);
    });

    modal.addEventListener("click", function(e) {
      if (e.target === this) {
        this.classList.remove("open");
      }
    });
  }

  window.filterDesigns = function(prefix) {
    renderDesigns(prefix);
  };

  function closeDesignModal(prefix) {
    document.getElementById("design-modal-" + prefix)?.classList.remove("open");
  }
  window.closeDesignModal = closeDesignModal;

  function renderDesigns(prefix) {
    const container = document.getElementById("cards-" + prefix);
    if (!container) return;
    const category = document.getElementById("category-" + prefix)?.value || "all";
    const filtered = category === "all" ? designData : designData.filter(function(d) {
      return d.category === category;
    });
    container.innerHTML = "";
    filtered.forEach(function(d) {
      const div = document.createElement("div");
      div.className = "design-option";
      div.innerHTML = '<img src="' + d.img + '" alt="' + d.name + '"><p>' + d.name + '</p>';
      div.addEventListener("click", function() {
        document.getElementById("selected-design-" + prefix).value = d.name;
        closeDesignModal(prefix);
        if (typeof toast === "function") {
          toast("Դիզայն ընտրված է: " + d.name, "success");
        }
      });
      container.appendChild(div);
    });
  }

  /* ═══════════════════════════════════════════════
     SUBMIT — shared for all 11 modals
  ════════════════════════════════════════════════ */
  window.submitManagerOrder = async function(formId, msgId) {
    const form = document.getElementById(formId);
    const msgEl = document.getElementById(msgId);
    const btn = form?.closest(".modal")?.querySelector(".btn-gd-primary");

    if (!form || !msgEl) return;

    msgEl.style.display = "none";
    msgEl.className = "gd-msg";

    /* Basic required check */
    const required = form.querySelectorAll("[required]");
    for (const el of required) {
      if (!el.value.trim()) {
        el.focus();
        showMsg(msgEl, "⚠️ Լրացրեք բոլոր պարտադիր դաշտերը", "error");
        return;
      }
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="reg-mark"></span> Գրանցվում է...';
    }

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) throw new Error("Մուտք գործեք նախ");

      const serviceKey = form.dataset.serviceKey;
      const serviceName = serviceNameFor(serviceKey);
      const orderNum = form.dataset.gdOrderNumber ||
                       (form.querySelector("[name='order_number']")?.value) || "";

      const fullName = (form.querySelector('[name="Անուն Ազգանուն"]')?.value || "").trim();
      const phone = (form.querySelector('[name="Հեռ. համար"]')?.value || "").trim();
      const email = (form.querySelector('[type="email"]')?.value || "").trim();
      const description = (form.querySelector("textarea")?.value || "").trim();

      /* Price from .result div */
      const priceText = form.querySelector(".result")?.textContent || "";
      const priceMatch = priceText.replace(/[,\s]/g, "").match(/(\d+)/);
      const totalAmount = priceMatch ? Number(priceMatch[1]) : 0;

      /* Generic details */
      const details = {};
      form.querySelectorAll("input, select, textarea").forEach(function(el) {
        const key = el.name || el.id;
        if (!key || ["order_number"].includes(el.name) || el.type === "hidden") return;
        if (el.type === "email" || el.type === "submit" || el.type === "button") return;
        if (["Անուն Ազգանուն", "Հեռ. համար"].some(function(x) { return el.name === x; })) return;
        if (el.tagName === "SELECT") {
          details[key] = el.options[el.selectedIndex]?.text || el.value;
        } else {
          details[key] = el.value;
        }
      });
      details._price_display = priceText.trim();

      /* get_or_create_customer */
      let customerId = null;
      try {
        const { data: cid, error: ce } = await supabaseClient
          .rpc("get_or_create_customer", { p_full_name: fullName, p_phone: phone, p_email: email });
        if (!ce) customerId = cid;
      } catch(e) {
        console.warn("customer link skip", e);
      }

      /* Insert order */
      const { data: inserted, error: oe } = await supabaseClient
        .from("orders")
        .insert({
          order_number: orderNum,
          customer_id: customerId,
          customer_name: fullName,
          customer_phone: phone,
          customer_email: email,
          created_by_type: "manager",
          created_by_manager_id: session.user.id,
          service_key: serviceKey,
          service_name: serviceName,
          language: "hy",
          total_amount: totalAmount,
          description: description,
          status: "pending",
        })
        .select().single();
      if (oe) throw oe;

      /* order_details */
      await supabaseClient.from("order_details").insert({ order_id: inserted.id, details });

      /* order_status_history */
      await supabaseClient.from("order_status_history").insert({
        order_id: inserted.id, old_status: null, new_status: "pending", changed_by: session.user.id,
      });

      showMsg(msgEl, "✅ Պատվեր " + orderNum + " գրանցված է", "success");
      if (typeof toast === "function") toast("Պատվեր " + orderNum + " գրանցված է ✓", "success");

      /* Close modal after 1.4s */
      setTimeout(function() {
        const modal = form.closest(".modal");
        if (modal && bootstrap && bootstrap.Modal) {
          bootstrap.Modal.getInstance(modal)?.hide();
        }
        if (typeof loadOrders === "function") loadOrders();
      }, 1400);

    } catch (err) {
      console.error(err);
      showMsg(msgEl, "⚠️ " + (err.message || "Անհայտ սխալ"), "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "✓ Գրանցել";
      }
    }
  };

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = "gd-msg " + type;
    el.style.display = "block";
  }

  function serviceNameFor(key) {
    const map = {
      wide_format: "Լայնաֆորմատ տպագրություն",
      plotter_cutting: "Պլոտերային հատում",
      business_cards: "Այցեքարտերի տպագրություն",
      photo_printing: "Լուսանկարների տպագրություն",
      printable_forms: "Ձևաթղթերի տպագրություն",
      calendar: "Օրացույցի տպագրություն",
      rollup: "Roll-Up Stand",
      canvas: "Կտավի վրա տպագրություն",
      poster_placement: "Գովազդի տեղադրում",
      cup_printing: "Բաժակի վրա տպագրություն",
      flyer: "Թռուցիկների տպագրություն"
    };
    return map[key] || key;
  }

})();

