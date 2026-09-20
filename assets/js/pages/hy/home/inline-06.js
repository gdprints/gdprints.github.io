/* Extracted from home.html — GDprint v8.0 */
// Initialize AOS
		AOS.init({
			duration: 800,
			easing: 'ease-in-out',
			once: true
		});

		// Կառուսելի ավտոմատ պտույտ
		document.addEventListener('DOMContentLoaded', function() {
			var myCarousel = document.getElementById('hero-carousel');
			if (myCarousel) {
				var carousel = new bootstrap.Carousel(myCarousel, {
					interval: 5000,
					wrap: true,
					pause: 'hover'
				});
			}
		});
