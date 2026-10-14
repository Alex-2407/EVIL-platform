'use strict';
// Static, pagine HTML e iniezione asset (estratto da js/server.js)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { isDevelopment, isProduction } = require('../utils/env');
const { getCanonicalOrigin } = require('../middleware/https-enforce');
const { renderHeader, renderFooter, clientManifest } = require('./chrome');
const i18n = require('./i18n');
const { PAGES, ACCOUNT_PAGES, LANGS, DEFAULT_LANG } = require('./site-map');
const { computeStats } = require('./stats');

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

const DEFAULT_DESCRIPTION = {
  it: 'EVIL è una piattaforma didattica di cybersecurity: laboratori simulati, quiz, simulatori di attacchi web e strumenti di analisi difensiva.',
  en: 'EVIL is a cybersecurity training platform: simulated labs, quizzes, web attack simulators and defensive analysis tools.',
};
const OG_LOCALE = { it: 'it_IT', en: 'en_GB' };

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

// Pagine pubbliche per la sitemap (le pagine con login rimandano al login: escluse).
// Ogni pagina compare in tutte le lingue, con i link hreflang alle altre versioni.
const SITEMAP_PAGES = [
  ['home.html', 1.0, 'weekly'],
  ...[...PAGES, ...ACCOUNT_PAGES]
    .filter((p) => p.sitemap != null)
    .map((p) => [p.file, p.sitemap, p.file === 'attacks-map.html' ? 'daily' : 'monthly']),
];

function localizedPath(file, lang) {
  const prefix = lang === DEFAULT_LANG ? '' : `/${lang}`;
  return !file || file === 'home.html' ? `${prefix}/` : `${prefix}/${file}`;
}

