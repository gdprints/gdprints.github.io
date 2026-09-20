
(function () {
  "use strict";

  // GDprint Kinder box printing calculator
  // Prices are easy to edit here.
  const PRICE_TABLE = {
    kinder4:   { 1: 2200, 10: 1900, 25: 1700, 50: 1500, 100: 1350 },
    kinder8:   { 1: 3200, 10: 2850, 25: 2550, 50: 2300, 100: 2100 },
    kinderMaxi:{ 1: 3900, 10: 3450, 25: 3100, 50: 2800, 100: 2550 }
  };

  const DESIGN_FEES = {
    ready: 0,
    custom: 5000,
    customer_file: 0
  };

  function unitPrice(type, qty) {
    const table = PRICE_TABLE[type] || PRICE_TABLE.kinder4;
    if (qty >= 100) return table[100];
    if (qty >= 50) return table[50];
    if (qty >= 25) return table[25];
    if (qty >= 10) return table[10];
    return table[1];
  }

  function money(n) {
    return Math.round(n).toLocaleString("en-US") + " AMD";
  }

  function calculate(form) {
    if (!form) return;

    const type = form.querySelector('[name="Կինդերի տուփի տեսակ"], [name="Kinder box type"], [name="Тип коробки Kinder"]');
    const qty = form.querySelector('[name="Տպաքանակ"], [name="Quantity"], [name="Тираж"]');
    const design = form.querySelector('[name="Դիզայն"], [name="Design"], [name="Дизайн"]');
    const priceEl = form.querySelector('[id^="gdPrice_kinder_box_printing"]');
    const hidden = form.querySelector('.gd-calculated-total');

    if (!type || !qty || !priceEl) return;

    const q = Math.max(1, parseInt(qty.value || "1", 10) || 1);
    const u = unitPrice(type.value || "kinder4", q);
    const designFee = DESIGN_FEES[(design && design.value) || "ready"] || 0;
    const total = (u * q) + designFee;

    priceEl.textContent = "Արժեքը: " + money(total);
    if (hidden) hidden.value = money(total);

    form.dataset.unitPrice = String(u);
    form.dataset.designFee = String(designFee);
    form.dataset.totalPrice = String(total);
  }

  function init() {
    document.querySelectorAll('form[data-service-key="kinder_box_printing"]').forEach(form => {
      form.querySelectorAll("select,input").forEach(el => {
        el.addEventListener("input", () => calculate(form));
        el.addEventListener("change", () => calculate(form));
      });
      calculate(form);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
