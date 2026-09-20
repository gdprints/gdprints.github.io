// ===== DOM Elements =====
const widthEl = document.getElementById('width');
const heightEl = document.getElementById('height');
const packageEl = document.getElementById('servicePackage');
const materialEl = document.getElementById('material');
const borderCutEl = document.getElementById('borderCut');

const eyeletWrapper = document.getElementById('eyeletWrapper');
const eyeletCountEl = document.getElementById('eyeletCount');
const totalCostEl = document.getElementById('totalCost');

// Minimum քանակ
const MIN_EYELETS = 8;

// Bootstrap modal instance
const eyeletWarningModal = new bootstrap.Modal(document.getElementById('eyeletWarningModal'));

// ===== Event Listeners =====
widthEl.addEventListener('input', () => onSizeChange());
heightEl.addEventListener('input', () => onSizeChange());
packageEl.addEventListener('change', () => calculateCost());
materialEl.addEventListener('change', () => calculateCost());
borderCutEl.addEventListener('change', () => calculateCost());

eyeletCountEl.addEventListener('input', () => {
    eyeletCountEl.dataset.manual = 'true';
    calculateCost();
});

// ===== Functions =====
function onSizeChange() {
    eyeletCountEl.dataset.manual = 'false'; // Չեղարկել ձեռքով փոփոխությունը
    calculateCost(true);
}

function calculateCost(forceAutoEyelets = false) {
    const width = parseFloat(widthEl.value);
    const height = parseFloat(heightEl.value);
    const packageCost = parseFloat(packageEl.value);
    const material = materialEl.value;
    const borderPrice = parseFloat(borderCutEl.value);

    if (!width || !height || !packageCost) {
        totalCostEl.innerText = 'Արժեքը: 0 AMD';
        return;
    }

    let totalCost = width * height * packageCost;

    // ===== Եզրագծային կտրվածք =====
    if (borderPrice > 0) {
        totalCost += 2 * (width + height) * borderPrice;
    }

    // ===== Banner + Ողակ =====
    if (material === 'Banner+ողակ') {
        const offset = 0.024; // 1.2 սմ × 2
        const effW = Math.max(width - offset, 0);
        const effH = Math.max(height - offset, 0);

        const eyeletsW = Math.floor(effW / 0.3) + 2;
        const eyeletsH = Math.floor(effH / 0.3) + 2;

        const autoEyelets = (eyeletsW * 1) + (eyeletsH * 1);

        eyeletWrapper.style.display = 'block';

        // Ավտոմատ դնում ենք առաջարկվող քանակը
        if (forceAutoEyelets || eyeletCountEl.dataset.manual !== 'true') {
            eyeletCountEl.value = Math.max(autoEyelets, MIN_EYELETS);
        }

        let finalEyelets = parseInt(eyeletCountEl.value || autoEyelets);

        // Minimum + Modal
        if (finalEyelets < MIN_EYELETS) {
            finalEyelets = MIN_EYELETS;
            eyeletCountEl.value = finalEyelets;
            eyeletWarningModal.show();
        }

        totalCost += finalEyelets * 100;

    } else {
        eyeletWrapper.style.display = 'none';
        eyeletCountEl.value = '';
        eyeletCountEl.dataset.manual = 'false';
    }

    totalCostEl.innerText = `Արժեքը: ${totalCost.toFixed(0)} AMD`;
}
//Լայնաֆորմատ տպագրություն Calculator functionality
//document.getElementById('width').addEventListener('input', calculateCost);
//document.getElementById('height').addEventListener('input', calculateCost);
//document.getElementById('servicePackage').addEventListener('change', calculateCost);
//
//function calculateCost() {
//	const width = parseFloat(document.getElementById('width').value);
//	const height = parseFloat(document.getElementById('height').value);
//	const packageCost = parseFloat(document.getElementById('servicePackage').value);
//
//	if (!width || !height || !packageCost || width <= 0 || height <= 0) {
//		document.getElementById('totalCost').innerText = `Արժեքը:  0 AMD`;
//		return;
//	}
//
//	const area = width * height;
//	const totalCost = packageCost * area;
//
//	document.getElementById('totalCost').innerText = `Արժեքը: ${totalCost.toFixed(0)} AMD`;
//}

