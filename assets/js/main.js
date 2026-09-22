
(function () {
	"use strict";

	/**
	 * Apply .scrolled class to the body as the page is scrolled down
	 */
	function toggleScrolled() {
		const selectBody = document.querySelector('body');
		const selectHeader = document.querySelector('#header');
		if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
		window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
	}

	document.addEventListener('scroll', toggleScrolled);
	window.addEventListener('load', toggleScrolled);

	/**
	 * Legacy mobile navigation.
	 * GDprint v7/v8 headers are managed exclusively by gdprint-header-v7.js.
	 */
	const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');
	const isGdprintHeader = Boolean(document.querySelector('#header.gdp-v7-full'));

	if (mobileNavToggleBtn && !isGdprintHeader) {
		function mobileNavToogle() {
			document.querySelector('body').classList.toggle('mobile-nav-active');
			mobileNavToggleBtn.classList.toggle('bi-list');
			mobileNavToggleBtn.classList.toggle('bi-x');
		}
		mobileNavToggleBtn.addEventListener('click', mobileNavToogle);

		document.querySelectorAll('#navmenu a').forEach(navmenu => {
			navmenu.addEventListener('click', () => {
				if (document.querySelector('.mobile-nav-active')) mobileNavToogle();
			});
		});

		document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
			navmenu.addEventListener('click', function (e) {
				e.preventDefault();
				this.parentNode.classList.toggle('active');
				this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
				e.stopImmediatePropagation();
			});
		});
	}

	/**
	 * Preloader
	 */
	const preloader = document.querySelector('#preloader');
	if (preloader) {
		window.addEventListener('load', () => {
			preloader.remove();
		});
	}

	/**
	 * Scroll top button
	 */
	let scrollTop = document.querySelector('.scroll-top');

	function toggleScrollTop() {
		if (scrollTop) {
			window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
		}
	}
	scrollTop.addEventListener('click', (e) => {
		e.preventDefault();
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
	});

	window.addEventListener('load', toggleScrollTop);
	document.addEventListener('scroll', toggleScrollTop);

	/**
	 * Animation on scroll function and init
	 */
	function aosInit() {
		AOS.init({
			duration: 600,
			easing: 'ease-in-out',
			once: true,
			mirror: false
		});
	}
	window.addEventListener('load', aosInit);

	/**
	 * Init swiper sliders
	 */
	function initSwiper() {
		document.querySelectorAll(".init-swiper").forEach(function (swiperElement) {
			let config = JSON.parse(
				swiperElement.querySelector(".swiper-config").innerHTML.trim()
			);

			if (swiperElement.classList.contains("swiper-tab")) {
				initSwiperWithCustomPagination(swiperElement, config);
			} else {
				new Swiper(swiperElement, config);
			}
		});
	}

	window.addEventListener("load", initSwiper);

	/**
	 * Initiate Pure Counter
	 */
	new PureCounter();

	/**
	 * Animate the skills items on reveal
	 */
	let skillsAnimation = document.querySelectorAll('.skills-animation');
	skillsAnimation.forEach((item) => {
		new Waypoint({
			element: item,
			offset: '80%',
			handler: function (direction) {
				let progress = item.querySelectorAll('.progress .progress-bar');
				progress.forEach(el => {
					el.style.width = el.getAttribute('aria-valuenow') + '%';
				});
			}
		});
	});

	/**
	 * Initiate glightbox
	 */
	const glightbox = GLightbox({
		selector: '.glightbox'
	});

	/**
	 * Init isotope layout and filters
	 */
	document.querySelectorAll('.isotope-layout').forEach(function (isotopeItem) {
		let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
		let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
		let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

		let initIsotope;
		imagesLoaded(isotopeItem.querySelector('.isotope-container'), function () {
			initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
				itemSelector: '.isotope-item',
				layoutMode: layout,
				filter: filter,
				sortBy: sort
			});
		});

		isotopeItem.querySelectorAll('.isotope-filters li').forEach(function (filters) {
			filters.addEventListener('click', function () {
				isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
				this.classList.add('filter-active');
				initIsotope.arrange({
					filter: this.getAttribute('data-filter')
				});
				if (typeof aosInit === 'function') {
					aosInit();
				}
			}, false);
		});

	});

})();



window.addEventListener('contextmenu', function(e) {
	e.preventDefault();
});

