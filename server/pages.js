'use strict';
// Static, pagine HTML e iniezione asset (estratto da js/server.js)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { isDevelopment, isProduction } = require('../utils/env');
const { getCanonicalOrigin } = require('../middleware/https-enforce');

const root = path.resolve(__dirname, '..');

function resolveAchievementsFile() {
  const candidates = [
    path.join(root, 'achievements.json'),
    path.join(process.cwd(), 'achievements.json'),
    path.join(__dirname, 'achievements.json')
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) || candidates[0];
}

function syncAchievementsToHtml() {
  try {
    const src = resolveAchievementsFile();
    if (!fs.existsSync(src)) {
      console.warn('⚠️ achievements.json non trovato in:', path.join(root, 'achievements.json'));
      return;
    }
    const dest = path.join(root, 'html', 'achievements.json');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  } catch (err) {
    console.warn('⚠️ sync achievements.json → html/:', err.message);
  }
}

// helper di debugging: avvisa se una directory statica non esiste
function checkStaticExists(dir) {
  try {
    if (!fs.existsSync(dir)) {
      console.warn(`⚠️ directory statica mancante: ${dir}`);
    }
  } catch (e) {
    console.warn(`⚠️ errore controllo statico: ${e.message}`);
  }
}


// ==================== HTML INJECTION MIDDLEWARE ====================

// Le versioni (?v=) non si scrivono più a mano: versionAssetUrls() aggiunge a ogni
// file l'hash del suo contenuto quando la pagina viene servita.
// home.bundle.css contiene già home-footer.css: non va caricato una seconda volta.
const HOME_STYLESHEETS = ['/css/home.css', '/css/home.bundle.css'];

const SITE_FOOTER_CSS = '/css/site-footer.css';
const SITE_HEADER_CSS = '/css/site-header.css';
const SYSTEM_THEME_CSS = '/css/system-theme.css';
const EVIL_SCROLLBAR_CSS = '/css/evil-scrollbar.css';
const RESPONSIVE_CSS = '/css/responsive.css';
const EVIL_MOTION_CSS = '/css/evil-motion.css';
const EVIL_MOTION_JS = '/js/evil-motion.js';

const DEFAULT_DESCRIPTION =
  'EVIL è una piattaforma didattica di cybersecurity: laboratori simulati, quiz, simulatori di attacchi web e strumenti di analisi difensiva.';

// ==================== VERSIONI DEGLI ASSET (hash del contenuto) ====================
// Nelle pagine ogni file di css/, js/, assets/, public/ riceve ?v=<hash del contenuto>.
// Con la versione giusta nell'URL il browser lo tiene per un anno (immutable); senza,
// lo rivalida a ogni visita (ETag, risposta 304 se non è cambiato). Al posto delle date
// scritte a mano e degli elenchi di file "sempre freschi" che si scaricavano a ogni visita.
const ASSET_DIRS = new Set(['css', 'js', 'assets', 'public', 'html']);
const versionCache = new Map();

function fileVersion(absPath) {
  let st;
  try {
    st = fs.statSync(absPath);
  } catch (_) {
    return null;
  }
  if (!st.isFile()) return null;
  const cached = versionCache.get(absPath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) return cached.hash;
  const hash = crypto.createHash('sha1').update(fs.readFileSync(absPath)).digest('hex').slice(0, 10);
  versionCache.set(absPath, { mtimeMs: st.mtimeMs, size: st.size, hash });
  return hash;
}

function assetFileFromUrl(urlPath) {
  const m = /^\/([a-z]+)\/(.+)$/.exec(urlPath);
  if (!m || !ASSET_DIRS.has(m[1])) return null;
  let rel;
  try {
    rel = decodeURIComponent(m[2]);
  } catch (_) {
    return null;
  }
  if (rel.split(/[\\/]/).includes('..')) return null;
  return path.join(root, m[1], rel);
}

function versionAssetUrls(html) {
  return html.replace(
    /\b(href|src)="(\/(?:css|js|assets|public)\/[^"?#]+)(?:\?[^"#]*)?"/g,
    (full, attr, urlPath) => {
      const file = assetFileFromUrl(urlPath);
      const v = file && fileVersion(file);
      return v ? `${attr}="${urlPath}?v=${v}"` : full;
    }
  );
}

