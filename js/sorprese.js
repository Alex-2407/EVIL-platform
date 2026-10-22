/**
 * EVIL · le sorprese di Lù (docs/evil-per-tutti/STILE.md, tabella degli easter egg).
 *
 * Registro delle sorprese trovate, solo nel browser (localStorage, chiave evil-pt-eggs-v1),
 * un avviso breve quando se ne trova una e il badge segreto "Esploratore" quando si trovano tutte.
 * Le sorprese stanno in js/site-search.js (password famose), js/per-tutti.js (torcia, curiosità di Lù,
 * pagine del premio finto e 404). Mai nella pagina Aiuto: lì si cerca aiuto, non si gioca.
 */
(function () {
  'use strict';

  const KEY = 'evil-pt-eggs-v1';
  const ALL = ['search', 'light', 'lu', 'prize', 'lost'];
  const I = window.EVIL_I18N || { lang: 'it', t: (s) => s, url: (p) => p };
  const { t } = I;
  const onHelpPage = /(^|\/)aiuto\.html$/.test(window.location.pathname) || Boolean(document.body && document.body.classList.contains('pt-help-page'));
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const NAMES = {
    search: t('La password che conoscono anche i muri'),
    light: t('La torcia di Lù'),
    lu: t('Le curiosità di Lù'),
    prize: t('Il premio troppo bello'),
    lost: t('La pagina persa'),
  };

  function load() {
    try {
      const list = JSON.parse(window.localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list.filter((id) => ALL.includes(id)) : [];
    } catch (_) {
      return [];
    }
  }

  function save(list) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (_) {
      /* navigazione privata: la sorpresa vale solo per questa visita */
    }
  }

  let box = null;
  /** Avviso in basso al centro, letto anche dai lettori di schermo; sparisce da solo. */
  function toast(title, text, ms) {
    if (!document.body) return;
    if (!box) {
      box = document.createElement('div');
      box.className = 'evil-egg-toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.className = 'evil-egg-toast';
    const b = document.createElement('strong');
    b.textContent = title;
    const s = document.createElement('span');
    s.textContent = text;
    item.append(b, s);
    box.appendChild(item);
    if (!reducedMotion) requestAnimationFrame(() => item.classList.add('is-in'));
    else item.classList.add('is-in');
    window.setTimeout(() => {
      item.classList.remove('is-in');
      window.setTimeout(() => item.remove(), reducedMotion ? 0 : 300);
    }, ms || 5200);
  }

  /** Segna una sorpresa come trovata. Restituisce null nella pagina Aiuto o per un nome sconosciuto. */
  function found(id) {
    if (onHelpPage || !ALL.includes(id)) return null;
    const list = load();
    if (list.includes(id)) return { isNew: false, count: list.length, total: ALL.length, complete: list.length === ALL.length };
    list.push(id);
    save(list);
    toast(t('Sorpresa {n} di {tot}', { n: list.length, tot: ALL.length }), NAMES[id]);
    const complete = list.length === ALL.length;
    if (complete) {
      window.setTimeout(() => toast(t('Badge segreto: Esploratore'), t('Hai trovato tutte le sorprese di Lù. Curiosità: livello lucciola.'), 7000), 3800);
    }
    document.dispatchEvent(new CustomEvent('evil:egg', { detail: { id, count: list.length, total: ALL.length, complete } }));
    return { isNew: true, count: list.length, total: ALL.length, complete };
  }

  window.EvilEggs = Object.freeze({
    found,
    list: load,
    total: ALL.length,
    names: () => ({ ...NAMES }),
    toast,
  });

  // per chi apre gli strumenti per sviluppatori (la home ha già il suo messaggio)
  if (!onHelpPage && !(document.body && document.body.classList.contains('home-v7'))) {
    const learn = `${window.location.origin}${I.url ? I.url('/learning-paths.html') : '/learning-paths.html'}`;
    console.log(
      `%c EVIL %c ${t('Ti piace capire come funziona sotto il cofano? L’area Impara fa per te:')} ${learn}`,
      'background:#f4e04d;color:#1b2130;font-weight:900;padding:2px 6px;border-radius:4px',
      'color:#7dd3fc'
    );
  }
})();
