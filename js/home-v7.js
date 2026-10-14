/**
 * EVIL — Home v7: animazioni e interazioni della home.
 *
 * Dati: window.EVIL_SITE (js/site-pages.js, generato dal server da server/site-map.js),
 * così pagine, aree e numeri restano allineati al sito senza toccare questo file.
 * Testi: tutti passano da t(); il dizionario inglese è i18n/en/js/home-v7.json.
 * Niente script inline: il file è compatibile con la CSP senza 'unsafe-inline'.
 */
(function () {
  'use strict';

  const I = window.EVIL_I18N || {
    lang: 'it',
    locale: 'it-IT',
    t: (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : String(s)),
    url: (p) => p,
  };
  const t = (s, v) => I.t(s, v);
  const L = I.lang === 'en' ? 'en' : 'it';
  const SITE = window.EVIL_SITE || { areas: [], pages: [], stats: {} };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const loc = (o) => (o && (o[L] || o.it)) || '';
  const pageUrl = (file) => I.url('/' + file);
  const fmt = (n) => Number(n).toLocaleString(I.locale);

  /* ------------------------------------------------------------ icone (stesso set del site-map) */
  const ICON = {
    route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
    code: '<path d="M8 6 2 12l6 6M16 6l6 6-6 6"/>',
    flask: '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    quiz: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v11h16V9M10 13h4"/>',
    bug: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M12 20v-9M4 10h4M16 10h4M4 16h4M16 16h4M9 3l1.5 3M15 3l-1.5 3"/>',
    tree: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M5 17v-2h14v2M12 12v3"/>',
    mask: '<path d="M3 7c4-2 14-2 18 0 0 7-4 12-9 12S3 14 3 7Z"/><path d="M8 11h2M14 11h2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    head: '<path d="M4 6h16M4 12h10M4 18h7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5"/>',
    dns: '<rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 7h.01M7 17h.01"/>',
    sub: '<path d="M3 5h6v6H3zM15 13h6v6h-6zM9 8h3v8h3"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    report: '<path d="M4 4h16v16H4z"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0L5 7zM19 7l-3 7a4 4 0 0 0 6 0l-3-7z"/>',
    help: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  };
  const svgIcon = (k) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k] || ICON.info}</svg>`;

  const AREA_HEX = { impara: '#7dd3fc', analizza: '#ffb627', verifica: '#00ff9c', progetto: '#c4b5fd' };
  const AREA_VAR = { impara: 'var(--hv-cyan)', analizza: 'var(--hv-amber2)', verifica: 'var(--hv-green)', progetto: 'var(--hv-violet)' };
  const areaById = Object.fromEntries((SITE.areas || []).map((a) => [a.id, a]));
  const areaLabel = (id) => loc(areaById[id] && areaById[id].label) || id;
  const areaSub = (id) => loc(areaById[id] && areaById[id].sub);

  $$('[data-icon]').forEach((el) => {
    el.innerHTML = svgIcon(el.dataset.icon);
  });

  /* ------------------------------------------------------------ easter egg: contatore */
  const EGGS = {
    konami: t('Codice Konami'),
    evil: t('La parola magica'),
    shell: t('Terminale root'),
    caesar: t('Crittografo'),
    core: t('Il cuore della mappa'),
    pixel: t('Il cursore lampeggiante'),
  };
  const EGG_TOTAL = Object.keys(EGGS).length;
  const STORE_KEY = 'evil-home-eggs';
  const found = new Set();
  try {
    JSON.parse(localStorage.getItem(STORE_KEY) || '[]').forEach((k) => {
      if (EGGS[k]) found.add(k);
    });
  } catch (_) {
    /* memoria del browser non disponibile: si riparte da zero */
  }

  const toastEl = $('#hv-toast');
  let toastTimer;
  function toast(title, msg, ms = 4200) {
    if (!toastEl) return;
    $('#hv-toast-t').textContent = title;
    $('#hv-toast-m').textContent = msg || '';
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), ms);
  }

  function renderEggs() {
    const n = found.size;
    const pill = $('#hv-eggs');
    if (pill) {
      pill.classList.toggle('is-show', n > 0);
      $('#hv-eggs-n').textContent = n;
    }
    const ring = $('#hv-ring');
    if (ring) ring.style.strokeDashoffset = String(540.35 * (1 - n / EGG_TOTAL));
    const lbl = $('#hv-ring-n');
    if (lbl) lbl.textContent = `${n}/${EGG_TOTAL}`;
    const medal = $('#hv-secret-medal');
    if (medal && n === EGG_TOTAL) {
      medal.classList.remove('is-locked');
      const ico = $('.hv-medal__ico', medal);
      if (ico) ico.innerHTML = svgIcon('star');
      $('#hv-secret-name').textContent = t('Cacciatore di segreti');
    }
  }

  function egg(id, msg) {
    if (found.has(id)) {
      if (msg) toast(t('Già trovato'), msg, 2500);
      return;
    }
    found.add(id);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...found]));
    } catch (_) {
      /* ignora */
    }
    renderEggs();
    toast(t('Segreto {n}/{tot} · {nome}', { n: found.size, tot: EGG_TOTAL, nome: EGGS[id] }), msg || '');
    if (found.size === EGG_TOTAL) {
      setTimeout(
        () => toast(t('Trofeo segreto sbloccato'), t('Li hai trovati tutti e sei. Il cerchio è pieno.'), 6000),
        4400
      );
    }
  }
  renderEggs();

  console.log(
    '%c EVIL %c ' + t('curioso? bene.') + '\n↑ ↑ ↓ ↓ ← → ← → B A',
    'background:#00ff9c;color:#000;font-weight:900;padding:2px 6px',
    'color:#f59e0b'
  );

  /* ------------------------------------------------------------ sfondo: rete di particelle */
  (function net() {
    const c = $('#hv-net');
    if (!c || !c.getContext) return;
    const x = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0;
    let h = 0;
    let pts = [];
    let running = true;
    const mouse = { x: -9999, y: -9999 };
    const size = () => {
      w = c.width = Math.round(window.innerWidth * dpr);
      h = c.height = Math.round(window.innerHeight * dpr);
      const n = Math.round(Math.min(80, (window.innerWidth * window.innerHeight) / 17000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35 * dpr,
        vy: (Math.random() - 0.5) * 0.35 * dpr,
        g: Math.random() < 0.25,
      }));
    };
    const LINK = 130 * dpr;
    function draw() {
      x.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          if (Math.hypot(dx, dy) < 180 * dpr) {
            p.x -= dx * 0.004;
            p.y -= dy * 0.004;
          }
        }
        x.fillStyle = p.g ? 'rgba(0,255,156,.8)' : 'rgba(245,158,11,.6)';
        x.beginPath();
        x.arc(p.x, p.y, 1.4 * dpr, 0, 7);
        x.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            x.strokeStyle = `rgba(125,211,252,${(1 - d / LINK) * 0.22})`;
            x.lineWidth = dpr * 0.8;
            x.beginPath();
            x.moveTo(a.x, a.y);
            x.lineTo(b.x, b.y);
            x.stroke();
          }
        }
      }
      if (running && !reduce) requestAnimationFrame(draw);
    }
    size();
    window.addEventListener('resize', size);
    window.addEventListener(
      'pointermove',
      (e) => {
        mouse.x = e.clientX * dpr;
        mouse.y = e.clientY * dpr;
      },
      { passive: true }
    );
    document.addEventListener('visibilitychange', () => {
      const was = running;
      running = !document.hidden;
      if (running && !was && !reduce) requestAnimationFrame(draw);
    });
    draw();
  })();

  /* ------------------------------------------------------------ cursore, avanzamento, magneti, tilt */
  const root = document.documentElement;
  if (finePointer && !reduce) {
    window.addEventListener(
      'pointermove',
      (e) => {
        document.body.style.setProperty('--mx', e.clientX + 'px');
        document.body.style.setProperty('--my', e.clientY + 'px');
      },
      { passive: true }
    );
  }
  const rail = $('.hv-rail');
  window.addEventListener(
    'scroll',
    () => {
      if (!rail) return;
      const p = window.scrollY / Math.max(1, root.scrollHeight - window.innerHeight);
      rail.style.setProperty('--prog', (p * 100).toFixed(1) + '%');
    },
    { passive: true }
  );
  if (finePointer && !reduce) {
    $$('.hv-magnet').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.25}px)`;
      });
      b.addEventListener('pointerleave', () => {
        b.style.transform = '';
      });
    });
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('.hv-tilt');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 8}deg)`;
      el.style.setProperty('--px', px * 100 + '%');
      el.style.setProperty('--py', py * 100 + '%');
    });
    document.addEventListener('pointerout', (e) => {
      const el = e.target.closest && e.target.closest('.hv-tilt');
      if (el && !el.contains(e.relatedTarget)) el.style.transform = '';
    });
  }

  /* ------------------------------------------------------------ testo che si decifra */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
  function scramble(el) {
    if (reduce || el.dataset.done) return;
    el.dataset.done = '1';
    const nodes = [];
    const walk = (n) => {
      for (const ch of n.childNodes) {
        if (ch.nodeType === 3) nodes.push([ch, ch.textContent]);
        else walk(ch);
      }
    };
    walk(el);
    const t0 = performance.now();
    const dur = 750;
    const step = (now) => {
      const k = Math.min(1, ((now || t0) - t0) / dur);
      for (const [n, txt] of nodes) {
        n.textContent = Array.from(txt)
          .map((c, i) => (c === ' ' ? ' ' : i / txt.length < k ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join('');
      }
      if (k < 1) requestAnimationFrame(step);
      else for (const [n, txt] of nodes) n.textContent = txt;
    };
    step(t0);
  }

  /* ------------------------------------------------------------ apparizione allo scroll + contatori */
  function countUp(el) {
    const to = parseInt(String(el.textContent).replace(/\D/g, ''), 10);
    if (!Number.isFinite(to) || reduce || to === 0) return;
    const t0 = performance.now();
    const dur = 1600;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(to);
    };
    requestAnimationFrame(tick);
  }

  function onReveal(el) {
    el.classList.remove('is-pending');
    if (el.matches('[data-scramble]')) scramble(el);
    $$('[data-scramble]', el).forEach(scramble);
    $$('[data-count]', el).forEach(countUp);
  }

  const revealables = $$('.hv-reveal');
  if ('IntersectionObserver' in window && !reduce) {
    const vh = window.innerHeight;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          onReveal(e.target);
          io.unobserve(e.target);
        }),
      { threshold: 0.15 }
    );
    revealables.forEach((el) => {
      // nasconde solo ciò che al caricamento è sotto lo schermo: niente sfarfallio
      if (el.getBoundingClientRect().top > vh * 0.92) el.classList.add('is-pending');
      io.observe(el);
    });
    // anche i titoli nell'hero si "decifrano" subito
    $$('.hv-intro [data-scramble]').forEach((el) => setTimeout(() => scramble(el), 900));
  }

  /* ------------------------------------------------------------ terminale dell'hero */
  (function terminal() {
    const out = $('#hv-term');
    if (!out || reduce) {
      if (out) out.lastElementChild.insertAdjacentHTML('beforeend', '<span class="hv-caret"></span>');
      return;
    }
    const lines = Array.from(out.children).map((el) => ({
      cls: el.className,
      html: el.innerHTML,
      typed: el.hasAttribute('data-type'),
    }));
    out.innerHTML = '';
    let i = 0;
    const next = () => {
      if (i >= lines.length) {
        const last = out.lastElementChild;
        if (last) last.insertAdjacentHTML('beforeend', '<span class="hv-caret"></span>');
        return;
      }
      const line = lines[i++];
      const row = document.createElement('div');
      if (line.cls) row.className = line.cls;
      out.appendChild(row);
      if (!line.typed) {
        row.innerHTML = line.html;
        setTimeout(next, 230);
        return;
      }
      const tmp = document.createElement('div');
      tmp.innerHTML = line.html;
      const prompt = tmp.querySelector('.p');
      const prefix = prompt ? prompt.outerHTML : '';
      if (prompt) prompt.remove();
      const text = tmp.textContent;
      let k = 0;
      const type = () => {
        row.innerHTML = prefix + esc(text.slice(0, k)) + '<span class="hv-caret"></span>';
        if (k++ < text.length) setTimeout(type, 36 + Math.random() * 48);
        else {
          row.innerHTML = prefix + esc(text);
          setTimeout(next, 380);
        }
      };
      type();
    };
    setTimeout(next, 650);
  })();

  /* ------------------------------------------------------------ ticker: feed reale della mappa avvisi */
  (function ticker() {
    const box = $('#hv-ticker');
    const track = $('#hv-ticker-track');
    if (!box || !track || !window.fetch) return;
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 9000);
    fetch('/api/realtime-incidents', { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        clearTimeout(timer);
        const list = data && Array.isArray(data.incidents) ? data.incidents : [];
        const mode = data && data.data_mode;
        if (!list.length || !['live', 'cache', 'sample'].includes(mode)) return;
        const sev = { critical: 's-h', high: 's-h', medium: 's-m', low: 's-l' };
        const href = pageUrl('attacks-map.html');
        const items = list.slice(0, 12).map((it) => {
          const what = [it.vendor, it.product].filter(Boolean).join(' ') || String(it.description || '').split(' — ')[0];
          const text = what.length > 90 ? what.slice(0, 88) + '…' : what;
          const label = it.severity_label || it.type || t('Avviso');
          const where = it.area_name || it.source || '';
          return `<a href="${esc(href)}"><b class="${sev[it.severity] || 's-i'}">● ${esc(label)}</b>${
            it.cve ? ' ' + esc(it.cve) : ''
          } &nbsp;${esc(text)}${where ? ' · <b>' + esc(where) + '</b>' : ''}</a>`;
        });
        if (mode === 'sample') {
          box.classList.add('hv-ticker--sample');
          items.push(`<span>${esc(t('dati di esempio: le fonti pubbliche ora non rispondono'))}</span>`);
        }
        const html = items.join('');
        track.innerHTML = html + html;
        $('#hv-ticker-label').textContent = mode === 'live' ? t('Live') : mode === 'cache' ? t('Feed') : t('Esempio');
        $('#hv-ticker-label').setAttribute('aria-label', t('Apri la mappa degli avvisi'));
        box.hidden = false;
      })
      .catch(() => {
        clearTimeout(timer);
        /* feed non raggiungibile: il ticker resta nascosto */
      });
  })();

  /* ------------------------------------------------------------ catalogo */
  const CATALOG_AREAS = ['impara', 'analizza', 'verifica'];
  (function catalog() {
    const box = $('#hv-tiles');
    if (!box || !(SITE.pages || []).length) return;
    const pages = SITE.pages.filter((p) => CATALOG_AREAS.includes(p.area));
    box.innerHTML = pages
      .map(
        (p) => `<a class="hv-tile hv-tilt" data-a="${esc(p.area)}" href="${esc(pageUrl(p.file))}" style="--c:${AREA_VAR[p.area]}">
          <span class="hv-tile__shine" aria-hidden="true"></span>
          <span class="hv-tile__ico">${svgIcon(p.icon)}</span>
          <h3>${esc(loc(p.title))}</h3>
          <p>${esc(loc(p.desc))}</p>
          <span class="hv-tile__foot"><span class="hv-badge ${p.auth ? 'hv-badge--acc' : 'hv-badge--free'}">${esc(
            p.auth ? t('Con account') : t('Libero')
          )}</span><span>${esc(areaLabel(p.area))} <span class="hv-tile__arrow" aria-hidden="true">→</span></span></span>
        </a>`
      )
      .join('');
    const tabs = $$('.hv-tabs [role="tab"]');
    const select = (b) => {
      tabs.forEach((x) => {
        x.setAttribute('aria-selected', String(x === b));
        x.tabIndex = x === b ? 0 : -1;
      });
      const f = b.dataset.f;
      $$('.hv-tile', box).forEach((tile, i) => {
        const show = f === 'all' || tile.dataset.a === f;
        tile.hidden = !show;
        if (show && !reduce && tile.animate) {
          tile.animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }], {
            duration: 420,
            delay: i * 25,
            easing: 'cubic-bezier(.2,.8,.2,1)',
            fill: 'backwards',
          });
        }
      });
    };
    tabs.forEach((b, i) => {
      b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1;
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = tabs[(i + d + tabs.length) % tabs.length];
        select(n);
        n.focus();
      });
    });
  })();

  /* ------------------------------------------------------------ mappa del sito (costellazione) */
  (function atlas() {
    const svg = $('#hv-atlas');
    const panel = $('#hv-panel');
    if (!svg || !panel || !(SITE.pages || []).length) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (n, a = {}, parent = svg) => {
      const e = document.createElementNS(NS, n);
      for (const k in a) e.setAttribute(k, a[k]);
      parent.appendChild(e);
      return e;
    };
    const defs = el('defs');
    const f = el('filter', { id: 'hv-glow-f', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 4, result: 'b' }, f);
    const m = el('feMerge', {}, f);
    el('feMergeNode', { in: 'b' }, m);
    el('feMergeNode', { in: 'SourceGraphic' }, m);

    const C = { x: 400, y: 300 };
    const HUB = {
      impara: { x: 200, y: 170, ly: 40 },
      analizza: { x: 600, y: 170, ly: 40 },
      verifica: { x: 600, y: 440, ly: -26 },
      progetto: { x: 200, y: 440, ly: 40 },
    };
    // posizioni disegnate a mano: [x, y, lato dell'etichetta]
    const POS = {
      'learning-paths.html': [75, 70, 'n'],
      'web-simulator.html': [200, 42, 'n'],
      'virtual-lab.html': [325, 70, 'n'],
      'crypto-studio.html': [345, 180, 'e'],
      'quiz-hub.html': [62, 190, 's'],
      'hacked-timeline.html': [140, 270, 's'],
      'glossary.html': [272, 268, 's'],
      'attacks-map.html': [478, 70, 'n'],
      'historic-attacks.html': [605, 42, 'n'],
      'malware-db.html': [732, 75, 'n'],
      'malware-classification.html': [742, 200, 's'],
      'persistence-evasion.html': [628, 272, 's'],
      'security-check.html': [482, 378, 'w'],
      'vulnerability-scanner.html': [470, 468, 'w'],
      'domain-recon.html': [522, 552, 's'],
      'file-analysis.html': [678, 552, 's'],
      'osint-hub.html': [735, 468, 'e'],
      'report-generator.html': [722, 372, 'e'],
      'about.html': [82, 378, 'n'],
      'ethics.html': [72, 490, 's'],
      'help.html': [190, 560, 's'],
      'site-policies.html': [318, 505, 's'],
    };
    const SHORT = {
      'learning-paths.html': t('Percorsi'),
      'web-simulator.html': t('Simulatore web'),
      'virtual-lab.html': t('Lab virtuale'),
      'crypto-studio.html': t('Cifratura'),
      'quiz-hub.html': t('Centro quiz'),
      'hacked-timeline.html': t('Timeline IR'),
      'glossary.html': t('Glossario'),
      'attacks-map.html': t('Mappa avvisi'),
      'historic-attacks.html': t('Violazioni storiche'),
      'malware-db.html': t('Catalogo malware'),
      'malware-classification.html': t('Tassonomia'),
      'persistence-evasion.html': t('Persistenza'),
      'security-check.html': t('Check URL'),
      'vulnerability-scanner.html': t('Header HTTP'),
      'domain-recon.html': t('Ricognizione'),
      'file-analysis.html': t('Analisi file'),
      'osint-hub.html': t('OSINT'),
      'report-generator.html': t('Report'),
      'about.html': t('Chi siamo'),
      'ethics.html': t('Etica e legge'),
      'help.html': t('Aiuto'),
      'site-policies.html': t('Privacy'),
    };

    const pages = SITE.pages.filter((p) => p.nav && HUB[p.area]);
    // pagine nuove senza posizione: su un arco attorno alla loro area
    const extra = {};
    pages.forEach((p) => {
      if (POS[p.file]) return;
      const h = HUB[p.area];
      const n = (extra[p.area] = (extra[p.area] || 0) + 1);
      const a = Math.atan2(h.y - C.y, h.x - C.x) + (n - 1) * 0.5 - 0.5;
      POS[p.file] = [Math.round(h.x + Math.cos(a) * 125), Math.round(h.y + Math.sin(a) * 110), 's'];
    });

    const gE = el('g');
    const gN = el('g');
    function show(html) {
      panel.classList.remove('is-swap');
      void panel.offsetWidth;
      panel.classList.add('is-swap');
      panel.innerHTML = html;
    }
    const clearOn = () => $$('.hv-node.is-on', svg).forEach((n) => n.classList.remove('is-on'));
    const chip = (area, text) =>
      `<span class="hv-chip" style="color:${AREA_HEX[area]};border-color:${AREA_HEX[area]}66">${esc(text)}</span>`;

    for (const [a, h] of Object.entries(HUB)) {
      el('path', { d: `M${C.x},${C.y} L${h.x},${h.y}`, class: 'hv-edge hv-edge--hub', stroke: AREA_HEX[a] }, gE);
    }

    pages.forEach((p) => {
      const h = HUB[p.area];
      const [x, y, side] = POS[p.file];
      const bend = y < h.y ? -14 : 14;
      el('path', { d: `M${h.x},${h.y} Q${(h.x + x) / 2},${(h.y + y) / 2 + bend} ${x},${y}`, class: 'hv-edge' }, gE);
      const g = el(
        'g',
        {
          class: 'hv-node',
          tabindex: 0,
          role: 'link',
          'aria-label': `${loc(p.title)}: ${loc(p.desc)}`,
          transform: `translate(${x},${y})`,
        },
        gN
      );
      el('circle', { r: 13, class: 'halo', stroke: AREA_HEX[p.area] }, g);
      el('circle', { r: 6, class: 'core', fill: AREA_HEX[p.area] }, g);
      const lp = { n: [0, -14, 'middle'], s: [0, 24, 'middle'], e: [13, 4, 'start'], w: [-13, 4, 'end'] }[side];
      const label = el('text', { x: lp[0], y: lp[1], 'text-anchor': lp[2], class: 'hv-lbl-page' }, g);
      label.textContent = SHORT[p.file] || loc(p.title);
      const href = pageUrl(p.file);
      const html = `${chip(p.area, areaLabel(p.area) + ' · ' + areaSub(p.area))}<h3>${esc(loc(p.title))}</h3><p>${esc(loc(p.desc))}</p>
        <div class="hv-atlas__meta"><span class="hv-badge ${p.auth ? 'hv-badge--acc' : 'hv-badge--free'}">${esc(
          p.auth ? t('Con account') : t('Libero')
        )}</span><span class="hv-chip">/${esc(p.file)}</span></div>
        <a class="hv-btn hv-btn--amber" href="${esc(href)}">${esc(t('Apri la pagina →'))}</a>`;
      const on = () => {
        clearOn();
        g.classList.add('is-on');
        show(html);
      };
      g.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') on();
      });
      g.addEventListener('focus', on);
      g.addEventListener('click', (e) => {
        // con il mouse si apre subito; al tocco il primo tap mostra la scheda
        if (e.pointerType === 'mouse' || g.classList.contains('is-on')) window.location.href = href;
        else on();
      });
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') window.location.href = href;
      });
    });

    for (const [a, h] of Object.entries(HUB)) {
      const list = pages.filter((p) => p.area === a);
      const g = el(
        'g',
        { class: 'hv-node hv-node--hub', tabindex: 0, role: 'button', 'aria-label': t('Area {nome}', { nome: areaLabel(a) }), transform: `translate(${h.x},${h.y})` },
        gN
      );
      el('circle', { r: 16, fill: AREA_HEX[a], class: 'hv-pulse', opacity: 0.45 }, g);
      el('circle', { r: 22, class: 'halo', stroke: AREA_HEX[a] }, g);
      el('circle', { r: 15, class: 'core', fill: '#05070b', stroke: AREA_HEX[a], 'stroke-width': 3 }, g);
      const txt = el('text', { y: h.ly, 'text-anchor': 'middle', style: `fill:${AREA_HEX[a]}` }, g);
      txt.textContent = areaLabel(a);
      const area = areaById[a] || {};
      const on = () => {
        clearOn();
        g.classList.add('is-on');
        show(
          `${chip(a, t('Area · {n} pagine', { n: list.length }))}<h3>${esc(areaLabel(a))}: ${esc(areaSub(a))}</h3><p>${esc(
            loc(area.desc)
          )}</p><div class="hv-atlas__meta">${list
            .map((p) => `<a class="hv-chip" href="${esc(pageUrl(p.file))}">${esc(loc(p.title))}</a>`)
            .join('')}</div>`
        );
      };
      g.addEventListener('pointerenter', on);
      g.addEventListener('focus', on);
      g.addEventListener('click', on);
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          on();
        }
      });
    }

    const g = el(
      'g',
      { class: 'hv-node hv-node--hub hv-node--center', tabindex: 0, role: 'button', 'aria-label': t('EVIL, il centro della mappa'), transform: `translate(${C.x},${C.y})` },
      gN
    );
    el('circle', { r: 26, fill: '#00ff9c', class: 'hv-pulse', opacity: 0.35 }, g);
    el('circle', { r: 30, class: 'halo', stroke: '#00ff9c' }, g);
    el('circle', { r: 24, class: 'core', fill: '#05070b', stroke: '#00ff9c', 'stroke-width': 2.5 }, g);
    const tx = el('text', { y: 5, 'text-anchor': 'middle', style: 'fill:#fff;font-size:14px' }, g);
    tx.textContent = 'EVIL';
    let clicks = 0;
    const center = () => {
      clicks++;
      clearOn();
      g.classList.add('is-on');
      if (clicks >= 3) {
        clicks = 0;
        egg('core', t('Tre clic sul cuore della mappa: le linee si accendono.'));
        if (!reduce) {
          $$('.hv-edge', svg).forEach((edge, i) => {
            if (edge.animate) {
              edge.animate([{ stroke: '#00ff9c', strokeWidth: 3 }, { stroke: getComputedStyle(edge).stroke, strokeWidth: 1 }], {
                duration: 1400,
                delay: i * 30,
              });
            }
          });
        }
      } else {
        show(
          `<span class="hv-chip hv-chip--g">${esc(t('Il centro'))}</span><h3>EVIL</h3><p>${esc(
            t('Impara · Analizza · Verifica. Tutto parte da qui.')
          )}</p><p class="hv-atlas__hint">${esc(clicks === 1 ? t('Ancora…') : t('Ci sei quasi.'))}</p>`
        );
      }
    };
    g.addEventListener('click', center);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        center();
      }
    });
  })();

  /* ------------------------------------------------------------ prova subito: schede */
  (function playTabs() {
    const tabs = $$('.hv-play__tabs [role="tab"]');
    const select = (b) => {
      tabs.forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(x.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    };
    tabs.forEach((b, i) => {
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', (e) => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = tabs[(i + d + tabs.length) % tabs.length];
        select(n);
        n.focus();
      });
    });
  })();

  /* ------------------------------------------------------------ cifrario di Cesare */
  (function caesar() {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const inp = $('#hv-c-in');
    const k = $('#hv-c-k');
    const out = $('#hv-c-out');
    const wheel = $('#hv-c-wheel');
    const res = $('#hv-c-res');
    if (!inp || !k || !out) return;
    if (!inp.value) inp.value = t("ATTACCO ALL'ALBA");
    const enc = (s, n) =>
      s
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[A-Z]/g, (c) => A[(A.indexOf(c) + n) % 26]);
    const upd = () => {
      const n = Number(k.value);
      $('#hv-c-kv').textContent = n;
      out.textContent = enc(inp.value, n);
      if (wheel) wheel.innerHTML = Array.from(A).map((c) => `<span>${c}<b>${enc(c, n)}</b></span>`).join('');
      const dec = enc('HYLO', (26 - n) % 26);
      if (res) {
        res.textContent = dec;
        res.classList.toggle('is-ok', dec === 'EVIL');
      }
      if (dec === 'EVIL') egg('caesar', t('HYLO con chiave 3 diventa EVIL. Giulio Cesare sarebbe fiero.'));
    };
    inp.addEventListener('input', upd);
    k.addEventListener('input', upd);
    upd();
  })();

  /* ------------------------------------------------------------ phishing */
  $$('[data-v]').forEach((b) =>
    b.addEventListener('click', () => {
      const ex = $('#hv-ph-exp');
      if (!ex) return;
      const right = b.dataset.v === 'ph';
      ex.classList.toggle('is-good', right);
      ex.classList.toggle('is-bad', !right);
      $('#hv-ph-verdict').textContent = right ? t('Esatto, è phishing.') : t('Attenzione: è phishing.');
      ex.hidden = false;
    })
  );

  /* ------------------------------------------------------------ password */
  (function password() {
    const inp = $('#hv-pw');
    if (!inp) return;
    if (!inp.value) inp.value = t('Estate2024!');
    const UNITS = [
      [3.15e9, t('{n} secolo'), t('{n} secoli')],
      [3.15e7, t('{n} anno'), t('{n} anni')],
      [86400, t('{n} giorno'), t('{n} giorni')],
      [3600, t('{n} ora'), t('{n} ore')],
      [60, t('{n} minuto'), t('{n} minuti')],
      [1, t('{n} secondo'), t('{n} secondi')],
    ];
    const human = (s) => {
      if (s < 1) return t('istantaneo');
      for (const [v, one, many] of UNITS) {
        if (s < v) continue;
        const q = s / v;
        if (q > 1e6) {
          const [mant, exp] = q.toExponential(1).split('e+');
          return many.replace('{n}', `${Number(mant).toLocaleString(I.locale)} × 10^${exp}`);
        }
        const r = Math.round(q);
        return (r === 1 ? one : many).replace('{n}', fmt(r));
      }
      return t('istantaneo');
    };
    const CHECKS = [
      [/[a-z]/, 26, t('Lettere minuscole')],
      [/[A-Z]/, 26, t('Lettere maiuscole')],
      [/\d/, 10, t('Numeri')],
      [/[^a-zA-Z0-9]/, 33, t('Simboli')],
    ];
    const COMMON =
      /(password|qwerty|123456|admin|letmein|estate|inverno|primavera|autunno|summer|winter|spring|autumn|ciao|hello|juventus|milan|inter|roma|napoli|amore|love)/i;
    const upd = () => {
      const v = inp.value;
      let pool = 0;
      CHECKS.forEach(([r, n]) => {
        if (r.test(v)) pool += n;
      });
      let ent = v.length * Math.log2(pool || 1);
      const common = COMMON.test(v) || /(19|20)\d\d/.test(v);
      if (common) ent = Math.min(ent, 28);
      const secs = Math.pow(2, ent) / 1e10;
      $('#hv-pw-ent').textContent = t('{n} bit', { n: Math.round(ent) });
      $('#hv-pw-comb').textContent = ent > 60 ? '2^' + Math.round(ent) : fmt(Math.round(Math.pow(2, ent)));
      $('#hv-pw-time').textContent = human(secs);
      $('#hv-pw-bar').style.width = Math.min(100, ent / 1.1) + '%';
      const tips = [[v.length >= 14, t('Almeno 14 caratteri')]]
        .concat(CHECKS.map(([r, , n]) => [r.test(v), n]))
        .concat([[!common, t('Niente parole comuni, nomi, squadre o anni')]]);
      $('#hv-pw-tips').innerHTML = tips.map(([ok, txt]) => `<li class="${ok ? 'is-ok' : ''}">${esc(txt)}</li>`).join('');
    };
    inp.addEventListener('input', upd);
    upd();
  })();

  /* ------------------------------------------------------------ easter egg: Konami e "evil" */
  function matrix(ms = 7000) {
    const c = $('#hv-rain');
    if (!c || !c.getContext || reduce) return;
    const x = c.getContext('2d');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.classList.add('is-on');
    const fs = 16;
    const cols = Math.ceil(c.width / fs);
    const y = Array.from({ length: cols }, () => Math.random() * -50);
    const ch = 'アイウエオカキクケコサシスセソ0123456789EVIL<>/{}';
    const t0 = performance.now();
    const draw = (now) => {
      x.fillStyle = 'rgba(0,0,0,.08)';
      x.fillRect(0, 0, c.width, c.height);
      x.font = fs + 'px monospace';
      y.forEach((v, i) => {
        x.fillStyle = Math.random() < 0.03 ? '#fff' : '#00ff9c';
        x.fillText(ch[(Math.random() * ch.length) | 0], i * fs, v * fs);
        y[i] = v * fs > c.height && Math.random() > 0.97 ? 0 : v + 1;
      });
      if (now - t0 < ms) requestAnimationFrame(draw);
      else {
        c.classList.remove('is-on');
        setTimeout(() => x.clearRect(0, 0, c.width, c.height), 700);
      }
    };
    requestAnimationFrame(draw);
  }

  const shellEl = $('#hv-shell');
  const KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let kpos = 0;
  let typed = '';
  document.addEventListener('keydown', (e) => {
    if (shellEl && shellEl.classList.contains('is-open')) return;
    const key = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = key === KON[kpos] ? kpos + 1 : key === KON[0] ? 1 : 0;
    if (kpos === KON.length) {
      kpos = 0;
      document.body.classList.toggle('hv-root');
      matrix();
      egg(
        'konami',
        document.body.classList.contains('hv-root')
          ? t('Accesso root concesso: tema "terminale" attivo. Ripeti il codice per tornare indietro.')
          : t('Tema normale ripristinato.')
      );
    }
    const tag = document.activeElement && document.activeElement.tagName;
    if (/^[a-z]$/.test(key) && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag || '')) {
      typed = (typed + key).slice(-4);
      if (typed === 'evil') {
        const h = $('#hv-title');
        if (h) h.classList.add('is-hot');
        document.body.classList.add('hv-flip');
        setTimeout(() => {
          if (h) h.classList.remove('is-hot');
          document.body.classList.remove('hv-flip');
        }, 1300);
        egg('evil', t('Hai digitato E-V-I-L: il logo ha avuto un piccolo cortocircuito.'));
      }
    }
  });

  /* ------------------------------------------------------------ easter egg: terminale finto (5 clic su EVIL) */
  (function shell() {
    const title = $('#hv-title');
    const out = $('#hv-shell-out');
    const inp = $('#hv-shell-in');
    if (!shellEl || !title || !out || !inp) return;
    let n = 0;
    let timer;
    let last;
    const print = (s) => {
      out.textContent += s + '\n';
      out.scrollTop = out.scrollHeight;
    };
    const secretFile = t('segreto.txt');
    const hiddenFile = t('.non-guardare');
    const CMD = {
      help: () => t('comandi: help, whoami, ls, cat <file>, uname, sudo, hack, eggs, matrix, clear, exit'),
      whoami: () => t('ospite (ma con lo spirito giusto)'),
      ls: () => `${t('didattica/  intelligence/  strumenti/')}  ${secretFile}  ${hiddenFile}`,
      cat: (arg) => {
        if (arg === secretFile || arg === 'segreto.txt') {
          return t('La sicurezza non è un prodotto, è un processo.\nP.S. prova a scrivere "evil" sulla pagina.');
        }
        if (arg === hiddenFile || arg === '.non-guardare') return t('Ti avevo detto di non guardare. Comunque: ↑↑↓↓←→←→BA');
        return t('cat: {file}: file non trovato', { file: arg || '' });
      },
      uname: () => t('EVIL 2026 · kernel didattico · nessuna vera shell è stata maltrattata'),
      sudo: () => t('ospite non è nel file sudoers. Questo episodio verrà segnalato. (scherzo)'),
      hack: () =>
        t('Bel tentativo. Qui si impara come funzionano gli attacchi, non si buca niente.') +
        '\n→ ' +
        window.location.origin +
        pageUrl('web-simulator.html'),
      eggs: () =>
        t('trovati {n}/{tot}: {elenco}', {
          n: found.size,
          tot: EGG_TOTAL,
          elenco: [...found].map((k) => EGGS[k]).join(', ') || t('nessuno, per ora'),
        }),
      matrix: () => {
        matrix(4000);
        return t('segui il coniglio bianco…');
      },
      clear: () => {
        out.textContent = '';
        return null;
      },
      exit: () => {
        close();
        return null;
      },
    };
    function open() {
      last = document.activeElement;
      shellEl.classList.add('is-open');
      out.textContent = '';
      print(t('EVIL shell 0.1 — terminale finto per curiosi.\nscrivi "help".') + '\n');
      inp.value = '';
      setTimeout(() => inp.focus(), 30);
      egg('shell', t('Cinque clic sulla scritta EVIL aprono un terminale (finto).'));
    }
    function close() {
      shellEl.classList.remove('is-open');
      if (last && last.focus) last.focus();
    }
    const hit = () => {
      n++;
      clearTimeout(timer);
      timer = setTimeout(() => {
        n = 0;
      }, 1200);
      if (!reduce && title.animate) {
        title.animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)' }, { transform: 'scale(1)' }], { duration: 180 });
      }
      if (n >= 5) {
        n = 0;
        open();
      }
    };
    title.addEventListener('click', hit);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Enter') return;
      const raw = inp.value.trim();
      inp.value = '';
      print('root@evil:~# ' + raw);
      if (!raw) return;
      const [cmd, ...rest] = raw.toLowerCase().split(/\s+/);
      const fn = CMD[cmd];
      const r = fn ? fn(rest.join(' ')) : t('{cmd}: comando non trovato (prova "help")', { cmd });
      if (r) print(r + '\n');
    });
    shellEl.addEventListener('click', (e) => {
      if (e.target === shellEl) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && shellEl.classList.contains('is-open')) close();
    });
  })();

  /* ------------------------------------------------------------ easter egg: cursore nella chiusura */
  function burst(x, y) {
    if (reduce) return;
    const colors = ['#00ff9c', '#f59e0b', '#7dd3fc'];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.className = 'hv-boom';
      s.textContent = Math.random() < 0.5 ? '0' : '1';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', (Math.random() - 0.5) * 320 + 'px');
      s.style.setProperty('--dy', -Math.random() * 260 - 40 + 'px');
      s.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
      s.style.color = colors[i % 3];
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }
  const pixel = $('#hv-pixel');
  if (pixel) {
    pixel.addEventListener('click', () => {
      const r = pixel.getBoundingClientRect();
      burst(r.left, r.top);
      egg('pixel', t('Il cursore che lampeggia in fondo non era solo decorazione.'));
    });
  }

  const hint = $('#hv-hint');
  if (hint) {
    hint.addEventListener('click', () =>
      toast(
        t('Indizi'),
        t(
          'Segreti trovati: {n}/{tot}. Prova la tastiera, la scritta EVIL in alto, il centro della mappa, un cifrario, la console del browser… e guarda in fondo alla pagina.',
          { n: found.size, tot: EGG_TOTAL }
        ),
        8000
      )
    );
  }
})();
