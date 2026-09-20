/* GDprint v8.0 — event handlers extracted from HTML. */
(() => {
  const handlers = {
    click: {
      "e001": function(event) { copyWideFormat() },
      "e002": function(event) { copyplotterCross() },
      "e003": function(event) { copybusinessCard() },
      "e005": function(event) { copyphotoPrint() },
      "e008": function(event) { copycupOrderForm() },
      "e010": function(event) { copyRollupOrder() },
      "e011": function(event) { copyCanvasOrder() },
      "e012": function(event) { copyposterOrderForm() },
      "e014": function(event) { backToOrder() },
    },
    input: {
      "e007": function(event) { photoCount() },
      "e009": function(event) { SarphForms() },
      "e013": function(event) { PostForms() },
    },
    change: {
      "e004": function(event) { filterCards() },
      "e006": function(event) { photoCount() },
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
