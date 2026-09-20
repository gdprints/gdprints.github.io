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
        totalCostEl.innerText = 'Price: 0 AMD';
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
        eyeletWrapper.style.display = 'block';
        eyeletCountEl.value = '';
        eyeletCountEl.dataset.manual = 'false';
    }

    totalCostEl.innerText = `Price: ${totalCost.toFixed(0)} AMD`;
}

//Լուսանկարների տպագրություն Calculator functionality
function photoCount() {
	const sizeCost = parseFloat(document.getElementById('size').value);
	const qanak = parseInt(document.getElementById('qanak').value);

	// Check if both values are valid
	if (!sizeCost || !qanak || qanak <= 0) {
		document.getElementById('totalphCost').innerText = `Price: 0 AMD `;
		return;
	}

	// Calculate total cost
	const totalphCost = sizeCost * qanak;
	document.getElementById('totalphCost').innerText = `Price:  ${totalphCost} AMD`;
}


//Այցեքարտերի տպագրություն Calculator functionality

(function () {
    const PRICE_PER_ITEM = 8;
    const MIN_QTY = 1000;

    function calculateBCCost() {
        const quantityInput = document.getElementById("quantity");
        const totalCostEl = document.getElementById("totalBCCost");

        if (!quantityInput || !totalCostEl) return;

        let qty = parseInt(quantityInput.value);
        if (isNaN(qty) || qty < MIN_QTY) {
            qty = MIN_QTY;
            quantityInput.value = MIN_QTY;
        }

        totalCostEl.textContent =
            "Price: " + (qty * PRICE_PER_ITEM).toLocaleString("en-US") + " AMD";
    }

    document.addEventListener("input", function (e) {
        if (e.target && e.target.id === "quantity") {
            calculateBCCost();
        }
    });

    document.addEventListener("DOMContentLoaded", calculateBCCost);
})();



//Ձևաթխտերի տպագրություն Calculator function
// Calculator function

//Բաժակների տպագրություն Calculator function
function SarphForms() {
        const regularPrice = 2000; // Price for 1 piece if quantity is 50 or less
        const discountedPrice = 1900; // Price for 1 piece if quantity is more than 50
        const Sarph = parseInt(document.getElementById('Sarph').value);

        // Check if quantity is valid
        if (!quantity || quantity <= 0) {
            document.getElementById('totalcupCost').innerText = `Price: 0 AMD`;
            return;
        }

        // Determine the applicable price
        const pricePerPiece = Sarph > 50 ? discountedPrice : regularPrice;

        // Calculate total cost
        const totalcupCost = pricePerPiece * Sarph;

        document.getElementById('totalcupCost').innerText = `Price: ${totalcupCost} AMD`;
    }


//Լայնաֆորմատ տպագրությ տեղադրում/փակցնում Calculator function
function PostForms() {
	const pricePerSquareMeter = 4200;
	const squareMeters = parseFloat(document.getElementById('squareMeters').value);
	//    const post = parseInt(document.getElementById('post').value);

	// Check if values are valid
	if (!squareMeters || squareMeters <= 0) {
		document.getElementById('totalptCost').innerText = `Price:  0 AMD`;
		return;
	}

	// Calculate total cost
	const totalptCost = pricePerSquareMeter * squareMeters;
	document.getElementById('totalptCost').innerText = `Price: ${totalptCost} AMD `;
}

function notificate() {
	alert("Այս պահին քննական թեստի ֆունկցիան ժամանակավորապես անհասանելի է և գտնվում է մշակման փուլում։");
	return;
}

// Roll Up Order Form

const rullSizeSelect = document.getElementById("rullsize");
const rullQuantityInput = document.getElementById("rullquantity");
const rullTotalDisplay = document.getElementById("totalRLPrice");

rullSizeSelect.addEventListener("change", function () {
    rullQuantityInput.disabled = false;
    calculateRollUpPrice();
});

rullQuantityInput.addEventListener("input", calculateRollUpPrice);

function calculateRollUpPrice() {
    const price = parseInt(rullSizeSelect.value) || 0;
    const quantity = parseInt(rullQuantityInput.value) || 1;
    const total = price * quantity;
    rullTotalDisplay.textContent = "Price: " + total.toLocaleString('en-US') + " AMD";
}

// Canvas Printing

const canvasPrices = {
    "20x30": 5460,
    "30x40": 5850,
    "40x50": 6370,
    "50x70": 6890,
    "60x80": 7410,
    "70x100": 7930,
    "100x150": 14820,
    "20x20": 5670,
    "25x35": 6100,
    "35x35": 6620,
    "40x60": 6620,
    "60x60": 7700,
    "80x120": 9180,
    "100x100": 10400,
    "120x180": 19700
};

const canvasSizeSelect = document.getElementById('canvasize');
const canvasQuantityInput = document.getElementById('canvaquantity');
const canvasTotalDisplay = document.getElementById('canvatotal');

canvasSizeSelect.addEventListener('change', calculateCanvasTotal);
canvasQuantityInput.addEventListener('input', calculateCanvasTotal);

function calculateCanvasTotal() {
    const selectedSize = canvasSizeSelect.value;
    const quantity = parseInt(canvasQuantityInput.value) || 1;

    if (selectedSize && canvasPrices[selectedSize]) {
        const total = canvasPrices[selectedSize] * quantity;
        canvasTotalDisplay.textContent = `Price: ${total.toLocaleString('en-US')} AMD`;
    } else {
        canvasTotalDisplay.textContent = 'Price: 0 AMD';
    }
}
// GDPRINT_PLOTTER_20000_FIX — 20,000 AMD / m²
document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector('form[data-service-key="plotter_cutting"]');
  if (!form) return;
  const heightInput = form.querySelector('input[name="Բարձրություն"], input[name="Высота"], input[name="Height"]');
  const widthInput = form.querySelector('input[name="Լայնություն"], input[name="Ширина"], input[name="Width"]');
  const totalEl = document.getElementById("totalPlotterCost");
  if (!heightInput || !widthInput || !totalEl) return;
  const PRICE_PER_SQM = 20000;
  function run() {
    const h = parseFloat(heightInput.value) || 0;
    const w = parseFloat(widthInput.value) || 0;
    const total = (h > 0 && w > 0) ? Math.round(h * w * PRICE_PER_SQM) : 0;
    totalEl.textContent = "Price: " + total.toLocaleString("hy-AM") + " AMD";
  }
  heightInput.addEventListener("input", run);
  widthInput.addEventListener("input", run);
  run();
});
