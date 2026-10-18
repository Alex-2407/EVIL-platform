/**
 * Ricerca rapida nel sito: Ctrl+K (⌘K su Mac), "/" oppure il pulsante "Cerca" nell'header.
 * Le pagine vengono da window.EVIL_SITE (js/site-pages.js, generato da server/site-map.js).
 */
(function () {
  'use strict';

  const I = window.EVIL_I18N || { lang: 'it', t: (s) => s, url: (p) => p };
  const L = {
    it: {
      placeholder: 'Cerca una pagina: quiz, phishing, DNS, TLS…',
      label: 'Cerca nel sito',
      empty: 'Nessuna pagina trovata. Prova con un’altra parola.',
      account: 'con account',
      hint: '↑ ↓ per scegliere · Invio per aprire · Esc per chiudere',
      close: 'Chiudi la ricerca',
      eggTitle: 'Lù arrossisce: questa password la conoscono anche i muri.',
      eggMeta: 'sorpresa',
      eggDesc: 'È tra le prime che si provano per entrare in un account. Tre parole a caso fanno una password lunga e facile da ricordare: ti mostriamo come.',
    },
    en: {
      placeholder: 'Search a page: quiz, phishing, DNS, TLS…',
      label: 'Search the site',
      empty: 'No page found. Try another word.',
      account: 'account needed',
      hint: '↑ ↓ to choose · Enter to open · Esc to close',
      close: 'Close search',
      eggTitle: 'Lu is blushing: even the walls know this password.',
      eggMeta: 'surprise',
      eggDesc: 'It’s one of the first ones tried to break into an account. Three random words make a long password that’s easy to remember: we’ll show you how.',
    },
  }[I.lang] || null;
  if (!L) return;

  // sorpresa (docs/evil-per-tutti/STILE.md): chi cerca una delle password più usate trova Lù
  const WEAK = new Set(['123456', '12345678', '123456789', '111111', '000000', 'password', 'password1', 'qwerty']);
  const EGG = { egg: true, file: 'pp-password.html' };
  const LU_FACE =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="17.5" r="5" fill="#f4e04d"/>' +
    '<circle cx="12" cy="9.5" r="6.5" fill="#1b2130"/><circle cx="9.6" cy="9" r="1.6" fill="#fff"/><circle cx="14.4" cy="9" r="1.6" fill="#fff"/>' +
    '<circle cx="7.6" cy="12" r="1.5" fill="#ff7a8a"/><circle cx="16.4" cy="12" r="1.5" fill="#ff7a8a"/></svg>';

  let dialog = null;
  let input = null;
  let list = null;
  let items = [];
  let active = 0;
  let lastFocus = null;

  function site() {
    return window.EVIL_SITE || { pages: [], areas: [] };
  }

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function score(page, q) {
    if (!q) return 1;
    const title = fold(page.title[I.lang]);
    const desc = fold(page.desc[I.lang]);
    const other = fold(Object.values(page.title).join(' '));
    let s = 0;
    for (const word of q.split(/\s+/).filter(Boolean)) {
      if (title.startsWith(word)) s += 6;
      else if (title.includes(word)) s += 4;
      else if (other.includes(word)) s += 2;
      else if (desc.includes(word)) s += 1;
      else return 0;
    }
    return s;
  }

  function render() {
    const q = fold(input.value.trim());
    const areas = Object.fromEntries(site().areas.map((a) => [a.id, a]));
    items = site().pages
      .map((p) => ({ p, s: score(p, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.p);
    // nella pagina Aiuto niente sorprese: lì si cerca aiuto, non si gioca
    if (WEAK.has(q.replace(/\s+/g, '')) && !/(^|\/)aiuto\.html$/.test(window.location.pathname)) {
      items = [EGG, ...items.filter((p) => p.file !== EGG.file)];
      if (window.EvilEggs) window.EvilEggs.found('search');
    }
    active = Math.min(active, Math.max(0, items.length - 1));
    list.replaceChildren();
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'evil-search__empty';
      li.textContent = L.empty;
      list.appendChild(li);
      input.setAttribute('aria-activedescendant', '');
      return;
    }
    items.forEach((p, i) => {
      const li = document.createElement('li');
      li.id = `evil-search-opt-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      li.className = p.egg ? 'evil-search__opt evil-search__opt--egg' : `evil-search__opt evil-search__opt--${(areas[p.area] || {}).color || 'cyan'}`;
      const a = document.createElement('a');
      a.href = I.url(`/${p.file}`);
      a.tabIndex = -1;
      const top = document.createElement('span');
      top.className = 'evil-search__t';
      top.textContent = p.egg ? L.eggTitle : p.title[I.lang];
      if (p.egg) top.insertAdjacentHTML('afterbegin', LU_FACE);
      const meta = document.createElement('span');
      meta.className = 'evil-search__m';
      meta.textContent = p.egg ? L.eggMeta : (areas[p.area] ? areas[p.area].label[I.lang] : '') + (p.auth ? ` · ${L.account}` : '');
      const d = document.createElement('span');
      d.className = 'evil-search__d';
      d.textContent = p.egg ? L.eggDesc : p.desc[I.lang];
      a.append(top, meta, d);
      li.appendChild(a);
      li.addEventListener('mousemove', () => {
        if (active !== i) {
          active = i;
          highlight();
        }
      });
      list.appendChild(li);
    });
    highlight();
  }

  function highlight() {
    list.querySelectorAll('[role="option"]').forEach((li, i) => {
      li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      if (i === active) li.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', items.length ? `evil-search-opt-${active}` : '');
  }

  function build() {
    dialog = document.createElement('div');
    dialog.className = 'evil-search';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', L.label);
    dialog.innerHTML =
      '<div class="evil-search__box">' +
      '<div class="evil-search__bar">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>' +
      '<input class="evil-search__input" type="search" role="combobox" aria-expanded="true" aria-controls="evil-search-list" autocomplete="off" spellcheck="false">' +
      '<button class="evil-search__close" type="button">Esc</button>' +
      '</div>' +
      '<ul class="evil-search__list" id="evil-search-list" role="listbox"></ul>' +
      '<p class="evil-search__hint"></p>' +
      '</div>';
    input = dialog.querySelector('input');
    list = dialog.querySelector('ul');
    input.placeholder = L.placeholder;
    input.setAttribute('aria-label', L.label);
    dialog.querySelector('.evil-search__hint').textContent = L.hint;
    dialog.querySelector('.evil-search__close').setAttribute('aria-label', L.close);
    dialog.querySelector('.evil-search__close').addEventListener('click', close);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });
    input.addEventListener('input', () => {
      active = 0;
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = (active + 1) % Math.max(1, items.length);
        highlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active - 1 + items.length) % Math.max(1, items.length);
        highlight();
      } else if (e.key === 'Enter' && items[active]) {
        e.preventDefault();
        window.location.href = I.url(`/${items[active].file}`);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab') {
        e.preventDefault();
      }
    });
    document.body.appendChild(dialog);
  }

  function open() {
    if (!dialog) build();
    lastFocus = document.activeElement;
    dialog.hidden = false;
    document.documentElement.classList.add('evil-search-open');
    input.value = '';
    active = 0;
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.documentElement.classList.remove('evil-search-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function typing(el) {
    return el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
  }

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') {
      e.preventDefault();
      if (dialog && !dialog.hidden) close();
      else open();
    } else if (k === '/' && !typing(document.activeElement) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      open();
    }
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('[data-evil-search]');
    if (btn) {
      e.preventDefault();
      open();
    }
  });

  window.EVIL_openSearch = open;
})();
