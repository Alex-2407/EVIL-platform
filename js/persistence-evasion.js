/**
 * Persistenza ed evasione — due corsie di schede brevi, mappa delle priorità, pannello di dettaglio
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;
  const DATA = window.PERSISTENCE_EVASION_DATA || { techniques: [] };
  const TECH = DATA.techniques;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const esc = window.EVIL_UTILS.escapeHtml;

  const LEVEL = { low: t('Bassa'), medium: t('Media'), high: t('Alta') };
  const N = { low: 1, medium: 2, high: 3 };
  const CAT = {
    persistence: { label: t('Persistenza'), color: '#f59e0b', icon: '⚓' },
    evasion: { label: t('Evasione'), color: '#a78bfa', icon: '🫥' },
  };
  const TABS = { indicators: 'indicators', detect: 'detect', prevent: 'prevent' };

  const state = { cat: 'all', q: '' };
  let visible = [];
  let openId = null;
  let lastFocus = null;

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return TECH.filter((x) => {
      if (state.cat !== 'all' && x.category !== state.cat) return false;
      if (!q) return true;
      return [x.title, x.mitre, x.mitreLabel, x.description, ...(x.indicators || []), ...(x.detect || []), ...(x.prevent || [])].join(' ').toLowerCase().includes(q);
    });
  }

  function meter(level, good) {
    // "good" = vantaggio per chi difende quando il valore è alto
    const n = N[level] || 1;
    return `<span class="mt-meter" data-n="${n}">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  function tile(x, i) {
    const c = CAT[x.category];
    return `<button type="button" class="mt-tile" data-id="${esc(x.id)}" style="--c:${c.color};--i:${i}">
      <span class="mt-tile__top"><span class="mt-mitre" translate="no">${esc(x.mitre)}</span></span>
      <strong>${esc(x.title)}</strong>
      <span class="mt-tile__bars">
        <span title="${esc(t('Stealth'))}"><em>${esc(t('Stealth'))}</em>${meter(x.stealth)}</span>
        <span title="${esc(t('Prevalenza'))}"><em>${esc(t('Prevalenza'))}</em>${meter(x.prevalence)}</span>
        <span title="${esc(t('Difficoltà di rilevamento'))}"><em>${esc(t('Rilevamento'))}</em>${meter(x.detection)}</span>
      </span>
    </button>`;
  }

  function renderLanes() {
    visible = filtered();
    $('mt-empty').hidden = visible.length > 0;
    const lane = (cat) => {
      const items = visible.filter((x) => x.category === cat);
      if (!items.length) return '';
      const c = CAT[cat];
      return `<section class="mt-lane" style="--c:${c.color}">
        <h2><span>${c.icon}</span> ${esc(c.label)} <b>${items.length}</b></h2>
        <div class="mt-lane__grid">${items.map((x, i) => tile(x, i)).join('')}</div>
      </section>`;
    };
    $('mt-grid').innerHTML = lane('persistence') + lane('evasion');
  }

  function renderMatrix() {
    // asse X: difficoltà di rilevamento (bassa → alta); asse Y: prevalenza (alta in alto)
    const cells = {};
    TECH.forEach((x) => {
      const k = `${x.prevalence}-${x.detection}`;
      (cells[k] = cells[k] || []).push(x);
    });
    const rows = ['high', 'medium', 'low'];
    const cols = ['low', 'medium', 'high'];
    let html = `<span class="mt-matrix__y">${esc(t('Prevalenza'))} ↑</span><span class="mt-matrix__x">${esc(t('Difficoltà di rilevamento'))} →</span>`;
    rows.forEach((r) => cols.forEach((c) => {
      const list = cells[`${r}-${c}`] || [];
      const hot = r === 'high' && c === 'low';
      html += `<div class="mt-cell${hot ? ' mt-cell--hot' : ''}${r === 'high' && c === 'high' ? ' mt-cell--hard' : ''}">${list.map((x) => `<button type="button" class="mt-dot" data-id="${esc(x.id)}" style="--c:${CAT[x.category].color}" title="${esc(x.title)}"><i></i><span>${esc(x.title)}</span></button>`).join('')}</div>`;
    }));
    html += `<div class="mt-matrix__legend"><span style="--c:${CAT.persistence.color}"><i></i>${esc(CAT.persistence.label)}</span><span style="--c:${CAT.evasion.color}"><i></i>${esc(CAT.evasion.label)}</span></div>`;
    $('mt-matrix').innerHTML = html;
  }

  /* -------------------------------------------------- dettaglio */
  function setTab(tab) {
    const x = TECH.find((y) => y.id === openId);
    if (!x) return;
    document.querySelectorAll('.mt-drawer__tabs button').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('mt-dr-list').innerHTML = (x[TABS[tab]] || []).map((i) => `<li>${esc(i)}</li>`).join('');
  }

  function openDrawer(id) {
    const x = TECH.find((y) => y.id === id);
    if (!x) return;
    openId = id;
    const c = CAT[x.category];
    const dr = $('mt-drawer');
    dr.style.setProperty('--c', c.color);
    $('mt-dr-meta').innerHTML = `<span class="mt-chip" style="--c:${c.color}">${c.icon} ${esc(c.label)}</span>`;
    $('mt-dr-title').textContent = x.title;
    $('mt-dr-mitre').textContent = `${x.mitre} · ${x.mitreLabel}`;
    $('mt-dr-desc').textContent = x.description;
    $('mt-dr-gauges').innerHTML = [['stealth', t('Stealth')], ['prevalence', t('Prevalenza')], ['detection', t('Difficoltà di rilevamento')]]
      .map(([k, l]) => `<div><em>${esc(l)}</em>${meter(x[k])}<b>${esc(LEVEL[x[k]] || x[k])}</b></div>`).join('');
    setTab('indicators');
    const idx = visible.findIndex((y) => y.id === id);
    $('mt-dr-prev').disabled = idx <= 0;
    $('mt-dr-next').disabled = idx < 0 || idx >= visible.length - 1;
    if (dr.hidden) {
      lastFocus = document.activeElement;
      dr.hidden = false;
      document.body.classList.add('mt-lock');
    }
    dr.querySelector('.mt-drawer__close').focus();
  }
  function closeDrawer() {
    $('mt-drawer').hidden = true;
    document.body.classList.remove('mt-lock');
    if (lastFocus) lastFocus.focus();
  }
  function step(d) {
    const idx = visible.findIndex((y) => y.id === openId);
    const n = visible[idx + d];
    if (n) openDrawer(n.id);
  }

  function setCategory(cat) {
    state.cat = cat;
    document.querySelectorAll('.mt-filter-btn').forEach((btn) => {
      const on = btn.dataset.category === cat;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    renderLanes();
  }

  function bind() {
    $('mt-search').addEventListener('input', window.EVIL_UTILS.debounce((e) => { state.q = e.target.value; renderLanes(); }, 180));
    document.addEventListener('click', (e) => {
      const f = e.target.closest('.mt-filter-btn');
      if (f) { setCategory(f.dataset.category || 'all'); return; }
      const open = e.target.closest('[data-id]');
      if (open) { openDrawer(open.dataset.id); return; }
      if (e.target.closest('[data-close]')) closeDrawer();
      const tab = e.target.closest('.mt-drawer__tabs button');
      if (tab) setTab(tab.dataset.tab);
      if (e.target.closest('#mt-dr-prev')) step(-1);
      if (e.target.closest('#mt-dr-next')) step(1);
    });
    document.addEventListener('keydown', (e) => {
      if ($('mt-drawer').hidden) return;
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  function boot() {
    bind();
    renderLanes();
    renderMatrix();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