function buildSitemap(origin) {
  const base = origin || 'https://www.projectevil.it';
  const urls = [];
  for (const [file, priority, freq] of SITEMAP_PAGES) {
    if (!fs.existsSync(path.join(root, 'html', file))) continue;
    const alts = [...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${base}${localizedPath(file, l)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${base}${localizedPath(file, DEFAULT_LANG)}"/>`];
    for (const lang of LANGS) {
      urls.push(`  <url>\n    <loc>${base}${localizedPath(file, lang)}</loc>\n${alts.join('\n')}\n    <changefreq>${freq}</changefreq>\n    <priority>${Number(priority).toFixed(1)}</priority>\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

/** Anteprima dei link (WhatsApp, Telegram, social) per le pagine che non la dichiarano. */
function injectSocialMeta(html, pagePath, origin, lang = DEFAULT_LANG) {
  let out = html;
  const fallback = DEFAULT_DESCRIPTION[lang] || DEFAULT_DESCRIPTION.it;
  if (!/<meta\s+name="description"/i.test(out)) {
    out = out.replace('</head>', `  <meta name="description" content="${escapeAttr(fallback)}">\n</head>`);
  }
  if (/property="og:title"/i.test(out)) return out;
  const title = ((out.match(/<title>([^<]*)<\/title>/i) || [])[1] || 'EVIL').trim();
  const desc = (out.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || fallback;
  const base = origin || 'https://www.projectevil.it';
  const tags = [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="EVIL">',
    `<meta property="og:locale" content="${OG_LOCALE[lang] || OG_LOCALE.it}">`,
    ...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`),
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

/**
 * Un solo script defer per menu e stato utente. La classe evil-auth-pending va su <html>
 * dal server (prima era uno <script> inline per pagina, che obbligava la CSP a 'unsafe-inline');
 * la regola che nasconde i pulsanti finché la sessione non è nota è in site-header.css.
 */
function injectAuthChromeScripts(html) {
  if (!/<header[\s>]/i.test(html) || !html.includes('</head>')) return html;
  const stripRe =
    /\s*<script[^>]*src="[^"]*(?:auth-manager|load-header|evil-site-chrome)\.js[^"]*"[^>]*>\s*<\/script>\s*/gi;
  let out = html.replace(stripRe, '\n');
  out = out.replace(/<style id="evil-auth-pending-style">[\s\S]*?<\/style>\s*/gi, '');
  out = out.replace(/\s*<script>document\.documentElement\.classList\.add\("evil-auth-pending"\);<\/script>/g, '');
  out = out.replace(/<html\b([^>]*)>/i, (m, attrs) => {
    if (/class="/.test(attrs)) return m.replace(/class="/, 'class="evil-auth-pending ');
    return `<html${attrs} class="evil-auth-pending">`;
  });
  return out.replace('</head>', `  <script src="/js/evil-site-chrome.js" defer></script>\n</head>`);
}

/** Link menu sempre dalla root (/pagina.html) — evita doppio caricamento da path /html/ misti */
function normalizeSiteNavLinks(html) {
  return html.replace(/href="([a-z][a-z0-9-]*\.html)"/gi, (match, file) => `href="/${file}"`);
}

// In produzione i file non cambiano mentre il server gira: la pagina elaborata si tiene
// in memoria. In sviluppo si rielabora a ogni richiesta, così le modifiche si vedono subito.
const renderedPages = new Map();

// Pagine di sviluppo: mai in produzione
const DEV_ONLY_PAGE = /-local\.html$/i;

function fillChrome(html, lang, file) {
  return html
    .replace(/<!--evil:header-->/, () => renderHeader(lang, file))
    .replace(/<!--evil:footer-->/, () => renderFooter(lang, file));
}

// ------------------------------------------------------------------ numeri nelle pagine
// <span data-stat="labs">17</span> → il numero vero calcolato dai file di dati (server/stats.js).
// "area:<id>" conta le pagine del menù di un'area, "area:<id>:all" tutte le pagine dell'area.
let statsCache = null;
function siteStats() {
  if (statsCache) return statsCache;
  const out = {};
  try {
    Object.assign(out, computeStats());
  } catch (_) {
    /* senza numeri le pagine mostrano i valori scritti nell'HTML */
  }
  for (const p of PAGES) {
    out[`area:${p.area}:all`] = (out[`area:${p.area}:all`] || 0) + 1;
    if (p.nav) out[`area:${p.area}`] = (out[`area:${p.area}`] || 0) + 1;
  }
  statsCache = out;
  return out;
}

function fillStats(html) {
  if (!html.includes('data-stat=')) return html;
  const stats = siteStats();
  return html.replace(/(<([a-z0-9]+)\b[^>]*\sdata-stat="([\w:]+)"[^>]*>)([^<]*)(<\/\2>)/gi, (m, open, tag, key, text, close) => {
    const v = stats[key];
    return Number.isFinite(v) ? `${open}${v}${close}` : m;
  });
}

function renderPage(relativeName, canonicalPath, lang = DEFAULT_LANG) {
  if (isProduction() && DEV_ONLY_PAGE.test(relativeName)) return null;
  const filePath = path.join(root, 'html', relativeName);
  const key = `${lang}|${relativeName}|${canonicalPath ?? ''}`;
  if (isProduction() && renderedPages.has(key)) return renderedPages.get(key);
  if (!fs.existsSync(filePath)) return null;
  let html = fillChrome(fs.readFileSync(filePath, 'utf8'), lang, relativeName);
  if (lang !== DEFAULT_LANG) {
    const out = i18n.translateHtml(html, lang, relativeName);
    html = out.html;
    if (isDevelopment() && out.missing.length) {
      console.warn(`⚠️ i18n ${lang}/${relativeName}: ${out.missing.length} testi senza traduzione (npm run i18n:check)`);
    }
  }
  html = fillStats(html);
  html = injectPageAssets(html, canonicalPath ?? relativeName, lang);
  if (isProduction()) renderedPages.set(key, html);
  return html;
}

function sendInjectedHtml(res, relativeName, canonicalPath, lang = DEFAULT_LANG) {
  const html = renderPage(relativeName, canonicalPath, lang);
  if (html == null) return false;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Language', lang);
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

const HTML_PAGES = () => new Set(fs.readdirSync(path.join(root, 'html')).filter((f) => f.endsWith('.html')));

/** Nella versione inglese i link alle pagine del sito puntano a /en/… */
function localizeLinks(html, lang) {
  if (lang === DEFAULT_LANG) return html;
  const pages = HTML_PAGES();
  return html
    .replace(/\bhref="\/([a-z0-9-]+\.html)((?:[?#][^"]*)?)"/gi, (m, file, rest) =>
      pages.has(file) && !DEV_ONLY_PAGE.test(file) ? `href="/${lang}/${file}${rest}"` : m)
    .replace(/\bhref="\/((?:[?#][^"]*)?)"/g, (m, rest) => `href="/${lang}/${rest}"`);
}

/** Nella versione inglese i file di dati (quiz, catalogo…) hanno una copia in js/i18n/<lang>/ */
function localizeDataScripts(html, lang) {
  if (lang === DEFAULT_LANG) return html;
  return html.replace(/(<script[^>]*\ssrc=")\/js\/([a-z0-9-]+\.js)((?:\?[^"]*)?")/gi, (m, pre, file, rest) =>
    fs.existsSync(path.join(root, 'js', 'i18n', lang, file)) ? `${pre}/js/i18n/${lang}/${file}${rest}` : m);
}

