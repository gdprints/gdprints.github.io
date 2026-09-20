/* Extracted from index.html — GDprint v8.0 */
function setLanguage(lang) {
    const agreed = document.getElementById("agreeTerms").checked;
    if (!agreed) {
      alert("Խնդրում ենք նախ համաձայնել կայքի կանոնակարգին։");
      return;
    }

    // Պահպանում ենք լեզուն՝ հետագայում օգտագործելու համար
    localStorage.setItem("selected_lang", lang);
    localStorage.setItem("agreed", "true");

    // Ստուգում ենք, թե արդյոք կա պահպանված նպատակակետ
    const intendedPage = localStorage.getItem("intendedPage");
    if (intendedPage) {
      localStorage.removeItem("intendedPage");
      window.location.href = intendedPage;
    } else {
      // Ուղղորդում ենք համապատասխան լեզվով էջ
      if (lang === "HY") {
        window.location.href = "home.html";
      } else if (lang === "EN") {
        window.location.href = "EN/home.html";
      } else if (lang === "RU") {
        window.location.href = "RU/home.html";
      }
    }
  }
