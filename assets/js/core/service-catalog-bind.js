(() => {
  const catalog = window.GDPRINT_SERVICE_BY_KEY || {};
  const htmlLang = (document.documentElement.lang || 'hy').toLowerCase();
  const locale = htmlLang.startsWith('ru') ? 'ru' : htmlLang.startsWith('en') ? 'en' : 'hy';
  document.querySelectorAll('[data-catalog-card][data-service-key]').forEach(card => {
    const service = catalog[card.dataset.serviceKey];
    if (!service) return;
    const name = service.names?.[locale] || service.names?.hy || service.key;
    const nameNode = card.querySelector('[data-service-name], .svc-name, h3');
    if (nameNode && card.dataset.catalogName !== 'off') nameNode.textContent = name;
    const image = card.querySelector('img[data-service-image], .svc-icon-box img, .gdp-service-image img');
    if (image && card.dataset.catalogImage !== 'off') {
      const basename = service.image.split('/').pop();
      const prefix = card.dataset.imagePrefix || '';
      image.src = `${prefix}assets/img/services/${basename}`;
      if (!image.alt) image.alt = name;
    }
  });
})();
