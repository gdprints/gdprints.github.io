
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-portfolio-root]");
  if (!root) return;

  const cards = [...root.querySelectorAll("[data-project-card]")];
  const filterButtons = [...root.querySelectorAll("[data-filter]")];
  const searchInput = root.querySelector("[data-portfolio-search]");
  const empty = root.querySelector("[data-empty]");
  const grid = root.querySelector("[data-project-grid]");
  const gridBtn = root.querySelector("[data-view='grid']");
  const listBtn = root.querySelector("[data-view='list']");
  const openFilter = root.querySelector("[data-open-filter]");
  const closeFilter = root.querySelector("[data-close-filter]");
  const panel = root.querySelector("[data-filter-panel]");
  const backdrop = root.querySelector("[data-filter-backdrop]");
  const modal = root.querySelector("[data-project-modal]");
  const modalImg = root.querySelector("[data-modal-img]");
  const modalTitle = root.querySelector("[data-modal-title]");
  const modalMeta = root.querySelector("[data-modal-meta]");
  const modalOrder = root.querySelector("[data-modal-order]");

  let activeFilter = "all";

  function applyFilter() {
    const query = (searchInput?.value || "").trim().toLocaleLowerCase();
    let visible = 0;

    cards.forEach(card => {
      const category = card.dataset.category || "";
      const haystack = (card.dataset.search || "").toLocaleLowerCase();
      const matchesCategory = activeFilter === "all" || category === activeFilter;
      const matchesSearch = !query || haystack.includes(query);
      card.hidden = !(matchesCategory && matchesSearch);
      if (!card.hidden) visible++;
    });

    empty?.classList.toggle("show", visible === 0);
  }

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter || "all";
      filterButtons.forEach(x => x.classList.toggle("active", x.dataset.filter === activeFilter));
      applyFilter();
      if (window.innerWidth <= 820) closeFilters();
    });
  });

  searchInput?.addEventListener("input", applyFilter);

  gridBtn?.addEventListener("click", () => {
    grid?.classList.remove("list-view");
    gridBtn.classList.add("active");
    listBtn?.classList.remove("active");
  });
  listBtn?.addEventListener("click", () => {
    grid?.classList.add("list-view");
    listBtn.classList.add("active");
    gridBtn?.classList.remove("active");
  });

  function openFilters() {
    panel?.classList.add("open");
    backdrop?.classList.add("open");
    document.body.classList.add("gdp-filter-open");
  }
  function closeFilters() {
    panel?.classList.remove("open");
    backdrop?.classList.remove("open");
    document.body.classList.remove("gdp-filter-open");
  }
  openFilter?.addEventListener("click", openFilters);
  closeFilter?.addEventListener("click", closeFilters);
  backdrop?.addEventListener("click", closeFilters);

  function closeModal() {
    modal?.classList.remove("open");
    document.body.classList.remove("gdp-project-modal-open");
  }

  root.querySelectorAll("[data-project-open]").forEach(btn => {
    btn.addEventListener("click", () => {
      const card = btn.closest("[data-project-card]");
      if (!card || !modal) return;
      modalImg.src = card.dataset.image || "";
      modalImg.alt = card.dataset.title || "";
      modalTitle.textContent = card.dataset.title || "";
      modalMeta.textContent = card.dataset.meta || "";
      modalOrder.href = card.dataset.orderHref || "services.html";
      modal.classList.add("open");
      document.body.classList.add("gdp-project-modal-open");
    });
  });

  root.querySelectorAll("[data-modal-close]").forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      closeModal();
      closeFilters();
    }
  });

  applyFilter();
});
