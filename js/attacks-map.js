/**
 * Mappa di avvisi e vulnerabilità sfruttate — fonti pubbliche (CISA KEV, NIST NVD, CERT-AGID,
 * CERT-EU, CISA Advisories, Cisco Talos). I testi arrivano dal server già nella lingua della
 * pagina; le descrizioni originali delle fonti restano nella loro lingua (attributo lang).
 */
(function () {
  'use strict';

  const { t, fmtNumber, fmtDate, lang, locale } = window.EVIL_I18N;

  const API = '/api/realtime-incidents';
  const SEV_CLASS = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };

  let map = null;
  let layerGroup = null;
  let markerByArea = {};
  let lastPayload = null;
  let ws = null;
  let wsReconnectTimer = null;
  let mapViewLocked = false;
  let lastRegionsKey = '';
  let lastPayloadStamp = '';
  let lastTickerKey = '';
  let resizeObserver = null;
  let loggedView = false;
  let radarAnim = null;
  let booted = false;
  let refreshInFlight = false;
  let mapReady = false;
  let pendingRegions = null;
  let mapFrozen = false;
  const MAP_CENTER = [24, 10];
  const MAP_ZOOM = 2;
  const POPUP_OPTS = window.EvilLeafletMap?.POPUP_OPTS || { autoPan: false };

  function $(id) {
    return document.getElementById(id);
  }

  function formatUtc(ts) {
    const d = new Date(ts);
    if (!ts || Number.isNaN(d.getTime())) return '—';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  }

  // Escape anche delle virgolette: il risultato finisce pure dentro attributi HTML
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function debounce(fn, ms) {
    let tm;
    return function (...args) {
      clearTimeout(tm);
      tm = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function animateValue(el, end) {
    if (!el) return;
    const start = Number(el.dataset.value) || 0;
    const target = typeof end === 'number' ? end : 0;
    el.dataset.value = String(target);
    const duration = 900;
    const t0 = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtNumber(Math.round(start + (target - start) * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setLivePill(mode, label) {
    const pill = $('live-mode-pill');
    if (!pill) return;
    pill.classList.remove('is-cache', 'is-error');
    if (mode === 'cache' || mode === 'sample') pill.classList.add('is-cache');
    if (mode === 'error' || mode === 'empty') pill.classList.add('is-error');
    const lbl = pill.querySelector('.am-live-pill__label');
    if (lbl) lbl.textContent = label;
  }

  function setStatusMessage(text) {
    const el = $('am-status-msg');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function initRadar() {
    const canvas = $('am-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let sweep = 0;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function draw() {
      if (document.hidden) {
        radarAnim = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      const cx = w * 0.72;
      const cy = h * 0.35;
      const r = Math.min(w, h) * 0.22;
      ctx.strokeStyle = 'rgba(0, 255, 156, 0.06)';
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r / 4) * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      sweep += 0.012;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweep);
      const g = ctx.createLinearGradient(0, 0, r, 0);
      g.addColorStop(0, 'rgba(0, 255, 156, 0)');
      g.addColorStop(0.15, 'rgba(0, 255, 156, 0.12)');
      g.addColorStop(1, 'rgba(0, 255, 156, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -0.4, 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      radarAnim = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', debounce(resize, 200));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && map) scheduleMapResize();
    });
    draw();
  }

  function initReveal() {
    const blocks = document.querySelectorAll('.am-reveal');
    const mapFrame = document.querySelector('.am-map-frame');

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            if (e.target.classList.contains('am-map-section') || e.target.closest('.am-map-section')) {
              scheduleMapResize();
            }
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    blocks.forEach((el) => io.observe(el));
    if (mapFrame) {
      const mapIo = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) scheduleMapResize();
        },
        { threshold: 0.1 }
      );
      mapIo.observe(mapFrame);
    }
  }

  function fixMapSize() {
    if (window.EvilLeafletMap) window.EvilLeafletMap.fixSize(map);
    else if (map) map.invalidateSize({ animate: false, pan: false });
    syncMarkerPositions();
  }

  function scheduleMapResize() {
    if (window.EvilLeafletMap) window.EvilLeafletMap.scheduleFixSize(map);
    else fixMapSize();
  }

  /** Riposiziona i DivIcon dopo resize/zoom (evita drift con container arrotondato). */
  function syncMarkerPositions() {
    if (!layerGroup) return;
    layerGroup.eachLayer((layer) => {
      if (layer.update) layer.update();
    });
  }

  function initMap() {
    const el = $('attacks-map');
    if (!el || typeof L === 'undefined' || map) return;

    const frame = el.closest('.am-map-frame');
    if (!frame) return;

    const start = () => {
      if (map) return;

      map = L.map(el, {
        center: MAP_CENTER,
        zoom: MAP_ZOOM,
        minZoom: MAP_ZOOM,
        maxZoom: MAP_ZOOM,
        worldCopyJump: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerGroup = L.layerGroup().addTo(map);
      markerByArea = {};

      if (window.EvilLeafletMap) {
        window.EvilLeafletMap.bindAutoResize(map, frame);
        window.EvilLeafletMap.lockMapInteraction(map);
      }

      map.on('resize', syncMarkerPositions);

      map.whenReady(() => {
        scheduleMapResize();
        if (window.EvilLeafletMap) {
          window.EvilLeafletMap.lockMapInteraction(map);
          if (!mapFrozen) {
            window.EvilLeafletMap.freezeMapView(map, MAP_CENTER, MAP_ZOOM);
            mapFrozen = true;
          }
        }
        mapReady = true;
        if (pendingRegions) {
          const regions = pendingRegions;
          pendingRegions = null;
          renderRegions(regions);
        }
      });
    };

    if (window.EvilLeafletMap) {
      window.EvilLeafletMap.waitForFrame(frame, start);
    } else {
      start();
    }
  }

  /** Colore del marker = quante voci arrivano dall'area (non la gravità). */
  function markerHtml(count) {
    const cls = count > 15 ? 'critical' : count > 8 ? 'high' : 'medium';
    return `<div class="am-marker am-marker--${cls}">
      <span class="am-marker__ring"></span>
      <span class="am-marker__ring"></span>
      <span class="am-marker__core"></span>
    </div>`;
  }

  function regionsFingerprint(regions) {
    return (regions || [])
      .map((r) => `${r.area}|${r.name}|${r.count}|${Number(r.lat).toFixed(2)}|${Number(r.lon).toFixed(2)}`)
      .sort()
      .join(';;');
  }

  function registerMarker(area, lat, lon, marker) {
    if (!area) return;
    markerByArea[area] = { marker, lat, lon };
  }

  function renderRegions(regions) {
    if (!map || !layerGroup) return;
    if (!mapReady) {
      pendingRegions = regions;
      return;
    }

    const fp = regionsFingerprint(regions);
    if (fp === lastRegionsKey && layerGroup.getLayers().length > 0) return;
    lastRegionsKey = fp;

    layerGroup.clearLayers();
    markerByArea = {};

    (regions || []).forEach((region, i) => {
      const lat = Number(region.lat);
      const lon = Number(region.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const count = region.count || 1;
      const typesHtml = Object.entries(region.types || {})
        .slice(0, 5)
        .map(([label, n]) => `<li>${escapeHtml(label)}: <strong>${fmtNumber(n)}</strong></li>`)
        .join('');
      const sources = (region.sources || []).join(', ');

      const popupHtml = `
        <div class="attacks-popup">
          <h4>${escapeHtml(region.name || region.area)}</h4>
          <p>${escapeHtml(count === 1 ? t('{n} voce pubblicata da enti di quest’area', { n: fmtNumber(count) }) : t('{n} voci pubblicate da enti di quest’area', { n: fmtNumber(count) }))}</p>
          ${sources ? `<p class="attacks-popup__sources">${escapeHtml(t('Fonti: {list}', { list: sources }))}</p>` : ''}
          <ul class="attacks-popup__types">${typesHtml}</ul>
          <p class="attacks-popup__note">${escapeHtml(t('Posizione = sede di chi pubblica, non luogo delle vittime.'))}</p>
        </div>`;

      const icon = L.divIcon({
        className: 'am-leaflet-icon',
        html: markerHtml(count),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lon], {
        icon,
        interactive: true,
        title: count === 1 ? t('{area}: {n} voce', { area: region.name || region.area, n: count }) : t('{area}: {n} voci', { area: region.name || region.area, n: count }),
      });
      marker.on('add', () => marker.getElement()?.querySelector('.am-marker')?.style.setProperty('--am-marker-i', String(i)));
      marker.bindPopup(popupHtml, POPUP_OPTS);
      marker.on('click', () => marker.openPopup());
      layerGroup.addLayer(marker);
      registerMarker(region.area, lat, lon, marker);
    });

    mapViewLocked = true;
    scheduleMapResize();
  }

  function focusAreaMarker(area) {
    const entry = markerByArea[area];
    if (!entry || !map) return;
    entry.marker.openPopup();
  }

  function updateStats(payload) {
    const agg = payload.aggregated_stats || {};
    const total = payload.total_incidents ?? (payload.incidents?.length || 0);
    const unlocated = agg.unlocated || 0;

    animateValue($('stat-total'), total);
    animateValue($('stat-exploited'), agg.exploited || 0);
    animateValue($('stat-critical'), agg.critical || 0);
    animateValue($('stat-cve'), agg.with_cve || 0);
    animateValue($('stat-ransomware'), agg.ransomware_known || 0);
    animateValue($('stat-unlocated'), unlocated);
    const srcEl = $('stat-sources');
    if (srcEl) {
      srcEl.textContent = agg.sources_total
        ? t('{ok} di {n}', { ok: fmtNumber(agg.sources_ok || 0), n: fmtNumber(agg.sources_total) })
        : '—';
    }

    const hud = $('hud-count');
    if (hud) {
      hud.textContent = fmtNumber(agg.located ?? total - unlocated);
      hud.classList.remove('is-bump');
      void hud.offsetWidth;
      hud.classList.add('is-bump');
    }
    if ($('hud-unlocated')) $('hud-unlocated').textContent = fmtNumber(unlocated);

    if ($('last-update')) $('last-update').textContent = formatUtc(payload.timestamp);

    const mode = payload.data_mode || 'empty';
    if (mode === 'live') setLivePill('live', t('Dati aggiornati'));
    else if (mode === 'cache') setLivePill('cache', t('Ultimi dati reali (fonti non raggiungibili)'));
    else if (mode === 'sample') setLivePill('sample', t('Solo esempi — fonti non raggiungibili'));
    else setLivePill('empty', t('Nessun dato disponibile'));
    setStatusMessage(mode === 'live' ? '' : payload.status_message);

    renderMonthly(payload.monthly || []);
    renderSourceChips(payload.sources || [], mode);
  }

  function renderSourceChips(sources, mode) {
    const wrap = $('sources-strip');
    if (!wrap) return;
    wrap.textContent = '';
    if (!sources.length) return;
    const label = document.createElement('span');
    label.className = 'am-sources__label';
    label.textContent = t('Stato delle fonti:');
    wrap.appendChild(label);
    sources.forEach((s, i) => {
      const chip = document.createElement('span');
      chip.className = `am-source-chip ${s.ok ? 'is-ok' : 'is-down'}`;
      chip.style.setProperty('animation-delay', `${i * 0.05}s`);
      chip.textContent = s.ok
        ? s.count === 1
          ? t('{name}: {n} voce', { name: s.name, n: fmtNumber(s.count) })
          : t('{name}: {n} voci', { name: s.name, n: fmtNumber(s.count) })
        : t('{name}: non raggiungibile', { name: s.name });
      if (mode === 'cache' && !s.ok) chip.title = t('Mostriamo gli ultimi dati scaricati da questa fonte, se presenti.');
      wrap.appendChild(chip);
    });
  }

  function monthLabel(ym) {
    const [y, m] = String(ym).split('-').map(Number);
    if (!y || !m) return '';
    try {
      return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
    } catch {
      return ym;
    }
  }

  function renderMonthly(months) {
    const grid = $('month-grid');
    const empty = $('month-empty');
    if (!grid) return;
    const values = months.map((m) => m.count || 0);
    const totalInRange = values.reduce((a, b) => a + b, 0);
    grid.textContent = '';
    months.forEach((m, i) => {
      const cell = document.createElement('div');
      cell.className = 'am-month-cell';
      cell.style.setProperty('animation-delay', `${i * 0.04}s`);
      const val = document.createElement('div');
      val.className = 'am-month-cell__val';
      val.textContent = fmtNumber(m.count || 0);
      const lbl = document.createElement('div');
      lbl.className = 'am-month-cell__lbl';
      lbl.textContent = monthLabel(m.month);
      cell.append(val, lbl);
      grid.appendChild(cell);
    });
    if (empty) {
      empty.hidden = totalInRange > 0 || !months.length;
      empty.textContent = t('Nessuna delle voci caricate è stata pubblicata negli ultimi 12 mesi.');
    }
    renderSparkline(values);
  }

  function renderSparkline(values) {
    const el = $('monthly-sparkline');
    if (!el) return;
    if (!values?.length || !values.some((v) => v > 0)) {
      el.textContent = '';
      return;
    }
    const w = 800;
    const h = 80;
    const pad = 10;
    const max = Math.max(...values, 1);
    const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => `${pad + i * step},${pad + (1 - v / max) * (h - pad * 2)}`);
    const line = pts.join(' ');
    const area = `${line} ${w - pad},${h - pad} ${pad},${h - pad}`;
    el.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(t('Grafico delle voci caricate per mese'))}">
        <defs>
          <linearGradient id="amSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00ff9c" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#00ff9c" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polygon points="${area}" fill="url(#amSparkGrad)"/>
        <polyline class="am-spark-line" points="${line}" fill="none" stroke="#00ff9c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
  }

  function renderTicker(incidents) {
    const track = $('ticker-track');
    const wrap = track?.parentElement;
    if (!track) return;

    const items = (incidents || []).slice(0, 12);
    const key = items.map((i) => `${lang}:${i.id}`).join('|');
    if (key === lastTickerKey && track.childElementCount > 1) return;
    lastTickerKey = key;

    if (!items.length) {
      track.textContent = '';
      const span = document.createElement('span');
      span.textContent = t('Nessuna voce disponibile');
      track.appendChild(span);
      if (wrap) wrap.style.setProperty('--ticker-duration', '0s');
      return;
    }

    const html = items
      .map((inc) => {
        const sample = inc.is_sample ? `${escapeHtml(t('Esempio'))} · ` : '';
        return `<span>${sample}<em>${escapeHtml(inc.type)}</em> — <span lang="${escapeHtml(inc.description_lang || 'en')}">${escapeHtml((inc.description || '').slice(0, 90))}</span> · ${escapeHtml(inc.source || '')}</span>`;
      })
      .join('');

    track.style.animation = 'none';
    void track.offsetWidth;
    track.innerHTML = html + html;
    requestAnimationFrame(() => {
      const width = track.scrollWidth / 2 || 800;
      const durationSec = Math.max(80, Math.min(200, width / 40));
      if (wrap) wrap.style.setProperty('--ticker-duration', `${durationSec}s`);
      track.style.animation = '';
    });
  }

  function bindIncidentCard(card, inc) {
    const go = () => {
      const feed = $('incidents-feed');
      feed?.querySelectorAll('.am-incident').forEach((c) => c.classList.remove('is-highlight'));
      card.classList.add('is-highlight');
      if (inc.area) focusAreaMarker(inc.area);
    };

    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      go();
    });
    card.addEventListener('keydown', (e) => {
      if (e.target.closest('a')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  }

  function renderTimeline(incidents) {
    const feed = $('incidents-feed');
    const empty = $('incidents-feed-empty');
    if (!feed) return;

    feed.textContent = '';
    const list = (incidents || []).slice(0, 12);

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = t('Nessuna voce disponibile al momento.');
      }
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((inc, i) => {
      const sevCls = SEV_CLASS[inc.severity] || 'none';
      const dateStr = inc.timestamp ? fmtDate(inc.timestamp) : '—';
      const link = /^https?:\/\//i.test(inc.link || '')
        ? `<a href="${escapeHtml(inc.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('Fonte originale ↗'))}</a>`
        : '';
      const cvss = typeof inc.cvss === 'number' ? ` (CVSS ${escapeHtml(fmtNumber(inc.cvss, { minimumFractionDigits: 1, maximumFractionDigits: 1 }))})` : '';
      const area = inc.area ? inc.area_name : t('Senza area geografica');

      const card = document.createElement('article');
      card.className = `am-incident am-incident--${sevCls}${inc.is_sample ? ' am-incident--sample' : ''}`;
      card.style.setProperty('animation-delay', `${Math.min(i * 0.06, 0.6)}s`);
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', t('Voce: {text}', { text: (inc.description || '').slice(0, 80) }));
      card.innerHTML = `
        <div class="am-incident__head">
          <div class="am-incident__title" lang="${escapeHtml(inc.description_lang || 'en')}">${escapeHtml((inc.description || '').slice(0, 220))}</div>
          <time class="am-incident__date"${inc.timestamp ? ` datetime="${escapeHtml(inc.timestamp)}"` : ''}>${escapeHtml(dateStr)}</time>
        </div>
        <div class="am-incident__tags">
          ${inc.is_sample ? `<span class="am-incident__tag am-incident__tag--sample">${escapeHtml(t('Esempio'))}</span>` : ''}
          <span class="am-incident__tag">${escapeHtml(inc.type)}</span>
          ${inc.exploited ? `<span class="am-incident__tag am-incident__tag--sev-critical">${escapeHtml(t('Sfruttata attivamente'))}</span>` : ''}
          ${inc.ransomware_known ? `<span class="am-incident__tag am-incident__tag--sev-high">${escapeHtml(t('Usata da ransomware'))}</span>` : ''}
          <span class="am-incident__tag am-incident__tag--sev-${sevCls}">${escapeHtml(inc.severity_label)}${cvss}</span>
          ${inc.cve ? `<span class="am-incident__tag" translate="no">${escapeHtml(inc.cve)}</span>` : ''}
        </div>
        <p class="am-incident__meta"><strong>${escapeHtml(t('Area della fonte:'))}</strong> ${escapeHtml(area)}</p>
        <p class="am-incident__source">${escapeHtml(inc.source || '')} ${link}</p>`;

      bindIncidentCard(card, inc);
      feed.appendChild(card);
    });
  }

  async function fetchIncidents(force) {
    const url = force ? `${API}?refresh=1` : API;
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', headers: { 'X-EVIL-Lang': lang } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function applyPayload(payload, options = {}) {
    if (!payload) return;

    const stamp = `${payload.timestamp || ''}|${payload.data_mode || ''}`;
    if (!options.force && stamp === lastPayloadStamp && lastPayload) return;
    lastPayloadStamp = stamp;
    lastPayload = payload;

    if (options.force) {
      lastRegionsKey = '';
      mapViewLocked = false;
    }

    const regions = (payload.regions || []).filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)));

    renderRegions(regions);
    updateStats(payload);
    renderTicker(payload.incidents);
    renderTimeline(payload.incidents);

    if (!loggedView && payload.incidents?.length) {
      loggedView = true;
      window.progressManager?.logActivity?.('attacks_map_viewed', {
        total: payload.total_incidents,
        mode: payload.data_mode,
      });
    }

    $('am-refresh-btn')?.removeAttribute('hidden');
  }

  async function refresh(force = false) {
    if (refreshInFlight) return;
    refreshInFlight = true;
    const btn = $('am-refresh-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('Aggiornamento…');
    }

    try {
      const data = await fetchIncidents(force);
      applyPayload(data, { force: true });
    } catch (err) {
      console.warn('[attacks-map]', err.message);
      // Nessun dato inventato: se il server non risponde la pagina lo dice e basta
      if (!lastPayload) {
        setLivePill('error', t('Server non raggiungibile'));
        setStatusMessage(t('Il server di EVIL non risponde: nessun dato da mostrare. Riprova tra poco.'));
        renderTimeline([]);
        renderTicker([]);
      } else {
        setStatusMessage(t('Aggiornamento non riuscito: restano i dati mostrati prima.'));
      }
      $('am-refresh-btn')?.removeAttribute('hidden');
    } finally {
      refreshInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = t('Ricarica dati');
      }
    }
  }

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${location.host}/ws/incidents?lang=${encodeURIComponent(lang)}`);
      ws.onmessage = (ev) => {
        try {
          applyPayload(JSON.parse(ev.data));
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        /* onclose gestisce reconnect */
      };
      ws.onclose = () => {
        ws = null;
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = setTimeout(connectWebSocket, 8000);
      };
    } catch {
      /* ws opzionale */
    }
  }

  function boot() {
    if (booted) return;
    booted = true;

    initRadar();
    initReveal();

    // Un errore della mappa non deve bloccare il feed (pill ferma su "Caricamento…")
    const safeInitMap = () => {
      try {
        initMap();
      } catch (err) {
        console.error('[attacks-map] mappa non disponibile:', err);
      }
    };

    const run = () => {
      safeInitMap();
      refresh();
      setInterval(() => refresh(false), 5 * 60 * 1000);
      connectWebSocket();
    };

    $('am-refresh-btn')?.addEventListener('click', () => refresh(true));

    requestAnimationFrame(() => {
      safeInitMap();
      setTimeout(run, 40);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
