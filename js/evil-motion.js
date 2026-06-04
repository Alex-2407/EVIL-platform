/**
 * EVIL — motion layer sito-wide
 * Scroll reveal, mesh leggero, orbs, count-up — rispetta prefers-reduced-motion
 */
(function () {
  'use strict';

  const SKIP_PAGE =
    /\b(home-page|quiz-hub-page|crypto-page|am-page|ha-page|policy-page)\b/;

  const REVEAL_SELECTORS = [
    '.st-hub-hero',
    '.sc-hero',
    '.mdb-hero',
    '.mt-hero',
    '.mc-hero',
    '.ir-hero',
    '.vlab-hero',
    '.sim-hero',
  ];

  const GRID_SELECTORS = [
    '.st-hub-grid',
    '.mdb-vectors__grid',
    '.card-grid',
    '.feature-grid',
    '.mt-grid',
    '.mc-grid',
  ];

  const BLOCK_SELECTORS = [
    '.st-hub-callout',
    '.mdb-stats',
    '.mdb-vectors',
    '.mdb-toolbar',
    'main > section:not([hidden]):not(.evil-reveal-skip)',
  ];

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shouldSkipPage() {
    return SKIP_PAGE.test(document.body.className);
  }

  function markReveal(el, type) {
    if (!el || el.classList.contains('evil-reveal') || el.dataset.evilReveal === 'off') return;
    el.classList.add('evil-reveal');
    if (type === 'grid') el.classList.add('evil-reveal--grid');
    if (reducedMotion) el.classList.add('is-visible');
  }

  function autoTagRevealTargets() {
    if (shouldSkipPage() || reducedMotion) return;

    REVEAL_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => markReveal(el));
    });

    GRID_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => markReveal(el, 'grid'));
    });

    BLOCK_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.closest('.home-page, .quiz-hub-page, .crypto-page')) return;
        markReveal(el);
      });
    });

    const foot = document.querySelector('footer.evil-site-foot');
    if (foot && !foot.classList.contains('evil-reveal')) {
      foot.classList.add('evil-reveal', 'evil-reveal--footer');
    }
  }

  function initRevealObserver() {
    const nodes = document.querySelectorAll(
      '.evil-reveal:not(.is-visible), .evil-reveal-item:not(.is-visible)'
    );
    if (!nodes.length) return;

    if (reducedMotion) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    nodes.forEach((n) => io.observe(n));
  }

  function initSceneOrbs() {
    if (reducedMotion || shouldSkipPage()) return;

    const scenes = document.querySelectorAll(
      '[class*="-scene"]:not(.evil-scene-ready), .st-hub-scene:not(.evil-scene-ready)'
    );

    scenes.forEach((scene) => {
      if (scene.querySelector('.evil-scene-orb')) {
        scene.classList.add('evil-scene-ready');
        return;
      }
      scene.classList.add('evil-scene-ready');
      scene.insertAdjacentHTML(
        'beforeend',
        '<span class="evil-scene-orb evil-scene-orb--amber" aria-hidden="true"></span>' +
          '<span class="evil-scene-orb evil-scene-orb--emerald" aria-hidden="true"></span>'
      );
    });
  }

  function initCountUp() {
    if (reducedMotion) return;

    const stats = document.querySelectorAll('.mdb-stat__val[data-evil-count], .evil-stat__val[data-evil-count]');
    if (!stats.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseInt(el.dataset.evilCount || el.textContent, 10);
          if (!Number.isFinite(target) || el.dataset.evilCounted === '1') return;
          el.dataset.evilCounted = '1';
          const duration = 900;
          const start = performance.now();
          function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = String(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          io.unobserve(el);
        });
      },
      { threshold: 0.5 }
    );

    stats.forEach((s) => io.observe(s));
  }

  function boot() {
    if (window.__evilMotionReady) return;
    window.__evilMotionReady = true;
    if (!document.body.classList.contains('evil-theme')) return;

    /* Leaflet si rompe se main/header hanno transform in animazione */
    if (!reducedMotion && !shouldSkipPage()) {
      document.body.classList.add('motion-on');
    }

    autoTagRevealTargets();
    initSceneOrbs();
    initRevealObserver();
    initCountUp();
  }

  window.initEvilMotion = boot;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
