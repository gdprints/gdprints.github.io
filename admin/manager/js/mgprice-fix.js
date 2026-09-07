// ============================================================
// mgprice-fix.js — քարտեզագրում է mgprice.js-ը new-order.html-ի համար
// Չի փոխում ոչ mgprice.js-ը, ոչ էլ new-order.html-ը
// ============================================================

(function() {
  'use strict';

  /* ── Helper ── */
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
     ID MAPS — old ID (mgprice.js) -> new ID (new-order.html)
  ════════════════════════════════════════════════ */
  const ID_MAPS = {
    // 1. Լայնաֆորմատ
    ltp: {
      'width': 'ltp-w',
      'height': 'ltp-h',
      'servicePackage': 'servicePackage',
      'material': 'ltp-material',
      'borderCut': 'borderCut',
      'eyeletCount': 'eyeletCount',
      'eyeletWrapper': 'eyeletWrapper',
      'totalCost': 'ltp-price'
    },
    // 2. Լուսանկար
    photo: {
      'size': 'lus-size',
      'qanak': 'lus-qty',
      'totalphCost': 'lus-price'
    },
    // 3. Այցեքարտ
    bc: {
      'quantity': 'ayc-qty',
      'totalBCCost': 'ayc-price'
    },
    // 4. Ձևաթղթեր
    forms: {
      'printType': 'dev-type',
      'blank': 'dev-qty',
      'totalbkCost': 'dev-price'
    },
    // 5. Roll-Up
    rollup: {
      'rullsize': 'rup-size',
      'rullquantity': 'rup-qty',
      'totalRLPrice': 'rup-price'
    },
    // 6. Կտավ
    canvas: {
      'canvasize': 'cnv-size',
      'canvaquantity': 'cnv-qty',
      'canvatotal': 'cnv-price'
    },
    // 7. Գովազդ
    poster: {
      'squareMeters': 'post-sqm',
      'totalptCost': 'post-price'
    },
    // 8. Բաժակ
    cup: {
      'Sarph': 'cup-qty',
      'totalcupCost': 'cup-price'
    },
    // 9. Թռուցիկ
    flyer: {
      'flyerSize': 'fly-size',
      'flyerQuantity': 'fly-qty',
      'totalFlyerCost': 'fly-price'
    }
  };

  function getEl(map, oldId) {
    const newId = map[oldId];
    return document.getElementById(newId || oldId);
  }

  /* ═══════════════════════════════════════════════
     OVERRIDE FUNCTIONS — վերասահմանում ենք mgprice.js-ի ֆունկցիաները
  ════════════════════════════════════════════════ */

  // ── 1. Լայնաֆորմատ ──
  const MIN_EYELETS = 8;

  window.ltpCalculateCost = function(forceAutoEyelets) {
    const map = ID_MAPS.ltp;
    const width = parseFloat(getEl(map, 'width')?.value) || 0;
    const height = parseFloat(getEl(map, 'height')?.value) || 0;
    const packageCost = parseFloat(getEl(map, 'servicePackage')?.value) || 0;
    const material = getEl(map, 'material')?.value || '';
    const borderPrice = parseFloat(getEl(map, 'borderCut')?.value) || 0;
    const eyeletCountEl = getEl(map, 'eyeletCount');
    const eyeletWrapper = getEl(map, 'eyeletWrapper');
    const totalCostEl = getEl(map, 'totalCost');

    if (!totalCostEl) return;

    if (!width || !height || !packageCost) {
      totalCostEl.innerText = 'Արժեք: 0 դր.';
      pushResult("form-wide-format", 0);
      return;
    }

    let totalCost = width * height * packageCost;

    if (borderPrice > 0) {
      totalCost += 2 * (width + height) * borderPrice;
    }

    if (material === 'Banner+ողակ') {
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

  // ── 2. Լուսանկար ──
  window.photoCalculate = function() {
    const map = ID_MAPS.photo;
    const sizeCost = parseFloat(getEl(map, 'size')?.value) || 0;
    const qty = parseInt(getEl(map, 'qanak')?.value) || 0;
    const totalCostEl = getEl(map, 'totalphCost');

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

  // ── 3. Այցեքարտ ──
  window.businessCardCalculate = function() {
    const map = ID_MAPS.bc;
    const qty = parseInt(getEl(map, 'quantity')?.value) || 0;
    const totalCostEl = getEl(map, 'totalBCCost');
    const PRICE_PER_CARD = 8;
    const MIN_QTY = 1000;

    if (!totalCostEl) return;

    let finalQty = qty;
    if (finalQty < MIN_QTY) {
      finalQty = MIN_QTY;
      const input = getEl(map, 'quantity');
      if (input) input.value = MIN_QTY;
    }

    const total = finalQty * PRICE_PER_CARD;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-bizcard", total);
  };

  // ── 4. Ձևաթղթեր ──
  window.formsCalculate = function() {
    const map = ID_MAPS.forms;
    const price = parseFloat(getEl(map, 'printType')?.value) || 0;
    const qty = parseInt(getEl(map, 'blank')?.value) || 0;
    const totalCostEl = getEl(map, 'totalbkCost');

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

  // ── 5. Roll-Up ──
  window.rollupCalculate = function() {
    const map = ID_MAPS.rollup;
    const select = getEl(map, 'rullsize');
    const selectedOption = select?.options[select.selectedIndex];
    const price = parseInt(selectedOption?.dataset?.price) || 0;
    const qty = parseInt(getEl(map, 'rullquantity')?.value) || 1;
    const totalCostEl = getEl(map, 'totalRLPrice');

    if (!totalCostEl) return;

    const total = price * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-rollup", total);
  };

  // ── 6. Կտավ ──
  window.canvasCalculate = function() {
    const map = ID_MAPS.canvas;
    const select = getEl(map, 'canvasize');
    const selectedOption = select?.options[select.selectedIndex];
    const price = parseInt(selectedOption?.dataset?.price) || 0;
    const qty = parseInt(getEl(map, 'canvaquantity')?.value) || 1;
    const totalCostEl = getEl(map, 'canvatotal');

    if (!totalCostEl) return;

    const total = price * qty;
    totalCostEl.innerText = 'Արժեք: ' + fmt(total);
    pushResult("form-canvas", total);
  };

  // ── 7. Գովազդ ──
  window.posterCalculate = function() {
    const map = ID_MAPS.poster;
    const PRICE_PER_SQM = 4200;
    const sqm = parseFloat(getEl(map, 'squareMeters')?.value) || 0;
    const totalCostEl = getEl(map, 'totalptCost');

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

  // ── 8. Բաժակ ──
  window.cupCalculate = function() {
    const map = ID_MAPS.cup;
    const REGULAR_PRICE = 2000;
    const DISCOUNTED_PRICE = 1900;
    const qty = parseInt(getEl(map, 'Sarph')?.value) || 0;
    const totalCostEl = getEl(map, 'totalcupCost');

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

  // ── 9. Թռուցիկ ──
  window.flyerCalculate = function() {
    const map = ID_MAPS.flyer;
    const sizeSelect = getEl(map, 'flyerSize');
    const rawSize = parseFloat(
      sizeSelect?.options[sizeSelect.selectedIndex]?.dataset?.price
    ) || 0;
    const qty = parseInt(getEl(map, 'flyerQuantity')?.value) || 0;
    const totalCostEl = getEl(map, 'totalFlyerCost');

    if (!totalCostEl) return;

    if (!rawSize || !qty || qty < 50) {
      totalCostEl.innerText = 'Արժեք: min 2000 հատ';
      pushResult("form-flyer", 0);
      return;
    }

    let weightFactor = 1.0;
    const weightSelect = document.querySelector('#form-flyer [name="Թղթի խտություն"]');
    if (weightSelect) {
      const weight = weightSelect.value || '';
      if (weight.includes("115")) weightFactor = 1.0;
      else if (weight.includes("150")) weightFactor = 1.1;
      else if (weight.includes("170")) weightFactor = 1.3;
    }

    let typeFactor = 1.0;
    const typeSelect = document.querySelector('#form-flyer [name="Թղթի տեսակը"]');
    if (typeSelect) {
      const type = typeSelect.value || '';
      if (type === "Անփայլ") typeFactor = 1.0;
      else if (type === "Փայլուն") typeFactor = 1.10;
    }

    let baseCost = rawSize * qty * weightFactor * typeFactor;

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
     INIT — կցում է event listeners
  ════════════════════════════════════════════════ */
  function init() {
    // 1. Լայնաֆորմատ
    const ltpMap = ID_MAPS.ltp;
    const ltpWidth = getEl(ltpMap, 'width');
    const ltpHeight = getEl(ltpMap, 'height');
    const ltpPackage = getEl(ltpMap, 'servicePackage');
    const ltpMaterial = getEl(ltpMap, 'material');
    const ltpBorderCut = getEl(ltpMap, 'borderCut');
    const ltpEyeletCount = getEl(ltpMap, 'eyeletCount');

    if (ltpWidth) ltpWidth.addEventListener('input', function() { window.ltpCalculateCost(true); });
    if (ltpHeight) ltpHeight.addEventListener('input', function() { window.ltpCalculateCost(true); });
    if (ltpPackage) ltpPackage.addEventListener('change', function() { window.ltpCalculateCost(); });
    if (ltpMaterial) ltpMaterial.addEventListener('change', function() { window.ltpCalculateCost(); });
    if (ltpBorderCut) ltpBorderCut.addEventListener('change', function() { window.ltpCalculateCost(); });
    if (ltpEyeletCount) {
      ltpEyeletCount.addEventListener('input', function() {
        this.dataset.manual = 'true';
        window.ltpCalculateCost();
      });
    }

    // 2. Լուսանկար
    const photoMap = ID_MAPS.photo;
    const photoSize = getEl(photoMap, 'size');
    const photoQty = getEl(photoMap, 'qanak');
    if (photoSize) photoSize.addEventListener('change', window.photoCalculate);
    if (photoQty) photoQty.addEventListener('input', window.photoCalculate);

    // 3. Այցեքարտ
    const bcMap = ID_MAPS.bc;
    const bcQty = getEl(bcMap, 'quantity');
    if (bcQty) bcQty.addEventListener('input', window.businessCardCalculate);

    // 4. Ձևաթղթեր
    const formsMap = ID_MAPS.forms;
    const formsType = getEl(formsMap, 'printType');
    const formsQty = getEl(formsMap, 'blank');
    if (formsType) formsType.addEventListener('change', window.formsCalculate);
    if (formsQty) formsQty.addEventListener('input', window.formsCalculate);

    // 5. Roll-Up
    const rupMap = ID_MAPS.rollup;
    const rupSize = getEl(rupMap, 'rullsize');
    const rupQty = getEl(rupMap, 'rullquantity');
    if (rupSize) rupSize.addEventListener('change', window.rollupCalculate);
    if (rupQty) rupQty.addEventListener('input', window.rollupCalculate);

    // 6. Կտավ
    const cnvMap = ID_MAPS.canvas;
    const cnvSize = getEl(cnvMap, 'canvasize');
    const cnvQty = getEl(cnvMap, 'canvaquantity');
    if (cnvSize) cnvSize.addEventListener('change', window.canvasCalculate);
    if (cnvQty) cnvQty.addEventListener('input', window.canvasCalculate);

    // 7. Գովազդ
    const postMap = ID_MAPS.poster;
    const postSqm = getEl(postMap, 'squareMeters');
    if (postSqm) postSqm.addEventListener('input', window.posterCalculate);

    // 8. Բաժակ
    const cupMap = ID_MAPS.cup;
    const cupQty = getEl(cupMap, 'Sarph');
    if (cupQty) cupQty.addEventListener('input', window.cupCalculate);

    // 9. Թռուցիկ
    const flyMap = ID_MAPS.flyer;
    const flySize = getEl(flyMap, 'flyerSize');
    const flyQty = getEl(flyMap, 'flyerQuantity');
    if (flySize) flySize.addEventListener('change', window.flyerCalculate);
    if (flyQty) flyQty.addEventListener('input', window.flyerCalculate);

    // Initial calculations
    setTimeout(function() {
      window.ltpCalculateCost();
      window.photoCalculate();
      window.businessCardCalculate();
      window.formsCalculate();
      window.rollupCalculate();
      window.canvasCalculate();
      window.posterCalculate();
      window.cupCalculate();
      window.flyerCalculate();
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();