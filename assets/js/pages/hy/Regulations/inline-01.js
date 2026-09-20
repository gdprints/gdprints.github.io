/* Extracted from Regulations.html — GDprint v8.0 */
// Ստուգում ենք, թե արդյոք օգտատերը համաձայնվել է կանոններին
  const agreed = localStorage.getItem("agreed");

  // Եթե համաձայնություն չկա և օգտատերը չի գտնվում index.html էջում
  if (!agreed && !window.location.pathname.endsWith("index.html")) {
    // Պահպանում ենք օգտատիրոջ նախնական նպատակակետը
    const intendedPage = window.location.href;
    localStorage.setItem("intendedPage", intendedPage);

    // Վերուղղում ենք index.html էջ
    window.location.href = "index.html";
  }