//պլտ տպագրություն Calculator functionality


//Լուսանկարների տպագրություն Calculator functionality
function photoCount() {
	const sizeCost = parseFloat(document.getElementById('size').value);
	const qanak = parseInt(document.getElementById('qanak').value);

	if (!sizeCost || !qanak || qanak <= 0) {
		document.getElementById('totalphCost').innerText = `Արժեքը: 0 AMD`;
		{ const el=document.getElementById('payPhoto'); if(el) el.disabled = true; }
		return;
	}

	const totalphCost = sizeCost * qanak;
	document.getElementById('totalphCost').innerText = `Արժեքը: ${totalphCost} AMD`;
	{ const el=document.getElementById('payPhoto'); if(el) el.disabled = false; }
}

//Այցեքարտերի տպագրություն Calculator functionality
{ const el=document.getElementById('quantity'); if(el) el.addEventListener('input', calculateBCCost); }

function calculateBCCost() {
	const quantity = parseInt(document.getElementById('quantity').value);
	const pricePerCard = 8;
	let totalBCCost = 0;

	if (quantity >= 1000) {
		totalBCCost = quantity * pricePerCard;
		{ const el=document.getElementById('payBusinessCard'); if(el) el.disabled = false; }
	} else {
		{ const el=document.getElementById('payBusinessCard'); if(el) el.disabled = true; }
	}

	document.getElementById('totalBCCost').innerText = `Արժեքը: ${totalBCCost} AMD`;
}

//Այցեքարտերի տպագրություն Calculator functionality
document.addEventListener("DOMContentLoaded", function () {
    const quantityInput = document.getElementById("quantity");
    const totalCostEl = document.getElementById("totalBCCost");

    const PRICE_PER_ITEM = 8;
    const MIN_QTY = 1000;

    function calculateBCCost() {
        let qty = parseInt(quantityInput.value);

        if (isNaN(qty) || qty < MIN_QTY) {
            qty = MIN_QTY;
            quantityInput.value = MIN_QTY;
        }

        const total = qty * PRICE_PER_ITEM;
        totalCostEl.textContent = "Արժեքը: " + total.toLocaleString("hy-AM") + " AMD";
    }

    // սկզբնական հաշվարկ
    calculateBCCost();

    // հաշվարկ փոփոխման ժամանակ
    quantityInput.addEventListener("input", calculateBCCost);
});

//Ձևաթխտերի տպագրություն Calculator function

//Բաժակների տպագրություն Calculator function
function SarphForms() {
    const regularPrice = 2000;
    const discountedPrice = 1900;
    const Sarph = parseInt(document.getElementById('Sarph').value);

    if (!Sarph || Sarph <= 0) {
        document.getElementById('totalcupCost').innerText = `Արժեքը: 0 AMD`;
        { const el=document.getElementById('payCups'); if(el) el.disabled = true; }
        return;
    }

    const pricePerPiece = Sarph > 50 ? discountedPrice : regularPrice;
    const totalcupCost = pricePerPiece * Sarph;

    document.getElementById('totalcupCost').innerText = `Արժեքը: ${totalcupCost} AMD`;
    { const el=document.getElementById('payCups'); if(el) el.disabled = false; }
}

//Գովազդի տեղադրում/փակցնում Calculator function
function PostForms() {
	const pricePerSquareMeter = 4200;
	const squareMeters = parseFloat(document.getElementById('squareMeters').value);

	if (!squareMeters || squareMeters <= 0) {
		document.getElementById('totalptCost').innerText = `Արժեքը: 0 AMD`;
		{ const el=document.getElementById('payPosting'); if(el) el.disabled = true; }
		return;
	}

	const totalptCost = pricePerSquareMeter * squareMeters;
	document.getElementById('totalptCost').innerText = `Արժեքը: ${totalptCost} AMD`;
	{ const el=document.getElementById('payPosting'); if(el) el.disabled = false; }
}

