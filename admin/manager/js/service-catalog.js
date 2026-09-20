/* GDprint v8.0 — Manager service grid generated from data/services.json. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const grid = document.getElementById('manager-service-grid');
  if (!grid) return;

  const services = (window.GDPRINT_SERVICE_CATALOG || []).filter(service => service.active !== false);
  const rows = services.filter(service => service.manager?.modal_target);
  const count = document.querySelector('.service-count');
  if (count) count.textContent = `${rows.length} ծառայություն`;

  grid.innerHTML = rows.map(service => {
    const manager = service.manager || {};
    const name = service.names?.hy || service.key;
    const image = '../../assets/img/services/' + service.image.split('/').pop();
    const prefix = manager.prefix || service.prefix || service.site_prefix || '';
    const meta = manager.meta_hy || '';
    const designClass = service.category === 'design' ? ' svc-card-design' : '';
    return `<button class="svc-card svc-card-photo${designClass}" data-bs-target="${esc(manager.modal_target)}" data-bs-toggle="modal" data-service-key="${esc(service.key)}" type="button">
      <span class="svc-icon-box"><img src="${esc(image)}" alt="${esc(name)}" loading="lazy"></span>
      <span class="svc-content"><span class="svc-name">${esc(name)}</span><span class="svc-meta"><span class="svc-prefix">${esc(prefix)}</span><span>${esc(meta)}</span></span></span>
      <span class="svc-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"></path></svg></span>
    </button>`;
  }).join('');

  if (!rows.length) grid.innerHTML = '<div class="service-grid-loading">Ծառայություն չի գտնվել։</div>';
})();
