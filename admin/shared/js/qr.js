/* ============================================================
   qr.js — QR code rendering helper
   Uses the locally bundled shared/js/vendor/qrcode.js (no CDN
   dependency, avoiding the network issues we hit with external
   scripts earlier in this project).

   Usage:
     renderQrCode(containerEl, "some text or URL", 120);
   ============================================================ */

function renderQrCode(containerEl, text, sizePx){
  if (!containerEl || !text) return;
  containerEl.innerHTML = "";

  let qr = null;
  // Try increasing QR "type" (capacity) until the data fits —
  // avoids hardcoding a size that might be too small for a longer URL.
  for (let typeNumber = 3; typeNumber <= 40 && !qr; typeNumber++){
    try {
      const candidate = qrcode(typeNumber, "M");
      candidate.addData(text);
      candidate.make();
      qr = candidate;
    } catch (e) { /* try the next size */ }
  }
  if (!qr) return;

  containerEl.innerHTML = qr.createSvgTag(4, 4);
  const svg = containerEl.querySelector("svg");
  if (svg && sizePx){
    svg.style.width = sizePx + "px";
    svg.style.height = sizePx + "px";
    svg.style.display = "block";
  }
}
