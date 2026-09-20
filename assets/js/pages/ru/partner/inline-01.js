/* Extracted from RU/partner.html — GDprint v8.0 */
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
  
  // Փաթեթի ընտրություն
  const planOptions = document.querySelectorAll('.plan-option');
  const selectedPlanInput = document.getElementById('selectedPlan');
  
  // Ստուգման էլեմենտներ
  const summaryPlanName = document.getElementById('summaryPlanName');
  const summaryFullName = document.getElementById('summaryFullName');
  const summaryPhone = document.getElementById('summaryPhone');
  const summaryEmail = document.getElementById('summaryEmail');
  const summaryCompany = document.getElementById('summaryCompany');
  const summaryCompanyType = document.getElementById('summaryCompanyType');
  const summaryTIN = document.getElementById('summaryTIN');
    // Փաթեթների տվյալներ
  const planData = {
    'Սկսնակ': {
      title: 'Стартовый',
      price: '4500 др/м² - 100м² ежемесячно',
      volume: 100
    },
    'Բիզնես': {
      title: 'Бизнес',
      price: '4000 др/м² - 500м² ежемесячно',
      volume: 500
    },
    'Ընկերություն': {
      title: 'Корпоративный',
      price: '3500 др/м² - 1000+ м² ежемесячно',
      volume: 1000
    }
  };
  // Փաթեթների տվյալներ (համապատասխանեցված լեզուներին)
  const planMapping = {
    'Սկսնակ': 'Стартовый',
    'Բիզնես': 'Бизнес', 
    'Ընկերություն': 'Корпоративный'
  };
  
  // Մոդալի բացում կոճակներից
  openModalButtons.forEach(button => {
    button.addEventListener('click', function() {
      const planKey = this.getAttribute('data-plan');
      const planName = planMapping[planKey] || 'Стартовый';
      
      // Փակել և բացել մոդալը
      closeModal();
      setTimeout(() => {
        initModal();
        openModal();
        
        // Ավտոմատ ընտրել փաթեթը
        selectPlanByName(planName);
      }, 300);
    });
  });
  
  // Փաթեթի ընտրություն անունով
  function selectPlanByName(planName) {
    planOptions.forEach(option => {
      const optionPlan = option.getAttribute('data-plan');
      if (optionPlan === planName) {
        option.classList.add('selected');
        selectedPlanInput.value = planName;
      } else {
        option.classList.remove('selected');
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
    });
  });
  
  // Մոդալի նախաստորագրում
  function initModal() {
    goToStep(1);
    
    // Քլիար ձևը
    if (form) {
      form.reset();
      selectedPlanInput.value = '';
    }
    
    // Քլիար ընտրությունը
    planOptions.forEach(option => {
      option.classList.remove('selected');
    });
  }
  
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
        
        // Սկրոլ դեպի վերև
        const modalContent = document.querySelector('.partner-modal-content');
        if (modalContent) {
          modalContent.scrollTop = 0;
        }
      }
    });
  });
  
  // Նախորդ քայլ կոճակներ
  prevStepBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const prevStep = parseInt(this.getAttribute('data-prev'));
      goToStep(prevStep);
      
      // Սկրոլ դեպի վերև
      const modalContent = document.querySelector('.partner-modal-content');
      if (modalContent) {
        modalContent.scrollTop = 0;
      }
    });
  });
  
  // Քայլի վալիդացիա
  function validateStep(stepNumber) {
    if (stepNumber === 1) {
      // Ստուգել փաթեթի ընտրությունը
      if (!selectedPlanInput.value) {
        alert('Пожалуйста, выберите партнёрский пакет');
        return false;
      }
      return true;
    }
    
    if (stepNumber === 2) {
      // Ստուգել պարտադիր դաշտերը
      const requiredFields = ['firstName', 'lastName', 'phone', 'email', 'companyName', 'companyType', 'tin'];
      let isValid = true;
      
      requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && field.hasAttribute('required')) {
          if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = 'var(--primary-red)';
            
            // Ավելացնել սխալի հաղորդագրություն
            let errorDiv = document.getElementById(`${fieldId}Error`);
            if (!errorDiv) {
              errorDiv = document.createElement('div');
              errorDiv.id = `${fieldId}Error`;
              errorDiv.className = 'error-message';
              errorDiv.textContent = 'Это поле обязательно';
              field.parentNode.appendChild(errorDiv);
            }
          } else {
            field.style.borderColor = '';
            
            // Հեռացնել սխալի հաղորդագրությունը
            const errorDiv = document.getElementById(`${fieldId}Error`);
            if (errorDiv) {
              errorDiv.remove();
            }
          }
        }
      });
      
      return isValid;
    }
    
    return true;
  }
  
  // Թարմացնել ստուգման տվյալները
  function updateSummary() {
    // Փաթեթի տվյալներ
    summaryPlanName.textContent = selectedPlanInput.value || '-';
    
    // Անձնական տվյալներ
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    summaryFullName.textContent = `${firstName} ${lastName}`.trim() || '-';
    summaryPhone.textContent = document.getElementById('phone')?.value || '-';
    summaryEmail.textContent = document.getElementById('email')?.value || '-';
    
    // Ընկերության տվյալներ
    summaryCompany.textContent = document.getElementById('companyName')?.value || '-';
    summaryTIN.textContent = document.getElementById('tin')?.value || '-';
    
    // Ընկերության տեսակ
    const companyTypeSelect = document.getElementById('companyType');
    if (companyTypeSelect) {
      summaryCompanyType.textContent = companyTypeSelect.options[companyTypeSelect.selectedIndex]?.text || '-';
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
  
  // FormSubmit.co-ի հետ աշխատանք
  if (form) {
    form.addEventListener('submit', function(e) {
      // Ստուգել պայմանների ընդունումը
      const termsCheckbox = document.getElementById('agreeTerms');
      if (termsCheckbox && !termsCheckbox.checked) {
        e.preventDefault();
        alert('Пожалуйста, согласитесь с условиями');
        return;
      }
      
      // Ցույց տալ բեռնման ցուցիչ
      const submitBtn = this.querySelector('.submit-btn');
      if (submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Отправка...';
        submitBtn.disabled = true;
        
        // Վերականգնել կոճակը ժամանակաընթացակարգից հետո
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 3000);
      }
      
      // Ցույց տալ հաջողության մոդալը ժամանակաընթացակարգից հետո
      setTimeout(() => {
        closeModal();
        openSuccessModal();
        initModal();
      }, 1000);
    });
  }
});
