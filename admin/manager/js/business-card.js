/* Business-card chooser used by the exact public-site form cloned into manager/new-order.html. */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('design-modal');
  const open = document.getElementById('open-modal');
  const close = modal?.querySelector('.close');
  const selected = document.getElementById('selected-design');
  if (open && modal) open.addEventListener('click', () => { modal.style.display='block'; modal.classList.add('gd-design-open'); });
  if (close && modal) close.addEventListener('click', () => { modal.style.display='none'; modal.classList.remove('gd-design-open'); });
  modal?.querySelectorAll('.design-option').forEach(card => card.addEventListener('click', () => {
    if (selected) selected.value = card.dataset.designName || card.querySelector('p')?.textContent || '';
    modal.style.display='none'; modal.classList.remove('gd-design-open');
  }));
});
function filterCards(){
  const category=document.getElementById('category')?.value || 'all';
  document.querySelectorAll('#design-modal .design-option').forEach(card => {
    card.style.display=(category==='all'||card.dataset.category===category)?'block':'none';
  });
}
