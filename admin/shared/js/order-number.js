/* ============================================================
   order-number.js
   Generates and displays the order number the instant a modal
   opens (never at submit time), so the number the customer sees
   and copies is always the exact number saved to the database.
   Reusable across every page: site (HY/RU/EN) and the manager's
   "new order" page.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".modal.fade").forEach((modalEl) => {
    modalEl.addEventListener("shown.bs.modal", () => {
      const form = modalEl.querySelector("form.gd-order-form");
      if (!form) return;
      ensureOrderNumber(form);
    });
  });

  // For pages that don't use Bootstrap modals (e.g. an embedded
  // manager page section that's just always visible), generate a
  // number for any .gd-order-form present as soon as the page loads.
  document.querySelectorAll("form.gd-order-form").forEach((form) => {
    if (!form.closest(".modal")) ensureOrderNumber(form);
  });
});

/* ============================================================
   ONE shared "copy order number" handler for all 11 forms.
   Replaces the 11 separate legacy copyWideFormat(), copyplotterCross(),
   copybusinessCard(), etc. functions — those regenerated a brand
   NEW random number on every click instead of copying the existing
   one, which was the root cause of the number mismatch bug.

   HTML usage (same for every form, no onclick attribute needed):
     <button type="button" class="gd-copy-btn">Պատճենել</button>
   as long as this button is somewhere inside the same <form
   class="gd-order-form">, next to the <input name="ID"> field.
   Delegated at the document level, so it works for every form
   automatically — nothing to wire up per-form.
   ============================================================ */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".gd-copy-btn");
  if (!btn) return;

  const form = btn.closest("form");
  const idField = form?.querySelector('input[name="ID"], input[name="order_number"]');
  if (!idField || !idField.value) return;

  navigator.clipboard.writeText(idField.value).then(() => {
    const original = btn.textContent;
    btn.textContent = "✅ Պատճենվեց";
    btn.disabled = true;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1500);
  }).catch(() => {
    // Clipboard API can fail on non-HTTPS/older browsers — fall back
    // to a manual selection so the number is still copyable.
    const temp = document.createElement("textarea");
    temp.value = idField.value;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
    btn.textContent = "✅ Պատճենվեց";
    setTimeout(() => { btn.textContent = "Պատճենել"; }, 1500);
  });
});
