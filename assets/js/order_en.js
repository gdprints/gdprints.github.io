// Simulated order data
const orderData = {
	"148025": {
		title: "Order #148025 - Advertising poster printing",
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
	}, 
	"AT-889619": {
		title: "Order #AT-889619 – Business Card Printing",
		printingMaterial: "Paper: 300 gsm Glossy",
		orderStage: "⏳ Awaiting Approval",
		customerData: {
			name: "Rafael Aloyan",
			 email: "rafaelaloyan@gmail.com",
			phone: "+37433911090"
		},
		description: "A modern, premium, double-sided business card designed in a high-tech style. Both sides feature the same visual design, with one side presenting all information in Armenian and the other in English. The dark technology-inspired background, blue neon accents, and the central Voltus logo create an innovative, professional, and trustworthy appearance. The bilingual layout makes the business card suitable for both local and international clients while maintaining a consistent brand identity and a premium professional look.",
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
                <p><strong>Print Material Type:</strong> ${order.printingMaterial}</p>
                <p><strong>Order Status:</strong> ${order.orderStage}</p>
                <p><strong>Customer Details:</strong></p>
                <ul>
                    <li><strong>Name:</strong> ${order.customerData.name}</li>
                    <li><strong>Email Address:</strong> ${order.customerData.email}</li>
                    <li><strong>Phone Number:</strong> ${order.customerData.phone}</li>
                </ul>
                <p><strong>Order Description:</strong> ${order.description}</p>
            `;

		// Display images in a responsive grid with zoom functionality
		order.images.forEach(imageUrl => {
			const colDiv = document.createElement("div");
			colDiv.className = "col";

			const img = document.createElement("img");
			img.src = imageUrl;
			img.alt = "Պատվերի Նկար";
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
		message.textContent = "No order found. Please enter a valid order number.";

	}
}

// Function to return to the order view
function backToOrder() {
	const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
	orderModal.show();
}