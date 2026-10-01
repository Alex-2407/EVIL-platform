/**
 * Persistenza ed evasione — render, filtri, tabella
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;
  const DATA = window.PERSISTENCE_EVASION_DATA || { techniques: [] };

  // stealth, prevalence e detection usano la stessa scala qualitativa
  const LEVEL_LABEL = {
    low: t('Bassa'),
    medium: t('Media'),
    high: t('Alta'),
  };

  function categoryLabel(cat) {
    return cat === 'evasion' ? t('Evasione') : t('Persistenza');
  }

  function listHtml(items, cls) {
    return `<ul class="mt-list ${cls}">${(items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;
  }

  let activeCategory = 'all';
  let searchQuery = '';

  function $(id) {
    return document.getElementById(id);
  }

  // Escape anche delle virgolette: il risultato finisce pure dentro attributi HTML
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function levelClass(level) {
    if (level === 'high') return 'mt-level--high';
    if (level === 'medium') return 'mt-level--med';
    return 'mt-level--low';
  }

  function filteredTechniques() {
    const q = searchQuery.trim().toLowerCase();
    return DATA.techniques.filter((tech) => {
      if (activeCategory !== 'all' && tech.category !== activeCategory) return false;
      if (!q) return true;
      const hay = [
        tech.title,
        tech.mitre,
        tech.mitreLabel,
        tech.description,
        ...(tech.indicators || []),
        ...(tech.detect || []),
        ...(tech.prevent || []),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderCards() {
    const grid = $('mt-grid');
    const empty = $('mt-empty');
    if (!grid) return;

    const list = filteredTechniques();
    if (empty) empty.hidden = list.length > 0;

    if (!list.length) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = list
      .map((tech) => `
        <article class="mt-card" data-id="${escapeHtml(tech.id)}">
          <div class="mt-card__meta">
            <span class="mt-chip mt-chip--${escapeHtml(tech.category)}">${escapeHtml(categoryLabel(tech.category))}</span>
            <span class="mt-mitre" translate="no" title="${escapeHtml(t('ID MITRE ATT&CK: {id}', { id: tech.mitre }))}">${escapeHtml(tech.mitre)}</span>
          </div>
          <h3 class="mt-card__title">${escapeHtml(tech.title)}</h3>
          <p class="mt-card__mitre-name" translate="no">${escapeHtml(tech.mitreLabel)}</p>
          <p class="mt-card__desc">${escapeHtml(tech.description)}</p>
          <p class="mt-card__label mt-card__label--ioc">${escapeHtml(t('Segnali da cercare'))}</p>
          ${listHtml(tech.indicators, 'mt-list--ioc')}
          <p class="mt-card__label mt-card__label--det">${escapeHtml(t('Come si rileva'))}</p>
          ${listHtml(tech.detect, 'mt-list--det')}
          <p class="mt-card__label mt-card__label--mit">${escapeHtml(t('Come si previene'))}</p>
          ${listHtml(tech.prevent, 'mt-list--mit')}
          <dl class="mt-card__levels">
            <div><dt>${escapeHtml(t('Stealth'))}</dt><dd><span class="mt-level ${levelClass(tech.stealth)}">${escapeHtml(LEVEL_LABEL[tech.stealth] || tech.stealth)}</span></dd></div>
            <div><dt>${escapeHtml(t('Prevalenza'))}</dt><dd><span class="mt-level ${levelClass(tech.prevalence)}">${escapeHtml(LEVEL_LABEL[tech.prevalence] || tech.prevalence)}</span></dd></div>
            <div><dt>${escapeHtml(t('Difficoltà di rilevamento'))}</dt><dd><span class="mt-level ${levelClass(tech.detection)}">${escapeHtml(LEVEL_LABEL[tech.detection] || tech.detection)}</span></dd></div>
          </dl>
        </article>`)
      .join('');
  }

  function renderTable() {
    const tbody = $('mt-compare-body');
    if (!tbody) return;

    const list =
      activeCategory === 'all'
        ? DATA.techniques
        : DATA.techniques.filter((tech) => tech.category === activeCategory);

    tbody.innerHTML = list
      .map((tech) => `
        <tr>
          <th scope="row">${escapeHtml(tech.title)} <span class="mt-table-cat">${escapeHtml(categoryLabel(tech.category))} · <span translate="no">${escapeHtml(tech.mitre)}</span></span></th>
          <td><span class="mt-level ${levelClass(tech.stealth)}">${escapeHtml(LEVEL_LABEL[tech.stealth] || tech.stealth)}</span></td>
          <td><span class="mt-level ${levelClass(tech.prevalence)}">${escapeHtml(LEVEL_LABEL[tech.prevalence] || tech.prevalence)}</span></td>
          <td><span class="mt-level ${levelClass(tech.detection)}">${escapeHtml(LEVEL_LABEL[tech.detection] || tech.detection)}</span></td>
          <td>${escapeHtml(tech.mainMitigation)}</td>
        </tr>`)
      .join('');
  }

  function renderStats() {
    const p = DATA.techniques.filter((tech) => tech.category === 'persistence').length;
    const e = DATA.techniques.filter((tech) => tech.category === 'evasion').length;
    const shown = filteredTechniques().length;
    if ($('mt-stat-persistence')) $('mt-stat-persistence').textContent = String(p);
    if ($('mt-stat-evasion')) $('mt-stat-evasion').textContent = String(e);
    if ($('mt-stat-shown')) $('mt-stat-shown').textContent = String(shown);
  }

  function render() {
    renderStats();
    renderCards();
    renderTable();
  }

  function setCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.mt-filter-btn').forEach((btn) => {
      const on = btn.dataset.category === cat;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    render();
  }

  function bindEvents() {
    $('mt-search')?.addEventListener(
      'input',
      debounce((e) => {
        searchQuery = e.target.value;
        render();
      }, 180)
    );

    document.querySelectorAll('.mt-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => setCategory(btn.dataset.category || 'all'));
    });
  }

  function boot() {
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