function openModal() {
			document.getElementById('jobModal').style.display = 'block';
		}

		function closeModal() {
			document.getElementById('jobModal').style.display = 'none';
		}
		
		function closeWidget(){
			document.getElementById('job-widget').style.display = 'none';
		}

		function openFormModal() {
			closeModal();
			document.getElementById('formModal').style.display = 'block';
		}

		function closeFormModal() {
			document.getElementById('formModal').style.display = 'none';
		}

		function submitApplication(event) {
			event.preventDefault();
			document.getElementById('successMsg').style.display = 'block';
		}

		window.onclick = function(event) {
			if (event.target == document.getElementById('jobModal')) closeModal();
			if (event.target == document.getElementById('formModal')) closeFormModal();
		}

 const questions = document.querySelectorAll('.question');
    questions.forEach(q => {
      q.addEventListener('click', () => {
        const answer = q.nextElementSibling;
        const isVisible = answer.style.display === 'block';
        document.querySelectorAll('.answer').forEach(a => a.style.display = 'none');
        answer.style.display = isVisible ? 'none' : 'block';
      });
    });





//(function () {
//  // --- Արգելող ֆունկցիա ---
//  function protectAction(e, text) {
//    // Թույլ ենք տալիս input, select, textarea դաշտերում
//    const tag = (e.target.tagName || "").toLowerCase();
//    if (["input", "textarea", "select"].includes(tag)) return;
//
//    // Թույլ ենք տալիս նաև այն span-ները, որոնք ունեն onclick ֆունկցիա (օրինակ՝ պատճենման կոճակներ)
//    if (!e.target.closest("span[onclick]")) {
//      e.preventDefault();
//      e.stopPropagation();
//      console.warn("Արգելված գործողություն:", text);
//      return false;
//    }
//  }
//
//  // --- Արգելել աջ կոճակը ---
//  document.addEventListener("contextmenu", (e) =>
//    protectAction(e, "Աջ կոճակը արգելված է։")
//  );
//
//  // --- Արգելել տեքստի նշումը (բացառությամբ input, select, textarea) ---
//  document.addEventListener("selectstart", (e) =>
//    protectAction(e, "Տեքստի ընտրությունը արգելված է։")
//  );
//
//  // --- Արգելել քաշելը կամ նշելը ---
//  document.addEventListener("mousedown", (e) => {
//    const tag = (e.target.tagName || "").toLowerCase();
//    if (["input", "textarea", "select"].includes(tag)) return;
//    if (!e.target.closest("span[onclick]")) {
//      if (e.button === 0 || e.button === 2) {
//        protectAction(e, "Քաշելը կամ նշելը արգելված է։");
//      }
//    }
//  });
//
//  // --- Արգելել drag գործողությունը ---
//  document.addEventListener("dragstart", (e) =>
//    protectAction(e, "Քաշելու գործողությունը արգելված է։")
//  );
//
//  // --- Արգելել ստեղնաշարի կոդերը ---
//  document.addEventListener("keydown", (e) => {
//    const tag = (e.target.tagName || "").toLowerCase();
//    // Թույլ ենք տալիս գրել input, textarea, select-ում
//    if (["input", "textarea", "select"].includes(tag)) return;
//
//    const key = (e.key || "").toLowerCase();
//    const ctrl = e.ctrlKey || e.metaKey;
//
//    // Արգելել F1–F12
////    if (e.keyCode >= 112 && e.keyCode <= 123) {
////      protectAction(e, "F1–F12 կոճակները արգելված են։");
////      return false;
////    }
//
//    // Արգելել Ctrl + ...
//    if (ctrl && ["a", "c", "v", "s", "p"].includes(key)) {
//      protectAction(e, `Ctrl + ${key.toUpperCase()} արգելված է։`);
//      return false;
//    }
//  });
//
//  // --- Developer Tools հայտնաբերում ---
//  const devDetector = new Image();
//  Object.defineProperty(devDetector, "id", {
//    get: function () {
//      console.warn("🚫 Developer Tools բացվել է։");
//    },
//  });
//  console.log("%c", devDetector);
//
//  // --- Մոբայլ մենյուի բացման թույլտվություն ---
//  document.addEventListener("click", (e) => {
//    const toggler = e.target.closest(".navbar-toggler");
//    if (toggler) {
//      const menu = document.querySelector(".navbar-collapse");
//      if (menu) menu.classList.toggle("show");
//    }
//  });
//})();

/**
 * ԲԱԺԱՆՈՐԴԱԳՐՈՒԹՅԱՆ ՄՈԴԱԼ
 * Համատեղելի է եռալեզու կայքերի և formsubmit.co-ի հետ
 * 
 * Տեղադրել բոլոր էջերում, մեկ անգամ
 */

