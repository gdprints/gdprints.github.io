/* ============================================================
   GDprint order-details.js — human-friendly order details renderer
   v8.0.3

   Keeps canonical ERP/inventory keys in JSON, but hides system
   metadata and removes semantic duplicates in every UI.
   ============================================================ */
(function (global) {
  'use strict';

  const SYSTEM_KEYS = new Set([
    '_server_price',
    '_created_from',
    '_created_via',
    '_repeated_from'
  ]);

  const ALIASES = {
    size: [
      'size', 'paper_size', 'Թղթի չափս', 'Չափս',
      'Размер бумаги', 'Размер', 'Paper size', 'Size'
    ],
    quantity: [
      'quantity', 'Տպագրության քանակը', 'Տպման քանակը', 'Տպաքանակ', 'Քանակ',
      'Количество', 'Тираж', 'Print quantity', 'Quantity'
    ],
    width: ['width', 'Լայնություն', 'Ширина', 'Width'],
    height: ['height', 'Բարձրություն', 'Высота', 'Height'],
    material: ['material', 'Նյութ', 'Материал', 'Material'],
    paper_type: ['paper_type', 'Թղթի տեսակ', 'Тип бумаги', 'Paper type'],
    paper_weight: ['paper_weight', 'grammage', 'Թղթի գրամաժ', 'Գրամաժ', 'Плотность бумаги', 'Paper weight', 'Grammage'],
    print_type: ['print_type', 'Տպագրության տեսակ', 'Тип печати', 'Print type'],
    sides: ['sides', 'side', 'Կողմերի քանակ', 'Կողմեր', 'Стороны', 'Sides'],
    lamination: ['lamination', 'Լամինացիա', 'Ламинация', 'Lamination'],
    finishing: ['finishing', 'finish', 'Հետտպագրական մշակում', 'Постпечатная обработка', 'Finishing'],
    cutting: ['cutting', 'Կտրում', 'Резка', 'Cutting'],
    contour: ['contour', 'border_cut', 'Կտրող կոնտուր', 'Контур резки', 'Cut contour'],
    design: ['design', 'design_name', 'Դիզայն', 'Макет', 'Design'],
    company: ['company', 'company_name', 'Ընկերություն', 'Название компании', 'Company'],
    address: ['address', 'company_address', 'Հասցե', 'Адрес', 'Address'],
    phone: ['phone', 'Հեռախոս', 'Телефон', 'Phone'],
    email: ['email', 'Էլ․ հասցե', 'Էլ. հասցե', 'Email'],
    notes: ['notes', 'comment', 'Նշումներ', 'Комментарий', 'Notes'],
    price_display: [
      '_price_display', 'Հաշվարկված գին (կայքից)', 'Հաշվարկված արժեք',
      'Расчетная цена (с сайта)', 'Calculated price (website)'
    ]
  };

  const LABELS = {
    hy: {
      size: 'Թղթի չափս', quantity: 'Տպագրության քանակը', width: 'Լայնություն', height: 'Բարձրություն',
      material: 'Նյութ', paper_type: 'Թղթի տեսակ', paper_weight: 'Թղթի գրամաժ', print_type: 'Տպագրության տեսակ',
      sides: 'Կողմերի քանակ', lamination: 'Լամինացիա', finishing: 'Հետտպագրական մշակում', cutting: 'Կտրում',
      contour: 'Կտրող կոնտուր', design: 'Դիզայն', company: 'Ընկերություն', address: 'Հասցե', phone: 'Հեռախոս',
      email: 'Էլ․ հասցե', notes: 'Նշումներ', price_display: 'Հաշվարկված գին (կայքից)'
    },
    ru: {
      size: 'Размер бумаги', quantity: 'Количество', width: 'Ширина', height: 'Высота', material: 'Материал',
      paper_type: 'Тип бумаги', paper_weight: 'Плотность бумаги', print_type: 'Тип печати', sides: 'Стороны',
      lamination: 'Ламинация', finishing: 'Постпечатная обработка', cutting: 'Резка', contour: 'Контур резки',
      design: 'Дизайн', company: 'Компания', address: 'Адрес', phone: 'Телефон', email: 'Email', notes: 'Примечания',
      price_display: 'Расчетная цена (с сайта)'
    },
    en: {
      size: 'Paper size', quantity: 'Print quantity', width: 'Width', height: 'Height', material: 'Material',
      paper_type: 'Paper type', paper_weight: 'Paper weight', print_type: 'Print type', sides: 'Sides',
      lamination: 'Lamination', finishing: 'Finishing', cutting: 'Cutting', contour: 'Cut contour', design: 'Design',
      company: 'Company', address: 'Address', phone: 'Phone', email: 'Email', notes: 'Notes',
      price_display: 'Calculated price (website)'
    }
  };

  const aliasToCanonical = new Map();
  Object.entries(ALIASES).forEach(([canonical, aliases]) => {
    aliases.forEach(alias => aliasToCanonical.set(normalizeKey(alias), canonical));
  });

  function normalizeKey(key) {
    return String(key ?? '').trim().toLocaleLowerCase();
  }

  function lang(requested) {
    const raw = String(requested || document?.documentElement?.lang || 'hy').toLowerCase();
    if (raw.startsWith('ru')) return 'ru';
    if (raw.startsWith('en')) return 'en';
    return 'hy';
  }

  function isEmpty(value) {
    return value === '' || value === null || value === undefined;
  }

  function isSystemKey(key) {
    const k = String(key || '');
    if (k === '_price_display') return false;
    return k.startsWith('_') || SYSTEM_KEYS.has(k);
  }

  function canonicalKey(key) {
    return aliasToCanonical.get(normalizeKey(key)) || null;
  }

  function keyPreference(key, canonical) {
    if (key === '_price_display') return 3;
    if (String(key) === canonical) return 1;
    return 2; // human/localized alias wins over canonical technical key
  }

  function prettyRawKey(key) {
    return String(key || '')
      .replace(/^_+/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatValue(value) {
    if (value === true) return 'Այո';
    if (value === false) return 'Ոչ';
    if (Array.isArray(value)) return value.map(formatValue).join(', ');
    if (value && typeof value === 'object') {
      try { return JSON.stringify(value); } catch (_) { return String(value); }
    }
    return String(value ?? '');
  }

  function entries(details, options = {}) {
    const language = lang(options.lang);
    const source = details && typeof details === 'object' ? details : {};
    const chosen = new Map();
    const passthrough = [];
    let index = 0;

    Object.entries(source).forEach(([key, value]) => {
      if (isEmpty(value) || isSystemKey(key)) return;

      const canonical = canonicalKey(key);
      if (!canonical) {
        passthrough.push({
          key,
          semantic: key,
          label: prettyRawKey(key),
          value: formatValue(value),
          index: index++
        });
        return;
      }

      const candidate = {
        key,
        semantic: canonical,
        label: LABELS[language]?.[canonical] || LABELS.hy[canonical] || prettyRawKey(key),
        value: formatValue(value),
        rank: keyPreference(key, canonical),
        index: index++
      };
      const prev = chosen.get(canonical);
      if (!prev || candidate.rank > prev.rank) {
        if (prev) candidate.index = Math.min(candidate.index, prev.index);
        chosen.set(canonical, candidate);
      }
    });

    return [...chosen.values(), ...passthrough]
      .sort((a, b) => a.index - b.index)
      .map(({ key, semantic, label, value }) => ({ key, semantic, label, value }));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  global.GDOrderDetails = Object.freeze({
    entries,
    formatValue,
    escapeHtml,
    canonicalKey,
    isSystemKey
  });
})(window);
