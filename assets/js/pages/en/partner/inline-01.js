/* Extracted from EN/partner.html — GDprint v8.0 */
document.addEventListener('DOMContentLoaded', function() {
  // Մոդալի էլեմենտներ
  const modalOverlay = document.getElementById('partnerModalOverlay');
  const successModal = document.getElementById('successModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const closeSuccessModalBtn = document.getElementById('closeSuccessModal');
  const openModalButtons = document.querySelectorAll('.open-partner-modal');
  const form = document.getElementById('partnerRegistrationForm');
  
  // Քայլերի նավիգացիա
  const steps = document.querySelectorAll('.form-step');
  const stepIndicators = document.querySelectorAll('.step');
  const nextStepBtns = document.querySelectorAll('.next-step-btn');
  const prevStepBtns = document.querySelectorAll('.prev-step-btn');
  const cancelBtn = document.querySelector('.cancel-btn');
  const submitBtn = document.querySelector('.submit-btn');
  
  // Փաթեթի ընտրություն
  const planOptions = document.querySelectorAll('.plan-option');
  const selectedPlanInput = document.getElementById('selectedPlan');
  
  // Ստուգման էլեմենտներ
  const summaryPlanName = document.getElementById('summaryPlanName');
  const summaryPlanPrice = document.getElementById('summaryPlanPrice');
  const summaryFullName = document.getElementById('summaryFullName');
  const summaryPhone = document.getElementById('summaryPhone');
  const summaryEmail = document.getElementById('summaryEmail');
  const summaryCompany = document.getElementById('summaryCompany');
  const summaryCompanyType = document.getElementById('summaryCompanyType');
  const summaryTIN = document.getElementById('summaryTIN');
  const summaryAddress = document.getElementById('summaryAddress');
  
  // Փաթեթների տվյալներ
  const planData = {
    'Սկսնակ': {
      title: 'Starter',
      price: '4500 դր/մ² - 100մ² ամսական',
      volume: 100
    },
    'Բիզնես': {
      title: 'Business',
      price: '4000 դր/մ² - 500մ² ամսական',
      volume: 500
    },
    'Ընկերություն': {
      title: 'Enterprise',
      price: '3300 դր/մ² - 1000+ մ² ամսական',
      volume: 1000
    }
  };
  
  // Մոդալի նախաստորագրում
  function initModal() {
    goToStep(1);
    
    // Քլիար ընտրությունը
    planOptions.forEach(option => {
      option.classList.remove('selected');
    });
    
    // Քլիար սխալի հաղորդագրությունները
    document.querySelectorAll('.error-message').forEach(el => {
      el.textContent = '';
    });
    
    // Քլիար դաշտերի սահմանները
    document.querySelectorAll('input, select, textarea').forEach(el => {
      el.style.borderColor = '';
    });
  }
  
  // Փաթեթի ընտրություն մոդալի բացման ժամանակ
  openModalButtons.forEach(button => {
    button.addEventListener('click', function() {
      const selectedPlan = this.getAttribute('data-plan');
      
      // Փակել և բացել մոդալը
      if (modalOverlay.classList.contains('active')) {
        closeModal();
        setTimeout(() => {
          initModal();
          selectPlan(selectedPlan);
          openModal();
        }, 300);
      } else {
        initModal();
        selectPlan(selectedPlan);
        openModal();
      }
    });
  });
  
  // Փաթեթի ընտրություն ֆունկցիա
  function selectPlan(planName) {
    planOptions.forEach(option => {
      const optionPlan = option.getAttribute('data-plan');
      if (optionPlan === planName) {
        option.classList.add('selected');
        selectedPlanInput.value = planName;
        
        // Սահմանել ակնկալվող ծավալը
        const volumeInput = document.getElementById('expectedVolume');
        if (volumeInput && planData[planName]) {
          volumeInput.value = planData[planName].volume;
        }
      }
    });
  }
  
  // Փաթեթի մանուալ ընտրություն
  planOptions.forEach(option => {
    option.addEventListener('click', function() {
      const plan = this.getAttribute('data-plan');
      
      // Հեռացնել ընտրությունը բոլորից
      planOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Ավելացնել ընտրվածին
      this.classList.add('selected');
      
      // Պահպանել ընտրված փաթեթը
      selectedPlanInput.value = plan;
      
      // Սահմանել ակնկալվող ծավալը
      const volumeInput = document.getElementById('expectedVolume');
      if (volumeInput && planData[plan]) {
        volumeInput.value = planData[plan].volume;
      }
    });
  });
  
  // Քայլերի նավիգացիա
  function goToStep(stepNumber) {
    // Թաքցնել բոլոր քայլերը
    steps.forEach(step => step.classList.remove('active'));
    
    // Ցույց տալ ընտրված քայլը
    const stepElement = document.getElementById(`step${stepNumber}`);
    if (stepElement) {
      stepElement.classList.add('active');
    }
    
    // Թարմացնել քայլերի ցուցիչը
    stepIndicators.forEach(indicator => {
      const indicatorStep = parseInt(indicator.getAttribute('data-step'));
      if (indicatorStep <= stepNumber) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    });
    
    // Սկրոլ դեպի վերև
    document.querySelector('.partner-modal-content').scrollTop = 0;
  }
  
  // Հաջորդ քայլ կոճակներ
  nextStepBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const nextStep = parseInt(this.getAttribute('data-next'));
      const currentStep = nextStep - 1;
      
      // Ստուգել ընթացիկ քայլը
      if (validateStep(currentStep)) {
        if (nextStep === 3) {
          updateSummary();
        }
        goToStep(nextStep);
      }
    });
  });
  
  // Նախորդ քայլ կոճակներ
  prevStepBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const prevStep = parseInt(this.getAttribute('data-prev'));
      goToStep(prevStep);
    });
  });
  
  // Քայլի վալիդացիա
  function validateStep(stepNumber) {
    if (stepNumber === 1) {
      // Ստուգել փաթեթի ընտրությունը
      if (!selectedPlanInput.value) {
        alert('Please select a partner package.');
        return false;
      }
      return true;
    }
    
    if (stepNumber === 2) {
      let isValid = true;
      
      // Ստուգել պարտադիր դաշտերը
      const requiredFields = ['firstName', 'lastName', 'phone', 'email', 'companyName', 'companyType', 'tin', 'address'];
      
      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}Error`);
        
        if (field && field.hasAttribute('required')) {
          const value = field.value.trim();
          
          if (!value) {
            isValid = false;
            field.style.borderColor = 'var(--primary-red)';
            if (error) {
              error.textContent = 'This field is required.';
            }
          } else if (fieldId === 'email' && !isValidEmail(value)) {
            isValid = false;
            field.style.borderColor = 'var(--primary-red)';
            if (error) {
              error.textContent = 'Please enter a valid email address.';
            }
          } else if (fieldId === 'phone' && !isValidPhone(value)) {
            isValid = false;
            field.style.borderColor = 'var(--primary-red)';
            if (error) {
              error.textContent = 'Please enter a valid phone number.';
            }
          } else {
            field.style.borderColor = '';
            if (error) {
              error.textContent = '';
            }
          }
        }
      });
      
      return isValid;
    }
    
    return true;
  }
  
  // Email վալիդացիա
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Հեռախոսի վալիդացիա
  function isValidPhone(phone) {
    const phoneRegex = /^\+374\d{8}$|^0\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
  
  // Թարմացնել ստուգման տվյալները
  function updateSummary() {
    // Փաթեթի տվյալներ
    const selectedPlan = selectedPlanInput.value;
    if (planData[selectedPlan]) {
      summaryPlanName.textContent = planData[selectedPlan].title;
      summaryPlanPrice.textContent = planData[selectedPlan].price;
    }
    
    // Անձնական տվյալներ
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    summaryFullName.textContent = `${firstName} ${lastName}`.trim() || '-';
    summaryPhone.textContent = document.getElementById('phone')?.value || '-';
    summaryEmail.textContent = document.getElementById('email')?.value || '-';
    
    // Ընկերության տվյալներ
    summaryCompany.textContent = document.getElementById('companyName')?.value || '-';
    summaryTIN.textContent = document.getElementById('tin')?.value || '-';
    summaryAddress.textContent = document.getElementById('address')?.value || '-';
    
    // Ընկերության տեսակ
    const companyTypeSelect = document.getElementById('companyType');
    if (companyTypeSelect) {
      const selectedOption = companyTypeSelect.options[companyTypeSelect.selectedIndex];
      summaryCompanyType.textContent = selectedOption.text || '-';
    }
  }
  
  // Մոդալի բացում/փակում
  function openModal() {
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
  
  function openSuccessModal() {
    successModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  function closeSuccessModal() {
    successModal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }
  
  // Մոդալի փակում
  closeModalBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  closeSuccessModalBtn.addEventListener('click', closeSuccessModal);
  
  // Մոդալի դուրս սեղմելուց փակում
  modalOverlay.addEventListener('click', function(e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
  
  successModal.addEventListener('click', function(e) {
    if (e.target === successModal) {
      closeSuccessModal();
    }
  });
  
  // Հեռախոսի համարի ֆորմատավորում
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      
      if (value.startsWith('374')) {
        value = '+' + value;
      } else if (value.startsWith('0')) {
        value = value;
      } else if (value.length > 0) {
        value = '+374' + value;
      }
      
      // Ֆորմատավորում բացատներով
      if (value.length > 4) {
        value = value.replace(/(\+\d{3})(\d{2})(\d{3})(\d{3})/, '$1 $2 $3 $4');
      }
      
      e.target.value = value;
    });
  }
  
  // Real-time validation
  const fieldsToValidate = ['firstName', 'lastName', 'email', 'phone', 'companyName', 'tin', 'address'];
  
  fieldsToValidate.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('blur', function() {
        validateField(fieldId);
      });
    }
  });
  
  function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(`${fieldId}Error`);
    
    if (!field || !error) return;
    
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
      field.style.borderColor = 'var(--primary-red)';
      error.textContent = 'This field is required.';
      return false;
    }
    
    if (fieldId === 'email' && value && !isValidEmail(value)) {
      field.style.borderColor = 'var(--primary-red)';
      error.textContent = 'Please enter a valid email address.';
      return false;
    }
    
    if (fieldId === 'phone' && value && !isValidPhone(value)) {
      field.style.borderColor = 'var(--primary-red)';
      error.textContent = 'Please enter a valid phone number.';
      return false;
    }
    
    field.style.borderColor = '';
    error.textContent = '';
    return true;
  }
  
  // Terms checkbox validation
  const termsCheckbox = document.getElementById('agreeTerms');
  const termsError = document.getElementById('termsError');
  
  if (termsCheckbox) {
    termsCheckbox.addEventListener('change', function() {
      if (!this.checked && termsError) {
        termsError.textContent = 'You must agree to the terms.';
      } else if (termsError) {
        termsError.textContent = '';
      }
    });
  }
  
  // Form submission
  if (form) {
    form.addEventListener('submit', function(e) {
      // Prevent default for testing
      e.preventDefault();
      
      // Validate terms
      if (termsCheckbox && !termsCheckbox.checked) {
        if (termsError) {
          termsError.textContent = 'You must agree to the terms.';
          termsError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return false;
      }
      
      // Show loading state
      if (submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
      }
      
      // Submit form
      const formData = new FormData(form);
      
      // For debugging
      console.log('Data to be sent.');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
      }
      
      // Send to FormSubmit.co
      fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        if (response.ok) {
          // Show success modal
          closeModal();
          setTimeout(() => {
            openSuccessModal();
          }, 300);
          
          // Reset form
          form.reset();
          initModal();
        } else {
          alert('Error: Your request was not sent. Please try again.');
        }
      })
      .catch(error => {
        console.error('Սխալ:', error);
        alert('Error: Your request was not sent. Please try again.');
      })
      .finally(() => {
        // Restore button
        if (submitBtn) {
          submitBtn.textContent = 'Submit application';
          submitBtn.disabled = false;
        }
      });
    });
  }
});