(function() {
    'use strict';

    // ===== ԿԱՐԳԱՎՈՐՈՒՄՆԵՐ =====
    const CONFIG = {
        // Ձեր formsubmit.co էլ. հասցեն (ՓՈԽԵԼ ԱՅՍՏԵՂ)
        FORM_EMAIL: 'gdprint.am@mail.ru', // ՓՈԽԱՐԻՆԵՔ ՁԵՐ ԷԼ. ՀԱՍՑԵՈՎ
        
        // Շնորհակալության էջի URL (ըստ ցանկության)
//        THANK_YOU_URL: 'https://gdprint.github.io/thank-you.html',
//        
        // Լեզվի կարգավորում (auto - կվերցնի HTML lang ատրիբուտից)
        DEFAULT_LANGUAGE: 'auto',
        
        // Մոդալի ավտոմատ բացում (true/false)
        AUTO_OPEN: false,
        
        // Քանի վայրկյան հետո բացել ավտոմատ (եթե AUTO_OPEN = true)
        AUTO_OPEN_DELAY: 5
    };

    // ===== ՀԻՄՆԱԿԱՆ ՓՈՓՈԽԱԿԱՆՆԵՐ =====
    let currentLanguage = 'hy'; // hy, ru, en
    let isSubmitting = false;

    // ===== DOM ԷԼԵՄԵՆՏՆԵՐ =====
    const modal = document.getElementById('ns-subscription-modal');
    const form = document.getElementById('ns-subscription-form');
    const successMsg = document.getElementById('ns-success-message');
    const toast = document.getElementById('ns-toast');
    
    // ===== ՍՏՈՒԳԵԼ, ԱՐԴՅՈՔ ԲՈԼՈՐ ԷԼԵՄԵՆՏՆԵՐԸ ԿԱՆ =====
    if (!modal || !form) {
        console.warn('ns-modal: necessary elements not found');
        return;
    }

    // ===== ԼԵԶՎԻ ՀԱՅՏՆԱԲԵՐՈՒՄ =====
    function detectLanguage() {
        // 1. Փորձել HTML lang ատրիբուտից
        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.startsWith('hy')) return 'hy';
        if (htmlLang.startsWith('ru')) return 'ru';
        if (htmlLang.startsWith('en')) return 'en';
        
        // 2. Փորձել URL-ից
        const path = window.location.pathname;
        if (path.includes('/hy/') || path.includes('/am/')) return 'hy';
        if (path.includes('/ru/')) return 'ru';
        if (path.includes('/en/')) return 'en';
        
        // 3. Փորձել localStorage-ից
        const savedLang = localStorage.getItem('site-language');
        if (savedLang && ['hy', 'ru', 'en'].includes(savedLang)) return savedLang;
        
        // 4. Կանխադրված
        return 'hy';
    }

    // ===== ԼԵԶՎԻ ՓՈԽԱՐԻՆՈՒՄ =====
    function setLanguage(lang) {
        if (!['hy', 'ru', 'en'].includes(lang)) lang = 'hy';
        currentLanguage = lang;
        
        // Թաքցնել բոլոր լեզուների տեքստերը, ցույց տալ ընտրվածը
        document.querySelectorAll('[data-lang]').forEach(el => {
            el.style.display = el.getAttribute('data-lang') === lang ? '' : 'none';
        });
        
        // Թարմացնել formsubmit-ի լեզվի դաշտերը
        const langInput = document.getElementById('ns-form-language');
        const submitLangInput = document.getElementById('ns-submit-language');
        if (langInput) langInput.value = lang;
        
        if (submitLangInput) {
            const langNames = { hy: 'Հայերեն', ru: 'Русский', en: 'English' };
            submitLangInput.value = langNames[lang] || 'Հայերեն';
        }
    }

    // ===== ՄՈԴԱԼԻ ԿԱՌԱՎԱՐՈՒՄ =====
    function openModal() {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Analytics (եթե ունեք)
        if (typeof gtag !== 'undefined') {
            gtag('event', 'modal_open', { 'event_category': 'subscription' });
        }
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        
        // Վերականգնել ձևը
        form.style.display = 'block';
        if (successMsg) successMsg.style.display = 'none';
    }

    // ===== TOAST ԾԱՆՈՒՑՈՒՄ =====
    function showToast(message) {
        if (!toast) return;
        
        const toastSpan = toast.querySelector('span');
        if (toastSpan && message) toastSpan.textContent = message;
        
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // ===== FORMVALIDATION =====
    function validateForm(formData) {
        const name = formData.get('Անուն | Name') || '';
        const email = formData.get('Էլ. հասցե | Email') || '';
        const terms = document.getElementById('ns-terms')?.checked || false;
        
        if (!name.trim()) {
            alert(currentLanguage === 'hy' ? 'Անունը պարտադիր է' : 
                  currentLanguage === 'ru' ? 'Имя обязательно' : 'Name is required');
            return false;
        }
        
        if (!email.trim()) {
            alert(currentLanguage === 'hy' ? 'Էլ. հասցեն պարտադիր է' : 
                  currentLanguage === 'ru' ? 'Email обязателен' : 'Email is required');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert(currentLanguage === 'hy' ? 'Մուտքագրեք վավեր էլ. հասցե' : 
                  currentLanguage === 'ru' ? 'Введите корректный email' : 'Enter a valid email address');
            return false;
        }
        
        if (!terms) {
            alert(currentLanguage === 'hy' ? 'Անհրաժեշտ է ընդունել կանոնակարգը' : 
                  currentLanguage === 'ru' ? 'Необходимо принять правила' : 'You must accept the terms');
            return false;
        }
        
        return true;
    }

    // ===== FORM-ի ՈՒՂԱՐԿՈՒՄ (formsubmit.co) =====
    async function handleSubmit(e) {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        // Ստեղծել FormData
        const formData = new FormData(form);
        
        // Վալիդացիա
        if (!validateForm(formData)) return;
        
        isSubmitting = true;
        const submitBtn = document.getElementById('ns-submit-btn');
        const originalText = submitBtn.innerHTML;
        
        // Loading վիճակ
        submitBtn.innerHTML = '<span class="ns-loading"></span> ' + 
            (currentLanguage === 'hy' ? 'Ուղարկվում է...' : 
             currentLanguage === 'ru' ? 'Отправка...' : 'Sending...');
        submitBtn.disabled = true;
        
        try {
            // Ուղարկել formsubmit.co-ին
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                // Հաջողություն
                form.style.display = 'none';
                if (successMsg) successMsg.style.display = 'block';
                
                // Toast
                showToast(currentLanguage === 'hy' ? 'Բաժանորդագրությունը հաջողվեց:' :
                         currentLanguage === 'ru' ? 'Подписка оформлена!' :
                         'Subscription successful!');
                
                // Analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'subscription', {
                        'event_category': 'form',
                        'event_label': currentLanguage
                    });
                }
                
                // 3 վայրկյան հետո փակել մոդալը
                setTimeout(() => {
                    closeModal();
                    // Վերականգնել ձևը հաջորդ անգամվա համար
                    form.style.display = 'block';
                    if (successMsg) successMsg.style.display = 'none';
                    form.reset();
                }, 3000);
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.error('Subscription error:', error);
            
            const errorMsg = currentLanguage === 'hy' ? 'Տեղի ունեցավ սխալ։ Կրկին փորձեք։' :
                            currentLanguage === 'ru' ? 'Произошла ошибка. Попробуйте снова.' :
                            'An error occurred. Please try again.';
            alert(errorMsg);
        } finally {
            isSubmitting = false;
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // ===== EVENT LISTENERS =====
    function initEventListeners() {
        // Փակել կոճակներ
        document.querySelectorAll('#ns-close-modal, #ns-close-footer, #ns-close-footer-ru, #ns-close-footer-en')
            .forEach(btn => {
                if (btn) btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    closeModal();
                });
            });
        
        // Փակել ֆոնին կտտացնելիս
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // ESC ստեղն
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                closeModal();
            }
        });
        
        // Ձևի ուղարկում
        form.addEventListener('submit', handleSubmit);
        
        // Փակել toast-ը կտտացնելիս
        if (toast) {
            toast.addEventListener('click', () => {
                toast.classList.remove('show');
            });
        }
    }

    // ===== AUTO-OPEN (ըստ ցանկության) =====
    function setupAutoOpen() {
        if (!CONFIG.AUTO_OPEN) return;
        
        // Ստուգել, արդեն բաժանորդագրված է
        const hasSubscribed = localStorage.getItem('ns_subscribed');
        if (hasSubscribed) return;
        
        setTimeout(() => {
            openModal();
        }, CONFIG.AUTO_OPEN_DELAY * 1000);
    }

    // ===== INITIALIZATION =====
    function init() {
        // 1. Հայտնաբերել լեզուն
        const detectedLang = detectLanguage();
        setLanguage(detectedLang);
        
        // 2. Թարմացնել form action-ը (ավելացնել էլ. հասցեն)
        if (CONFIG.FORM_EMAIL && CONFIG.FORM_EMAIL !== 'your-email@example.com') {
            form.action = `https://formsubmit.co/${CONFIG.FORM_EMAIL}`;
        } else {
            console.warn('ns-modal: please set your email in CONFIG.FORM_EMAIL');
        }
        
        // 3. Թարմացնել _next URL-ը
        const nextInput = form.querySelector('input[name="_next"]');
        if (nextInput) nextInput.value = CONFIG.THANK_YOU_URL;
        
        // 4. Ավելացնել event listeners
        initEventListeners();
        
        // 5. Auto-open
        setupAutoOpen();
        
        // 6. Պահպանել subscribed status (կարող եք ավելացնել form-ի հաջողությունից հետո)
        const originalHandleSubmit = handleSubmit;
        handleSubmit = async function(e) {
            await originalHandleSubmit(e);
            if (!isSubmitting && form.style.display === 'none') {
                localStorage.setItem('ns_subscribed', 'true');
            }
        };
    }

    // ===== ԳԼՈԲԱԼ ՄԵԹՈԴՆԵՐ (այլ սկրիպտներից կանչելու համար) =====
    window.nsModal = {
        open: openModal,
        close: closeModal,
        setLanguage: setLanguage,
        getLanguage: () => currentLanguage
    };

    // Սկսել
    document.addEventListener('DOMContentLoaded', init);
})();

