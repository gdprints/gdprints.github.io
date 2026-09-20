document.addEventListener('DOMContentLoaded', function(){
  const h=document.getElementById('header');
  if(!h || !h.classList.contains('gdp-v7-full')) return;

  const serviceMenu=h.querySelector('.service-menu');
  const serviceBtn=h.querySelector('.gdp-service-trigger');
  const mega=h.querySelector('.gdp-mega');

  const other=h.querySelector('.dropdown');
  const otherBtn=other?.querySelector(':scope > a');
  const otherMenu=other?.querySelector(':scope > ul');

  const lang=h.querySelector('.language-dropdown');
  const langBtn=h.querySelector('.language-button');
  const langMenu=h.querySelector('.language-menu');

  const searchBtn=h.querySelector('.gdp-search-toggle');
  const searchPanel=h.querySelector('.gdp-search-panel');
  const searchInput=h.querySelector('.gdp-search-input');
  const searchResults=h.querySelector('.gdp-search-results');
  const mobile=h.querySelector('.mobile-nav-toggle');

  const services=[...h.querySelectorAll('.gdp-mega a[data-service-key]')].map(a=>({
    key:(a.dataset.serviceKey || '').trim(),
    name:(a.textContent || '').trim(),
    href:a.getAttribute('href') || 'services.html'
  })).filter(x=>x.key && x.name);

  function getEmptyMessage(){
    const langCode=(document.documentElement.lang || '').toLowerCase();
    if(langCode.startsWith('ru')) return 'Услуга не найдена';
    if(langCode.startsWith('en')) return 'No service found';
    const path=location.pathname.toLowerCase();
    if(path.includes('/ru/')) return 'Услуга не найдена';
    if(path.includes('/en/')) return 'No service found';
    return 'Ծառայություն չի գտնվել';
  }

  function render(q){
    const s=(q||'').trim().toLocaleLowerCase();
    const rows=services.filter(x =>
      !s ||
      x.name.toLocaleLowerCase().includes(s) ||
      x.key.toLocaleLowerCase().includes(s)
    ).slice(0,30);

    searchResults.innerHTML=rows.length
      ? rows.map(x=>`
          <a class="gdp-search-result" href="${x.href}">
            <span>${x.name}</span>
            <i class="bi bi-arrow-right"></i>
          </a>
        `).join('')
      : `<div class="gdp-search-empty">${getEmptyMessage()}</div>`;
  }

  const canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const closeTimers = new WeakMap();

  function clearClose(el){
    const t=closeTimers.get(el);
    if(t) clearTimeout(t);
    closeTimers.delete(el);
  }

  function openMenu(el){
    clearClose(el);
    el?.classList.add('open');
  }

  function closeMenuSoon(el, delay=320){
    clearClose(el);
    const t=setTimeout(()=>el?.classList.remove('open'), delay);
    closeTimers.set(el,t);
  }

  function bindStableHover(wrapper, popup){
    if(!wrapper || !popup || !canHover) return;

    wrapper.addEventListener('mouseenter',()=>openMenu(wrapper));
    wrapper.addEventListener('mouseleave',()=>closeMenuSoon(wrapper,360));

    popup.addEventListener('mouseenter',()=>openMenu(wrapper));
    popup.addEventListener('mouseleave',()=>closeMenuSoon(wrapper,360));
  }

  /* Stable desktop hover: moving from button to menu no longer closes it. */
  bindStableHover(serviceMenu, mega);
  bindStableHover(lang, langMenu);
  bindStableHover(other, otherMenu);

  /* Click/touch behavior remains available. */
  serviceBtn?.addEventListener('click',e=>{
    e.stopPropagation();
    clearClose(serviceMenu);
    serviceMenu.classList.toggle('open');
    serviceBtn.setAttribute('aria-expanded',String(serviceMenu.classList.contains('open')));
  });

  otherBtn?.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    clearClose(other);
    other.classList.toggle('open');
  });

  langBtn?.addEventListener('click',e=>{
    e.stopPropagation();
    clearClose(lang);
    lang.classList.toggle('open');
  });

  searchBtn?.addEventListener('click',e=>{
    e.stopPropagation();
    searchPanel.classList.toggle('open');
    if(searchPanel.classList.contains('open')){
      render(searchInput.value);
      setTimeout(()=>searchInput.focus(),30);
    }
  });

  searchInput?.addEventListener('input',()=>render(searchInput.value));

  mobile?.addEventListener('click',e=>{
    e.stopPropagation();
    h.classList.toggle('mobile-open');
    mobile.className=h.classList.contains('mobile-open')
      ? 'mobile-nav-toggle d-xl-none bi bi-x-lg'
      : 'mobile-nav-toggle d-xl-none bi bi-list';
  });

  document.addEventListener('click',e=>{
    if(!h.contains(e.target)){
      serviceMenu?.classList.remove('open');
      other?.classList.remove('open');
      lang?.classList.remove('open');
      searchPanel?.classList.remove('open');
      h.classList.remove('mobile-open');
    }
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      serviceMenu?.classList.remove('open');
      other?.classList.remove('open');
      lang?.classList.remove('open');
      searchPanel?.classList.remove('open');
      h.classList.remove('mobile-open');
    }
  });
});
