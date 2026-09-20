document.addEventListener('DOMContentLoaded', function(){
  if(!/\/?services\.html$/i.test(location.pathname)) return;
  const params=new URLSearchParams(location.search);
  const key=params.get('service');
  if(!key) return;

  const form=document.querySelector('form[data-service-key="'+CSS.escape(key)+'"]');
  if(!form) return;
  const modal=form.closest('.modal');
  if(!modal) return;

  // Give the page and Bootstrap scripts a moment to finish initializing.
  setTimeout(function(){
    try{
      if(window.bootstrap && bootstrap.Modal){
        bootstrap.Modal.getOrCreateInstance(modal).show();
      }else{
        // Safe fallback if Bootstrap JS is delayed/missing.
        modal.style.display='block'; modal.style.zIndex='1055';
        modal.classList.add('show');
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal','true');
        document.body.classList.add('modal-open');
      }
    }catch(e){ console.error('GDprint service deep-link:',e); }
  },180);
});
