/* GDprint v8.0 — event handlers extracted from HTML. */
(() => {
  const handlers = {
    click: {
    },
    input: {
      "e003": function(event) { photoCount() },
      "e004": function(event) { PostForms() },
      "e005": function(event) { SarphForms() },
    },
    change: {
      "e001": function(event) { filterCards() },
      "e002": function(event) { photoCount() },
    },
  };
  for (const type of ['click','input','change']) {
    document.addEventListener(type, event => {
      const target = event.target.closest?.(`[data-gd-${type}-handler]`);
      if (!target) return;
      const id = target.getAttribute(`data-gd-${type}-handler`);
      const fn = handlers[type]?.[id];
      if (!fn) return;
      const result = fn.call(target, event);
      if (result === false) { event.preventDefault(); event.stopPropagation(); }
    });
  }
})();