const rullSizeSelect = document.getElementById("rullsize");
const rullQuantityInput = document.getElementById("rullquantity");
const rullTotalDisplay = document.getElementById("totalRLPrice");

rullSizeSelect.addEventListener("change", calculateRollUpPrice);
rullQuantityInput.addEventListener("input", calculateRollUpPrice);

function calculateRollUpPrice() {
    const selectedOption = rullSizeSelect.options[rullSizeSelect.selectedIndex];
    const price = parseInt(selectedOption.dataset.price) || 0;
    const quantity = parseInt(rullQuantityInput.value) || 1;

    const total = price * quantity;

    // Ցույց տալ արժեքը
    rullTotalDisplay.textContent = "Արժեքը: " + total.toLocaleString('hy-AM') + " AMD";

    // Ուղարկման hidden fields
    let form = document.getElementById('RollupOrderForm');
    let hiddenPrice = form.querySelector('input[name="Մեկ հատի գին"]');
    let hiddenTotal = form.querySelector('input[name="Ընդհանուր գին"]');

    if (!hiddenPrice) {
        hiddenPrice = document.createElement('input');
        hiddenPrice.type = 'hidden';
        hiddenPrice.name = 'Մեկ հատի գին';
        form.appendChild(hiddenPrice);
    }
    if (!hiddenTotal) {
        hiddenTotal = document.createElement('input');
        hiddenTotal.type = 'hidden';
        hiddenTotal.name = 'Ընդհանուր գին';
        form.appendChild(hiddenTotal);
    }

    hiddenPrice.value = price + ' AMD';
    hiddenTotal.value = total + ' AMD';
}


const canvasSizeSelect = document.getElementById('canvasize');
const canvasQuantityInput = document.getElementById('canvaquantity');
const canvasTotalDisplay = document.getElementById('canvatotal');

canvasSizeSelect.addEventListener('change', calculateCanvasTotal);
canvasQuantityInput.addEventListener('input', calculateCanvasTotal);

