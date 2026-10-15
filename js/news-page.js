(function () {
  'use strict';
  const { t, fmtNumber } = window.EVIL_I18N;
  const $ = (id) => document.getElementById(id);
  const PAGE = 18;

  const TAGS = {
    ransomware: { label: t('Ransomware'), icon: '🔒', learn: ['/glossary.html?q=ransomware', t('Che cos’è un ransomware')] },
    breach: { label: t('Violazioni'), icon: '💧', learn: ['/hacked-timeline.html', t('Cosa fare dopo una violazione')] },
    vuln: { label: t('Vulnerabilità'), icon: '🧩', learn: ['/glossary.html?q=CVE', t('Cos’è una CVE')] },
    malware: { label: t('Malware'), icon: '🦠', learn: ['/malware-db.html', t('Catalogo malware')] },
    phishing: { label: t('Phishing e truffe'), icon: '🎣', learn: ['/quiz-hub.html?cat=phishing', t('Quiz sul phishing')] },
    apt: { label: t('Gruppi APT'), icon: '🕵️', learn: ['/glossary.html?q=APT', t('Cos’è un APT')] },
    ddos: { label: 'DDoS', icon: '🌊', learn: ['/glossary.html?q=DDoS', t('Cos’è un DDoS')] },
    supply: { label: t('Supply chain'), icon: '📦', learn: ['/glossary.html?q=supply', t('Attacchi alla supply chain')] },
    privacy: { label: t('Normative e privacy'), icon: '⚖️', learn: ['/glossary.html?q=GDPR', t('GDPR nel glossario')] },
    ai: { label: t('AI'), icon: '🤖', learn: ['/glossary.html?q=AI', t('Sicurezza e AI')] },
  };

  const state = { items: [], sources: [], tag: '', q: '', it: false, official: false, shown: PAGE, nextAt: null, updatedAt: null };
  let lastFocus = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : '#');

  function ago(iso) {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (m < 2) return t('adesso');
    if (m < 60) return t('{n} min fa', { n: m });
    const h = Math.round(m / 60);
    if (h < 24) return t('{n} h fa', { n: h });
    const d = Math.round(h / 24);
    return d === 1 ? t('ieri') : t('{n} giorni fa', { n: d });
  }
  const isNew = (it) => Date.now() - Date.parse(it.published) < 3 * 3600 * 1000;

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return state.items.filter((it) => {
      if (state.tag && !it.tags.includes(state.tag)) return false;
      if (state.it && it.lang !== 'it') return false;
      if (state.official && !it.official) return false;
      if (q && !(`${it.title} ${it.summary} ${it.sourceName} ${it.cve.join(' ')}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  function tagChips(it) {
    return it.tags.map((id) => `<span class="nw-tag nw-tag--${id}">${TAGS[id] ? esc(TAGS[id].label) : esc(id)}</span>`).join('');
  }

  function card(it, i) {
    return `<button type="button" class="nw-item" data-id="${esc(it.id)}" style="--i:${i % PAGE}">
      <span class="nw-item__top"><span class="nw-src">${esc(it.sourceName)}${it.official ? ' <i title="' + esc(t('Fonte ufficiale')) + '">✓</i>' : ''}</span>
      ${isNew(it) ? `<span class="nw-new">${esc(t('NUOVO'))}</span>` : ''}<time>${esc(ago(it.published))}</time></span>
      <strong class="nw-item__title">${esc(it.title)}</strong>
      ${it.summary ? `<span class="nw-item__sum">${esc(it.summary)}</span>` : ''}
      <span class="nw-item__tags">${tagChips(it)}${it.cve.map((c) => `<span class="nw-tag nw-tag--cve">${esc(c)}</span>`).join('')}</span>
    </button>`;
  }

  function render() {
    const list = filtered();
    const [first, ...rest] = list;
    const featuredOn = first && !state.q && !state.tag;
    $('nw-featured').innerHTML = featuredOn
      ? `<button type="button" class="nw-featured" data-id="${esc(first.id)}">
          <span class="nw-featured__badge">${esc(t('In evidenza'))} · ${esc(first.sourceName)} · ${esc(ago(first.published))}</span>
          <strong>${esc(first.title)}</strong>
          ${first.summary ? `<span>${esc(first.summary)}</span>` : ''}
          <span class="nw-item__tags">${tagChips(first)}</span>
          <span class="nw-featured__go">${esc(t('Leggi di più'))} →</span></button>`
      : '';
    const body = featuredOn ? rest : list;
    $('nw-grid').innerHTML = body.slice(0, state.shown).map(card).join('');
    $('nw-more').hidden = body.length <= state.shown;
    $('nw-empty').hidden = list.length > 0 || !state.items.length;
  }

  function renderTags() {
    const counts = {};
    state.items.forEach((it) => it.tags.forEach((x) => { counts[x] = (counts[x] || 0) + 1; }));
    const all = `<button type="button" class="nw-chip" data-tag="" aria-pressed="${!state.tag}">${esc(t('Tutte'))}</button>`;
    $('nw-tags').innerHTML = all + Object.keys(TAGS).filter((id) => counts[id]).map((id) =>
      `<button type="button" class="nw-chip" data-tag="${id}" aria-pressed="${state.tag === id}">${TAGS[id].icon} ${esc(TAGS[id].label)} <b>${counts[id]}</b></button>`).join('');
    const max = Math.max(1, ...Object.values(counts));
    const rows = Object.keys(counts).filter((id) => TAGS[id]).sort((a, b) => counts[b] - counts[a]).slice(0, 6);
    $('nw-trend').innerHTML = rows.map((id) =>
      `<button type="button" class="nw-bar" data-tag="${id}"><span>${TAGS[id].icon} ${esc(TAGS[id].label)}</span><i style="--w:${Math.round((counts[id] / max) * 100)}%"></i><b>${counts[id]}</b></button>`).join('')
      || `<p class="nw-note">${esc(t('Ancora nessun dato.'))}</p>`;
  }

  function renderStats() {
    const day = state.items.filter((it) => Date.now() - Date.parse(it.published) < 24 * 3600 * 1000).length;
    const ok = state.sources.filter((s) => s.ok).length;
    $('nw-stat-total').textContent = fmtNumber(state.items.length);
    $('nw-stat-today').textContent = fmtNumber(day);
    $('nw-stat-sources').textContent = `${ok}/${state.sources.length || '—'}`;
    $('nw-sources').innerHTML = state.sources.map((s) =>
      `<li class="${s.ok ? 'ok' : 'ko'}"><span></span>${esc(s.name)}<em>${s.ok ? esc(t('{n} articoli', { n: s.count })) : esc(t('non raggiungibile'))}</em></li>`).join('');
    const label = $('nw-live-label');
    if (!state.items.length) label.textContent = t('Nessuna notizia disponibile al momento: riprova tra poco');
    else label.textContent = t('Aggiornato {when}', { when: ago(state.updatedAt) });
  }

  function tickNext() {
    const el = $('nw-stat-next');
    if (!state.nextAt) { el.textContent = '—'; return; }
    const m = Math.round((Date.parse(state.nextAt) - Date.now()) / 60000);
    el.textContent = m <= 0 ? t('a breve') : t('tra {n} min', { n: m });
  }

  function openReader(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    lastFocus = document.activeElement;
    $('nw-reader-meta').innerHTML = `<span class="nw-src">${esc(it.sourceName)}${it.official ? ' ✓' : ''}</span> · <time datetime="${esc(it.published)}">${esc(new Date(it.published).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short' }))}</time>${it.lang === 'en' && document.documentElement.lang !== 'en' ? ' · ' + esc(t('in inglese')) : ''}`;
    $('nw-reader-title').textContent = it.title;
    $('nw-reader-summary').textContent = it.summary || t('La testata non fornisce un estratto: apri l’articolo per leggerlo.');
    $('nw-reader-chips').innerHTML = tagChips(it) + it.cve.map((c) => `<span class="nw-tag nw-tag--cve">${esc(c)}</span>`).join('');
    const learn = it.tags.filter((x) => TAGS[x]).map((x) => `<a href="${esc(TAGS[x].learn[0])}">${esc(TAGS[x].learn[1])} →</a>`);
    $('nw-reader-learn').innerHTML = learn.length ? `<h3>${esc(t('Per capire meglio'))}</h3>${learn.join('')}` : '';
    $('nw-reader-link').href = safeUrl(it.link);
    $('nw-reader').hidden = false;
    document.body.classList.add('nw-lock');
    $('nw-reader').querySelector('.nw-reader__close').focus();
  }
  function closeReader() {
    $('nw-reader').hidden = true;
    document.body.classList.remove('nw-lock');
    if (lastFocus) lastFocus.focus();
  }

  async function loadKev() {
    try {
      const r = await fetch('/api/realtime-incidents', { headers: { Accept: 'application/json' } });
      const data = r.ok ? await r.json() : null;
      const list = (data && Array.isArray(data.incidents) ? data.incidents : []).filter((x) => x.cve).slice(0, 5);
      if (!list.length) throw new Error('vuoto');
      $('nw-kev').innerHTML = list.map((x) => {
        const what = [x.vendor, x.product].filter(Boolean).join(' ') || String(x.description || '').split(' — ')[0];
        return `<li><b>${esc(x.cve)}</b><span>${esc(what.slice(0, 80))}</span></li>`;
      }).join('');
    } catch (_) {
      $('nw-kev').innerHTML = `<li><span>${esc(t('Catalogo non raggiungibile ora.'))}</span></li>`;
    }
  }

  async function load() {
    try {
      const r = await fetch('/api/news', { headers: { Accept: 'application/json' } });
      const data = await r.json();
      Object.assign(state, { items: data.items || [], sources: data.sources || [], nextAt: data.nextRefreshAt, updatedAt: data.updatedAt });
    } catch (_) { /* resta lo stato precedente */ }
    $('nw-grid').classList.remove('nw-grid--loading');
    renderTags(); renderStats(); render(); tickNext();
    if (state.items.length && !window.__nwLogged) {
      window.__nwLogged = true;
      window.progressManager?.logActivity?.('attacks_map_viewed', { total: state.items.length });
    }
  }

  document.addEventListener('click', (e) => {
    const tagBtn = e.target.closest('[data-tag]');
    if (tagBtn) { state.tag = state.tag === tagBtn.dataset.tag ? '' : tagBtn.dataset.tag; state.shown = PAGE; renderTags(); render(); return; }
    const opt = e.target.closest('[data-opt]');
    if (opt) {
      const key = opt.dataset.opt === 'lang' ? 'it' : 'official';
      state[key] = !state[key]; opt.setAttribute('aria-pressed', String(state[key])); state.shown = PAGE; render(); return;
    }
    const open = e.target.closest('[data-id]');
    if (open) { openReader(open.dataset.id); return; }
    if (e.target.closest('[data-close]')) closeReader();
    if (e.target.id === 'nw-more') { state.shown += PAGE; render(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('nw-reader').hidden) closeReader(); });
  $('nw-search').addEventListener('input', (e) => { state.q = e.target.value; state.shown = PAGE; render(); });

  $('nw-grid').classList.add('nw-grid--loading');
  $('nw-grid').innerHTML = '<div class="nw-skel nw-skel--card"></div>'.repeat(6);
  load();
  loadKev();
  setInterval(() => { tickNext(); if (state.updatedAt) renderStats(); }, 30000);
  setInterval(load, 10 * 60 * 1000);
})();
