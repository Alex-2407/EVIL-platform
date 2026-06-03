/**
 * Persistenza ed evasione — render, filtri, tabella
 */
(function () {
  'use strict';

  const DATA = window.PERSISTENCE_EVASION_DATA || { techniques: [] };

  const STEALTH_LABEL = {
    low: 'Bassa',
    medium: 'Media',
    high: 'Alta',
  };

  const PREVALENCE_LABEL = {
    low: 'Bassa',
    medium: 'Media',
    high: 'Alta',
  };

  let activeCategory = 'all';
  let searchQuery = '';

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function levelClass(level) {
    if (level === 'high') return 'mt-level--high';
    if (level === 'medium') return 'mt-level--med';
    return 'mt-level--low';
  }

  function filteredTechniques() {
    const q = searchQuery.trim().toLowerCase();
    return DATA.techniques.filter((t) => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (!q) return true;
      const hay = [t.title, t.mitre, t.mitreLabel, t.description, ...(t.indicators || []), ...(t.mitigation || [])]
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
      .map((t) => {
        const catLabel = t.category === 'evasion' ? 'Evasione' : 'Persistenza';
        return `
        <article class="mt-card" data-id="${escapeHtml(t.id)}">
          <div class="mt-card__meta">
            <span class="mt-chip mt-chip--${escapeHtml(t.category)}">${escapeHtml(catLabel)}</span>
            <span class="mt-mitre" title="${escapeHtml(t.mitreLabel)}">${escapeHtml(t.mitre)}</span>
          </div>
          <h2 class="mt-card__title">${escapeHtml(t.title)}</h2>
          <p class="mt-card__mitre-name">${escapeHtml(t.mitreLabel)}</p>
          <p class="mt-card__desc">${escapeHtml(t.description)}</p>
          <p class="mt-card__label">Indicatori (IoC comportamentali)</p>
          <ul class="mt-list mt-list--ioc">
            ${(t.indicators || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
          <p class="mt-card__label">Mitigazione difensiva</p>
          <ul class="mt-list mt-list--mit">
            ${(t.mitigation || []).map((m) => `<li>${escapeHtml(m)}</li>`).join('')}
          </ul>
        </article>`;
      })
      .join('');
  }

  function renderTable() {
    const tbody = $('mt-compare-body');
    if (!tbody) return;

    const list =
      activeCategory === 'all'
        ? DATA.techniques
        : DATA.techniques.filter((t) => t.category === activeCategory);

    tbody.innerHTML = list
      .map((t) => {
        const cat = t.category === 'evasion' ? 'Evasione' : 'Persistenza';
        return `
        <tr>
          <th scope="row">${escapeHtml(t.title)} <span class="mt-table-cat">${escapeHtml(cat)}</span></th>
          <td><span class="mt-level ${levelClass(t.stealth)}">${escapeHtml(STEALTH_LABEL[t.stealth] || t.stealth)}</span></td>
          <td><span class="mt-level ${levelClass(t.prevalence)}">${escapeHtml(PREVALENCE_LABEL[t.prevalence] || t.prevalence)}</span></td>
          <td><span class="mt-level ${levelClass(t.detection)}">${escapeHtml(STEALTH_LABEL[t.detection] || t.detection)}</span></td>
          <td>${escapeHtml(t.mainMitigation)}</td>
        </tr>`;
      })
      .join('');
  }

  function renderStats() {
    const p = DATA.techniques.filter((t) => t.category === 'persistence').length;
    const e = DATA.techniques.filter((t) => t.category === 'evasion').length;
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
      btn.classList.toggle('is-active', btn.dataset.category === cat);
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
