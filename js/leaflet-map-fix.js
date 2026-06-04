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
  }

  /** Ripristina centro/zoom se Leaflet prova a spostare la vista (popup, fitBounds, ecc.) */
  function freezeMapView(map, center, zoom) {
    if (!map || !center) return () => {};
    const frozen = global.L ? global.L.latLng(center[0], center[1]) : { lat: center[0], lng: center[1] };
    const z = zoom != null ? zoom : map.getZoom();

    const snap = () => {
      const cur = map.getCenter();
      const drift =
        Math.abs(cur.lat - frozen.lat) > 0.02 || Math.abs(cur.lng - frozen.lng) > 0.02;
      if (drift || map.getZoom() !== z) {
        map.setView(frozen, z, { animate: false, pan: false });
      }
    };

    map.on('moveend', snap);
    map.on('zoomend', snap);
    map.setView(frozen, z, { animate: false, pan: false });
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
