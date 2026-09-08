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
		document.getElementById('payPhoto').disabled = true;
		return;
	}

	const totalphCost = sizeCost * qanak;
	document.getElementById('totalphCost').innerText = `Արժեքը: ${totalphCost} AMD`;
	document.getElementById('payPhoto').disabled = false;
}

//Այցեքարտերի տպագրություն Calculator functionality
document.getElementById('quantity').addEventListener('input', calculateBCCost);

function calculateBCCost() {
	const quantity = parseInt(document.getElementById('quantity').value);
	const pricePerCard = 8;
	let totalBCCost = 0;

	if (quantity >= 1000) {
		totalBCCost = quantity * pricePerCard;
		document.getElementById('payBusinessCard').disabled = false;
	} else {
		document.getElementById('payBusinessCard').disabled = true;
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
function blankForms() {
	const printTypeCost = parseFloat(document.getElementById('printType').value);
	const blank = parseInt(document.getElementById('blank').value);

	if (!printTypeCost || !blank || blank <= 0) {
		document.getElementById('totalbkCost').innerText = `Արժեքը: 0 AMD`;
		document.getElementById('payForms').disabled = true;
		return;
	}

	const totalbkCost = printTypeCost * blank;
	document.getElementById('totalbkCost').innerText = `Արժեքը: ${totalbkCost} AMD`;
	document.getElementById('payForms').disabled = false;
}

//Բաժակների տպագրություն Calculator function
function SarphForms() {
    const regularPrice = 2000;
    const discountedPrice = 1900;
    const Sarph = parseInt(document.getElementById('Sarph').value);

    if (!Sarph || Sarph <= 0) {
        document.getElementById('totalcupCost').innerText = `Արժեքը: 0 AMD`;
        document.getElementById('payCups').disabled = true;
        return;
    }

    const pricePerPiece = Sarph > 50 ? discountedPrice : regularPrice;
    const totalcupCost = pricePerPiece * Sarph;

    document.getElementById('totalcupCost').innerText = `Արժեքը: ${totalcupCost} AMD`;
    document.getElementById('payCups').disabled = false;
}

//Գովազդի տեղադրում/փակցնում Calculator function
function PostForms() {
	const pricePerSquareMeter = 4200;
	const squareMeters = parseFloat(document.getElementById('squareMeters').value);

	if (!squareMeters || squareMeters <= 0) {
		document.getElementById('totalptCost').innerText = `Արժեքը: 0 AMD`;
		document.getElementById('payPosting').disabled = true;
		return;
	}

	const totalptCost = pricePerSquareMeter * squareMeters;
	document.getElementById('totalptCost').innerText = `Արժեքը: ${totalptCost} AMD`;
	document.getElementById('payPosting').disabled = false;
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


//// Թռուցիկների տպագրություն
function flyerCount() {
    const sizeSelect = document.getElementById('flyerSize');
    const rawSize = parseFloat(
        sizeSelect.options[sizeSelect.selectedIndex].dataset.price
    );

    const quantity = parseInt(document.getElementById('flyerQuantity').value);
    const weight = document.getElementById('flyerWeight').value;
    const type = document.getElementById('flyerType').value;

    if (!rawSize || !quantity || quantity < 50) {
        document.getElementById('totalFlyerCost').innerText = `Արժեքը: 0 AMD`;
        document.getElementById('flyerDiscount').innerText = ``;
        return;
    }

    // Թղթի խտության գործակից
    let weightFactor = 1;
    if (weight.includes("115")) weightFactor = 1.00;
    if (weight.includes("150")) weightFactor = 1.1;
    if (weight.includes("170")) weightFactor = 1.3;

    // Թղթի տեսակի գործակից
    let typeFactor = type === "Անփայլ" ? 1.00 : 1.10;

    // Հիմնական արժեք
    let baseCost = rawSize * quantity * weightFactor * typeFactor;

    // Զեղչեր
    let discount = 0;
    if (quantity >= 1000) discount = 0.15;
    else if (quantity >= 500) discount = 0.10;
    else if (quantity >= 100) discount = 0.05;

    let totalCost = Math.round(baseCost - baseCost * discount);

    // Արդյունքի ցուցադրում
    document.getElementById('flyerDiscount').innerText =
        discount > 0 ? `Զեղչ՝ ${discount * 100}%` : ``;

    document.getElementById('totalFlyerCost').innerText =
        `Արժեքը: ${totalCost.toLocaleString('hy-AM')} AMD`;
}
