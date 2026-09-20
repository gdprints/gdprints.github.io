// Simulated order data
const orderData = {

	"148025": {
		title: "Заказ #148025 - Печать рекламных плакатов",
		printingMaterial: "Banner",
		orderStage: "Պատրաստման փուլում",
		customerData: {
			name: "Տիգրան Դանելյան",
			email: "tiko_danelyan@bk.ru",
			phone: "093672234"
		},
		description: "Գովազդային պաստառ՝ Սև ֆոնով և կապույտ երանգներով պատկեր է, պարունակում է իր մեջ համակարգչային խաղերի լուսանկարններ առկա տեքստ (GAME ZONE) տառատեսակի անվանումը *PERFORMANCE* ",
		images: [
        "https://github.com/GDprint/GDprint.github.io/blob/Master/img/dummies/works/148.jpg?raw=true"
            ]
	}
	, 
	"AT-889619": {
		title: "Заказ #AT-889619 — Печать визитных карточек",
		printingMaterial: "Бумага: 300 г/м², глянцевая (Glossy)",
		orderStage: "⏳ Ожидает подтверждения",
		customerData: {
			name: "Рафаэль Алоян",
			 email: "rafaelaloyan@gmail.com",
			phone: "+37433911090"
		},
		description: "Современная двусторонняя визитная карточка в премиальном технологичном стиле. Обе стороны выполнены в едином дизайне: одна сторона полностью оформлена на армянском языке, а другая — на английском. Темный технологичный фон, синие неоновые акценты и центральный логотип Voltus создают современный, инновационный и внушающий доверие образ. Двуязычное оформление делает визитную карточку удобной как для местных, так и для международных клиентов, сохраняя единый фирменный стиль и профессиональный внешний вид.",
			images: ["https://github.com/GDprint/GDprint.github.io/blob/Master/assets/img/portfolio/32.jpg?raw=true"]
	}
};

function searchOrder() {
	const orderNumber = document.getElementById("orderNumber").value.trim();
	const message = document.getElementById("message");
	const orderTitle = document.getElementById("orderTitle");
	const orderInfo = document.getElementById("orderInfo");
	const imageGrid = document.getElementById("imageGrid");

	// Clear previous data
	message.textContent = "";
	orderTitle.textContent = "";
	orderInfo.innerHTML = "";
	imageGrid.innerHTML = "";

	// Check if the order exists
	if (orderData[orderNumber]) {
		const order = orderData[orderNumber];

		// Set order title and detailed information
		orderTitle.textContent = order.title;
		orderInfo.innerHTML = `

                <p><strong>Тип материала печати.</strong> ${order.printingMaterial}</p>
                <p><strong>Статус заказа:</strong> ${order.orderStage}</p>
                <p><strong>Данные клиента.</strong></p>
                <ul>
                    <li><strong>Имя:</strong> ${order.customerData.name}</li>
                    <li><strong>Эл адрес:</strong> ${order.customerData.email}</li>
                    <li><strong>Номер телефона:</strong> ${order.customerData.phone}</li>
                </ul>
                <p><strong>Описание заказа:</strong> ${order.description}</p>
            `;

		// Display images in a responsive grid with zoom functionality
		order.images.forEach(imageUrl => {
			const colDiv = document.createElement("div");
			colDiv.className = "col";

			const img = document.createElement("img");
			img.src = imageUrl;
			img.alt = "Изображение заказа:";
			img.className = "order-image img-fluid";
			img.setAttribute("data-bs-toggle", "modal");
			img.setAttribute("data-bs-target", "#zoomModal");

			// Click event to zoom image
			img.onclick = function () {
				document.getElementById("zoomImage").src = img.src;
			};

			colDiv.appendChild(img);
			imageGrid.appendChild(colDiv);
		});

		// Show the modal
		const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
		orderModal.show();
	} else {
		message.textContent = "Заказ не найден. Пожалуйста, введите правильный номер заказа.";

	}
}

// Function to return to the order view
function backToOrder() {
	const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
	orderModal.show();
}