/**
 * Helper condiviso — dimensioni Leaflet corrette su EVIL
 */
(function (global) {
  const POPUP_OPTS = { autoPan: false, autoClose: true, closeOnClick: true };

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function waitForFrame(frame, callback) {
    if (!frame || typeof callback !== 'function') return;

    let finished = false;
    const finish = (rect) => {
      if (finished) return;
      finished = true;
      callback(rect);
    };

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      if (rect.width >= 80 && rect.height >= 80) finish(rect);
      return rect.width >= 80 && rect.height >= 80;
    };

    if (measure()) return;

    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (measure() && observer) observer.disconnect();
      });
      observer.observe(frame);
    }

    let attempts = 0;
    const poll = () => {
      attempts += 1;
      if (measure()) {
        if (observer) observer.disconnect();
        return;
      }
      if (attempts < 40) requestAnimationFrame(poll);
      else finish(frame.getBoundingClientRect());
    };
    requestAnimationFrame(poll);

    setTimeout(() => {
      measure();
      if (observer) observer.disconnect();
    }, 1200);
  }

  function applyContainerSize(map) {
    if (!map) return null;
    const host = map.getContainer();
    const frame = host.closest('.am-map-frame, .ha-map-frame');
    if (!frame) return null;

    const rect = frame.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    return { width, height };
  }

  function fixSize(map) {
    if (!map) return;
    applyContainerSize(map);
    map.invalidateSize({ animate: false, pan: false });
  }

  function scheduleFixSize(map) {
    fixSize(map);
    requestAnimationFrame(() => fixSize(map));
    [80, 250, 700].forEach((ms) => setTimeout(() => fixSize(map), ms));
  }

  function bindAutoResize(map, frame) {
    if (!map) return;
    const onResize = debounce(() => scheduleFixSize(map), 120);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleFixSize(map);
    });
    if (typeof ResizeObserver !== 'undefined' && frame) {
      new ResizeObserver(onResize).observe(frame);
    }
  }

  /** Mappa fissa: niente pan/zoom; popup senza autoPan */
  function lockMapInteraction(map) {
    if (!map) return;
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    if (map.touchRotate) map.touchRotate.disable();
    if (map.keyboard) map.keyboard.disable();
    if (map.tap) map.tap.disable();
    const zc = map.zoomControl;
    if (zc && map.removeControl) {
      try {
        map.removeControl(zc);
      } catch (_) {
        /* ignore */
      }
    }
    const host = map.getContainer();
    if (host) {
      host.style.touchAction = 'manipulation';
    }
    if (!map._evilPopupClamp) {
      map._evilPopupClamp = true;
      const frame = map.getContainer().closest('.am-map-frame, .ha-map-frame');
      map.on('popupopen', (e) => {
        if (frame) frame.classList.add('is-popup-open');
        clampPopup(map, e.popup);
      });
      map.on('popupclose', () => {
        if (frame) frame.classList.remove('is-popup-open');
      });
      map.on('resize', () => {
        map.eachLayer((l) => {
          if (l.getPopup && l.isPopupOpen && l.isPopupOpen()) clampPopup(map, l.getPopup());
        });
      });
    }
  }

  /**
   * La mappa è fissa (niente autoPan), quindi un popup vicino al bordo verrebbe tagliato.
   * Qui lo si tiene dentro il riquadro: larghezza e altezza massime pari alla mappa,
   * spostamento laterale e, se esce in alto, abbassamento con scorrimento interno.
   */
  function clampPopup(map, popup) {
    const el = popup && popup.getElement && popup.getElement();
    const host = map.getContainer();
    if (!el || !host) return;
    const M = 8;
    const wrap = el.querySelector('.leaflet-popup-content-wrapper');
    const content = el.querySelector('.leaflet-popup-content');
    const tip = el.querySelector('.leaflet-popup-tip-container');
    el.style.marginLeft = '';
    el.style.marginBottom = '';
    if (tip) {
      tip.style.marginLeft = '';
      tip.style.visibility = '';
    }
    const box = host.getBoundingClientRect();
    // larghezza e altezza decise da Leaflet stesso, entro i limiti del riquadro
    const o = popup.options;
    if (o._evilMaxW == null) o._evilMaxW = o.maxWidth || 300;
    o.maxWidth = Math.max(140, Math.min(o._evilMaxW, Math.floor(box.width - 2 * M - 48)));
    o.minWidth = Math.min(o.minWidth || 50, o.maxWidth);
    o.maxHeight = Math.max(100, Math.floor(box.height - 2 * M - 44));
    if (!popup._evilUpdating) {
      popup._evilUpdating = true;
      try {
        popup.update();
      } finally {
        popup._evilUpdating = false;
      }
    }
    if (wrap) wrap.style.maxWidth = `${Math.floor(box.width - 2 * M)}px`;
    if (content) content.style.maxWidth = `${o.maxWidth}px`;
    const r = el.getBoundingClientRect();
    let dx = 0;
    if (r.left < box.left + M) dx = box.left + M - r.left;
    else if (r.right > box.right - M) dx = box.right - M - r.right;
    if (dx) {
      el.style.marginLeft = `${dx}px`;
      if (tip) tip.style.marginLeft = `${-20 - dx}px`;
    }
    const top = el.getBoundingClientRect().top;
    if (top < box.top + M) {
      el.style.marginBottom = `${-(box.top + M - top)}px`;
      if (tip) tip.style.visibility = 'hidden';
    }
  }

  /**
   * Ripristina centro/zoom se Leaflet prova a spostare la vista (popup, fitBounds, ecc.).
   * fit = { bounds: [[sud, ovest], [nord, est]], pad }: sugli schermi stretti, dove la vista
   * disegnata per desktop taglierebbe i punti, lo zoom scende finché l'area sta nel riquadro.
   * La vista si ricalcola a ogni ridimensionamento della mappa.
   */
  function freezeMapView(map, center, zoom, fit) {
    if (!map || !center) return () => {};
    const L = global.L;
    const designed = L ? L.latLng(center[0], center[1]) : { lat: center[0], lng: center[1] };
    const maxZ = zoom != null ? zoom : map.getZoom();
    const area = fit && fit.bounds && L ? L.latLngBounds(fit.bounds) : null;
    const pad = fit && Number.isFinite(fit.pad) ? fit.pad : 16;

    const compute = () => {
      if (!area) return { c: designed, z: maxZ };
      let z = maxZ;
      try {
        z = Math.min(maxZ, map.getBoundsZoom(area, false, L.point(pad, pad)));
      } catch (_) {
        /* mappa non ancora dimensionata */
      }
      return { c: area.getCenter(), z };
    };
    let target = compute();

    // Leaflet arrotonda il centro al pixel: a zoom 2 un pixel vale ~0,35°, quindi
    // confrontare le coordinate con una soglia di 0,02° non converge mai e setView
    // rientra in moveend all'infinito (RangeError: Maximum call stack size exceeded).
    // Si confronta lo scarto in pixel e si evita di rientrare durante il ripristino.
    let snapping = false;
    const snap = () => {
      if (snapping) return;
      let offset;
      try {
        offset = map.latLngToContainerPoint(target.c).subtract(map.getSize().divideBy(2));
      } catch (_) {
        return;
      }
      if (Math.abs(offset.x) <= 2 && Math.abs(offset.y) <= 2 && Math.abs(map.getZoom() - target.z) < 0.01) return;
      snapping = true;
      try {
        map.setView(target.c, target.z, { animate: false });
      } finally {
        snapping = false;
      }
    };

    map.on('moveend', snap);
    map.on('zoomend', snap);
    map.on('resize', () => {
      target = compute();
      snap();
    });
    snap();
    return snap;
  }

  /** Separa marker troppo vicini (es. più breach su Washington D.C.) */
  function spreadCoords(lat, lon, bucket, precision = 1) {
    const key = `${Number(lat).toFixed(precision)}|${Number(lon).toFixed(precision)}`;
    const index = bucket.get(key) || 0;
    bucket.set(key, index + 1);
    if (index === 0) return [lat, lon];
    const angle = ((index * 53) % 360) * (Math.PI / 180);
    const radius = 0.22 + index * 0.11;
    return [lat + radius * Math.cos(angle), lon + radius * Math.sin(angle)];
  }

  global.EvilLeafletMap = {
    POPUP_OPTS,
    waitForFrame,
    applyContainerSize,
    fixSize,
    scheduleFixSize,
    bindAutoResize,
    lockMapInteraction,
    freezeMapView,
    spreadCoords,
  };
})(typeof window !== 'undefined' ? window : global);
