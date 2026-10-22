/**
 * EVIL · Primi passi: giochi, progressi, badge e patentino (docs/evil-per-tutti/PRIMI-PASSI.md).
 *
 * Le pagine sono generate da scripts/build-primi-passi.js e funzionano anche senza JavaScript
 * (le risposte stanno nei <details>). Qui i giochi diventano giochi veri. I testi che questo file
 * scrive in pagina stanno nell'HTML (elenco nascosto [data-pp-str]), già nella lingua della pagina.
 *
 * I progressi restano nel browser (localStorage, chiave evil-pp-v1): nessun dato va al server,
 * il nome del patentino non viene salvato. Nessun limite di tempo, nessun errore "rosso" (STILE.md).
 */
(function () {
  'use strict';

  const page = document.body && document.body.getAttribute('data-pp-page');
  if (!page) return;

  const KEY = 'evil-pp-v1';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const I18N = window.EVIL_I18N || null;

  // ------------------------------------------------------------ testi della pagina
  function S(key, vars) {
    const el = document.querySelector(`[data-pp-str="${key}"]`);
    const s = el ? el.textContent.trim() : '';
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
  }

  function fmtDate(ts) {
    try {
      if (I18N && I18N.fmtDate) return I18N.fmtDate(ts, { dateStyle: 'long' });
      return new Date(ts).toLocaleDateString();
    } catch (_) {
      return '';
    }
  }

  // ------------------------------------------------------------ progressi sul dispositivo
  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (d && d.v === 1) return { v: 1, done: d.done && typeof d.done === 'object' ? d.done : {}, now: d.now && typeof d.now === 'object' ? d.now : {} };
    } catch (_) {
      /* dati illeggibili o archiviazione bloccata: si riparte da zero */
    }
    return { v: 1, done: {}, now: {} };
  }

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {
      /* navigazione privata: i progressi valgono solo per questa visita */
    }
  }

  let state = load();

  // ------------------------------------------------------------ piccoli effetti
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function restart(node, cls) {
    if (!node || reducedMotion) return;
    node.classList.remove(cls);
    void node.offsetWidth; // riavvia l'animazione
    node.classList.add(cls);
  }

  /** Lù festeggia: luce verde e un saltello (STILE.md, "Successo"). */
  function cheer() {
    const lu = document.querySelector('.pp-hero [data-lu]');
    if (!lu) return;
    lu.classList.add('lu--happy');
    restart(lu, 'is-hop');
    window.clearTimeout(cheer.timer);
    cheer.timer = window.setTimeout(() => lu.classList.remove('lu--happy'), 1600);
  }

  /** Qualche lucciola che sale da un elemento (solo se il movimento è consentito). */
  function sparkle(from, n) {
    if (!from || reducedMotion) return;
    const box = el('span', 'pp-sparks');
    box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < (n || 9); i++) {
      const s = el('span', 'pp-spark');
      s.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 140)}px`);
      s.style.setProperty('--dy', `${Math.round(-50 - Math.random() * 90)}px`);
      s.style.setProperty('--d', `${Math.round(Math.random() * 180)}ms`);
      box.appendChild(s);
    }
    from.appendChild(box);
    window.setTimeout(() => box.remove(), 1400);
  }

  function nudge(node) {
    restart(node, 'is-nudge');
  }

  // ------------------------------------------------------------ percorso (puntini in alto)
  function markTrail() {
    document.querySelectorAll('[data-pp-dot]').forEach((a) => {
      const done = Boolean(state.done[a.getAttribute('data-pp-dot')]);
      a.classList.toggle('is-done', done);
      const sr = a.querySelector('.pt-sr');
      if (!sr) return;
      if (!sr.hasAttribute('data-label')) sr.setAttribute('data-label', sr.textContent);
      const label = sr.getAttribute('data-label');
      sr.textContent = done ? S('doneDot', { label }) : label;
    });
  }

  // ------------------------------------------------------------ pagina di una tappa
  function initStage() {
    const slug = document.body.getAttribute('data-pp-stage');
    markTrail();
    initSide(slug);
    initStory();
    initDoNow(slug);
    initClassMode();
    if (state.done[slug]) showBadge(false);
    const root = document.querySelector('[data-pp-game]');
    if (!root) return;
    const kind = root.getAttribute('data-pp-game');
    const games = { classify: initClassify, order: initOrder, select: initSelect, spot: initSpot };
    if (games[kind]) games[kind](root, slug);
  }

  /**
   * Modalità classe (passo 3.2): alla LIM una parte della tappa alla volta, testo grande, il docente
   * avanza con i pulsanti o con il telecomando delle presentazioni (Pagina giù/su).
   * Si apre dal pulsante o con ?classe=1 nell'indirizzo (i kit di EVIL Scuola lo usano); Esc la chiude.
   */
  function initClassMode() {
    const on = document.querySelector('[data-pp-class-on]');
    const bar = document.querySelector('[data-pp-classbar]');
    if (!on || !bar) return;
    const steps = ['story', 'explain', 'do-now', 'game', 'next']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const label = bar.querySelector('[data-pp-class-step]');
    let i = 0;
    let active = false;

    function title(sec) {
      const h = sec.querySelector('h2');
      return h ? h.textContent.replace(/^\s*\d+\s*/, '').trim() : '';
    }

    function go(n) {
      i = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach((sec, k) => sec.classList.toggle('is-class-current', k === i));
      label.textContent = S('classStep', { n: i + 1, total: steps.length, title: title(steps[i]) });
      bar.querySelector('[data-pp-class-prev]').disabled = i === 0;
      bar.querySelector('[data-pp-class-next]').disabled = i === steps.length - 1;
      window.scrollTo(0, 0);
      if (steps[i].id === 'story') document.dispatchEvent(new CustomEvent('pp:story'));
    }

    function setActive(v) {
      active = v;
      document.body.classList.toggle('pp-class', v);
      document.documentElement.classList.toggle('pp-class-root', v);
      bar.hidden = !v;
      if (v) go(i);
      else {
        steps.forEach((sec) => sec.classList.remove('is-class-current'));
        on.focus();
      }
    }

    on.hidden = false;
    on.addEventListener('click', () => setActive(true));
    bar.querySelector('[data-pp-class-prev]').addEventListener('click', () => go(i - 1));
    bar.querySelector('[data-pp-class-next]').addEventListener('click', () => go(i + 1));
    bar.querySelector('[data-pp-class-off]').addEventListener('click', () => setActive(false));
    document.addEventListener('keydown', (e) => {
      if (!active || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      if (e.key === 'Escape') setActive(false);
      else if (e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
    });
    if (new URLSearchParams(window.location.search).get('classe') === '1') setActive(true);
  }

  /**
   * Schermi larghi: un riquadro a destra segue la lettura e spunta le quattro parti della tappa
   * (storia, spiegazione, fai subito, gioco). Compare dopo l'apertura e sparisce prima della fine.
   */
  function initSide(slug) {
    const side = document.querySelector('[data-pp-side]');
    if (!side) return;
    function mark(key, on) {
      const li = side.querySelector(`[data-pp-step="${key}"]`);
      if (li) li.classList.toggle('is-done', on !== false);
    }
    if (state.now[slug]) mark('do');
    if (state.done[slug]) {
      mark('game');
      side.classList.add('is-won');
    }
    document.addEventListener('pp:story', () => mark('story'));
    document.addEventListener('pp:do', (e) => mark('do', Boolean(e.detail && e.detail.on)));
    document.addEventListener('pp:solved', () => {
      mark('game');
      side.classList.add('is-won');
    });
    if (!('IntersectionObserver' in window)) return;
    const explain = document.getElementById('explain');
    if (explain) {
      const seen = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          mark('explain');
          seen.disconnect();
        }
      }, { threshold: 0.25 });
      seen.observe(explain);
    }
    const hero = document.querySelector('.pp-hero');
    const next = document.getElementById('next');
    let heroGone = false;
    let atEnd = false;
    const update = () => side.classList.toggle('is-shown', heroGone && !atEnd);
    if (hero) {
      new IntersectionObserver(([e]) => {
        heroGone = !e.isIntersecting;
        update();
      }).observe(hero);
    }
    if (next) {
      new IntersectionObserver(([e]) => {
        atEnd = e.isIntersecting || e.boundingClientRect.top < 0;
        update();
      }).observe(next);
    }
  }

  /**
   * La scena in tre quadri (passo 2.13): parte quando entra nello schermo, mostra i quadri una
   * volta sola e si ferma sull'ultimo; pausa e frecce sempre disponibili. Con il movimento ridotto
   * resta la striscia a fumetti, senza animazioni.
   */
  function initScene() {
    const fig = document.querySelector('[data-pp-anim]');
    if (!fig || reducedMotion) return;
    const list = fig.querySelector('[data-pp-anim-frames]');
    const frames = Array.from(fig.querySelectorAll('.pp-anim__frame'));
    const bar = fig.querySelector('[data-pp-anim-bar]');
    const play = fig.querySelector('[data-pp-anim-play]');
    const dots = Array.from(fig.querySelectorAll('.pp-anim__dots i'));
    if (frames.length < 2 || !list || !bar || !play) return;
    const STEP = 3800;
    let i = 0;
    let timer = 0;
    let playing = false;

    function show(n) {
      i = (n + frames.length) % frames.length;
      frames.forEach((f, k) => {
        f.classList.toggle('is-active', k === i);
        f.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });
      dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
    }

    function setPlaying(on) {
      playing = on;
      window.clearTimeout(timer);
      fig.classList.toggle('is-playing', on);
      play.setAttribute('aria-label', on ? S('scenePause') : S('scenePlay'));
      if (on) timer = window.setTimeout(tick, STEP);
    }

    function tick() {
      if (i >= frames.length - 1) {
        setPlaying(false);
        return;
      }
      show(i + 1);
      timer = window.setTimeout(tick, STEP);
    }

    // i movimenti dentro i quadri partono solo da qui (css: .pp-anim.is-run)
    const run = () => fig.classList.add('is-run');

    // chi usa le frecce sente la didascalia nuova; durante la riproduzione automatica no
    function manual(n) {
      run();
      setPlaying(false);
      list.setAttribute('aria-live', 'polite');
      show(n);
    }

    fig.classList.add('is-show');
    bar.hidden = false;
    list.setAttribute('aria-live', 'off');
    show(0);
    setPlaying(false);
    play.addEventListener('click', () => {
      run();
      if (playing) {
        setPlaying(false);
        return;
      }
      if (i >= frames.length - 1) show(0);
      setPlaying(true);
    });
    fig.querySelector('[data-pp-anim-prev]').addEventListener('click', () => manual(i - 1));
    fig.querySelector('[data-pp-anim-next]').addEventListener('click', () => manual(i + 1));

    // parte quando metà della scena è sullo schermo, così il primo quadro non si perde
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        run();
        setPlaying(true);
      }, { threshold: 0.5 });
      io.observe(fig);
    } else {
      run();
    }
  }

  function initStory() {
    initScene();
    document.querySelectorAll('[data-pp-choices] details').forEach((d) => {
      d.addEventListener('toggle', () => {
        if (!d.open || !d.hasAttribute('data-good')) return;
        cheer();
        document.dispatchEvent(new CustomEvent('pp:story'));
      });
    });
  }

  function initDoNow(slug) {
    const btn = document.querySelector('[data-pp-done]');
    const msg = document.querySelector('[data-pp-done-msg]');
    if (!btn) return;
    function show(on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('is-on', on);
      if (msg) msg.hidden = !on;
    }
    show(Boolean(state.now[slug]));
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      if (on) state.now[slug] = true;
      else delete state.now[slug];
      save();
      show(on);
      document.dispatchEvent(new CustomEvent('pp:do', { detail: { on } }));
      if (on) {
        restart(btn, 'is-pop');
        cheer();
      }
    });
  }

  function showBadge(isNew) {
    const badge = document.querySelector('[data-pp-badge]');
    if (!badge) return;
    badge.classList.add('is-won');
    if (isNew) {
      restart(badge, 'is-new');
      sparkle(badge.querySelector('.pp-medal'), 12);
    }
  }

  /** Comandi comuni a tutti i giochi: messaggi, vittoria, "Gioca di nuovo". */
  function shell(root, slug, reset) {
    const status = root.querySelector('[data-pp-status]');
    const replay = root.querySelector('[data-pp-replay]');
    function say(text, tone) {
      if (!status) return;
      status.textContent = text || '';
      status.className = `pp-game__status${tone ? ` is-${tone}` : ''}`;
    }
    function win(score) {
      root.classList.add('is-solved');
      const first = !state.done[slug];
      if (first) {
        state.done[slug] = { at: Date.now() };
        save();
      }
      const badgeName = document.querySelector('[data-pp-badge] .pp-badge__name');
      const parts = [S('solved'), score || '', first && badgeName ? S('badgeEarned', { badge: badgeName.textContent.trim() }) : ''];
      say(parts.filter(Boolean).join(' '), 'good');
      showBadge(first);
      markTrail();
      cheer();
      document.dispatchEvent(new CustomEvent('pp:solved'));
      const next = document.querySelector('[data-pp-next]');
      if (next) next.classList.add('is-ready');
      if (replay) replay.hidden = false;
    }
    if (replay) {
      replay.addEventListener('click', () => {
        root.classList.remove('is-solved', 'is-busted');
        replay.hidden = true;
        say('');
        reset();
      });
    }
    return { say, win };
  }

  // ---------------------------------------------------- gioco: classifica (due categorie)
  function initClassify(root, slug) {
    const cats = Array.from(root.querySelectorAll('[data-pp-cats] [data-cat]')).map((li) => ({
      id: li.getAttribute('data-cat'),
      label: li.textContent.trim(),
    }));
    const items = Array.from(root.querySelectorAll('.pp-item'));
    let firstTry = 0;
    let right = 0;
    const g = shell(root, slug, reset);
    root.classList.add('is-live');

    items.forEach((item) => {
      const text = item.querySelector('.pp-item__text');
      const answer = item.querySelector('.pp-item__answer');
      const why = item.querySelector('.pp-item__why');
      if (answer && why) answer.replaceWith(why); // la spiegazione arriva dopo la risposta giusta
      if (why) why.hidden = true;
      const bar = el('div', 'pp-item__picks');
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', text ? text.textContent.trim() : '');
      cats.forEach((c) => {
        const b = el('button', `pp-pick pp-pick--${c.id}`, c.label);
        b.type = 'button';
        b.setAttribute('data-cat', c.id);
        b.addEventListener('click', () => pick(item, b));
        bar.appendChild(b);
      });
      const fb = el('p', 'pp-item__fb');
      fb.setAttribute('aria-live', 'polite');
      (text || item.firstChild).after(bar, fb);
    });

    function pick(item, btn) {
      if (item.classList.contains('is-right') || btn.getAttribute('aria-disabled') === 'true') return;
      const fb = item.querySelector('.pp-item__fb');
      if (item.getAttribute('data-cat') === btn.getAttribute('data-cat')) {
        if (!item.classList.contains('was-wrong')) firstTry++;
        right++;
        item.classList.add('is-right');
        btn.classList.add('is-right');
        item.querySelectorAll('.pp-pick').forEach((b) => b.setAttribute('aria-disabled', 'true'));
        const why = item.querySelector('.pp-item__why');
        if (why) why.hidden = false;
        fb.textContent = S('right');
        fb.className = 'pp-item__fb is-good';
        if (right === items.length) g.win(S('firstTry', { ok: firstTry, n: items.length }));
      } else {
        item.classList.add('was-wrong');
        btn.classList.add('is-wrong');
        btn.setAttribute('aria-disabled', 'true');
        nudge(btn);
        fb.textContent = S('almost');
        fb.className = 'pp-item__fb is-warn';
      }
    }

    function reset() {
      firstTry = 0;
      right = 0;
      items.forEach((item) => {
        item.classList.remove('is-right', 'was-wrong');
        item.querySelectorAll('.pp-pick').forEach((b) => {
          b.classList.remove('is-right', 'is-wrong');
          b.removeAttribute('aria-disabled');
        });
        const why = item.querySelector('.pp-item__why');
        if (why) why.hidden = true;
        const fb = item.querySelector('.pp-item__fb');
        fb.textContent = '';
        fb.className = 'pp-item__fb';
      });
      const first = items[0] && items[0].querySelector('.pp-pick');
      if (first) first.focus();
    }
  }

  // ---------------------------------------------------- gioco: metti in ordine
  function initOrder(root, slug) {
    const list = root.querySelector('[data-pp-order]');
    const check = root.querySelector('[data-pp-check]');
    const solution = root.querySelector('[data-pp-solution]');
    const status = root.querySelector('[data-pp-status]');
    if (!list || !check) return;
    const initial = Array.from(list.children);
    let attempts = 0;
    const g = shell(root, slug, reset);
    root.classList.add('is-live');
    if (solution) solution.hidden = true;

    initial.forEach((li) => {
      const text = li.querySelector('.pp-order__text');
      const name = text ? text.textContent.trim() : '';
      const ctl = el('span', 'pp-order__ctl');
      [['up', '↑', S('moveUp')], ['down', '↓', S('moveDown')]].forEach(([dir, glyph, label]) => {
        const b = el('button', `pp-move pp-move--${dir}`, glyph);
        b.type = 'button';
        b.setAttribute('aria-label', `${label}: ${name}`);
        b.addEventListener('click', () => move(li, dir === 'up' ? -1 : 1, b));
        ctl.appendChild(b);
      });
      li.appendChild(ctl);
      li.appendChild(el('span', 'pp-order__mark'));
    });
    refreshEdges();

    function refreshEdges() {
      const items = Array.from(list.children);
      items.forEach((li, i) => {
        li.querySelector('.pp-move--up').setAttribute('aria-disabled', i === 0 ? 'true' : 'false');
        li.querySelector('.pp-move--down').setAttribute('aria-disabled', i === items.length - 1 ? 'true' : 'false');
      });
    }

    /** Sposta un elemento di una posizione, con un movimento breve che mostra lo scambio. */
    function move(li, delta, btn) {
      if (root.classList.contains('is-solved') || btn.getAttribute('aria-disabled') === 'true') return;
      const items = Array.from(list.children);
      const i = items.indexOf(li);
      const j = i + delta;
      if (j < 0 || j >= items.length) return;
      const other = items[j];
      const before = new Map([li, other].map((n) => [n, n.getBoundingClientRect().top]));
      if (delta < 0) list.insertBefore(li, other);
      else list.insertBefore(other, li);
      clearMarks();
      if (!reducedMotion) {
        [li, other].forEach((n) => {
          const dy = before.get(n) - n.getBoundingClientRect().top;
          if (!dy) return;
          n.style.transition = 'none';
          n.style.transform = `translateY(${dy}px)`;
          void n.offsetWidth;
          n.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)';
          n.style.transform = '';
        });
      }
      refreshEdges();
      // il fuoco resta sul pulsante appena usato; se l'elemento è arrivato in fondo, passa all'altro
      const again = li.querySelector(delta < 0 ? '.pp-move--up' : '.pp-move--down');
      const focusBtn = again.getAttribute('aria-disabled') === 'true' ? li.querySelector(delta < 0 ? '.pp-move--down' : '.pp-move--up') : again;
      focusBtn.focus();
      const name = li.querySelector('.pp-order__text').textContent.trim();
      if (status) {
        status.textContent = S('moved', { item: name, n: j + 1, total: items.length });
        status.className = 'pp-game__status';
      }
    }

    function clearMarks() {
      Array.from(list.children).forEach((li) => li.classList.remove('is-ok', 'is-off'));
    }

    check.addEventListener('click', () => {
      if (root.classList.contains('is-solved')) return;
      attempts++;
      const items = Array.from(list.children);
      let ok = 0;
      items.forEach((li, i) => {
        const good = Number(li.getAttribute('data-pos')) === i;
        li.classList.toggle('is-ok', good);
        li.classList.toggle('is-off', !good);
        if (good) ok++;
      });
      if (ok === items.length) {
        check.hidden = true;
        if (solution) {
          solution.hidden = false;
          solution.open = true;
          solution.classList.add('is-explained');
        }
        g.win(S('attempts', { n: attempts }));
      } else {
        g.say(S('orderScore', { ok, n: items.length }), 'warn');
        nudge(check);
      }
    });

    function reset() {
      attempts = 0;
      initial.forEach((li) => list.appendChild(li));
      clearMarks();
      refreshEdges();
      check.hidden = false;
      if (solution) {
        solution.open = false;
        solution.hidden = true;
        solution.classList.remove('is-explained');
      }
      const first = list.querySelector('.pp-move--down');
      if (first) first.focus();
    }
  }

  // ---------------------------------------------------- gioco: scegli le trappole
  function initSelect(root, slug) {
    const opts = Array.from(root.querySelectorAll('.pp-option'));
    const check = root.querySelector('[data-pp-check]');
    const hint = root.querySelector('[data-pp-hint]');
    if (!check) return;
    let attempts = 0;
    const g = shell(root, slug, reset);
    root.classList.add('is-live');

    opts.forEach((o) => {
      const text = o.querySelector('.pp-option__text');
      const answer = o.querySelector('.pp-option__answer');
      const why = o.querySelector('.pp-option__why');
      if (answer && why) answer.replaceWith(why);
      if (why) why.hidden = true;
      const b = el('button', 'pp-option__btn', text ? text.textContent.trim() : '');
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (root.classList.contains('is-solved')) return;
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        o.classList.toggle('is-picked', on);
        o.classList.remove('is-hinted');
      });
      if (text) text.replaceWith(b);
      else o.prepend(b);
    });

    check.addEventListener('click', () => {
      if (root.classList.contains('is-solved')) return;
      attempts++;
      const traps = opts.filter((o) => o.hasAttribute('data-trap'));
      const picked = opts.filter((o) => o.classList.contains('is-picked'));
      const found = picked.filter((o) => o.hasAttribute('data-trap')).length;
      const wrong = picked.length - found;
      if (found === traps.length && wrong === 0) {
        solve();
        return;
      }
      g.say(`${S('selectScore', { found, total: traps.length })}${wrong ? ` ${S('selectExtra')}` : ''}`, 'warn');
      nudge(check);
      if (hint && attempts >= 2) hint.hidden = false;
    });

    if (hint) {
      hint.addEventListener('click', () => {
        // un aiuto alla volta: la prima trappola non scelta, oppure la prima scelta innocua
        const target =
          opts.find((o) => o.hasAttribute('data-trap') && !o.classList.contains('is-picked')) ||
          opts.find((o) => !o.hasAttribute('data-trap') && o.classList.contains('is-picked'));
        if (!target) return;
        const why = target.querySelector('.pp-option__why');
        if (why) why.hidden = false;
        target.classList.add('is-hinted');
        restart(target, 'is-pulse');
        const b = target.querySelector('.pp-option__btn');
        if (b) b.focus();
      });
    }

    function solve() {
      opts.forEach((o) => {
        o.classList.remove('is-hinted');
        o.classList.add(o.hasAttribute('data-trap') ? 'is-trap' : 'is-safe');
        const why = o.querySelector('.pp-option__why');
        if (why) why.hidden = false;
        const b = o.querySelector('.pp-option__btn');
        if (b) b.setAttribute('aria-disabled', 'true');
      });
      check.hidden = true;
      if (hint) hint.hidden = true;
      g.win(S('attempts', { n: attempts }));
    }

    function reset() {
      attempts = 0;
      opts.forEach((o) => {
        o.classList.remove('is-picked', 'is-hinted', 'is-trap', 'is-safe');
        const why = o.querySelector('.pp-option__why');
        if (why) why.hidden = true;
        const b = o.querySelector('.pp-option__btn');
        if (b) {
          b.setAttribute('aria-pressed', 'false');
          b.removeAttribute('aria-disabled');
        }
      });
      check.hidden = false;
      if (hint) hint.hidden = true;
      const first = opts[0] && opts[0].querySelector('.pp-option__btn');
      if (first) first.focus();
    }
  }

  // ---------------------------------------------------- gioco: trova le trappole nel messaggio
  function initSpot(root, slug) {
    const body = root.querySelector('[data-pp-spot]');
    const solution = root.querySelector('[data-pp-solution]');
    const stamp = root.querySelector('[data-pp-stamp]');
    const hint = root.querySelector('[data-pp-hint]');
    if (!body) return;
    const segs = Array.from(body.querySelectorAll('.pp-seg'));
    const whys = Array.from(root.querySelectorAll('.pp-spot__whys li'));
    const total = segs.filter((s) => s.hasAttribute('data-trap')).length;
    let found = 0;
    let misses = 0;
    const g = shell(root, slug, reset);
    root.classList.add('is-live');
    if (solution) solution.hidden = true;

    const notes = el('ol', 'pp-spot__notes');
    (root.querySelector('.pp-sms') || body).after(notes);

    segs.forEach((s) => {
      s.setAttribute('role', 'button');
      s.setAttribute('tabindex', '0');
      s.setAttribute('aria-pressed', 'false');
      s.addEventListener('click', () => tap(s));
      s.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tap(s);
        }
      });
    });

    function note(s, trap) {
      const src = whys.find((w) => w.getAttribute('data-seg') === s.getAttribute('data-seg'));
      if (!src) return;
      const li = src.cloneNode(true);
      li.className = trap ? 'is-trap' : 'is-clean';
      notes.appendChild(li);
    }

    function tap(s) {
      if (root.classList.contains('is-solved') || s.getAttribute('aria-pressed') === 'true') return;
      s.setAttribute('aria-pressed', 'true');
      s.classList.remove('is-hinted');
      if (s.hasAttribute('data-trap')) {
        found++;
        s.classList.add('is-found');
        note(s, true);
        if (found === total) {
          solve();
          return;
        }
        g.say(S('spotFound', { found, total }), 'good');
      } else {
        misses++;
        s.classList.add('is-clean');
        note(s, false);
        g.say(S('spotMiss'), 'info');
        if (hint && misses >= 2) hint.hidden = false;
      }
    }

    if (hint) {
      hint.addEventListener('click', () => {
        const next = segs.find((s) => s.hasAttribute('data-trap') && s.getAttribute('aria-pressed') !== 'true');
        if (!next) return;
        next.classList.add('is-hinted');
        restart(next, 'is-pulse');
        next.focus();
        g.say(S('hintTrap'), 'info');
      });
    }

    function solve() {
      if (hint) hint.hidden = true;
      if (stamp) stamp.hidden = false;
      root.classList.add('is-busted');
      g.win('');
    }

    function reset() {
      found = 0;
      misses = 0;
      segs.forEach((s) => {
        s.setAttribute('aria-pressed', 'false');
        s.classList.remove('is-found', 'is-clean', 'is-hinted');
      });
      notes.replaceChildren();
      if (stamp) stamp.hidden = true;
      if (hint) hint.hidden = true;
      if (segs[0]) segs[0].focus();
    }
  }

  // ------------------------------------------------------------ pagina del percorso
  function initOverview() {
    const cards = Array.from(document.querySelectorAll('[data-pp-tile]'));
    const slugs = cards.map((c) => c.getAttribute('data-pp-tile'));
    const total = slugs.length;

    function render(animate) {
      const done = slugs.filter((s) => state.done[s]);
      const n = done.length;
      document.querySelectorAll('[data-pp-count]').forEach((b) => {
        b.textContent = String(n);
      });
      document.querySelectorAll('[data-pp-light]').forEach((li, i) => {
        const on = Boolean(state.done[li.getAttribute('data-pp-light')]);
        li.classList.toggle('is-on', on);
        li.style.setProperty('--i', String(i));
      });
      const lights = document.querySelector('[data-pp-lights]');
      if (lights) lights.classList.toggle('is-anim', Boolean(animate) && !reducedMotion);
      cards.forEach((c) => c.classList.toggle('is-done', Boolean(state.done[c.getAttribute('data-pp-tile')])));
      document.querySelectorAll('[data-pp-cert-badge]').forEach((li) => li.classList.toggle('is-on', Boolean(state.done[li.getAttribute('data-pp-cert-badge')])));

      // pulsante principale: inizia, continua o ritira il patentino
      const start = document.querySelector('[data-pp-start]');
      if (start) {
        if (!start.hasAttribute('data-href')) start.setAttribute('data-href', start.getAttribute('href'));
        if (n === total) {
          start.setAttribute('href', '#patentino');
          start.textContent = S('certGo');
        } else if (n > 0) {
          const nextIdx = slugs.findIndex((s) => !state.done[s]);
          const link = cards[nextIdx].querySelector('a');
          start.setAttribute('href', link.getAttribute('href'));
          start.textContent = S('continue', { n: nextIdx + 1 });
        } else {
          start.setAttribute('href', start.getAttribute('data-href'));
          start.textContent = S('start');
        }
      }

      // patentino e lucciola d'oro
      const complete = n === total;
      const locked = document.querySelector('[data-pp-cert-locked]');
      const tools = document.querySelector('[data-pp-cert-tools]');
      const gold = document.querySelector('[data-pp-gold]');
      const cert = document.querySelector('[data-pp-cert]');
      if (locked) locked.hidden = complete;
      if (tools) tools.hidden = !complete;
      if (gold) gold.hidden = !complete;
      if (cert) cert.classList.toggle('is-unlocked', complete);
      document.querySelectorAll('.pp-hero [data-lu], .pp-cert [data-lu]').forEach((lu) => lu.classList.toggle('lu--gold', complete));
      const date = document.querySelector('[data-pp-cert-date]');
      if (date) {
        const last = Math.max(0, ...done.map((s) => Number(state.done[s].at) || 0));
        date.textContent = complete && last ? S('certIssued', { date: fmtDate(last) }) : '';
      }
      if (complete && animate) {
        sparkle(document.querySelector('.pp-hero .pt-hero__art'), 14);
      }
      renderSecrets(complete);
    }

    // badge segreti: lucciola d'oro (tutte le tappe) ed Esploratore (tutte le sorprese, js/sorprese.js)
    function renderSecrets(complete) {
      const gold = document.querySelector('[data-pp-secret="gold"]');
      if (gold) gold.classList.toggle('is-won', complete);
      const eggs = window.EvilEggs ? window.EvilEggs.list() : [];
      const totalEggs = window.EvilEggs ? window.EvilEggs.total : 5;
      document.querySelectorAll('[data-pp-eggs]').forEach((b) => {
        b.textContent = String(eggs.length);
      });
      const explorer = document.querySelector('[data-pp-secret="explorer"]');
      if (explorer) explorer.classList.toggle('is-won', eggs.length >= totalEggs);
    }

    document.addEventListener('evil:egg', () => renderSecrets(slugs.every((s) => state.done[s])));

    render(true);

    // nome sul patentino: solo nella pagina, mai salvato
    const input = document.querySelector('[data-pp-cert-input]');
    const name = document.querySelector('[data-pp-cert-name]');
    if (input && name) {
      input.addEventListener('input', () => {
        name.textContent = input.value.trim().slice(0, 40);
      });
    }
    const print = document.querySelector('[data-pp-print]');
    if (print) {
      print.addEventListener('click', () => {
        document.body.classList.add('pp-printing');
        const done = () => {
          document.body.classList.remove('pp-printing');
          window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        window.print();
        window.setTimeout(done, 1000);
      });
    }

    // ricominciare da zero (computer condivisi, classi): serve un secondo tocco per conferma
    const reset = document.querySelector('[data-pp-reset]');
    const msg = document.querySelector('[data-pp-reset-msg]');
    if (reset) {
      let armed = 0;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = window.setTimeout(() => {
            armed = 0;
            reset.textContent = S('resetBtn');
            reset.classList.remove('is-armed');
          }, 5000);
          reset.textContent = S('resetConfirm');
          reset.classList.add('is-armed');
          return;
        }
        window.clearTimeout(armed);
        armed = 0;
        state = { v: 1, done: {}, now: {} };
        save();
        reset.textContent = S('resetBtn');
        reset.classList.remove('is-armed');
        if (msg) msg.textContent = S('resetDone');
        if (input) input.value = '';
        if (name) name.textContent = '';
        render(false);
      });
    }
  }

  function init() {
    if (page === 'stage') initStage();
    else if (page === 'overview') initOverview();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
