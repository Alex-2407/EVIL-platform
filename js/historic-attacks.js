/**
 * Mappa attacchi storici — Leaflet + card collegate
 */
(function () {
  'use strict';

  const ATTACKS = window.HISTORIC_ATTACKS || [];
  const SEV = {
    critical: '#f87171',
    high: '#fb923c',
    medium: '#fbbf24',
  };

  let map = null;
  let layerGroup = null;
  let markerById = {};
  let mapReady = false;
  let resizeObserver = null;
  let mapFrozen = false;
  const MAP_CENTER = [28, 12];
  const MAP_ZOOM = 2;
  const POPUP_OPTS = window.EvilLeafletMap?.POPUP_OPTS || { autoPan: false };

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

  function fixMapSize() {
    if (window.EvilLeafletMap) window.EvilLeafletMap.fixSize(map);
    else if (map) map.invalidateSize({ animate: false, pan: false });
    syncMarkerPositions();
  }

  function scheduleMapResize() {
    if (window.EvilLeafletMap) window.EvilLeafletMap.scheduleFixSize(map);
    else fixMapSize();
  }

  function syncMarkerPositions() {
    if (!layerGroup) return;
    layerGroup.eachLayer((layer) => {
      if (layer.update) layer.update();
    });
  }

  function initMap() {
    const el = $('historic-map');
    if (!el || typeof L === 'undefined' || map) return;

    const frame = el.closest('.ha-map-frame');
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
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerGroup = L.layerGroup().addTo(map);
      markerById = {};

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
        renderMarkers();
      });
    };

    if (window.EvilLeafletMap) {
      window.EvilLeafletMap.waitForFrame(frame, start);
    } else {
      start();
    }
  }

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
      ? `<img class="ha-logo" src="${escapeHtml(attack.logo)}" alt="${alt}" loading="lazy" width="56" height="46"
        onerror="this.closest('.ha-logo-wrap').classList.add('is-fallback'); this.remove();">`
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

  function markerHtml(attack, index) {
    const color = SEV[attack.severity] || SEV.medium;
    return `<div class="ha-marker" style="color:${color};--ha-marker-i:${index}">
      <span class="ha-marker__ring"></span>
      <span class="ha-marker__ring"></span>
      <span class="ha-marker__core"></span>
    </div>`;
  }

  function renderMarkers() {
    if (!map || !layerGroup || !mapReady) return;
    layerGroup.clearLayers();
    markerById = {};
    const coordBucket = new Map();
    const spread = window.EvilLeafletMap?.spreadCoords;

    ATTACKS.forEach((attack, i) => {
      const lat = Number(attack.lat);
      const lon = Number(attack.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const [dispLat, dispLon] = spread
        ? spread(lat, lon, coordBucket, 1)
        : [lat, lon];

      const icon = L.divIcon({
        className: 'ha-leaflet-icon',
        html: markerHtml(attack, i),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const popup = popupHtml(attack);

      const marker = L.marker([dispLat, dispLon], { icon, interactive: true });
      marker.bindPopup(popup, POPUP_OPTS);
      marker.on('click', () => focusAttack(attack.id, false));
      layerGroup.addLayer(marker);
      markerById[attack.id] = { marker, lat: dispLat, lon: dispLon };
    });

    $('ha-map-count').textContent = String(ATTACKS.length);
    scheduleMapResize();
  }

  function focusAttack(id, fly = true) {
    const entry = markerById[id];
    if (!entry || !map) return;

    document.querySelectorAll('.ha-card').forEach((c) => {
      c.classList.toggle('is-active', c.dataset.attackId === id);
    });

    entry.marker.openPopup();

    const card = document.querySelector(`.ha-card[data-attack-id="${id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    const mapFrame = document.querySelector('.ha-map-frame');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            if (e.target.closest('.ha-map-section')) scheduleMapResize();
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

  function boot() {
    renderCards();
    renderTable();
    document.querySelector('.ha-map-section')?.classList.add('is-visible');
    initReveal();
    requestAnimationFrame(() => {
      initMap();
      setTimeout(() => scheduleMapResize(), 120);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