/** Lingua del documento, traduzioni per il JS e ricerca rapida. */
function injectI18nRuntime(html, lang) {
  let out = html.replace(/<html\b([^>]*)>/i, (m, attrs) =>
    /\blang="/i.test(attrs) ? m.replace(/\blang="[^"]*"/i, `lang="${lang}"`) : `<html lang="${lang}"${attrs}>`);
  if (out.includes('/js/i18n.js')) return out;
  const scripts = [];
  if (lang !== DEFAULT_LANG) scripts.push(`<script src="/js/i18n/${lang}.js"></script>`);
  scripts.push('<script src="/js/i18n.js"></script>');
  if (/<header[\s>]/i.test(out)) {
    scripts.push('<script src="/js/site-pages.js" defer></script>', '<script src="/js/site-search.js" defer></script>');
  }
  // prima di qualunque altro script della pagina
  const headEnd = out.indexOf('</head>');
  const firstScript = out.search(/<script\b/i);
  const block = scripts.join('\n  ');
  if (firstScript !== -1 && firstScript < headEnd) return `${out.slice(0, firstScript)}${block}\n  ${out.slice(firstScript)}`;
  return out.replace('</head>', `  ${block}\n</head>`);
}

function injectAlternates(html, pagePath, origin, lang) {
  if (!origin) return html;
  const file = pagePath === '/' ? 'home.html' : pagePath.replace(/^\//, '');
  const links = [
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${origin}${localizedPath(file, l)}">`),
    `<link rel="alternate" hreflang="x-default" href="${origin}${localizedPath(file, DEFAULT_LANG)}">`,
  ];
  return html.replace('</head>', `${links.map((l) => `  ${l}`).join('\n')}\n</head>`);
}

function injectPageAssets(htmlContent, pageName, lang = DEFAULT_LANG) {
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
        // accetta /css/, css/ e ../css/ (i ../css/ sono già diventati /css/ qui sopra)
        /<link rel="stylesheet" href="(?:\/|\.\.\/|\/\.\.\/)?css\/style\.css[^"]*">/,
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
  html = localizeLinks(html, lang);
  html = localizeDataScripts(html, lang);
  html = injectI18nRuntime(html, lang);
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
  const langPath = lang === DEFAULT_LANG ? pagePath : `/${lang}${pagePath}`;
  if (canonical && !html.includes('rel="canonical"')) {
    html = html.replace(
      '</head>',
      `  <link rel="canonical" href="${canonical}${langPath}">\n</head>`
    );
  }
  html = injectAlternates(html, pagePath, canonical, lang);
  html = injectSocialMeta(html, langPath, canonical, lang);
  html = injectIcons(html);

  // I meta http-equiv sulla cache non servono (decidono gli header HTTP) e confondono
  html = html.replace(/\s*<meta http-equiv="(?:Cache-Control|Pragma|Expires)"[^>]*>/gi, '');

  return versionAssetUrls(html);
}


