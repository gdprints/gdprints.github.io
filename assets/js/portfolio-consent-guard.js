
(() => {
  const agreed = localStorage.getItem("agreed");
  if (!agreed && !window.location.pathname.endsWith("index.html")) {
    localStorage.setItem("intendedPage", window.location.href);
    const prefix = window.location.pathname.includes("/EN/") || window.location.pathname.includes("/RU/") ? "../" : "";
    window.location.href = prefix + "index.html";
  }
})();
