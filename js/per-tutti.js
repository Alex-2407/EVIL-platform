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

    // ordine: scheda nell'indirizzo (#…), poi l'ultima scelta, poi quella indicata nell'HTML
    const fromHash = indexOfKey(decodeURIComponent((window.location.hash || '').slice(1)));
    const fromStore = indexOfKey(store(`pt-switch:${name}`));
    const fromMarkup = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    select(fromHash >= 0 ? fromHash : fromStore >= 0 ? fromStore : Math.max(0, fromMarkup));

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

    // il pulsante sta subito sotto l'header (che resta in alto mentre si scorre)
    const header = document.querySelector('header[role="banner"], body > header');
    function placeBelowHeader() {
      if (!header) return;
      const h = Math.round(header.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty('--pt-header-h', `${h}px`);
    }
    placeBelowHeader();
    window.addEventListener('resize', placeBelowHeader, { passive: true });

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

  // ------------------------------------------------------------ sorprese (STILE.md): mai nella pagina Aiuto
  const t = (window.EVIL_I18N && window.EVIL_I18N.t) || ((s) => s);

  function isHelpPage() {
    return document.body.classList.contains('pt-help-page');
  }

  function egg(id) {
    if (!isHelpPage() && window.EvilEggs) window.EvilEggs.found(id);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // Curiosità vere, con la fonte (verificate il 18 ottobre 2026): Lù ne racconta una ogni 5 tocchi
  const FACTS = [
    { text: t('Le passkey non si possono rubare con una pagina falsa: ognuna funziona solo con il sito vero.'), src: t('FIDO Alliance, passkey'), url: 'https://fidoalliance.org/passkeys/' },
    { text: t('Tre parole a caso fanno una password lunga e facile da ricordare: lo consiglia il centro per la cybersicurezza del Regno Unito.'), src: t('NCSC, «Three random words», 2016'), url: 'https://www.ncsc.gov.uk/blog-post/three-random-words-or-thinkrandom-0' },
    { text: t('I codici delle app di autenticazione cambiano ogni 30 secondi: è il passo consigliato dallo standard TOTP, del 2011.'), src: t('IETF, RFC 6238'), url: 'https://datatracker.ietf.org/doc/html/rfc6238' },
    { text: t('Con l’intelligenza artificiale basta un breve audio per imitare la voce di una persona. Se al telefono ti chiedono soldi, richiama tu.'), src: t('FTC, voci clonate con l’IA, 2023'), url: 'https://consumer.ftc.gov/node/80688' },
    { text: t('Pagare un riscatto non garantisce di riavere i file: per questo l’FBI invita a non pagare.'), src: t('FBI, ransomware'), url: 'https://www.fbi.gov/how-we-can-help-you/scams-and-safety/common-frauds-and-scams/ransomware' },
    { text: t('Esiste un elenco pubblico delle falle che i criminali sfruttano davvero: lo tiene la CISA. Aggiornare chiude proprio quelle porte.'), src: t('CISA, catalogo KEV'), url: 'https://www.cisa.gov/known-exploited-vulnerabilities' },
    { text: t('Alcune foto e video portano le «credenziali del contenuto», che raccontano come sono stati creati: lo standard si chiama C2PA.'), src: t('C2PA, Content Credentials'), url: 'https://c2pa.org/' },
  ];

  function showFact(lu) {
    let i = 0;
    try {
      i = (Number(window.localStorage.getItem('evil-lu-fact')) || 0) % FACTS.length;
      window.localStorage.setItem('evil-lu-fact', String(i + 1));
    } catch (_) {
      i = Math.floor(Math.random() * FACTS.length);
    }
    const f = FACTS[i];
    const host = lu.parentElement;
    host.classList.add('pt-fact-host');
    let bubble = host.querySelector('.pt-fact');
    if (!bubble) {
      bubble = el('div', 'lu-bubble pt-fact');
      bubble.setAttribute('role', 'status');
      host.appendChild(bubble);
    }
    const src = el('p', 'pt-fact__src', `${t('Fonte:')} `);
    const a = el('a', '', f.src);
    a.href = f.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    src.appendChild(a);
    const close = el('button', 'pt-fact__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Chiudi la curiosità'));
    close.addEventListener('click', () => {
      bubble.remove();
      lu.focus();
    });
    bubble.replaceChildren(el('p', 'pt-fact__k', t('Lo sapevi?')), el('p', 'pt-fact__t', f.text), src, close);
    egg('lu');
  }

  function initFacts() {
    document.addEventListener('lu:tap', (e) => {
      const lu = e.target && e.target.closest && e.target.closest('[data-lu]');
      if (!lu || isHelpPage()) return;
      const taps = (e.detail && e.detail.taps) || 0;
      if (taps > 0 && taps % 5 === 0) showFact(lu);
    });
  }

  // "luce" (o "light") scritto sulla tastiera nell'area Per tutti: Lù diventa una torcia
  const TIPS = [
    t('Psst: un codice arrivato per SMS non si gira a nessuno.'),
    t('Una password lunga batte una password complicata.'),
    t('Prima di pubblicare una foto, guarda lo sfondo.'),
    t('Se un messaggio ti mette fretta, rallenta: è il trucco più vecchio del mondo.'),
    t('Chiedere aiuto è una mossa da esperti.'),
  ];

  function initTorch() {
    if (isHelpPage() || !document.body.classList.contains('pt-page')) return;
    const WORDS = ['luce', 'light'];
    let typed = '';
    let layer = null;

    function build() {
      const wrap = el('div', 'pt-torch');
      const tips = el('div', 'pt-torch__tips');
      // tre consigli a caso, in tre zone diverse dello schermo
      const spots = [[12, 26], [58, 48], [18, 72]];
      TIPS.slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .forEach((text, i) => {
          const tip = el('p', 'pt-torch__tip', text);
          tip.style.left = `${spots[i][0] + Math.round(Math.random() * 12)}vw`;
          tip.style.top = `${spots[i][1] + Math.round(Math.random() * 8)}vh`;
          tips.appendChild(tip);
        });
      const bar = el('div', 'pt-torch__bar');
      const off = el('button', 'pt-torch__off', t('Spegni la torcia'));
      off.type = 'button';
      off.addEventListener('click', () => toggle(false));
      bar.append(el('p', 'pt-torch__hint', t('Muovi la luce con il mouse, il dito o le frecce: qualche consiglio è nascosto nel buio.')), off);
      wrap.append(tips, el('div', 'pt-torch__dark'), bar);
      return wrap;
    }

    // posizione del fascio, in pixel: la muovono il puntatore e, da tastiera, le frecce
    let pos = { x: 0, y: 0 };

    function place(x, y) {
      pos = { x: Math.min(Math.max(x, 0), window.innerWidth), y: Math.min(Math.max(y, 0), window.innerHeight) };
      layer.style.setProperty('--x', `${pos.x}px`);
      layer.style.setProperty('--y', `${pos.y}px`);
    }

    function move(e) {
      if (layer) place(e.clientX, e.clientY);
    }

    const STEP = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

    function toggle(on) {
      if (on && !layer) {
        layer = build();
        document.body.appendChild(layer);
        place(window.innerWidth * 0.5, window.innerHeight * 0.45);
        root.classList.add('pt-torch-on');
        window.addEventListener('pointermove', move, { passive: true });
        layer.querySelector('.pt-torch__off').focus();
        egg('light');
      } else if (!on && layer) {
        layer.remove();
        layer = null;
        root.classList.remove('pt-torch-on');
        window.removeEventListener('pointermove', move);
      }
    }

    document.addEventListener('keydown', (e) => {
      if (layer && e.key === 'Escape') {
        toggle(false);
        return;
      }
      if (layer && STEP[e.key]) {
        e.preventDefault();
        const d = Math.max(32, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.06));
        place(pos.x + STEP[e.key][0] * d, pos.y + STEP[e.key][1] * d);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const target = e.target;
      if (target && (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))) return;
      typed = (typed + e.key.toLowerCase()).slice(-8);
      if (WORDS.some((w) => typed.endsWith(w))) {
        typed = '';
        toggle(!layer);
      }
    });
  }

  function init() {
    document.querySelectorAll('[data-pt-switch]').forEach(initSwitch);
    initReveal();
    initMascots();
    initQuickExit();
    initFacts();
    initTorch();
    // pagine che sono esse stesse una sorpresa (premio finto, 404)
    const pageEgg = document.body.getAttribute('data-pt-egg');
    if (pageEgg) egg(pageEgg);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
