'use strict';
// Static, pagine HTML e iniezione asset (estratto da js/server.js)
const fs = require('fs');
const path = require('path');
const express = require('express');
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

const HOME_CSS_VERSION = '20260603';
const HOME_STYLESHEETS = [
  `/css/home.css?v=${HOME_CSS_VERSION}`,
  `/css/home.bundle.css?v=${HOME_CSS_VERSION}`,
  `/css/home-footer.css?v=${HOME_CSS_VERSION}`
];

const SITE_FOOTER_CSS = '/css/site-footer.css?v=20260606';
const SITE_HEADER_CSS = '/css/site-header.css?v=20260619';
const SYSTEM_THEME_CSS = '/css/system-theme.css?v=20260717';
const EVIL_SCROLLBAR_CSS = '/css/evil-scrollbar.css?v=20260717';
const RESPONSIVE_CSS = '/css/responsive.css?v=20260717';
const EVIL_MOTION_CSS = '/css/evil-motion.css?v=20260626';
const EVIL_MOTION_JS = '/js/evil-motion.js?v=20260626';

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

function sendInjectedHtml(res, relativeName) {
  const filePath = path.join(root, 'html', relativeName);
  if (!fs.existsSync(filePath)) return false;
  const htmlContent = injectPageAssets(fs.readFileSync(filePath, 'utf8'), relativeName);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(htmlContent);
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

  const canonical = getCanonicalOrigin();
  if (canonical && !html.includes('rel="canonical"')) {
    html = html.replace(
      '</head>',
      `  <link rel="canonical" href="${canonical}">\n</head>`
    );
  }

  return html;
}


function mountStatic(app) {
  syncAchievementsToHtml();

  // controlli solo in sviluppo, possono essere rimossi in produzione
  if (process.env.NODE_ENV !== 'production') {
    checkStaticExists(path.join(root, 'css'));
    checkStaticExists(path.join(root, 'js'));
    checkStaticExists(path.join(root, 'assets'));
    checkStaticExists(path.join(root, 'public'));
    checkStaticExists(path.join(root, 'html'));
  }

  app.use('/css', express.static(path.join(root, 'css'), {
    maxAge: process.env.NODE_ENV === 'production' ? '30d' : 0,
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      const base = filePath.replace(/\\/g, '/');
      const alwaysFresh = /virtual-lab|web-simulator|crypto-studio|quiz-hub|hacked-timeline|attacks-map|historic-attacks|malware-db|malware-classification|manipulation-techniques|security-check|http-header-audit|tools-hub/i.test(base);
      const devFresh =
        process.env.NODE_ENV !== 'production' &&
        /(home(\.bundle|\.css|-footer|-hero|-unified|-motion)?|site-footer|site-header|evil-motion)\.css$/i.test(base);
      if (alwaysFresh || devFresh) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));

  // Alias typo comune (browser/cache): home-chrome.css → bundle reale
  app.get('/css/home-chrome.css', (req, res) => {
    res.redirect(302, `/css/home.bundle.css?v=${HOME_CSS_VERSION}`);
  });

  // matrixrain.js: no long cache (easter egg aggiornato spesso)
  app.get('/js/matrixrain.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(root, 'js', 'matrixrain.js'));
  });

  const LAB_JS_NO_CACHE = /^(virtual-lab(-guides)?|crypto-studio|quiz-hub(-data)?(-extra)?|hacked-timeline(-data)?|attacks-map|historic-attacks(-data)?|malware-db(-data)?|malware-classification(-data)?|manipulation-techniques(-data)?|security-check|http-header-audit|tools-api|url-scanner-service|http-header-audit-service|load-header|auth-manager|evil-site-chrome)\.js$/i;
  app.use('/js', express.static(path.join(root, 'js'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (LAB_JS_NO_CACHE.test(path.basename(filePath))) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));
  app.use('/assets', express.static(path.join(root, 'assets'), {
    maxAge: '30d', // Cache assets for 30 days
    etag: true,
    lastModified: true
  }));

  // Easter egg: aprendo /public/generated-image.png nel browser (non come <img>) → animazione
  app.get('/public/generated-image.png', (req, res, next) => {
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      return res.sendFile(path.join(root, 'html', 'logo-easter-egg.html'));
    }
    next();
  });

  app.use('/public', express.static(path.join(root, 'public'), {
    maxAge: '30d', // Cache public files for 30 days
    etag: true,
    lastModified: true
  }));

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

  app.use('/html', express.static(path.join(root, 'html'))); // asset non-html + fallback
}

function mountPageRoutes(app) {
  // Route per la homepage (root)
  app.get('/', (req, res) => {
    const filePath = path.join(root, 'html', 'home.html');
    if (fs.existsSync(filePath)) {
      let htmlContent = injectPageAssets(fs.readFileSync(filePath, 'utf8'));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(htmlContent);
    }
    res.status(404).send('Home page not found');
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
  root,
};
