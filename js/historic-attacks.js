/**
 * Violazioni storiche — mappa del mondo fissa (SVG) con zoom e trascinamento + card collegate
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;
  const ATTACKS = window.HISTORIC_ATTACKS || [];
  const WORLD = window.WORLD_MAP;
  const SEV = {
    critical: '#f87171',
    high: '#fb923c',
    medium: '#fbbf24',
  };

  function $(id) {
    return document.getElementById(id);
  }

  // Escape anche delle virgolette: il risultato finisce pure dentro attributi HTML
  const escapeHtml = window.EVIL_UTILS.escapeHtml;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function orgMonogram(attack) {
    if (attack.orgMonogram) return attack.orgMonogram;
    const words = (attack.org || '').split(/[\s·]+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (attack.org || '?').slice(0, 2).toUpperCase();
  }

  function logoMarkup(attack, wrapClass) {
    const alt = escapeHtml(attack.org || attack.title);
    const mono = escapeHtml(orgMonogram(attack));
    const cls = wrapClass ? ` ${wrapClass}` : '';
    const img = attack.logo
      ? `<img class="ha-logo" src="${escapeHtml(attack.logo)}" alt="${alt}" loading="lazy" width="56" height="46">`
      : '';
    const fallback = attack.logo ? '' : ' is-fallback';
    return `<span class="ha-logo-wrap${cls}${fallback}">${img}<span class="ha-logo ha-logo--mono" aria-hidden="true">${mono}</span></span>`;
  }

  function popupHtml(attack) {
    return `
      <div class="ha-popup">
        ${logoMarkup(attack, 'ha-logo-wrap--popup')}
        <h4>${escapeHtml(attack.headline || attack.title)}</h4>
        <p class="ha-popup__org">${escapeHtml(attack.org)}</p>
        <p><strong>${attack.year}</strong> · ${escapeHtml(attack.region)}</p>
        <p>${escapeHtml(attack.violation)}</p>
        <p><em>${escapeHtml(attack.actor)}</em></p>
      </div>`;
  }

  /* ------------------------------------------------------------------ mappa SVG fissa */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const MAX_K = 14;
  const view = { k: 1, x: 0, y: 0 };
  let svg;
  let gWorld;
  let gMarks;
  let frame;
  let panel;
  let activeId = null;
  let animId = 0;
  const SEV_LABEL = { critical: t('Critica'), high: t('Alta'), medium: t('Media') };

  function el(name, attrs, parent) {
    const n = document.createElementNS(SVGNS, name);
    Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  }

  // Proiezione equirettangolare, la stessa usata per generare il disegno dei continenti
  function project(lat, lon) {
    return [((lon + 180) / 360) * WORLD.w, ((WORLD.latTop - lat) / 360) * WORLD.w];
  }

  function pxPerUnit() {
    const m = svg.getScreenCTM();
    return m && m.a ? m.a : 1;
  }

  function clampView() {
    view.x = Math.min(0, Math.max(WORLD.w - WORLD.w * view.k, view.x));
    view.y = Math.min(0, Math.max(WORLD.h - WORLD.h * view.k, view.y));
  }

  function applyView() {
    clampView();
    gWorld.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    frame.classList.toggle('is-zoomed', view.k > 1.01);
    renderMarkers();
    frame.querySelectorAll('[data-zoom]').forEach((b) => {
      if (b.dataset.zoom === 'in') b.disabled = view.k >= MAX_K - 0.01;
      else b.disabled = view.k <= 1.01;
    });
  }

  /* I segnaposto stanno dentro il gruppo scalato: coordinate "mondo", dimensione compensata da 1/k. */
  function clusters() {
    const unit = pxPerUnit(); // pixel per unità del disegno
    const radius = 26 / unit / view.k; // distanza di fusione in unità "mondo"
    const list = [];
    ATTACKS.forEach((a) => {
      if (!Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lon))) return;
      const [x, y] = project(Number(a.lat), Number(a.lon));
      const near = list.find((c) => Math.hypot(c.x - x, c.y - y) < radius);
      if (near) {
        const n = near.items.length;
        near.items.push(a);
        near.x = (near.x * n + x) / (n + 1);
        near.y = (near.y * n + y) / (n + 1);
      } else list.push({ x, y, items: [a] });
    });
    return list;
  }

  function renderMarkers() {
    gMarks.textContent = '';
    const unit = pxPerUnit();
    const px = 1 / unit / view.k; // un pixel dello schermo in unità "mondo"
    clusters().forEach((c) => {
      const g = el('g', { class: 'ha-pin', transform: `translate(${c.x} ${c.y})`, tabindex: '0', role: 'button' }, gMarks);
      if (c.items.length === 1) {
        const a = c.items[0];
        const color = SEV[a.severity] || SEV.medium;
        g.setAttribute('aria-label', `${a.org}, ${a.year}`);
        g.dataset.id = a.id;
        if (a.id === activeId) g.classList.add('is-active');
        el('circle', { class: 'ha-pin__ring', r: 14 * px, fill: 'none', stroke: color, 'stroke-width': 1.5 * px }, g);
        el('circle', { class: 'ha-pin__ring ha-pin__ring--b', r: 14 * px, fill: 'none', stroke: color, 'stroke-width': 1.5 * px }, g);
        el('circle', { class: 'ha-pin__core', r: 6 * px, fill: color, stroke: '#fff', 'stroke-width': 1.6 * px }, g);
        const label = el('text', { class: 'ha-pin__label', x: 11 * px, y: 4 * px, 'font-size': 11 * px, 'stroke-width': 3 * px }, g);
        label.textContent = a.org.split(/[·—-]/)[0].trim();
      } else {
        g.setAttribute('aria-label', t('{n} violazioni in quest’area', { n: c.items.length }));
        g.dataset.cluster = c.items.map((a) => a.id).join(',');
        el('circle', { class: 'ha-pin__ring', r: 18 * px, fill: 'none', stroke: '#fb7185', 'stroke-width': 1.5 * px }, g);
        el('circle', { class: 'ha-pin__core', r: 12 * px, fill: '#1b1020', stroke: '#fb7185', 'stroke-width': 2 * px }, g);
        const n = el('text', { class: 'ha-pin__count', y: 4.5 * px, 'font-size': 12.5 * px, 'text-anchor': 'middle' }, g);
        n.textContent = String(c.items.length);
      }
    });
  }

  function animateTo(k, x, y, ms = 450) {
    const from = { ...view };
    const id = ++animId;
    if (reducedMotion) {
      Object.assign(view, { k, x, y });
      applyView();
      return;
    }
    const t0 = performance.now();
    (function step(now) {
      if (id !== animId) return;
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      view.k = from.k + (k - from.k) * e;
      view.x = from.x + (x - from.x) * e;
      view.y = from.y + (y - from.y) * e;
      applyView();
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function centerOn(px, py, k) {
    return [k, Math.min(0, Math.max(WORLD.w - WORLD.w * k, WORLD.w / 2 - px * k)), Math.min(0, Math.max(WORLD.h - WORLD.h * k, WORLD.h / 2 - py * k))];
  }

  /** Zoom di fattore f attorno al punto (cx, cy) in unità dello schermo (0..w, 0..h). */
  function zoomAround(f, cx, cy, animate) {
    const k = Math.min(MAX_K, Math.max(1, view.k * f));
    const r = k / view.k;
    const x = cx - (cx - view.x) * r;
    const y = cy - (cy - view.y) * r;
    if (animate) animateTo(k, Math.min(0, Math.max(WORLD.w - WORLD.w * k, x)), Math.min(0, Math.max(WORLD.h - WORLD.h * k, y)), 260);
    else {
      animId += 1;
      Object.assign(view, { k, x, y });
      applyView();
    }
  }

  function fitItems(items) {
    const pts = items.map((a) => project(Number(a.lat), Number(a.lon)));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const fit = Math.min(WORLD.w / (w * 1.6 + 40), WORLD.h / (h * 1.6 + 40));
    const k = Math.min(MAX_K, Math.max(view.k * 1.8, fit));
    animateTo(...centerOn((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, k));
    return k;
  }

  function closePanel() {
    panel.hidden = true;
    activeId = null;
    document.querySelectorAll('.ha-card.is-active').forEach((c) => c.classList.remove('is-active'));
    renderMarkers();
  }

  function showAttack(attack) {
    panel.innerHTML = `<button type="button" class="ha-panel__close" data-close aria-label="${escapeHtml(t('Chiudi'))}">×</button>${popupHtml(attack)}<button type="button" class="ha-panel__more" data-card="${escapeHtml(attack.id)}">${escapeHtml(t('Vai alla scheda completa'))} ↓</button>`;
    panel.hidden = false;
  }

  function showCluster(items) {
    panel.innerHTML = `<button type="button" class="ha-panel__close" data-close aria-label="${escapeHtml(t('Chiudi'))}">×</button>
      <h4>${escapeHtml(t('{n} violazioni in quest’area', { n: items.length }))}</h4>
      <ul class="ha-panel__list">${items.map((a) => `<li><button type="button" data-pick="${escapeHtml(a.id)}"><b>${escapeHtml(a.org.split(/[·—-]/)[0].trim())}</b><span>${a.year} · ${escapeHtml(a.violation)}</span></button></li>`).join('')}</ul>`;
    panel.hidden = false;
  }

  function focusAttack(id, fly = true) {
    const attack = ATTACKS.find((a) => a.id === id);
    if (!attack || !svg) return;
    activeId = id;
    document.querySelectorAll('.ha-card').forEach((c) => c.classList.toggle('is-active', c.dataset.attackId === id));
    showAttack(attack);
    const [px, py] = project(Number(attack.lat), Number(attack.lon));
    animateTo(...centerOn(px, py, Math.max(view.k, 3)));
    if (fly) frame.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
  }

  function initMap() {
    const host = $('historic-map');
    if (!host || !WORLD) return;
    frame = host.closest('.ha-map-frame');
    svg = el('svg', { viewBox: `0 0 ${WORLD.w} ${WORLD.h}`, class: 'ha-svg', role: 'group', 'aria-label': t('Mappa mondiale delle violazioni storiche'), preserveAspectRatio: 'xMidYMid meet' });
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: 'ha-sea', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    el('stop', { offset: '0', 'stop-color': '#0b1626' }, grad);
    el('stop', { offset: '1', 'stop-color': '#060d18' }, grad);
    el('rect', { width: WORLD.w, height: WORLD.h, fill: 'url(#ha-sea)' }, svg);
    gWorld = el('g', { class: 'ha-world' }, svg);
    const grid = el('g', { class: 'ha-graticule' }, gWorld);
    for (let lon = -150; lon <= 180; lon += 30) { const x = project(0, lon)[0]; el('line', { x1: x, y1: 0, x2: x, y2: WORLD.h }, grid); }
    for (let lat = -30; lat <= 80; lat += 30) { const y = project(lat, 0)[1]; el('line', { x1: 0, y1: y, x2: WORLD.w, y2: y }, grid); }
    el('path', { class: 'ha-land', d: WORLD.land }, gWorld);
    el('path', { class: 'ha-borders', d: WORLD.borders }, gWorld);
    gMarks = el('g', { class: 'ha-marks' }, gWorld);
    host.textContent = '';
    host.appendChild(svg);

    panel = document.createElement('div');
    panel.className = 'ha-panel';
    panel.hidden = true;
    frame.appendChild(panel); // sul telefono si apre sotto la mappa invece di coprirla

    const ctrl = document.createElement('div');
    ctrl.className = 'ha-ctrl';
    ctrl.innerHTML = `<button type="button" data-zoom="in" aria-label="${escapeHtml(t('Ingrandisci'))}">+</button><button type="button" data-zoom="out" aria-label="${escapeHtml(t('Riduci'))}">−</button><button type="button" data-zoom="reset" aria-label="${escapeHtml(t('Mondo intero'))}">⟲</button>`;
    host.appendChild(ctrl);

    const legend = document.createElement('div');
    legend.className = 'ha-legend';
    legend.innerHTML = ['critical', 'high', 'medium'].map((k) => `<span><i style="background:${SEV[k]}"></i>${escapeHtml(SEV_LABEL[k])}</span>`).join('');
    host.appendChild(legend);

    // Coordinate del puntatore in unità del disegno (corrette anche con eventuali fasce vuote ai lati).
    const toUnits = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return [0, 0];
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const q = pt.matrixTransform(m.inverse());
      return [q.x, q.y];
    };
    ctrl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-zoom]');
      if (!b) return;
      if (b.dataset.zoom === 'reset') animateTo(1, 0, 0);
      else zoomAround(b.dataset.zoom === 'in' ? 2 : 0.5, WORLD.w / 2, WORLD.h / 2, true);
    });
    host.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return; // senza Ctrl la rotella fa scorrere la pagina
      e.preventDefault();
      const [cx, cy] = toUnits(e);
      zoomAround(e.deltaY < 0 ? 1.25 : 0.8, cx, cy, false);
    }, { passive: false });
    svg.addEventListener('dblclick', (e) => {
      if (e.target.closest('.ha-pin')) return;
      const [cx, cy] = toUnits(e);
      zoomAround(2, cx, cy, true);
    });

    const pointers = new Map();
    let drag = null;
    let pinch = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.ha-pin')) return;
      pointers.set(e.pointerId, e);
      svg.setPointerCapture(e.pointerId);
      animId += 1;
      if (pointers.size === 1) { const [x, y] = toUnits(e); drag = { x, y, vx: view.x, vy: view.y }; }
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k: view.k }; drag = null; }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, e);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const mid = toUnits({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
        zoomAround(((pinch.k * d) / pinch.d) / view.k, mid[0], mid[1], false);
      } else if (drag) {
        const [x, y] = toUnits(e);
        view.x = drag.vx + x - drag.x;
        view.y = drag.vy + y - drag.y;
        applyView();
        frame.classList.add('is-dragging');
      }
    });
    const end = (e) => { pointers.delete(e.pointerId); drag = null; if (pointers.size < 2) pinch = null; frame.classList.remove('is-dragging'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);

    const activate = (g) => {
      if (!g) return;
      if (g.dataset.cluster) {
        const items = g.dataset.cluster.split(',').map((id) => ATTACKS.find((a) => a.id === id)).filter(Boolean);
        const k = fitItems(items);
        if (k >= MAX_K - 0.5) showCluster(items);
        else panel.hidden = true;
      } else focusAttack(g.dataset.id, false);
    };
    svg.addEventListener('click', (e) => activate(e.target.closest('.ha-pin')));
    svg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e.target.closest('.ha-pin')); }
    });
    panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closePanel();
      const pick = e.target.closest('[data-pick]');
      if (pick) focusAttack(pick.dataset.pick, false);
      const card = e.target.closest('[data-card]');
      if (card) document.querySelector(`.ha-card[data-attack-id="${card.dataset.card}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    frame.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) closePanel(); });
    if (window.ResizeObserver) new ResizeObserver(() => renderMarkers()).observe(host);

    $('ha-map-count').textContent = String(ATTACKS.length);
    applyView();
  }

  function renderCards() {
    const grid = $('historic-grid');
    if (!grid) return;

    grid.innerHTML = ATTACKS.map((a, i) => {
      const sev = a.severity || 'medium';
      return `
      <article class="ha-card ha-card--${sev} ha-reveal" data-attack-id="${escapeHtml(a.id)}"
        style="animation-delay:${Math.min(i * 0.06, 0.45)}s" tabindex="0" role="button"
        aria-label="Violazione: ${escapeHtml(a.headline || a.title)}">
        <div class="ha-card__head">
          ${logoMarkup(a, 'ha-logo-wrap--card')}
          <div class="ha-card__head-text">
            <p class="ha-card__org">${escapeHtml(a.org)}</p>
            <h3 class="ha-card__headline">${escapeHtml(a.headline || a.title)}</h3>
            <p class="ha-card__title-sub">${escapeHtml(a.title)} · ${escapeHtml(a.dateLabel)}</p>
          </div>
        </div>
        <span class="ha-card__tag">${escapeHtml(a.violation)}</span>
        <p class="ha-card__meta"><strong>Attore:</strong> ${escapeHtml(a.actor)}</p>
        <p class="ha-card__meta"><strong>Metodo:</strong> ${escapeHtml(a.method)}</p>
        <p class="ha-card__meta"><strong>Scope:</strong> ${escapeHtml(a.scope)}</p>
        <div class="ha-card__block ha-card__block--data">
          <strong>Dati violati</strong>
          <p>${escapeHtml(a.dataExposed)}</p>
        </div>
        <div class="ha-card__block ha-card__block--impact">
          <strong>Impatto</strong>
          <p>${escapeHtml(a.impact)}</p>
        </div>
        <div class="ha-card__block ha-card__block--lesson">
          <strong>Lezioni</strong>
          <p>${escapeHtml(a.lessons)}</p>
        </div>
        <p class="ha-card__map-hint">Clicca per evidenziare sulla mappa</p>
      </article>`;
    }).join('');

    grid.querySelectorAll('.ha-card').forEach((card) => {
      const id = card.dataset.attackId;
      const go = () => focusAttack(id, true);
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  function renderTable() {
    const tbody = $('historic-compare-body');
    if (!tbody) return;
    tbody.innerHTML = ATTACKS.map(
      (a) => `
      <tr data-attack-id="${escapeHtml(a.id)}">
        <td class="ha-compare__org">
          ${logoMarkup(a, 'ha-logo-wrap--table')}
          <strong>${escapeHtml((a.headline || a.title).replace(/ —.*/, ''))}</strong>
        </td>
        <td>${a.year}</td>
        <td>${escapeHtml(a.actor)}</td>
        <td>${escapeHtml(a.compareImpact)}</td>
        <td>${escapeHtml(a.compareLesson)}</td>
      </tr>`
    ).join('');

    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', () => focusAttack(row.dataset.attackId, true));
      row.style.cursor = 'pointer';
    });
  }

  function initReveal() {
    const blocks = document.querySelectorAll('.ha-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    blocks.forEach((el) => io.observe(el));
  }

  function boot() {
    renderCards();
    renderTable();
    document.querySelector('.ha-map-section')?.classList.add('is-visible');
    initReveal();
    try {
      initMap();
    } catch (err) {
      console.error('[historic-attacks] mappa non disponibile:', err);
    }
  }

  // Fallback logo senza onerror inline (CSP senza 'unsafe-inline'): gli eventi
  // error non fanno bubbling, quindi si ascolta in fase di cattura sul document.
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG' && img.classList && img.classList.contains('ha-logo')) {
        const wrap = img.closest('.ha-logo-wrap');
        if (wrap) wrap.classList.add('is-fallback');
        img.remove();
      }
    },
    true
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