function calculateCanvasTotal() {
    const selectedOption = canvasSizeSelect.options[canvasSizeSelect.selectedIndex];
    const price = parseInt(selectedOption.dataset.price) || 0;
    const quantity = parseInt(canvasQuantityInput.value) || 1;
    const total = price * quantity;

    canvasTotalDisplay.textContent = `Արժեքը՝ ${total.toLocaleString('hy-AM')} AMD`;

    // Hidden fields պատվերի համար
    const form = document.getElementById('CanvasOrderForm');
    
    let onePriceInput = form.querySelector('input[name="Մեկ հատի գին"]');
    let totalPriceInput = form.querySelector('input[name="Ընդհանուր գին"]');

    if (!onePriceInput) {
        onePriceInput = document.createElement('input');
        onePriceInput.type = 'hidden';
        onePriceInput.name = 'Մեկ հատի գին';
        form.appendChild(onePriceInput);
    }
    if (!totalPriceInput) {
        totalPriceInput = document.createElement('input');
        totalPriceInput.type = 'hidden';
        totalPriceInput.name = 'Ընդհանուր գին';
        form.appendChild(totalPriceInput);
    }

    onePriceInput.value = price + ' AMD';
    totalPriceInput.value = total + ' AMD';
}
// ===== GDprint new services market-calibrated calculators (2026) =====
(() => {
  const CFG = {"tshirt_printing":{"minQty":1,"base":4500,"qty":"Քանակ","tiers":[[1,5500],[5,4800],[10,4500],[25,3900],[50,3400],[100,3000]],"mods":{"Տեղադրում":{"Առջև":1,"Մեջք":1,"Առջև + մեջք":1.45,"Այլ":1.15}}},"x_banner":{"minQty":1,"base":18000,"qty":"Քանակ","tiers":[[1,18000],[5,16500],[10,15000]],"mods":{"Կազմ":{"Տպագրություն + X-ստենդ":1,"Միայն տպագրություն":0.48,"Միայն ստենդ":0.58}}},"self_adhesive_sticker":{"minQty":100,"base":30,"qty":"Քանակ","tiers":[[100,55],[300,40],[500,30],[1000,23],[2000,18],[5000,14]],"mods":{"Նյութ":{"Փայլուն":1,"Անփայլ":1.08,"Սպիտակ PVC":1.3,"Թափանցիկ PVC":1.45,"Այլ":1.2},"Կտրվածք":{"Ուղղանկյուն":1,"Կլոր":1.05,"Ֆիգուրային":1.22,"Այլ":1.15}}}};

  const num = v => Number(String(v ?? '').replace(',', '.')) || 0;
  const money = n => Math.max(0, Math.round(n)).toLocaleString('hy-AM') + ' AMD';

  function field(form, name) {
    return form.querySelector(`[name="${CSS.escape(name)}"]`);
  }
  function tierPrice(tiers, qty, fallback) {
    let p = fallback;
    for (const [min, price] of tiers || []) if (qty >= min) p = price;
    return p;
  }
  function calc(form, key) {
    const c = CFG[key]; if (!c) return;
    const qtyEl = field(form, c.qty);
    const minQty = Number(c.minQty || 1);
    let qty = parseInt(qtyEl?.value || minQty, 10);
    if (!Number.isFinite(qty) || qty < minQty) {
      qty = minQty;
      if (qtyEl) qtyEl.value = minQty;
    }
    if (qtyEl) qtyEl.min = minQty;
    let unit = c.base || 0;

    if (c.formula === 'pages') {
      const pages = Math.max(1, parseInt(field(form,c.page)?.value || 1,10) || 1);
      unit = pages * c.pageRate;
      if (c.coverAdd) unit += c.coverAdd[field(form,c.cover)?.value] || 0;
      if (c.coverMul) unit *= c.coverMul[field(form,c.cover)?.value] || 1;
      unit += c.fixedAdd || 0;
      if (qty >= 100) unit *= .88;
      if (qty >= 300) unit *= .82;
      if (qty >= 500) unit *= .77;
    } else {
      unit = tierPrice(c.tiers, qty, unit);
    }

    for (const [fname, table] of Object.entries(c.mods || {})) {
      unit *= table[field(form,fname)?.value] || 1;
    }

    // ISO A0-A6 paper size coefficient. A4 is the base price.
    if (c.sizeField && c.sizeFactors) {
      const selectedSize = field(form, c.sizeField)?.value;
      unit *= Number(c.sizeFactors[selectedSize] || 1);
    }
    if (c.sheet) {
      const sheets = Math.max(1, parseInt(field(form,c.sheet)?.value || c.sheetBase,10) || c.sheetBase);
      unit *= sheets / c.sheetBase;
    }

    const total = qty * unit;
    const out = document.getElementById('gdPrice_' + key);
    if (out) out.textContent = 'Արժեքը: ' + money(total);
    const hidden = form.querySelector('.gd-calculated-total');
    if (hidden) hidden.value = money(total);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-market-calculator="1"]').forEach(form => {
      const key = form.dataset.serviceKey;
      const run = () => calc(form,key);
      form.addEventListener('input',run);
      form.addEventListener('change',run);
      run();
    });
  });
})();


// ===== Պլոտերային հատում — 20,000 AMD / քմ =====
document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector('form[data-service-key="plotter_cutting"]');
    if (!form) return;

    const heightInput = form.querySelector('input[name="Բարձրություն"]');
    const widthInput = form.querySelector('input[name="Լայնություն"]');
    const totalEl = document.getElementById("totalPlotterCost");

    if (!heightInput || !widthInput || !totalEl) return;

    const PRICE_PER_SQM = 20000;

    function calculatePlotterCost() {
        const height = parseFloat(heightInput.value) || 0;
        const width = parseFloat(widthInput.value) || 0;

        if (height <= 0 || width <= 0) {
            totalEl.textContent = "Արժեքը: 0 AMD";
            return;
        }

        const area = height * width;
        const total = Math.round(area * PRICE_PER_SQM);

        totalEl.textContent =
            "Արժեքը: " + total.toLocaleString("hy-AM") + " AMD";
    }

    heightInput.addEventListener("input", calculatePlotterCost);
    widthInput.addEventListener("input", calculatePlotterCost);

    calculatePlotterCost();
});