const navitems = document.querySelectorAll("nav div");
const containers = document.querySelectorAll(".container");

navitems.forEach((item) => {
  item.addEventListener("click", () => {
    navitems.forEach((item) => {
      item.classList.remove("active");
    });
    item.classList.add("active");
    containers.forEach((container) => {
      container.classList.remove("active");
    });
    document.querySelector(`#${item.id}-container`).classList.add("active");
  });
});

const customPicker = document.querySelectorAll(".custom-picker");
const colorPicker = document.querySelectorAll(".color-picker");

customPicker.forEach((item) => {
  item.addEventListener("click", () => {
    item.querySelector(".color-picker").click();
  });
});

colorPicker.forEach((item) => {
  item.addEventListener("change", (e) => {
    color = e.target.value;
    span = item.parentElement.querySelector("span");
    input = item.parentElement.querySelector("input[type=text]");
    span.style.backgroundColor = color;
    input.value = color;
  });
});

const uploadElem = document.querySelector(".upload-img");
const uploadImgInput = document.querySelector("#upload-img-input");

if (uploadElem && uploadImgInput) uploadElem.addEventListener("click", () => {
  uploadImgInput.click();
});

if (uploadImgInput) uploadImgInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    img = uploadImgInput.nextSibling.nextSibling;
    img.src = reader.result;
    generateQRCode();
  };
});

