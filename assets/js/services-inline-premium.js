(function(){
  const section=document.getElementById('services');
  if(!section) return;

  const search=section.querySelector('[data-gdp-search]');
  const count=section.querySelector('[data-gdp-count]');
  const empty=section.querySelector('.gdp-no-results');
  let active='all';

  function cards(){
    return Array.from(section.querySelectorAll('[data-gdp-card]'));
  }

  function normalize(v){
    return String(v||'').toLocaleLowerCase().trim();
  }

  function syncCategoryCounts(){
    const allCards=cards();
    const real={all:allCards.length};
    allCards.forEach(card=>{
      const k=card.dataset.category||'other';
      real[k]=(real[k]||0)+1;
    });
    section.querySelectorAll('[data-gdp-category]').forEach(btn=>{
      const k=btn.dataset.gdpCategory||'all';
      const spans=btn.querySelectorAll(':scope > span');
      if(spans.length>1) spans[spans.length-1].textContent=String(real[k]||0);
    });
  }

  function apply(){
    const q=normalize(search && search.value);
    let visible=0;
    cards().forEach(card=>{
      const cat=card.dataset.category||'other';
      const title=normalize(card.dataset.serviceTitle || card.querySelector('h3')?.textContent || '');
      const serviceKey=normalize(card.querySelector('.gd-order-form[data-service-key]')?.dataset.serviceKey || '');
      const searchable=title+' '+serviceKey.replace(/_/g,' ');
      const matchesCategory=(active==='all'||cat===active);
      const matchesSearch=(!q||searchable.includes(q));
      const show=matchesCategory&&matchesSearch;

      card.hidden=!show;
      card.style.display=show?'':'none';
      card.setAttribute('aria-hidden',show?'false':'true');
      if(show){
        card.style.visibility='visible';
        card.style.opacity='1';
        card.style.transform='none';
        visible++;
      }
    });
    if(count) count.textContent=String(visible);
    if(empty) empty.style.display=visible?'none':'block';
  }

  section.addEventListener('click',e=>{
    const btn=e.target.closest('[data-gdp-category]');
    if(btn){
      active=btn.dataset.gdpCategory||'all';
      section.querySelectorAll('[data-gdp-category]').forEach(x=>{
        x.classList.toggle('active',(x.dataset.gdpCategory||'all')===active);
      });
      apply();
      return;
    }
    if(e.target.closest('[data-gdp-reset]')){
      active='all';
      if(search) search.value='';
      section.querySelectorAll('[data-gdp-category]').forEach(x=>{
        x.classList.toggle('active',(x.dataset.gdpCategory||'all')==='all');
      });
      apply();
      return;
    }
    if(e.target.closest('[data-gdp-search-btn]')) apply();
  });

  search?.addEventListener('input',apply);
  syncCategoryCounts();
  apply();

  const listRoot=section.querySelector('.gdp-main .row')||section;
  new MutationObserver(()=>{syncCategoryCounts();apply();}).observe(listRoot,{childList:true,subtree:false});
})();