/** Cache-Control per i file statici: un anno se l'URL ha la versione giusta, altrimenti rivalida. */
function staticOptions() {
  return {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      const v = res.req?.query?.v;
      if (typeof v === 'string' && v && v === fileVersion(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  };
}

function escapeAttr(value) {
  return String(value).replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Icone del sito: prima solo la home dichiarava la favicon, le altre pagine chiedevano /favicon.ico (404). */
function injectIcons(html) {
  if (/rel="(?:shortcut )?icon"/i.test(html)) return html;
  const links = [
    '<link rel="icon" href="/assets/favicon.ico" sizes="32x32">',
    '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
  ];
  return html.replace('</head>', `${links.map((l) => `  ${l}`).join('\n')}\n</head>`);
}

// Pagine pubbliche per la sitemap (le pagine con login rimandano al login: escluse)
const SITEMAP_PAGES = [
  ['/', '1.0', 'weekly'],
  ['/virtual-lab.html', '0.9', 'monthly'],
  ['/web-simulator.html', '0.9', 'monthly'],
  ['/crypto-studio.html', '0.9', 'monthly'],
  ['/quiz-hub.html', '0.9', 'monthly'],
  ['/hacked-timeline.html', '0.8', 'monthly'],
  ['/attacks-map.html', '0.8', 'daily'],
  ['/historic-attacks.html', '0.8', 'monthly'],
  ['/malware-db.html', '0.7', 'monthly'],
  ['/malware-classification.html', '0.7', 'monthly'],
  ['/manipulation-techniques.html', '0.7', 'monthly'],
  ['/domain-recon.html', '0.6', 'monthly'],
  ['/osint-hub.html', '0.6', 'monthly'],
  ['/report-generator.html', '0.5', 'yearly'],
  ['/account.html', '0.4', 'yearly'],
  ['/login.html', '0.3', 'yearly'],
  ['/help.html', '0.4', 'yearly'],
  ['/site-policies.html', '0.3', 'yearly'],
];

function buildSitemap(origin) {
  const base = origin || 'https://www.projectevil.it';
  const urls = SITEMAP_PAGES.filter(([p]) => p === '/' || fs.existsSync(path.join(root, 'html', p.slice(1))))
    .map(([p, priority, freq]) => `  <url>\n    <loc>${base}${p}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Anteprima dei link (WhatsApp, Telegram, social) per le pagine che non la dichiarano. */
function injectSocialMeta(html, pagePath, origin) {
  let out = html;
  if (!/<meta\s+name="description"/i.test(out)) {
    out = out.replace('</head>', `  <meta name="description" content="${escapeAttr(DEFAULT_DESCRIPTION)}">\n</head>`);
  }
  if (/property="og:title"/i.test(out)) return out;
  const title = ((out.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'EVIL').trim();
  const desc = (out.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || DEFAULT_DESCRIPTION;
  const base = origin || 'https://www.projectevil.it';
  const tags = [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="EVIL">',
    '<meta property="og:locale" content="it_IT">',
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(desc)}">`,
    `<meta property="og:url" content="${escapeAttr(base + pagePath)}">`,
    `<meta property="og:image" content="${escapeAttr(base)}/assets/og-image.jpg">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
  ];
  return out.replace('</head>', `${tags.map((t) => `  ${t}`).join('\n')}\n</head>`);
}

function hasResponsiveCss(html) {
  return /responsive\.css/i.test(html);
}

const AUTH_CHROME_VERSION = '20260610';

const AUTH_REQUIRED_HTML =
  /^(security-check|vulnerability-scanner|dns-enumerator|subdomain-finder|ssl-analyzer|file-analysis|social-profiling|public-info|profile)\.html$/i;

const DEFER_BODY_SCRIPT_RE =
  /(?:matrixrain\.js|\/js\/js\.js|tools-api\.js|progress-manager\.js|security-check\.js|http-header-audit\.js|dns-enumerator\.js|subdomain-finder\.js|ssl-analyzer\.js|file-analysis\.js|social-profiling\.js|public-info\.js|profile-page\.js|web-simulator-lab\.js)/i;

function injectAuthRequiredBody(html, reqPath) {
  const base = path.basename(String(reqPath || '').replace(/^\//, ''));
  if (!AUTH_REQUIRED_HTML.test(base)) return html;
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/data-evil-auth/i.test(attrs)) return match;
    return `<body${attrs} data-evil-auth="required">`;
  });
}

function addDeferToBodyScripts(html) {
  return html.replace(
    /<script([^>]*)\ssrc="(\/js\/[^"]+\.js[^"]*)"([^>]*)>\s*<\/script>/gi,
    (full, before, src, after) => {
      if (/\bdefer\b/i.test(`${before} ${after}`)) return full;
      if (!DEFER_BODY_SCRIPT_RE.test(src)) return full;
      return `<script${before} src="${src}" defer${after}></script>`;
    }
  );
}

/** Un solo script defer: menu + auth (evita doppio init e header "Accedi" con JWT valido) */
function injectAuthChromeScripts(html) {
  if (!/<header[\s>]/i.test(html) || !html.includes('</head>')) return html;

  const block =
    `  <style id="evil-auth-pending-style">html.evil-auth-pending .auth-buttons{visibility:hidden;pointer-events:none;min-height:2.25rem}</style>\n` +
    `  <script>document.documentElement.classList.add("evil-auth-pending");</script>\n` +
    `  <script src="/js/evil-site-chrome.js?v=${AUTH_CHROME_VERSION}" defer></script>\n`;
  const stripRe =
    /\s*<script[^>]*src="[^"]*(?:auth-manager|load-header|evil-site-chrome)\.js[^"]*"[^>]*>\s*<\/script>\s*/gi;

  let out = html.replace(stripRe, '\n');
  out = out.replace(/<style id="evil-auth-pending-style">[\s\S]*?<\/style>\s*/gi, '');
  if (!out.includes('evil-site-chrome.js')) {
    out = out.replace('</head>', `${block}</head>`);
  }
  return out;
}

/** Link menu sempre dalla root (/pagina.html) — evita doppio caricamento da path /html/ misti */
function normalizeSiteNavLinks(html) {
  return html.replace(/href="([a-z][a-z0-9-]*\.html)"/gi, (match, file) => `href="/${file}"`);
}

// In produzione i file non cambiano mentre il server gira: la pagina elaborata si tiene
// in memoria. In sviluppo si rielabora a ogni richiesta, così le modifiche si vedono subito.
const renderedPages = new Map();

function renderPage(relativeName, canonicalPath) {
  const filePath = path.join(root, 'html', relativeName);
  const key = `${relativeName}|${canonicalPath || ''}`;
  if (isProduction() && renderedPages.has(key)) return renderedPages.get(key);
  if (!fs.existsSync(filePath)) return null;
  const html = injectPageAssets(fs.readFileSync(filePath, 'utf8'), canonicalPath ?? relativeName);
  if (isProduction()) renderedPages.set(key, html);
  return html;
}

function sendInjectedHtml(res, relativeName, canonicalPath) {
  const html = renderPage(relativeName, canonicalPath);
  if (html == null) return false;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // no-cache = il browser chiede sempre se la pagina è cambiata (ETag → 304 se no)
  res.setHeader('Cache-Control', 'no-cache');
  res.send(html);
  return true;
}

function injectSiteChromeCss(html, href, marker) {
  if (html.includes(marker) || html.includes(href)) return html;
  const link = `  <link rel="stylesheet" href="${href}">`;
  const styleLinkRe = /<link rel="stylesheet" href="(\/?\.\.\/)?css\/style\.css[^"]*">/i;
  if (styleLinkRe.test(html)) {
    return html.replace(styleLinkRe, (m) => `${m}\n${link}`);
  }
  return html.replace('</head>', `${link}\n</head>`);
}

function upgradeSiteChromeCssLink(html, href) {
  if (html.includes(href)) return html;
  const base = href.split('?')[0];
  const re = new RegExp(
    `<link rel="stylesheet" href="[^"]*${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*">`,
    'i'
  );
  if (re.test(html)) {
    return html.replace(re, `<link rel="stylesheet" href="${href}">`);
  }
  return html;
}

function injectSiteFooterCss(html) {
  let out = upgradeSiteChromeCssLink(html, SITE_FOOTER_CSS);
  return injectSiteChromeCss(out, SITE_FOOTER_CSS, 'evil-site-footer-injected');
}

function injectSiteHeaderCss(html) {
  let out = upgradeSiteChromeCssLink(html, SITE_HEADER_CSS);
  return injectSiteChromeCss(out, SITE_HEADER_CSS, 'evil-site-header-injected');
}

/** site-header.css deve caricare per ultimo (dopo home.bundle) per vincere la cascata */
function ensureSiteHeaderCssLast(html) {
  const re = /<link rel="stylesheet" href="([^"]*site-header\.css[^"]*)">\s*/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) return html;
  const href = matches[matches.length - 1][1];
  const cleaned = html.replace(re, '');
  const linkTag = `<link rel="stylesheet" href="${href}">`;
  return cleaned.replace('</head>', `  ${linkTag}\n</head>`);
}

function injectHomeStyles(html) {
  if (!html.includes('home-page') && !html.includes('home-hero--editorial')) {
    return html;
  }
  let out = html;
  const missing = HOME_STYLESHEETS.filter((href) => !out.includes(href.split('?')[0]));
  if (missing.length === 0) return out;
  const block = missing.map((href) => `  <link rel="stylesheet" href="${href}">`).join('\n');
  out = out.replace('</head>', `${block}\n</head>`);
  return out;
}

function injectEvilMotion(html) {
  if (!html.includes('evil-motion.css')) {
    html = injectSiteChromeCss(html, EVIL_MOTION_CSS, 'evil-motion.css');
  }
  if (!html.includes('evil-motion.js')) {
    html = html.replace(
      '</head>',
      `  <script src="${EVIL_MOTION_JS}" defer></script>\n</head>`
    );
  }
  return html;
}

function injectPageAssets(htmlContent, pageName) {
  if (!htmlContent.includes('</head>')) return htmlContent;
  let html = htmlContent;
  html = injectAuthRequiredBody(html, pageName);

  html = html
    .replace(/href="\.\.\/css\//g, 'href="/css/')
    .replace(/src="\.\.\/js\//g, 'src="/js/');

  if (!html.includes('viewport-fit=cover')) {
    html = html.replace(
      /content="width=device-width, initial-scale=1\.0"/,
      'content="width=device-width, initial-scale=1.0, viewport-fit=cover"'
    );
  }

  if (!hasResponsiveCss(html)) {
    if (html.includes('/css/style.css')) {
      html = html.replace(
        /<link rel="stylesheet" href="(\/?\.\.\/)?css\/style\.css[^"]*">/,
        (m) => `${m}\n  <link rel="stylesheet" href="${RESPONSIVE_CSS}">`
      );
    } else {
      html = html.replace(
        '</head>',
        `  <link rel="stylesheet" href="${RESPONSIVE_CSS}">\n</head>`
      );
    }
  }

  if (!html.includes('system-theme.css')) {
    html = injectSiteChromeCss(html, SYSTEM_THEME_CSS, 'system-theme.css');
  }

  if (!html.includes('evil-scrollbar.css')) {
    html = injectSiteChromeCss(html, EVIL_SCROLLBAR_CSS, 'evil-scrollbar.css');
  }

  html = injectAuthChromeScripts(html);
  html = normalizeSiteNavLinks(html);
  html = addDeferToBodyScripts(html);

  html = injectSiteFooterCss(html);
  html = injectEvilMotion(html);
  html = injectHomeStyles(html);
  html = injectSiteHeaderCss(html);
  html = ensureSiteHeaderCssLast(html);

  // Canonical = URL della pagina stessa. Prima tutte le pagine dichiaravano la home
  // come canonica, invitando i motori di ricerca a non indicizzarle.
  const canonical = getCanonicalOrigin();
  const pagePath = pageName ? `/${String(pageName).replace(/^\/+/, '')}` : '/';
  if (canonical && !html.includes('rel="canonical"')) {
    html = html.replace(
      '</head>',
      `  <link rel="canonical" href="${canonical}${pagePath}">\n</head>`
    );
  }
  html = injectSocialMeta(html, pagePath, canonical);
  html = injectIcons(html);

  // I meta http-equiv sulla cache non servono (decidono gli header HTTP) e confondono
  html = html.replace(/\s*<meta http-equiv="(?:Cache-Control|Pragma|Expires)"[^>]*>/gi, '');

  return versionAssetUrls(html);
}


function mountStatic(app) {
  syncAchievementsToHtml();

  // File che i motori di ricerca e i browser cercano nella radice del sito
  // (prima /robots.txt, /sitemap.xml e /favicon.ico rispondevano 404)
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(path.join(root, 'public', 'robots.txt'));
  });
  app.get('/sitemap.xml', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(buildSitemap(getCanonicalOrigin()));
  });
  app.get('/favicon.ico', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.join(root, 'assets', 'favicon.ico'));
  });
  app.get('/apple-touch-icon.png', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.sendFile(path.join(root, 'assets', 'apple-touch-icon.png'));
  });

  // controlli solo in sviluppo, possono essere rimossi in produzione
  if (isDevelopment()) {
    checkStaticExists(path.join(root, 'css'));
    checkStaticExists(path.join(root, 'js'));
    checkStaticExists(path.join(root, 'assets'));
    checkStaticExists(path.join(root, 'public'));
    checkStaticExists(path.join(root, 'html'));
  }

  app.use('/css', express.static(path.join(root, 'css'), staticOptions()));

  // Alias typo comune (browser/cache): home-chrome.css → bundle reale
  app.get('/css/home-chrome.css', (req, res) => {
    res.redirect(302, '/css/home.bundle.css');
  });

  app.use('/js', express.static(path.join(root, 'js'), staticOptions()));
  app.use('/assets', express.static(path.join(root, 'assets'), staticOptions()));

  // Easter egg: aprendo /public/generated-image.png nel browser (non come <img>) → animazione
  app.get('/public/generated-image.png', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      return res.sendFile(path.join(root, 'html', 'logo-easter-egg.html'));
    }
    next();
  });

  app.use('/public', express.static(path.join(root, 'public'), staticOptions()));

  // HTML con asset injection (prima dello static /html, altrimenti bypass)
  app.get(/^\/html\/[^/]+\.html$/i, (req, res, next) => {
    const rel = req.path.replace(/^\/html\//i, '');
    if (!sendInjectedHtml(res, rel)) return next();
  });

  app.get(/^\/[^/]+\.html$/i, (req, res, next) => {
    const rel = req.path.replace(/^\//, '');
    if (!rel || rel.includes('/') || rel.startsWith('html/')) return next();
    if (!sendInjectedHtml(res, rel)) return next();
  });

  app.use('/html', express.static(path.join(root, 'html'), staticOptions())); // asset non-html + fallback
}

function mountPageRoutes(app) {
  // Route per la homepage (root)
  app.get('/', (req, res) => {
    if (!sendInjectedHtml(res, 'home.html', '')) res.status(404).send('Home page not found');
  });

  // Redirect legacy ethical hacking → studio cifratura
  app.get(['/ethical-hacking.html', '/html/ethical-hacking.html'], (req, res) => {
    res.redirect(301, '/crypto-studio.html');
  });

  // Redirect legacy quiz pages → centro quiz unificato
  app.get(['/phishing-quiz.html', '/html/phishing-quiz.html'], (req, res) => {
    res.redirect(301, '/quiz-hub.html');
  });
  app.get(['/social-engineering.html', '/html/social-engineering.html'], (req, res) => {
    res.redirect(301, '/quiz-hub.html?cat=social-engineering');
  });
}

module.exports = {
  mountStatic,
  mountPageRoutes,
  resolveAchievementsFile,
  injectPageAssets,
  versionAssetUrls,
  fileVersion,
  root,
};