const range = document.querySelector(".custom-slider input"),
  tooltip = document.querySelector(".custom-slider span"),
  setValue = () => {
    const newValue = Number(
        ((range.value - range.min) * 100) / (range.max - range.min)
      ),
      newPosition = 16 - newValue * 0.32;
    tooltip.innerHTML = range.value + " x " + range.value;
    tooltip.style.left = `calc(${newValue}% + (${newPosition}px))`;
  };

document.addEventListener("DOMContentLoaded", setValue);
range.addEventListener("input", setValue);

const customDropdown = document.querySelectorAll(".custom-dropdown");

//add event listeners on all option inside customdropdown
customDropdown.forEach((item) => {
  options = item.querySelectorAll(".option");
  options.forEach((option) => {
    option.addEventListener("click", () => {
      allOptions = option.parentElement.querySelectorAll(".option");
      allOptions.forEach((item) => {
        item.classList.remove("active");
      });
      option.classList.add("active");
      item.querySelector(".selected").innerHTML = option.innerHTML;
      generateQRCode();
    });
  });
});

// Portfolio
function filterItems(category, el) {
  let items = document.querySelectorAll(".portfolio-item");

  items.forEach(item => {
    if (category === "all") {
      item.style.display = "block";
    } else {
      item.style.display = item.classList.contains("filter-" + category)
        ? "block"
        : "none";
    }
  });

  document.querySelectorAll(".sidebar button").forEach(btn => {
    btn.classList.remove("active");
  });

  el.classList.add("active");
}

// Modal
function openModal(img) {
  let modal = document.getElementById("imageModal");
  let modalImg = document.getElementById("modalImg");

  modal.style.display = "flex";
  modalImg.src = img.src;
}

function closeModal() {
  document.getElementById("imageModal").style.display = "none";
};
