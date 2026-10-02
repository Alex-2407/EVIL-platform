/**
 * Traduzioni lato browser. Il server carica prima /js/i18n/<lingua>.js (dizionario) e poi
 * questo file, in testa alla pagina, così ogni script può usare:
 *
 *   const { t, url, locale } = window.EVIL_I18N;
 *   el.textContent = t('Trovati {n} risultati', { n: 3 });
 *   location.href = url('/login.html');
 *
 * La chiave è il testo italiano: in italiano t() restituisce il testo così com'è.
 * Le traduzioni stanno in i18n/<lingua>/js/<file>.json (docs/I18N.md).
 */
(function () {
  'use strict';

  const LANGS = ['it', 'en'];
  const DEFAULT = 'it';
  const lang = (() => {
    const l = (document.documentElement.getAttribute('lang') || DEFAULT).slice(0, 2).toLowerCase();
    return LANGS.includes(l) ? l : DEFAULT;
  })();
  const dict = (lang !== DEFAULT && window.EVIL_I18N_DICT) || {};
  const locale = lang === 'en' ? 'en-GB' : 'it-IT';

  function format(str, vars) {
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
  }

  /** Traduce un testo italiano. vars sostituisce i segnaposto {nome}. */
  function t(str, vars) {
    const s = String(str);
    const tr = lang !== DEFAULT && Object.prototype.hasOwnProperty.call(dict, s) ? dict[s] : s;
    return format(tr, vars);
  }

  /** Percorso di una pagina del sito nella lingua corrente: url('/quiz-hub.html') → /en/quiz-hub.html */
  function url(path) {
    const p = String(path || '/');
    if (lang === DEFAULT) return p;
    if (/^\/(?:[a-z0-9-]+\.html)?(?:[?#].*)?$/i.test(p)) return `/${lang}${p}`;
    if (/^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(p)) return `/${lang}/${p}`;
    return p;
  }

  /** Percorso della pagina corrente in un'altra lingua (stessa query e ancora). */
  function switchUrl(target) {
    const { pathname, search, hash } = window.location;
    const bare = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/';
    const base = target === DEFAULT ? bare : `/${target}${bare === '/' ? '/' : bare}`;
    return base + search + hash;
  }

  const fmtNumber = (n, opts) => Number(n).toLocaleString(locale, opts);
  const fmtDate = (d, opts) => new Intl.DateTimeFormat(locale, opts || { dateStyle: 'medium' }).format(new Date(d));

  window.EVIL_I18N = Object.freeze({ lang, locale, langs: LANGS, t, url, switchUrl, format, fmtNumber, fmtDate });

  // Le API rispondono nella lingua della pagina (server/i18n: cookie evil_lang)
  try {
    document.cookie = `evil_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch (_) { /* cookie disattivati */ }

  function wireSwitchers() {
    document.querySelectorAll('a[data-evil-lang]').forEach((a) => {
      const target = a.getAttribute('data-evil-lang');
      a.setAttribute('href', switchUrl(target));
      a.addEventListener('click', () => {
        try {
          localStorage.setItem('evil-lang-choice', target);
        } catch (_) { /* storage non disponibile */ }
      });
    });
  }

  /** Visitatore che non parla italiano su una pagina italiana: proponi l'inglese, senza redirect. */
  function suggestLanguage() {
    if (lang !== DEFAULT) return;
    let chosen = null;
    try {
      chosen = localStorage.getItem('evil-lang-choice');
    } catch (_) { /* ignore */ }
    if (chosen) return;
    const prefs = (navigator.languages || [navigator.language || ''])
      .map((l) => String(l).slice(0, 2).toLowerCase())
      .filter(Boolean);
    // solo chi non ha l'italiano tra le lingue del browser (i crawler non lo vedono: niente redirect)
    if (!prefs.length || prefs.includes('it')) return;
    const bar = document.createElement('div');
    bar.className = 'evil-lang-hint';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Language');
    bar.lang = 'en';
    const text = document.createElement('span');
    text.textContent = 'EVIL is also available in English.';
    const go = document.createElement('a');
    go.href = switchUrl('en');
    go.className = 'evil-lang-hint__go';
    go.textContent = 'Switch to English';
    go.addEventListener('click', () => {
      try {
        localStorage.setItem('evil-lang-choice', 'en');
      } catch (_) { /* ignore */ }
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'evil-lang-hint__close';
    close.setAttribute('aria-label', 'Stay in Italian');
    close.textContent = '×';
    close.addEventListener('click', () => {
      try {
        localStorage.setItem('evil-lang-choice', 'it');
      } catch (_) { /* ignore */ }
      bar.remove();
    });
    bar.append(text, go, close);
    document.body.appendChild(bar);
  }

  // Link interni creati dal JavaScript senza url(): nella versione inglese restano in inglese
  if (lang !== DEFAULT) {
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.hasAttribute('data-evil-lang')) return;
      const href = a.getAttribute('href');
      if (/^\/(?:[a-z0-9-]+\.html)?(?:[?#].*)?$/i.test(href)) a.setAttribute('href', url(href));
    }, true);
  }

  const ready = () => {
    wireSwitchers();
    suggestLanguage();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
