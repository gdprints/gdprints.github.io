(function() {
            'use strict';

            // ========== CONFIGURATION ==========
            const CONFIG = {
                FORM_ACTION: 'https://formsubmit.co/660dd97886433d138ad8015f38da42f1', // CHANGE THIS TO YOUR EMAIL
                SUCCESS_MESSAGE: '✓ Բաժանորդագրությունը հաջողվեց',
                ERROR_MESSAGE: '✗ Սխալ․ կրկին փորձեք',
                REDIRECT_URL: 'https://gdprint.am/#' // optional
            };

            // ========== DOM ELEMENTS ==========
            const modal = document.getElementById('gdpSubscriptionModal');
            const openBtn = document.getElementById('gdpOpenModalBtn');
            const closeBtn = document.getElementById('gdpCloseModalBtn');
            const form = document.getElementById('gdpSubscriptionForm');
            const submitBtn = document.getElementById('gdpSubmitBtn');
            const toast = document.getElementById('gdpToast');
            const toastIcon = document.getElementById('gdpToastIcon');
            const toastMessage = document.getElementById('gdpToastMessage');
            const phoneInput = document.getElementById('gdpPhone');
            const termsCheck = document.getElementById('gdpTerms');
            const nameInput = document.getElementById('gdpName');
            const emailInput = document.getElementById('gdpEmail');
            const audioElement = document.getElementById('gdpSuccessAudio');

            // ========== MODAL CONTROLS ==========
            function openModal() {
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            }

            function closeModal() {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }

            if (openBtn) openBtn.addEventListener('click', openModal);
            if (closeBtn) closeBtn.addEventListener('click', closeModal);

            // Click outside to close
            if (modal) modal.addEventListener('click', function(e) {
                if (e.target === modal) closeModal();
            });

            // ESC key
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && modal && modal.style.display === 'block') closeModal();
            });

            // ========== PHONE FORMATTING ==========
            if (phoneInput) {
                phoneInput.addEventListener('input', function(e) {
                    let value = e.target.value.replace(/[^\d+]/g, '');
                    e.target.value = value;
                });
            }

            // ========== PLAY SOUND FUNCTION ==========
            function playSuccessSound() {
                if (audioElement) {
                    audioElement.play().catch(e => {
                        console.log('Audio playback failed:', e);
                        // Browsers often block autoplay, but user interaction allows it
                    });
                }
            }

            // ========== TOAST FUNCTION (compact) ==========
            function showToast(message, isSuccess = true) {
                if (!toast || !toastIcon || !toastMessage) return;
                
                toastMessage.textContent = message;
                
                if (isSuccess) {
                    toastIcon.className = 'fas fa-check-circle';
                    toast.classList.remove('gdp-toast-error');
                    // Play sound on success
                    playSuccessSound();
                } else {
                    toastIcon.className = 'fas fa-exclamation-circle';
                    toast.classList.add('gdp-toast-error');
                }
                
                toast.classList.add('show');
                
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 3000); // Shorter duration
            }

            // ========== FORM VALIDATION ==========
            function validateForm() {
                if (!nameInput.value.trim()) {
                    showToast('Անունը պարտադիր է', false);
                    nameInput.focus();
                    return false;
                }
                
                if (!emailInput.value.trim()) {
                    showToast('Էլ. հասցեն պարտադիր է', false);
                    emailInput.focus();
                    return false;
                }
                
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailInput.value.trim())) {
                    showToast('Էլ. հասցեն սխալ է', false);
                    emailInput.focus();
                    return false;
                }
                
                if (!termsCheck.checked) {
                    showToast('Ընդունեք պայմանները', false);
                    return false;
                }
                
                return true;
            }

            // ========== FORM SUBMIT HANDLER ==========
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                if (!validateForm()) return;
                
                // Prepare form data
                const formData = new FormData(form);
                formData.append('Գրանցման ամսաթիվ', new Date().toLocaleString('hy-AM'));
                
                // Disable submit button
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span>Ուղարկվում է...</span> <i class="fas fa-spinner fa-pulse"></i>';
                }
                
                // Send to formsubmit.co
                fetch(form.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                })
                .then(response => {
                    if (response.ok) {
                        showToast(CONFIG.SUCCESS_MESSAGE, true);
                        form.reset();
                        closeModal();
                    } else {
                        throw new Error('Server error');
                    }
                })
                .catch(error => {
                    console.error('Submission error:', error);
                    showToast(CONFIG.ERROR_MESSAGE, false);
                })
                .finally(() => {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span>Բաժանորդագրվել</span> <i class="fas fa-arrow-right"></i>';
                    }
                });
            });

            // ========== TOAST CLICK TO CLOSE ==========
            if (toast) {
                toast.addEventListener('click', function() {
                    toast.classList.remove('show');
                });
            }

            // ========== AUTO-CLOSE MODAL ON UNLOAD ==========
            window.addEventListener('beforeunload', function() {
                document.body.style.overflow = '';
            });

            // ========== INIT ==========
            modal.style.display = 'none';
        })();