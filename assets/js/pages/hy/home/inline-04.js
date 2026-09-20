/* Extracted from home.html — GDprint v8.0 */
const allowedCountries = ["AM"];
		async function checkAccess() {
			try {
				const response = await fetch("https://ipinfo.io/46.36.116.209/json?token=b7d1ce3554c287");
				const data = await response.json();
				const userCountry = data.country;

				console.log("Ձեր երկիրը:", userCountry);

				if (!allowedCountries.includes(userCountry)) {

					const modal = new bootstrap.Modal(document.getElementById('accessModal'));
					modal.show();
				}
			} catch (error) {
				console.error("Սխալ IP ստուգման ժամանակ:", error);
			}
		}

		function closeWindow() {
			window.close();
		}

		// Ստուգումը կատարենք էջի բեռնման ժամանակ
		window.onload = checkAccess;
