/**
 * EVIL · area "Per tutti": selettori a schede, entrate morbide, Lù, pulsante "Esci subito".
 * Regole in docs/evil-per-tutti/STILE.md. Senza JavaScript tutto resta leggibile:
 * i pannelli sono tutti visibili e i pulsanti sono normali link.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  root.classList.add('pt-js');

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (_) {
      /* navigazione privata o archiviazione bloccata: si ricomincia ogni volta */
    }
    return null;
  }

  // ------------------------------------------------------------ selettori a schede (ARIA tabs)
  function initSwitch(box) {
    const name = box.getAttribute('data-pt-switch') || 'switch';
    const tabs = Array.from(box.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    if (!tabs.length || panels.some((p) => !p)) return;

    function select(index, opts) {
      const o = opts || {};
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
        if (on && o.animate && !reducedMotion) {
          panels[i].classList.remove('is-entering');
          void panels[i].offsetWidth; // riavvia l'animazione
          panels[i].classList.add('is-entering');
        }
      });
      const key = panels[index].getAttribute('data-pt-panel') || panels[index].id;
      if (o.remember) store(`pt-switch:${name}`, key);
      if (o.hash && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `#${panels[index].id}`);
      }
      if (o.focus) tabs[index].focus();
    }

    function indexOfKey(key) {
      if (!key) return -1;
      return panels.findIndex((p) => p.id === key || p.getAttribute('data-pt-panel') === key);
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, { remember: true, hash: true, animate: true }));
      tab.addEventListener('keydown', (e) => {
        let next = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next < 0) return;
        e.preventDefault();
        select(next, { remember: true, hash: true, animate: true, focus: true });
      });
    });

    const fromHash = indexOfKey(decodeURIComponent((window.location.hash || '').slice(1)));
    const fromStore = indexOfKey(store(`pt-switch:${name}`));
    select(fromHash >= 0 ? fromHash : fromStore >= 0 ? fromStore : 0);

    window.addEventListener('hashchange', () => {
      const i = indexOfKey(decodeURIComponent(window.location.hash.slice(1)));
      if (i >= 0) select(i, { animate: true });
    });
  }

  // ------------------------------------------------------------ entrate morbide (solo sotto la piega)
  function initReveal() {
    if (reducedMotion || !('IntersectionObserver' in window)) return;
    const targets = document.querySelectorAll('.pt [data-pt-reveal], .pt .pt-section');
    const fold = window.innerHeight * 0.92;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < fold) return; // già visibile: niente sfarfallio
      el.classList.add('pt-will-reveal');
      io.observe(el);
    });
  }

  // ------------------------------------------------------------ Lù: guarda il puntatore, salta se la tocchi
  function initMascots() {
    const mascots = Array.from(document.querySelectorAll('[data-lu]'));
    if (!mascots.length) return;

    if (!reducedMotion) {
      let raf = 0;
      let px = 0;
      let py = 0;
      window.addEventListener(
        'pointermove',
        (e) => {
          px = e.clientX;
          py = e.clientY;
          if (raf) return;
          raf = window.requestAnimationFrame(() => {
            raf = 0;
            mascots.forEach((m) => {
              const r = m.getBoundingClientRect();
              if (!r.width) return;
              const dx = px - (r.left + r.width / 2);
              const dy = py - (r.top + r.height * 0.42);
              const d = Math.hypot(dx, dy) || 1;
              const k = Math.min(1, d / 240);
              m.style.setProperty('--lu-look-x', `${((dx / d) * 1.8 * k).toFixed(2)}px`);
              m.style.setProperty('--lu-look-y', `${((dy / d) * 1.4 * k).toFixed(2)}px`);
              m.classList.add('is-looking');
            });
          });
        },
        { passive: true }
      );
    }

    mascots.forEach((m) => {
      if (m.tagName !== 'BUTTON') return;
      let taps = 0;
      let timer = 0;
      m.addEventListener('click', () => {
        taps += 1;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          taps = 0;
        }, 2500);
        if (!reducedMotion) {
          m.classList.remove('is-hop');
          void m.offsetWidth;
          m.classList.add('is-hop');
        }
        const before = m.className.match(/\blu--(idle|happy|warn|help)\b/);
        m.classList.remove('lu--idle', 'lu--warn', 'lu--help');
        m.classList.add('lu--happy');
        window.setTimeout(() => {
          m.classList.remove('lu--happy');
          m.classList.add(before ? before[0] : 'lu--idle');
        }, 1200);
        m.dispatchEvent(new CustomEvent('lu:tap', { bubbles: true, detail: { taps } }));
      });
    });
  }

  // ------------------------------------------------------------ Esci subito
  function initQuickExit() {
    const buttons = Array.from(document.querySelectorAll('[data-pt-exit]'));
    if (!buttons.length) return;
    const dest = buttons[0].getAttribute('data-pt-exit') || 'https://www.google.com/search?q=meteo';

    function leave(e) {
      if (e) e.preventDefault();
      try {
        document.body.style.visibility = 'hidden';
      } catch (_) {
        /* niente */
      }
      window.location.replace(dest);
    }

    buttons.forEach((b) => b.addEventListener('click', leave));

    // Esc due volte di seguito (entro 800 ms), se non c'è una finestra di dialogo aperta
    let last = 0;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])')) return;
      const now = Date.now();
      if (now - last < 800) leave(e);
      last = now;
    });
  }

  function init() {
    document.querySelectorAll('[data-pt-switch]').forEach(initSwitch);
    initReveal();
    initMascots();
    initQuickExit();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
