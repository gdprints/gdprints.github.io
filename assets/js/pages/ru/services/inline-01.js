/* Extracted from RU/services.html — GDprint v8.0 */
document.querySelectorAll("p").forEach(paragraph => {
			paragraph.innerHTML = paragraph.innerHTML.replace(/Design/g, "Версия");
		});

		document.querySelectorAll('[data-design-name]').forEach(element => {
			element.dataset.designName = element.dataset.designName.replace(/Design/g, 'Версия');
		});
