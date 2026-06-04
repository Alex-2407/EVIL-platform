/**
 * Mappa incidenti documentati — feed pubblici (CISA, NVD, CERT)
 */
(function () {
  'use strict';

  const API = '/api/realtime-incidents';
  const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const OFFLINE_DEMO_INCIDENTS = [
    { country: 'Stati Uniti', latitude: 38.9, longitude: -77.0, type: 'Ransomware', severity: 'critical' },
    { country: 'Germania', latitude: 52.5, longitude: 13.4, type: 'Data Breach', severity: 'high' },
    { country: 'Italia', latitude: 41.9, longitude: 12.5, type: 'Phishing', severity: 'medium' },
    { country: 'Regno Unito', latitude: 51.5, longitude: -0.12, type: 'Malware', severity: 'high' },
    { country: 'Giappone', latitude: 35.7, longitude: 139.7, type: 'Exploit', severity: 'critical' },
    { country: 'Brasile', latitude: -15.8, longitude: -47.9, type: 'DDoS', severity: 'medium' },
  ];
  const SEV = {
    critical: { color: '#f87171', cls: 'critical' },
    high: { color: '#fb923c', cls: 'high' },
    medium: { color: '#fbbf24', cls: 'medium' },
    low: { color: '#22c55e', cls: 'medium' },
  };

  let map = null;
  let layerGroup = null;
  let markerByCountry = {};
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
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
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

  function animateValue(el, end, formatter) {
    if (!el) return;
    const start = parseFloat(String(el.textContent).replace(/[^\d.-]/g, '')) || 0;
    const target = typeof end === 'number' ? end : 0;
    const duration = 900;
    const t0 = performance.now();
    function frame(t) {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * eased;
      el.textContent = formatter ? formatter(val) : Math.round(val).toLocaleString('it-IT');
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setLivePill(mode, label) {
    const pill = $('live-mode-pill');
    if (!pill) return;
    pill.classList.remove('is-cache', 'is-error');
    if (mode === 'cache' || mode === 'simulated') pill.classList.add('is-cache');
    if (mode === 'error') pill.classList.add('is-error');
    const lbl = pill.querySelector('.am-live-pill__label');
    if (lbl) lbl.textContent = label;
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
      markerByCountry = {};

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

  function markerHtml(count, index) {
    const cls = count > 15 ? 'critical' : count > 8 ? 'high' : 'medium';
    const c = SEV[cls] || SEV.medium;
    return `<div class="am-marker am-marker--${cls}" style="color:${c.color};--am-marker-i:${index}">
      <span class="am-marker__ring"></span>
      <span class="am-marker__ring"></span>
      <span class="am-marker__core"></span>
    </div>`;
  }

  function regionsFingerprint(regions) {
    return (regions || [])
      .map((r) => `${r.country}|${r.count}|${Number(r.lat).toFixed(2)}|${Number(r.lon).toFixed(2)}`)
      .sort()
      .join(';;');
  }

  function registerMarker(country, lat, lon, marker) {
    if (!country) return;
    markerByCountry[country] = { marker, lat, lon };
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
    markerByCountry = {};

    (regions || []).forEach((region, i) => {
      const lat = Number(region.lat);
      const lon = Number(region.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const count = region.count || 1;
      const typesHtml = Object.entries(region.types || {})
        .slice(0, 5)
        .map(([t, n]) => `<li>${escapeHtml(t)}: <strong>${n}</strong></li>`)
        .join('');

      const popupHtml = `
        <div class="attacks-popup">
          <h4>${escapeHtml(region.country)}</h4>
          <p><strong>${count}</strong> segnalazioni aggregate</p>
          <ul style="margin:6px 0;padding-left:16px;font-size:12px;color:#94a3b8">${typesHtml || '<li>Advisory / CVE</li>'}</ul>
          <p style="font-size:11px;color:#64748b">Coordinate regionali — non vittime reali</p>
        </div>`;

      const icon = L.divIcon({
        className: 'am-leaflet-icon',
        html: markerHtml(count, i),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lon], { icon, interactive: true });
      marker.bindPopup(popupHtml, POPUP_OPTS);
      marker.on('click', () => marker.openPopup());
      layerGroup.addLayer(marker);
      registerMarker(region.country, lat, lon, marker);
    });

    mapViewLocked = true;
    scheduleMapResize();
  }

  function focusCountryMarker(country) {
    const entry = markerByCountry[country];
    if (!entry || !map) return;
    entry.marker.openPopup();
  }

  function updateStats(payload) {
    const agg = payload.aggregated_stats || {};
    const total = payload.total_incidents ?? (payload.incidents?.length || 0);

    animateValue($('stat-total'), total);
    animateValue($('stat-ransomware'), agg.ransomware || 0);
    animateValue($('stat-breaches'), agg.data_breaches || 0);
    animateValue($('stat-cve'), agg.vulnerability_disclosures || 0);
    animateValue($('stat-countries'), agg.countries_affected || 0);
    animateValue($('stat-critical'), agg.critical_count || 0);

    const damageEl = $('stat-damage');
    if (damageEl) {
      if (agg.estimated_damage_usd) {
        animateValue(damageEl, agg.estimated_damage_usd / 1e9, (v) => `${v.toFixed(1)}B$`);
      } else {
        damageEl.textContent = '—';
      }
    }

    const hud = $('hud-count');
    if (hud) {
      hud.textContent = String(total);
      hud.classList.remove('is-bump');
      void hud.offsetWidth;
      hud.classList.add('is-bump');
    }

    if ($('last-update')) $('last-update').textContent = formatUtc(payload.timestamp);

    const mode = payload.data_mode || 'cache';
    if (mode === 'live') {
      setLivePill('live', 'Feed live attivo');
    } else if (mode === 'simulated') {
      setLivePill('simulated', 'Dati demo — feed offline');
    } else {
      setLivePill('cache', 'Cache / fallback');
    }

    if (payload.monthly_trends) renderMonthly(payload.monthly_trends);
    if (payload.sources) renderSourceChips(payload.sources);
  }

  function renderSourceChips(sources) {
    const wrap = $('sources-strip');
    if (!wrap) return;
    wrap.innerHTML = (sources || [])
      .slice(0, 10)
      .map(
        (s, i) =>
          `<span class="am-source-chip" style="animation-delay:${i * 0.05}s">${escapeHtml(s)}</span>`
      )
      .join('');
  }

  function renderMonthly(values) {
    const grid = $('month-grid');
    if (!grid) return;
    const arr = values || [];
    grid.innerHTML = arr
      .map(
        (v, i) => `
        <div class="am-month-cell" style="animation-delay:${i * 0.04}s">
          <div class="am-month-cell__val">${v}</div>
          <div class="am-month-cell__lbl">${MONTHS[i] || ''}</div>
        </div>`
      )
      .join('');
    renderSparkline(arr);
  }

  function renderSparkline(values) {
    const el = $('monthly-sparkline');
    if (!el || !values?.length) return;
    const w = 800;
    const h = 80;
    const pad = 10;
    const max = Math.max(...values, 1);
    const min = Math.min(...values);
    const range = Math.max(1, max - min);
    const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
    const pts = values.map((v, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    });
    const line = pts.join(' ');
    const area = `${line} ${w - pad},${h - pad} ${pad},${h - pad}`;
    el.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Grafico trend mensile">
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
    const key = items.map((i) => i.id || i.description?.slice(0, 40)).join('|');
    if (key === lastTickerKey && track.childElementCount > 1) return;
    lastTickerKey = key;

    if (!items.length) {
      track.innerHTML = '<span>Nessun aggiornamento disponibile</span>';
      if (wrap) wrap.style.setProperty('--ticker-duration', '0s');
      return;
    }

    const html = items
      .map(
        (inc) =>
          `<span><em>${escapeHtml(inc.type || 'Advisory')}</em> — ${escapeHtml((inc.description || '').slice(0, 90))} · ${escapeHtml(inc.country || 'Globale')}</span>`
      )
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
    const country = inc.country || '';
    const go = () => {
      const feed = $('incidents-feed');
      feed?.querySelectorAll('.am-incident').forEach((c) => c.classList.remove('is-highlight'));
      card.classList.add('is-highlight');
      if (country) focusCountryMarker(country);
    };

    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      go();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
    card.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  function renderTimeline(incidents) {
    const feed = $('incidents-feed');
    const empty = $('incidents-feed-empty');
    if (!feed) return;

    feed.innerHTML = '';
    const list = (incidents || []).slice(0, 12);

    if (!list.length) {
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Nessuna segnalazione disponibile al momento.';
      }
      return;
    }
    if (empty) empty.hidden = true;

    list.forEach((inc, i) => {
      const sev = (inc.severity || 'medium').toLowerCase();
      const sevCls = SEV[sev]?.cls || 'medium';
      const date = new Date(inc.timestamp);
      const dateStr = Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString('it-IT', { dateStyle: 'medium' });
      const link = inc.link
        ? `<a href="${escapeHtml(inc.link)}" target="_blank" rel="noopener noreferrer">Fonte ufficiale ↗</a>`
        : '';

      const card = document.createElement('article');
      card.className = `am-incident am-incident--${sevCls}`;
      card.style.animationDelay = `${Math.min(i * 0.06, 0.6)}s`;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Segnalazione: ${(inc.description || '').slice(0, 80)}`);
      card.innerHTML = `
        <div class="am-incident__head">
          <div class="am-incident__title">${escapeHtml((inc.description || '').slice(0, 160))}</div>
          <time class="am-incident__date">${dateStr}</time>
        </div>
        <div class="am-incident__tags">
          <span class="am-incident__tag">${escapeHtml(inc.type || 'Incident')}</span>
          <span class="am-incident__tag am-incident__tag--sev-${sevCls}">${sev}</span>
          ${inc.is_simulated ? '<span class="am-incident__tag">Demo</span>' : ''}
        </div>
        <p class="am-incident__meta"><strong>Area:</strong> ${escapeHtml(inc.country || 'Multi-regione')} · <strong>Impatto:</strong> ${inc.impact_score ?? '—'}/100</p>
        <p class="am-incident__source">${escapeHtml(inc.source || '')} ${link}</p>`;

      bindIncidentCard(card, inc);
      feed.appendChild(card);
    });
  }

  function aggregateClientSide(incidents) {
    const mapByCountry = {};
    incidents.forEach((inc) => {
      const key = inc.country || 'Globale';
      const lat = Number(inc.latitude);
      const lon = Number(inc.longitude);
      if (!mapByCountry[key]) {
        mapByCountry[key] = {
          country: key,
          lat: Number.isFinite(lat) ? lat : null,
          lon: Number.isFinite(lon) ? lon : null,
          count: 0,
          types: {},
        };
      }
      mapByCountry[key].count += 1;
      const t = inc.type || 'Other';
      mapByCountry[key].types[t] = (mapByCountry[key].types[t] || 0) + 1;
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const prev = mapByCountry[key].count - 1;
        mapByCountry[key].lat = Number.isFinite(mapByCountry[key].lat)
          ? (mapByCountry[key].lat * prev + lat) / mapByCountry[key].count
          : lat;
        mapByCountry[key].lon = Number.isFinite(mapByCountry[key].lon)
          ? (mapByCountry[key].lon * prev + lon) / mapByCountry[key].count
          : lon;
      }
    });
    return Object.values(mapByCountry).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
  }

  function buildOfflinePayload() {
    const incidents = OFFLINE_DEMO_INCIDENTS.map((row, i) => ({
      id: `OFFLINE-${i}`,
      timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      type: row.type,
      country: row.country,
      latitude: row.latitude,
      longitude: row.longitude,
      severity: row.severity,
      source: 'Dati dimostrativi (server non raggiungibile)',
      description: `${row.type} — esempio didattico offline per ${row.country}`,
      is_simulated: true,
    }));
    const regions = aggregateClientSide(incidents);
    return {
      timestamp: new Date().toISOString(),
      data_mode: 'simulated',
      total_incidents: incidents.length,
      incidents,
      regions,
      aggregated_stats: {
        total_incidents: incidents.length,
        ransomware: 1,
        data_breaches: 1,
        vulnerability_disclosures: 1,
        countries_affected: regions.length,
        critical_count: 2,
      },
      monthly_trends: [1, 2, 2, 3, 2, 4, 3, 2, 3, 2, 1, 2],
      sources: ['Modalità offline — avvia npm start per il feed live'],
      source: 'Dati dimostrativi locali',
    };
  }

  async function fetchIncidents(force) {
    const url = force ? `${API}?refresh=1` : API;
    const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function applyPayload(payload, options = {}) {
    if (!payload) return;

    const stamp = payload.timestamp || payload.lastUpdate || '';
    if (!options.force && stamp && stamp === lastPayloadStamp && lastPayload) return;
    lastPayloadStamp = stamp;
    lastPayload = payload;

    if (options.force) {
      lastRegionsKey = '';
      mapViewLocked = false;
    }

    const regions =
      payload.regions?.length > 0
        ? payload.regions.filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon)))
        : aggregateClientSide(payload.incidents || []);

    renderRegions(regions);
    updateStats(payload);
    renderTicker(payload.incidents);
    renderTimeline(payload.incidents);

    if ($('feed-source-line')) {
      $('feed-source-line').textContent = payload.source
        ? ` · ${payload.source}`
        : ' · Fonti pubbliche verificate';
    }

    if (!loggedView && (payload.incidents?.length || regions.length)) {
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
    const prevLabel = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Aggiornamento…';
    }
    if (force) setLivePill('cache', 'Aggiornamento feed…');

    try {
      const data = await fetchIncidents(force);
      applyPayload(data, { force: true });
    } catch (err) {
      console.warn('Mappa incidenti:', err.message);
      setLivePill('error', 'Feed offline — dati dimostrativi');
      $('am-refresh-btn')?.removeAttribute('hidden');
      if (!lastPayload) {
        applyPayload(buildOfflinePayload(), { force: true });
        const help = $('incidents-feed-empty');
        if (help) {
          help.hidden = false;
          help.textContent =
            'Feed non raggiungibile: mappa con dati dimostrativi. Avvia il server EVIL (npm start) e ricarica.';
        }
      }
    } finally {
      refreshInFlight = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel || 'Ricarica feed';
      }
    }
  }

  function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${location.host}/ws/incidents`);
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

    const run = () => {
      initMap();
      refresh();
      setInterval(() => refresh(false), 5 * 60 * 1000);
      connectWebSocket();
    };

    $('am-refresh-btn')?.addEventListener('click', () => refresh(true));

    requestAnimationFrame(() => {
      initMap();
      setTimeout(run, 40);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