/** File generati per il browser: dizionari delle traduzioni e mappa del sito con i numeri. */
function writeGeneratedClientFiles() {
  try {
    i18n.buildClientDicts();
  } catch (err) {
    console.warn('⚠️ i18n: dizionari per il browser non generati:', err.message);
  }
  try {
    statsCache = null; // ricalcolato a ogni avvio del server
    const manifest = clientManifest(siteStats());
    const body = `/* Generato da server/pages.js: non modificare a mano (server/site-map.js) */\nwindow.EVIL_SITE = ${JSON.stringify(manifest)};\n`;
    const file = path.join(root, 'js', 'site-pages.js');
    let prev = null;
    try {
      prev = fs.readFileSync(file, 'utf8');
    } catch (_) { /* nuovo */ }
    if (prev !== body) fs.writeFileSync(file, body);
  } catch (err) {
    console.warn('⚠️ js/site-pages.js non generato:', err.message);
  }
}

function mountStatic(app) {
  syncAchievementsToHtml();
  writeGeneratedClientFiles();

  // Il codice del server non va servito come file statico (js/server.js è l'avvio)
  app.get(['/js/server.js', '/js/server.js.map'], (req, res) => res.status(404).end());

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
    if (rel === 'home.html') return res.redirect(301, '/');
    if (!sendInjectedHtml(res, rel)) return next();
  });

  // Versioni nelle altre lingue: /en/ e /en/pagina.html
  for (const lang of LANGS.filter((l) => l !== DEFAULT_LANG)) {
    // /en senza barra → /en/ (con il routing non stretto di Express '/en' prenderebbe anche '/en/')
    app.get(new RegExp(`^/${lang}$`), (req, res, next) => (req.originalUrl.split('?')[0] === `/${lang}` ? res.redirect(301, `/${lang}/`) : next()));
    app.get(`/${lang}/`, (req, res, next) => {
      if (!sendInjectedHtml(res, 'home.html', '', lang)) return next();
    });
    app.get(new RegExp(`^/${lang}/([a-z0-9-]+\\.html)$`, 'i'), (req, res, next) => {
      const rel = req.params[0];
      if (rel === 'home.html') return res.redirect(301, `/${lang}/`);
      if (!sendInjectedHtml(res, rel, undefined, lang)) return next();
    });
  }

  // Le pagine HTML si servono solo dalle route sopra (con header, traduzioni e asset):
  // /html/ resta per gli altri file (achievements.json, componenti)
  app.use('/html', (req, res, next) => {
    if (/\.html$/i.test(req.path) && isProduction()) return res.status(404).end();
    next();
  }, express.static(path.join(root, 'html'), staticOptions()));
}

function mountPageRoutes(app) {
  // Route per la homepage (root)
  app.get('/', (req, res) => {
    if (!sendInjectedHtml(res, 'home.html', '')) res.status(404).send('Home page not found');
  });

  // La pagina "Tecniche di manipolazione" parlava di persistenza ed evasione: ora ha il nome giusto
  app.get(['/manipulation-techniques.html', '/html/manipulation-techniques.html'], (req, res) => {
    res.redirect(301, '/persistence-evasion.html');
  });
  app.get('/en/manipulation-techniques.html', (req, res) => res.redirect(301, '/en/persistence-evasion.html'));

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
  writeGeneratedClientFiles,
  renderPage,
  buildSitemap,
  mountStatic,
  mountPageRoutes,
  resolveAchievementsFile,
  injectPageAssets,
  versionAssetUrls,
  fileVersion,
  root,
};
