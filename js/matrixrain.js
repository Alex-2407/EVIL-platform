/**
 * Logo easter egg — effetto Matrix editorial EVIL
 * Click sul logo: avvia · click di nuovo / Esc / overlay: interrompe
 */
(function () {
  'use strict';

  const WORD = 'PROJECT EVIL';
  const INTRO_MS = 520;
  const WORD_FORM_MS = 2400;
  const WORD_HOLD_MS = 1800;
  const SAFETY_MS = 10000;

  let animationFrameId = null;
  let animationRunId = 0;
  let easterEggActive = false;
  let endTimers = [];
  let viewportCleanup = null;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.isLogoEasterEggActive = function isLogoEasterEggActive() {
    return easterEggActive;
  };

  function clearEndTimers() {
    endTimers.forEach((id) => clearTimeout(id));
    endTimers = [];
  }

  function scheduleEnd(fn, ms) {
    endTimers.push(setTimeout(fn, ms));
  }

  function getElements() {
    return {
      canvas: document.getElementById('matrix-canvas'),
      overlay: document.getElementById('fade-overlay'),
      btn: document.getElementById('matrix-btn'),
    };
  }

  function getViewportSize() {
    const vv = window.visualViewport;
    return {
      width: Math.round(vv?.width ?? window.innerWidth),
      height: Math.round(vhHeight(vv)),
      offsetTop: Math.round(vv?.offsetTop ?? 0),
      offsetLeft: Math.round(vv?.offsetLeft ?? 0),
    };
  }

  function vhHeight(vv) {
    if (vv?.height) return vv.height;
    return window.innerHeight;
  }

  function computeMatrixLayout(viewW, viewH) {
    let fontSize = Math.min(22, Math.max(13, Math.floor(viewW / 17)));
    let columns = Math.max(1, Math.floor(viewW / fontSize));

    while (columns < WORD.length + 2 && fontSize > 11) {
      fontSize -= 1;
      columns = Math.max(1, Math.floor(viewW / fontSize));
    }

    const wordStart = Math.max(0, Math.floor((columns - WORD.length) / 2));
    const rowCount = Math.max(1, Math.floor(viewH / fontSize));
    const midRow = Math.floor(rowCount / 2);
    const midY = Math.min(viewH - fontSize * 2, Math.max(fontSize * 2, midRow * fontSize));

    return { fontSize, columns, wordStart, midY, viewW, viewH };
  }

  function syncCanvasSurface(canvas, ctx) {
    if (!canvas || !ctx) return computeMatrixLayout(window.innerWidth, window.innerHeight);

    const vp = getViewportSize();
    const layout = computeMatrixLayout(vp.width, vp.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = `${vp.width}px`;
    canvas.style.height = `${vp.height}px`;
    canvas.style.top = `${vp.offsetTop}px`;
    canvas.style.left = `${vp.offsetLeft}px`;

    const nextW = Math.max(1, Math.round(vp.width * dpr));
    const nextH = Math.max(1, Math.round(vp.height * dpr));

    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return layout;
  }

  function syncOverlaySurface(overlay) {
    if (!overlay) return;
    const vp = getViewportSize();
    overlay.style.top = `${vp.offsetTop}px`;
    overlay.style.left = `${vp.offsetLeft}px`;
    overlay.style.width = `${vp.width}px`;
    overlay.style.height = `${vp.height}px`;
  }

  function attachViewportListeners(runId, canvas, ctx, onResize) {
    detachViewportListeners();
    const handler = () => {
      if (!easterEggActive || runId !== animationRunId) return;
      onResize();
    };
    viewportCleanup = handler;
    window.visualViewport?.addEventListener('resize', handler);
    window.visualViewport?.addEventListener('scroll', handler);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
  }

  function detachViewportListeners() {
    if (!viewportCleanup) return;
    window.visualViewport?.removeEventListener('resize', viewportCleanup);
    window.visualViewport?.removeEventListener('scroll', viewportCleanup);
    window.removeEventListener('resize', viewportCleanup);
    window.removeEventListener('orientationchange', viewportCleanup);
    viewportCleanup = null;
  }

  function isOnHomePage() {
    const path = window.location.pathname.toLowerCase();
    return path === '/' || path.endsWith('/home.html') || path.endsWith('/html/home.html');
  }

  function getHomeUrl() {
    return '/';
  }

  function updateMatrixButtonState(active) {
    const { btn } = getElements();
    if (!btn) return;
    btn.classList.toggle('is-matrix-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.setAttribute(
      'aria-label',
      active ? 'Interrompi effetto Matrix' : 'Attiva effetto Matrix'
    );
  }

  function hideMatrixVisuals() {
    const { canvas, overlay } = getElements();
    detachViewportListeners();

    if (canvas) {
      canvas.style.display = 'none';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.style.top = '';
      canvas.style.left = '';
    }

    if (overlay) {
      overlay.style.pointerEvents = 'none';
      overlay.style.top = '';
      overlay.style.left = '';
      overlay.style.width = '';
      overlay.style.height = '';
    }

    document.body.classList.remove('logo-easter-active');
    updateMatrixButtonState(false);
  }

  function fadeOutOverlay(overlay, onDone) {
    if (!overlay) {
      onDone?.();
      return;
    }
    overlay.style.transition = 'opacity 0.45s ease';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    scheduleEnd(() => {
      overlay.style.display = 'none';
      onDone?.();
    }, 460);
  }

  function cancelLogoEasterEgg() {
    clearEndTimers();
    animationRunId += 1;
    easterEggActive = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    hideMatrixVisuals();
    fadeOutOverlay(getElements().overlay);
  }

  function finishLogoEasterEgg(runId) {
    if (!easterEggActive || runId !== animationRunId) return;

    clearEndTimers();
    easterEggActive = false;
    detachViewportListeners();

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    const { canvas, overlay } = getElements();
    if (canvas) canvas.style.display = 'none';
    document.body.classList.remove('logo-easter-active');
    updateMatrixButtonState(false);

    if (!isOnHomePage()) {
      window.location.href = getHomeUrl();
      return;
    }

    if (overlay) {
      syncOverlaySurface(overlay);
      overlay.style.display = 'block';
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
      overlay.style.transition = 'opacity 0.5s ease';
    }

    scheduleEnd(() => {
      fadeOutOverlay(overlay);
    }, 420);
  }

  function startMatrixRain(runId) {
    const { canvas } = getElements();
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let layout = syncCanvasSurface(canvas, ctx);
    let columns = layout.columns;
    let drops = Array(columns).fill(1);
    let evilY = Array(WORD.length).fill(0);
    let frame = 0;

    const wordStart = () => layout.wordStart;
    const wordEnd = () => wordStart() + WORD.length;
    const evilStart = () => wordStart() + 8;

    function resetRainState() {
      layout = syncCanvasSurface(canvas, ctx);
      columns = layout.columns;
      drops = Array(columns).fill(1);
      evilY = Array(WORD.length).fill(0);
      frame = 0;
      ctx.fillStyle = '#06080e';
      ctx.fillRect(0, 0, layout.viewW, layout.viewH);
    }

    resetRainState();
    attachViewportListeners(runId, canvas, ctx, resetRainState);

    function draw() {
      if (!easterEggActive || runId !== animationRunId) {
        animationFrameId = null;
        return;
      }

      const { fontSize, midY, viewW, viewH } = layout;
      ctx.fillStyle = 'rgba(6, 8, 14, 0.14)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.font = `${fontSize}px ui-monospace, Consolas, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const isWordCol = frame >= 50 && i >= wordStart() && i < wordEnd();
        const idx = i - wordStart();

        if (isWordCol && idx >= 0 && idx < WORD.length) {
          if (evilY[idx] < midY) {
            evilY[idx] = Math.min(midY, evilY[idx] + fontSize);
          }
          const ch = WORD[idx];
          if (ch === ' ') continue;
          ctx.fillStyle = i >= evilStart() ? '#f59e0b' : '#00ff9c';
          ctx.fillText(ch, i * fontSize, evilY[idx]);
        } else {
          ctx.fillStyle = Math.random() > 0.92 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(0, 255, 156, 0.72)';
          ctx.fillText(
            letters[Math.floor(Math.random() * letters.length)],
            i * fontSize,
            drops[i] * fontSize
          );
          if (Math.random() > 0.975 || drops[i] * fontSize > viewH) {
            drops[i] = 0;
          }
          drops[i]++;
        }
      }

      frame++;
      animationFrameId = requestAnimationFrame(draw);
    }

    draw();
  }

  window.playLogoEasterEgg = function playLogoEasterEgg() {
    const { canvas, overlay } = getElements();

    if (easterEggActive) {
      cancelLogoEasterEgg();
      return;
    }

    if (!canvas || !overlay) {
      window.location.href = getHomeUrl();
      return;
    }

    if (reducedMotion) {
      window.location.href = getHomeUrl();
      return;
    }

    clearEndTimers();
    animationRunId += 1;
    const runId = animationRunId;
    easterEggActive = true;

    document.body.classList.add('logo-easter-active');
    updateMatrixButtonState(true);
    syncOverlaySurface(overlay);

    overlay.style.transition = 'opacity 0.45s ease';
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    canvas.style.display = 'none';

    scheduleEnd(() => {
      if (!easterEggActive || runId !== animationRunId) return;

      overlay.style.display = 'none';
      canvas.style.display = 'block';
      startMatrixRain(runId);

      scheduleEnd(() => {
        finishLogoEasterEgg(runId);
      }, WORD_FORM_MS + WORD_HOLD_MS);
    }, INTRO_MS);

    scheduleEnd(() => {
      finishLogoEasterEgg(runId);
    }, INTRO_MS + SAFETY_MS);
  };

  window.toggleMatrix = function toggleMatrix() {
    playLogoEasterEgg();
  };

  window.stopMatrixRain = function stopMatrixRainPublic() {
    cancelLogoEasterEgg();
  };

  function bindLogoEasterEggButton() {
    const btn = document.getElementById('matrix-btn');
    if (!btn || btn.dataset.easterBound === '1') return;
    btn.dataset.easterBound = '1';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      playLogoEasterEgg();
    });
  }

  function bindOverlayDismiss() {
    const { overlay } = getElements();
    if (!overlay || overlay.dataset.easterBound === '1') return;
    overlay.dataset.easterBound = '1';
    const dismiss = () => {
      if (easterEggActive) cancelLogoEasterEgg();
    };
    overlay.addEventListener('click', dismiss);
    overlay.addEventListener('touchend', (e) => {
      if (easterEggActive) {
        e.preventDefault();
        dismiss();
      }
    }, { passive: false });
  }

  function bindEscapeDismiss() {
    if (window.__evilMatrixEscapeBound) return;
    window.__evilMatrixEscapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && easterEggActive) {
        e.preventDefault();
        e.stopPropagation();
        cancelLogoEasterEgg();
      }
    }, true);
  }

  function initLogoEasterEgg() {
    bindLogoEasterEggButton();
    bindOverlayDismiss();
    bindEscapeDismiss();
  }

  window.bindLogoEasterEggButton = bindLogoEasterEggButton;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogoEasterEgg);
  } else {
    initLogoEasterEgg();
  }
})();
