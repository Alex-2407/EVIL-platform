/**
 * Helper condiviso — dimensioni Leaflet corrette su EVIL
 */
(function (global) {
  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function hasTransformAncestor(el) {
    let node = el;
    while (node && node !== document.body) {
      const transform = getComputedStyle(node).transform;
      if (transform && transform !== 'none') return true;
      node = node.parentElement;
    }
    return false;
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
      if (hasTransformAncestor(frame)) return false;
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

  /** Mappa fissa: niente pan/zoom, marker cliccabili */
  function lockMapInteraction(map) {
    if (!map) return;
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
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
  }

  global.EvilLeafletMap = {
    waitForFrame,
    applyContainerSize,
    fixSize,
    scheduleFixSize,
    bindAutoResize,
    lockMapInteraction,
  };
})(typeof window !== 'undefined' ? window : global);
