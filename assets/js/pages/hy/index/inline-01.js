/* Extracted from index.html — GDprint v8.0 */
window.onload = function () {
    const savedLang = localStorage.getItem("selected_lang");

    if (savedLang === "HY") {
      window.location.href = "home.html";
    } else if (savedLang === "EN") {
      window.location.href = "EN/home.html";
    } else if (savedLang === "RU") {
      window.location.href = "RU/home.html";
    }
  };
