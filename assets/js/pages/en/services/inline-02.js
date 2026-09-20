/* Extracted from EN/services.html — GDprint v8.0 */
//audio ֆունկցիա
		// Audio files for different languages
		const audioFiles = {
			'hy': 'assets/audio/click.mp3', // Armenian audio
			'ru': '../assets/audio/click.mp3', // Russian audio
			'en': '../assets/audio/click.mp3' // English audio
		};

		// Function to get current language from URL or HTML
		function getCurrentLanguage() {
			const url = window.location.href;
			if (url.includes('/RU/')) return 'ru';
			if (url.includes('/EN/')) return 'en';
			return 'hy'; // Default to Armenian
		}

		// Function to copy text and play audio
		function copyText(textElementId, audioLang = null) {
			const textElement = document.getElementById(textElementId);

			if (!textElement) {
				console.error('Element not found:', textElementId);
				return;
			}

			// Select the text
			textElement.select();
			textElement.setSelectionRange(0, 99999); // For mobile devices

			// Copy text to clipboard
			try {
				const successful = document.execCommand('copy');

				if (successful) {
					// Play audio feedback
					const lang = audioLang || getCurrentLanguage();
					playAudio(lang);

					// Show visual feedback
					showCopyFeedback(textElementId);
				}
			} catch (err) {
				console.error('Copy failed:', err);
				// Fallback: Use modern Clipboard API
				navigator.clipboard.writeText(textElement.value).then(function() {
					const lang = audioLang || getCurrentLanguage();
					playAudio(lang);
					showCopyFeedback(textElementId);
				}).catch(function(err) {
					console.error('Clipboard API failed:', err);
				});
			}
		}

		// Function to play audio
		function playAudio(lang) {
			const audioUrl = audioFiles[lang] || audioFiles['en']; // Default to Armenian
			const audio = new Audio(audioUrl);
			audio.play().catch(e => console.log('Audio play failed:', e));
		}

		// Function to show visual feedback
		function showCopyFeedback(elementId) {
			// Find the message element
			const msgElement = document.querySelector(`[data-for="${elementId}"]`);

			if (msgElement) {
				msgElement.style.display = 'block';
				setTimeout(() => {
					msgElement.style.display = 'none';
				}, 2000);
			}
		}

		// Initialize copy functions when page loads
		document.addEventListener('DOMContentLoaded', function() {
			// Add specific copy functions for each form
			window.copyWideFormat = function() {
				copyText('wideFormat');
			}
			window.copyplotterCross = function() {
				copyText('plotterCross');
			}
			window.copybusinessCard = function() {
				copyText('businessCard');
			}
			window.copyphotoPrint = function() {
				copyText('photoPrint');
			}
			window.copyRollupOrder = function() {
				copyText('RollupOrder');
			}
			window.copyCanvasOrder = function() {
				copyText('CanvasOrder');
			}
			window.copycupOrderForm = function() {
				copyText('cupOrderForm');
			}
			window.copyposterOrderForm = function() {
				copyText('posterOrderForm');
			}
		});
