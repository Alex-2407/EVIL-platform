'use strict';
// Header e footer di tutte le pagine, generati dalla mappa del sito nella lingua della pagina.
// Le pagine in html/ contengono solo i segnaposto <!--evil:header--> e <!--evil:footer-->.

const { AREAS, PAGES, LANGS, DEFAULT_LANG, pagesOf } = require('./site-map');
const { svgIcon } = require('./icons');

// Icona grande dell'anteprima nel menu, una per area
const AREA_ICON = { 'per-tutti': 'sun', impara: 'book', analizza: 'globe', verifica: 'shield', progetto: 'star' };

const STR = {
  it: {
    headerLabel: 'Intestazione principale',
    menuLabel: 'Menu principale',
    matrix: 'Attiva effetto Matrix',
    logoAlt: 'Logo EVIL',
    home: 'EVIL — torna alla home',
    search: 'Cerca nel sito',
    searchShort: 'Cerca',
    langNav: 'Lingua',
    login: 'Accedi',
    register: 'Registrati',
    openMenu: 'Apri menu di navigazione',
    loginAria: 'Accedi a EVIL',
    registerAria: 'Crea un account EVIL',
    allArea: 'Tutta l’area',
    modules: (n) => (n === 1 ? 'pagina' : 'pagine'),
    needAccount: 'Serve un account',
    free: 'Libero',
    open: 'Apri',
    footMission:
      'Formazione pratica in cybersecurity. Spieghiamo come funzionano gli attacchi perché chi studia impari a prevenirli, nel rispetto della legge.',
    footFire:
      'La conoscenza è neutra, come il fuoco: può cucinare o distruggere. Qui si impara a usarla per proteggere.',
    footLegal: 'Strumenti da usare solo su sistemi tuoi o con autorizzazione scritta.',
    code: 'Codice su GitHub',
    langName: { it: 'Italiano', en: 'English' },
    help: 'Aiuto',
    helpAria: 'Aiuto subito: cyberbullismo, ricatti, minacce',
  },
  en: {
    headerLabel: 'Main header',
    menuLabel: 'Main menu',
    matrix: 'Toggle Matrix effect',
    logoAlt: 'EVIL logo',
    home: 'EVIL — back to the home page',
    search: 'Search the site',
    searchShort: 'Search',
    langNav: 'Language',
    login: 'Sign in',
    register: 'Sign up',
    openMenu: 'Open navigation menu',
    loginAria: 'Sign in to EVIL',
    registerAria: 'Create an EVIL account',
    allArea: 'Whole section',
    modules: (n) => (n === 1 ? 'page' : 'pages'),
    needAccount: 'Account needed',
    free: 'Free',
    open: 'Open',
    footMission:
      'Hands-on cybersecurity training. We explain how attacks work so that learners can prevent them, within the law.',
    footFire:
      'Knowledge is neutral, like fire: it can cook or destroy. Here you learn to use it to protect.',
    footLegal: 'Use the tools only on your own systems or with written authorisation.',
    code: 'Source code on GitHub',
    langName: { it: 'Italiano', en: 'English' },
    help: 'Help',
    helpAria: 'Get help now: cyberbullying, blackmail, threats',
  },
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** URL di una pagina in una lingua: home → / o /en/, pagina → /x.html o /en/x.html */
function pageUrl(file, lang) {
  const prefix = lang === DEFAULT_LANG ? '' : `/${lang}`;
  if (!file || file === 'home.html') return `${prefix}/`;
  return `${prefix}/${file}`;
}

function langSwitch(file, lang, extraClass = '') {
  const s = STR[lang];
  const links = LANGS.map((l) => {
    const current = l === lang;
    return `<a class="evil-lang__opt${current ? ' is-current' : ''}" href="${pageUrl(file, l)}" hreflang="${l}" lang="${l}"` +
      `${current ? ' aria-current="true"' : ''} title="${esc(s.langName[l])}" data-evil-lang="${l}">${l.toUpperCase()}</a>`;
  }).join('');
  return `<nav class="evil-lang${extraClass ? ` ${extraClass}` : ''}" aria-label="${esc(s.langNav)}">${links}</nav>`;
}

function renderHeader(lang, file) {
  const s = STR[lang] || STR.it;
  const lock = svgIcon('lock');
  const menus = AREAS.map((area) => {
    const pages = pagesOf(area.id).filter((p) => p.nav);
    const items = pages
      .map((p, i) => {
        const current = p.file === file;
        const n = String(i + 1).padStart(2, '0');
        return `<a class="evil-dd__item" href="${pageUrl(p.file, lang)}"${current ? ' aria-current="page"' : ''} style="--i:${i}"` +
          ` data-n="${n}" data-badge="${esc(p.auth ? s.needAccount : s.free)}"${p.auth ? ' data-auth="1"' : ''}>` +
          `<span class="evil-dd__ico">${svgIcon(p.icon)}</span>` +
          `<span class="evil-dd__txt"><span class="evil-nav__t">${esc(p.title[lang])}</span>` +
          `<span class="evil-nav__d">${esc(p.desc[lang])}</span></span>` +
          (p.auth ? `<span class="evil-dd__lock" title="${esc(s.needAccount)}">${lock}</span>` : '') +
          '</a>';
      })
      .join('\n              ');
    const active = pagesOf(area.id).some((p) => p.file === file);
    return `          <li class="evil-nav__area evil-nav__area--${area.color}${active ? ' is-active' : ''}">
            <a href="#">${esc(area.label[lang])} ▾</a>
            <div class="dropdown evil-dd evil-dd--${area.id}">
              <div class="evil-dd__list">
                <p class="evil-dd__k"><span>${esc(area.sub[lang])}</span><b>${pages.length}</b> ${esc(s.modules(pages.length))}</p>
              ${items}
                <span class="evil-dd__glide" aria-hidden="true"></span>
              </div>
              <div class="evil-dd__peek" aria-hidden="true">
                <span class="evil-dd__fx"></span>
                <span class="evil-dd__big" data-area-icon="${AREA_ICON[area.id] || 'info'}">${svgIcon(AREA_ICON[area.id] || 'info')}</span>
                <p class="evil-dd__pk"><span class="evil-dd__pn">${esc(area.label[lang])}</span></p>
                <p class="evil-dd__pt">${esc(area.sub[lang])}</p>
                <p class="evil-dd__pd evil-nav__intro">${esc(area.desc[lang])}</p>
                <p class="evil-dd__pm"><span class="evil-dd__badge">${pages.length} ${esc(s.modules(pages.length))}</span><span class="evil-dd__go">${esc(s.open)} →</span></p>
              </div>
            </div>
          </li>`;
  }).join('\n');

  return `<header role="banner" aria-label="${esc(s.headerLabel)}">
    <div class="header-container">
      <div class="logo-section">
        <button class="img-btn" id="matrix-btn" type="button" aria-label="${esc(s.matrix)}" aria-pressed="false">
          <img src="/assets/evil-logo-144.png" width="56" height="56" alt="${esc(s.logoAlt)}">
        </button>
        <a href="${pageUrl('home.html', lang)}" class="header-evil-wordmark" aria-label="${esc(s.home)}">EVIL</a>
      </div>

      <nav role="navigation" aria-label="${esc(s.menuLabel)}">
        <ul>
${menus}
        </ul>
      </nav>

      <div class="header-actions">
        <button class="evil-search-btn" type="button" data-evil-search aria-label="${esc(s.search)}" aria-keyshortcuts="Control+K Meta+K /">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <span class="evil-search-btn__label">${esc(s.searchShort)}</span><kbd>Ctrl K</kbd>
        </button>
        ${langSwitch(file, lang)}
        <div class="auth-buttons">
          <a class="auth-btn account" href="${pageUrl('login.html', lang)}" aria-label="${esc(s.loginAria)}">${esc(s.login)}</a>
          <a class="auth-btn login" href="${pageUrl('account.html', lang)}" aria-label="${esc(s.registerAria)}">${esc(s.register)}</a>
        </div>
        <button class="hamburger-btn" type="button" aria-label="${esc(s.openMenu)}" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </header>`;
}

function renderFooter(lang, file) {
  const s = STR[lang] || STR.it;
  const cols = AREAS.map((area) => {
    const links = pagesOf(area.id)
      .filter((p) => p.nav)
      .map((p) => `<li><a class="evil-site-foot__link" href="${pageUrl(p.file, lang)}">${esc(p.title[lang])}</a></li>`)
      .join('');
    return `<section class="evil-site-foot__col evil-site-foot__col--${area.color}">
      <h2 class="evil-site-foot__tag">${esc(area.label[lang])}</h2>
      <ul class="evil-site-foot__list">${links}</ul>
    </section>`;
  }).join('\n    ');

  return `<footer class="evil-site-foot" id="site-footer">
  <div class="evil-site-foot__glow" aria-hidden="true"></div>
  <div class="evil-site-foot__grid evil-site-foot__grid--v3">
    <section class="evil-site-foot__col evil-site-foot__col--brand">
      <p class="evil-site-foot__title">EVIL</p>
      <p class="evil-site-foot__copy">${esc(s.footMission)}</p>
      <p class="evil-site-foot__copy evil-site-foot__fire">${esc(s.footFire)}</p>
    </section>
    ${cols}
  </div>
  <div class="evil-site-foot__bottom">
    <p class="evil-site-foot__copy evil-site-foot__meta">© 2026 EVIL · ${esc(s.footLegal)}</p>
    <p class="evil-site-foot__copy">
      <a class="evil-site-foot__link" href="https://github.com/Alex-2407/evil-platform" rel="noopener noreferrer">${esc(s.code)}</a>
    </p>
    ${langSwitch(file, lang, 'evil-lang--foot')}
  </div>
</footer>${helpButton(lang, file)}`;
}

/**
 * Pulsante "Aiuto" sempre raggiungibile (docs/evil-per-tutti/PIANO.md, passo 1.5).
 * Sta fuori dal footer: un genitore con transform sposterebbe un elemento fixed.
 */
function helpButton(lang, file) {
  if (file === 'aiuto.html') return '';
  const s = STR[lang] || STR.it;
  return `
<a class="evil-help-fab" href="${pageUrl('aiuto.html', lang)}" aria-label="${esc(s.helpAria)}">${svgIcon('lifebuoy')}<span>${esc(s.help)}</span></a>`;
}

/** Manifest per il browser (home, ricerca rapida): pagine e aree nella lingua indicata. */
function clientManifest(stats) {
  const pick = (o) => Object.fromEntries(LANGS.map((l) => [l, o[l]]));
  return {
    langs: LANGS,
    areas: AREAS.map((a) => ({ id: a.id, color: a.color, label: pick(a.label), sub: pick(a.sub), desc: pick(a.desc) })),
    pages: PAGES.map((p) => ({
      file: p.file, area: p.area, icon: p.icon, nav: Boolean(p.nav), auth: Boolean(p.auth),
      title: pick(p.title), desc: pick(p.desc),
    })),
    stats: stats || {},
  };
}

module.exports = { renderHeader, renderFooter, pageUrl, langSwitch, clientManifest, STR };
