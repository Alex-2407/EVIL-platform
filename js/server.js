// ==================== ENVIRONMENT & SECURITY ====================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dns = require('dns').promises;
const { lookup } = require('dns');
const net = require('net');
const tls = require('tls');
const https = require('https');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');
const { promisify } = require('util');
const compression = require('compression'); // Added for gzip compression
const cookieParser = require('cookie-parser');

const execFileAsync = promisify(execFile);
const { runUrlScan } = require('./url-scanner-service');
const { runHttpHeaderAudit } = require('./http-header-audit-service');
const { runDnsEnumeration } = require('./dns-enumerator-service');
const { runWhoisLookup } = require('./whois-service');
const { runSubdomainFinder } = require('./subdomain-finder-service');
const { runSslAnalysis } = require('./ssl-analyzer-service');
const { runFileScan } = require('./file-scanner-service');
const { runSocialProfiling } = require('./social-profiling-service');
const { runPublicInfoPersonSearch, runPublicInfoDomainSearch } = require('./public-info-service');
const { runPublicInfoRegistrySearch, runPublicInfoPersonDetail } = require('./public-info-registry-service');
const { scanUpload, handleScanUploadError } = require('../middleware/file-scanner-upload');

const {
  setTokenCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie
} = require('../utils/token-utils');

// Import middleware e services
const { 
  authenticateToken,
  optionalAuthenticate,
  authenticateTools,
  validateRegister,
  validateLogin,
  hashPassword,
  verifyPassword,
  validatePasswordStrength
} = require('../middleware/auth');

const { 
  validateSchema,
  scanSchema,
  osintSearchSchema,
  dnsEnumSchema,
  registerSchema,
  loginSchema
} = require('../middleware/validation-schemas');

const {
  sanitizeString,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeFilename,
  assertSafePublicUrl,
} = require('../middleware/sanitization');
const { upload: multerUpload, handleUploadError } = require('../middleware/upload');
const { 
  globalLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  refreshTokenLimiter,
  scanLimiter,
  dnsLimiter,
  uploadLimiter,
  incidentsPublicLimiter,
  virtualLabSessionLimiter,
  virtualLabLimiter,
} = require('../middleware/limiter');

const tokenManager = require('../services/token-manager');
const emailService = require('../services/email-service');
const incidentsService = require('../services/incidents-service');
const virtualLabService = require('../services/virtual-lab-service');
const securityHeaders = require('../middleware/security-headers');
const {
  httpsRedirectMiddleware,
  shouldEnforceHttps,
  getCanonicalOrigin,
} = require('../middleware/https-enforce');
const { logger, auditLog, httpLogger } = require('../middleware/logger');

const app = express();

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const weakPatterns = ['your_super_secret', 'change_this', 'minimum_32', 'example'];
  const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_REFRESH].filter(Boolean);

  for (const secret of secrets) {
    if (secret.length < 32 || weakPatterns.some((p) => secret.includes(p))) {
      console.error('❌ CRITICAL: JWT secrets must be 32+ chars and unique in production');
      process.exit(1);
    }
  }

  if (!process.env.BASE_URL || !/^https:\/\//i.test(process.env.BASE_URL)) {
    console.warn('⚠️ BASE_URL should be https://your-domain in production');
  }

  if (process.env.EMAIL_DEV_OUTBOX === '1') {
    console.warn('⚠️ EMAIL_DEV_OUTBOX=1 in production — emails will not reach users');
  }

  if (process.env.EVIL_TOOLS_PUBLIC === '1' || process.env.EVIL_TOOLS_PUBLIC === 'true') {
    console.warn('⚠️ EVIL_TOOLS_PUBLIC enabled in production — scan/OSINT APIs are open to guests');
  }

  if (!process.env.REDIS_URL) {
    console.warn('⚠️ REDIS_URL not set — refresh tokens and rate limits are per-process only');
  }
}

validateProductionEnvironment();

// Health checks (Railway/Render/load balancer)
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'evil-platform',
    env: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Dietro nginx/Cloudflare in produzione: IP reale per rate limit e sessioni lab
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ==================== UTILITY FUNCTIONS ====================
// Funzione per richieste HTTP con retry e backoff esponenziale
async function fetchWithRetries(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 5000,
        headers: options.headers || {},
        params: options.params || {},
        validateStatus: () => true
      });

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const baseDelay = 500; // 500ms base
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 1000; // Up to 1 second jitter
        const delay = exponentialDelay + jitter;

        logger.debug(`Retry attempt ${attempt + 1} for ${url} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ==================== COMPRESSION MIDDLEWARE ====================
// Enable gzip compression for all responses > 1KB
app.use(compression({
  level: 6, // Good balance between speed and compression
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  }
}));
// HTTP → HTTPS + host canonico (BASE_URL); vedi middleware/https-enforce.js
app.use(httpsRedirectMiddleware);
// CRITICO: questi middleware devono essere registrati **prima** di qualunque
// altro routing o security headers, così Express può rispondere con i file
// statici invece di cadere in un handler 404 generico.
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

syncAchievementsToHtml();

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

const LAB_JS_NO_CACHE = /^(virtual-lab(-guides)?|crypto-studio|quiz-hub(-data)?(-extra)?|hacked-timeline(-data)?|attacks-map|historic-attacks(-data)?|malware-db(-data)?|malware-classification(-data)?|manipulation-techniques(-data)?|security-check|http-header-audit|tools-api|url-scanner-service|http-header-audit-service)\.js$/i;
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
  const filePath = path.join(root, 'html', rel);
  if (!fs.existsSync(filePath)) return next();
  const htmlContent = injectPageAssets(fs.readFileSync(filePath, 'utf8'));
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(htmlContent);
});

app.use('/html', express.static(path.join(root, 'html'))); // asset non-html + fallback

// ==================== APPLY SECURITY HEADERS ====================
securityHeaders(app);

// ==================== APPLY RATE LIMITING ====================
// Rate limit NON si applica ai file statici e HTML, solo alle API /api/*
app.use((req, res, next) => {
  const path = req.path.toLowerCase();
  // skip rate limit per:
  // - pagine HTML (root, .html files)
  // - file statici (css, js, immagini, assets, fonts, public)
  const isStaticFile = path === '/' || 
    path.endsWith('.html') || 
    path.endsWith('.css') || 
    path.endsWith('.js') ||
    path.endsWith('.png') || 
    path.endsWith('.jpg') || 
    path.endsWith('.jpeg') ||
    path.endsWith('.gif') || 
    path.endsWith('.svg') || 
    path.endsWith('.ico') ||
    path.endsWith('.woff') || 
    path.endsWith('.woff2') || 
    path.endsWith('.ttf') ||
    path.startsWith('/css') || 
    path.startsWith('/js') || 
    path.startsWith('/assets') || 
    path.startsWith('/public') ||
    path.startsWith('/fonts') ||
    path.startsWith('/images');
  
  if (isStaticFile) {
    return next(); // bypass rate limit per file statici
  }
  if (path.startsWith('/api/health')) {
    return next();
  }
  // applica rate limit solo alle API
  globalLimiter(req, res, next);
});

// ==================== APPLY LOGGING MIDDLEWARE ====================
app.use(httpLogger);

// ==================== CORS SICURO - DEPLOYMENT AWARE ====================
const isDev = process.env.NODE_ENV !== 'production';

// route di debugging: mostra l'albero dei file dall'interno del container
// utile su Render per verificare quali asset sono stati effettivamente copiati
if (isDev) {
  app.get('/__debug/files', (req, res) => {
    try {
      const walk = (dir) => {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          const full = path.join(dir, file);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            results = results.concat(walk(full));
          } else {
            results.push(path.relative(root, full));
          }
        });
        return results;
      };
      res.json({ cwd: process.cwd(), root, files: walk(root) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

function getAllowedCorsOrigins() {
  const defaultOrigins =
    'https://www.projectevil.it,https://projectevil.it,http://localhost:5000,http://127.0.0.1:5000';
  const origins = new Set(
    (process.env.CORS_ORIGINS || defaultOrigins)
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  );

  for (const raw of [process.env.BASE_URL, process.env.RENDER_EXTERNAL_URL]) {
    if (!raw || !String(raw).trim()) continue;
    try {
      const normalized = String(raw).trim().replace(/\/$/, '');
      const withScheme = /^https?:\/\//i.test(normalized)
        ? normalized
        : `https://${normalized}`;
      origins.add(new URL(withScheme).origin);
    } catch (_) {
      /* ignore malformed URL */
    }
  }

  return origins;
}

function isCorsOriginAllowed(origin, req) {
  if (isDev) return true;
  if (!origin) return true;

  const allowed = getAllowedCorsOrigins();
  if (allowed.has('*') || allowed.has(origin)) return true;

  try {
    const originHost = new URL(origin).host;
    const requestHost = req.get('host');
    if (originHost && requestHost && originHost === requestHost) {
      return true;
    }
  } catch (_) {
    /* ignore */
  }

  return false;
}

app.use((req, res, next) => {
  cors({
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, req)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked', { origin, host: req.get('host') });
        callback(new Error('CORS non consentito: ' + origin));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })(req, res, next);
});
app.use(cookieParser());
app.use(express.json());

/** Set httpOnly auth cookies and persist refresh token in Redis */
async function establishAuthSession(res, user) {
  const tokens = setTokenCookies(res, user.id, user.email);
  await tokenManager.storeRefreshToken(user.id, tokens.refreshToken);
  return tokens;
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

function hasLoadHeaderJs(html) {
  return /load-header\.js/i.test(html);
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

function injectPageAssets(htmlContent) {
  if (!htmlContent.includes('</head>')) return htmlContent;
  let html = htmlContent;

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

  if (!hasLoadHeaderJs(html) && /<header[\s>]/i.test(html)) {
    html = html.replace('</head>', '<script src="/js/load-header.js" defer></script>\n</head>');
  }

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

// Route personalizzata per i file HTML - header unificato + CSS responsive
app.get('*.html', (req, res, next) => {
  const filePath = path.join(root, 'html', req.path);

  if (fs.existsSync(filePath) && filePath.endsWith('.html')) {
    const htmlContent = injectPageAssets(fs.readFileSync(filePath, 'utf8'));
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (/virtual-lab|web-simulator|crypto-studio|quiz-hub|hacked-timeline|attacks-map|historic-attacks|malware-db|malware-classification|manipulation-techniques/i.test(req.path)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    return res.send(htmlContent);
  }

  next();
});

const PORT = process.env.PORT || 5000;

// ==================== JWT CONFIGURATION ====================
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.error('❌ CRITICAL: JWT_SECRET not configured in .env');
  console.error('Run: node scripts/generate-secrets.js');
  process.exit(1);
})();

const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH || (() => {
  console.error('❌ CRITICAL: JWT_SECRET_REFRESH not configured in .env');
  console.error('Run: node scripts/generate-secrets.js');
  process.exit(1);
})();

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// ==================== FILE UPLOAD CONFIGURATION ====================
// NOTE: File upload configuration now handled by middleware/upload.js
// This ensures MIME type whitelist, UUID naming, and user isolation
// Old hardcoded multer config below is superseded:

// OLD CONFIG (SUPERSEDED - DO NOT USE):
// const storage = multer.diskStorage({ ... })
// const upload = multer({ storage, limits, fileFilter })

// NEW CONFIG: Uses middleware/upload.js with security hardening
// See: middleware/upload.js for MIME whitelist, UUID generation, user isolation

// Database utenti — cartella scrivibile (Render: imposta DATA_DIR)
function ensureDataDir() {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(root, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const dataDir = ensureDataDir();

function resolveUsersFile() {
  const custom = (process.env.DB_FILE || '').trim();
  if (custom) {
    const resolved = path.isAbsolute(custom) ? custom : path.join(root, custom);
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    return resolved;
  }
  return path.join(dataDir, 'users.json');
}

const usersFile = resolveUsersFile();
const legacyUsersFile = path.join(root, 'users.json');
let users = [];

// Cache file per persistenza incidenti fra riavvii
const cacheFile = path.join(root, '.incidents-cache.json');

// Carica cache dal disco se esiste
function loadIncidentsCacheFromDisk() {
  try {
    if (fs.existsSync(cacheFile)) {
      const data = fs.readFileSync(cacheFile, 'utf8');
      const cached = JSON.parse(data);
      console.log('💾 Cache incidenti caricata dal disco:', cached.lastUpdate);
      return cached;
    }
  } catch (err) {
    console.warn('⚠️ Errore caricamento cache dal disco:', err.message);
  }
  return null;
}

// Salva cache su disco
function saveIncidentsCacheToDisk(cache) {
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn('⚠️ Errore salvataggio cache su disco:', err.message);
  }
}

// Carica utenti dal file
function loadUsers() {
  try {
    if (!fs.existsSync(usersFile) && fs.existsSync(legacyUsersFile)) {
      fs.copyFileSync(legacyUsersFile, usersFile);
      console.log('📁 Utenti migrati da users.json root →', usersFile);
    }
    if (fs.existsSync(usersFile)) {
      const data = fs.readFileSync(usersFile, 'utf8');
      users = JSON.parse(data);
    }
  } catch (err) {
    console.error('Errore caricamento utenti:', err.message);
    users = [];
  }
}

// Salva utenti nel file
function saveUsers() {
  try {
    ensureDataDir();
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    return true;
  } catch (err) {
    console.error('Errore salvataggio utenti:', err.message, usersFile);
    return false;
  }
}

// Carica utenti all'avvio
loadUsers();

// Database ASN
const asnDatabase = {
  'AS13335': { name: 'CLOUDFLARENET', country: 'US', type: 'CDN' },
  'AS16509': { name: 'AMAZON-02', country: 'US', type: 'Cloud' },
  'AS8453': { name: 'GOOGLECLOUD', country: 'US', type: 'Cloud' },
  'AS3352': { name: 'TELEFONICA', country: 'ES', type: 'ISP' },
  'AS15169': { name: 'GOOGLE', country: 'US', type: 'Tech' },
};

// Threat DB
const threatDatabase = {
  'phishing-domain.xyz': { threat: 'phishing', score: 15 },
  'malware-host.net': { threat: 'malware', score: 10 },
  'scam-site.ru': { threat: 'scam', score: 20 },
};

// Risoluzione DNS IPv4 (fallback IPv6)
async function resolveDomain(domain) {
  try {
    const { address } = await dns.lookup(domain, { family: 4 });
    return address;
  } catch {
    const { address } = await dns.lookup(domain, { family: 6 });
    return address;
  }
}

// Estrae campi utili da output WHOIS
function parseWhoisOutput(raw) {
  const fields = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!val || key.startsWith('%')) continue;
    if (fields[key]) {
      fields[key] = Array.isArray(fields[key]) ? [...fields[key], val] : [fields[key], val];
    } else {
      fields[key] = val;
    }
  }
  return {
    fields,
    preview: lines.filter(l => l.trim() && !l.startsWith('%')).slice(0, 35).join('\n')
  };
}

// Simula ASN lookup (in produzione userebbe MaxMind/IPinfo)
function getAsn(ip) {
  const octets = ip.split('.').map(Number);
  const sum = octets.reduce((a, b) => a + b, 0);
  const asnIndex = sum % Object.keys(asnDatabase).length;
  return Object.keys(asnDatabase)[asnIndex];
}

// Estrai certificato SSL
function getCertificate(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect(443, domain, { rejectUnauthorized: false }, function() {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      const sans = cert.subjectaltname
        ? cert.subjectaltname.split(',').map(s => s.trim().replace(/^DNS:/i, ''))
        : [];
      resolve({
        subject: cert.subject,
        issuer: cert.issuer,
        valid_from: cert.valid_from,
        valid_to: cert.valid_to,
        fingerprint: cert.fingerprint,
        fingerprint256: cert.fingerprint256 || null,
        serialNumber: cert.serialNumber || null,
        subjectaltname: sans,
        bits: cert.bits || null,
        sigalg: cert.sigalg || null,
        status: 'Valid'
      });
    });

    socket.on('error', (err) => {
      resolve({ error: err.message, status: 'Failed' });
    });

    setTimeout(() => {
      socket.destroy();
      resolve({ error: 'Timeout', status: 'Failed' });
    }, 5000);
  });
}

// Estrai HTTP headers
async function getHttpHeaders(url) {
  try {
    const response = await axios.head(url, { 
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: () => true 
    });
    
    return {
      status: response.status,
      server: response.headers['server'] || 'Unknown',
      csp: response.headers['content-security-policy'] ? 'Present' : 'Missing',
      hsts: response.headers['strict-transport-security'] ? 'Present' : 'Missing',
      xfo: response.headers['x-frame-options'] ? 'Present' : 'Missing',
      xss: response.headers['x-xss-protection'] ? 'Present' : 'Missing',
      contentType: response.headers['content-type'] || 'Unknown',
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Traccia redirect chain
async function getRedirectChain(url) {
  const redirects = [];
  let currentUrl = url;
  let maxRedirects = 5;

  try {
    while (maxRedirects > 0) {
      const response = await axios.head(currentUrl, {
        timeout: 5000,
        maxRedirects: 0,
        validateStatus: () => true
      });

      redirects.push({
        url: currentUrl,
        status: response.status,
        type: [301, 302, 303, 307, 308].includes(response.status) ? 'redirect' : 'final'
      });

      if (response.headers.location) {
        currentUrl = new URL(response.headers.location, currentUrl).toString();
        maxRedirects--;
      } else {
        break;
      }
    }
  } catch (err) {
    redirects.push({ url: currentUrl, error: err.message });
  }

  return redirects;
}

// Verifica threat intelligence
function checkThreat(domain) {
  for (const [threatDomain, data] of Object.entries(threatDatabase)) {
    if (domain.toLowerCase().includes(threatDomain.toLowerCase())) {
      return data;
    }
  }
  return null;
}

// Endpoint principale
// URL SECURITY CHECK SCAN
app.post('/api/scan', 
  authenticateTools,
  scanLimiter,
  body('url')
    .trim()
    .notEmpty().withMessage('URL required')
    .isURL().withMessage('Invalid URL format'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      auditLog.security('SCAN_VALIDATION_FAILED', { userId: req.user.id, errors: errors.array() }, 'WARN');
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    next();
  },
  async (req, res) => {
    const { url } = req.body;

    // Sanitize and validate URL
    const sanitizedUrl = sanitizeUrl(url);
    if (!sanitizedUrl) {
      auditLog.security('SCAN_INVALID_URL', { userId: req.user.id, originalUrl: url }, 'WARN');
      return res.status(400).json({
        error: 'Invalid or dangerous URL format',
        status: 'error'
      });
    }

    let fullUrl = sanitizedUrl;
    let domain, hasSSL;

    try {
      const parsed = new URL(fullUrl);
      domain = parsed.hostname;
      hasSSL = parsed.protocol === 'https:';

      // Additional domain validation
      if (!domain || domain.length > 253) {
        throw new Error('Invalid domain length');
      }

      await assertSafePublicUrl(fullUrl);
    } catch (err) {
      auditLog.security('SCAN_INVALID_DOMAIN', {
        userId: req.user.id,
        url: fullUrl,
        error: err.message
      }, 'WARN');
      return res.status(400).json({
        error: 'Invalid domain in URL',
        status: 'error'
      });
    }

    // Set timeout for the entire scan operation
    const scanTimeout = setTimeout(() => {
      logger.warn('Scan timeout', { userId: req.user.id, domain });
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Scan timeout - operation took too long',
          status: 'timeout',
          domain
        });
      }
    }, 45000);

    try {
      const scanResult = await Promise.race([
        runUrlScan(fullUrl, domain, hasSSL),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Scan timeout')), 40000)
        )
      ]);

      scanResult.userId = req.user.id;
      clearTimeout(scanTimeout);

      const user = users.find(u => u.id === req.user.id);
      if (user) {
        user.progress.scans = (user.progress.scans || 0) + 1;
        saveUsers();
      }

      auditLog.security('SCAN_COMPLETED', { userId: req.user.id, domain, grade: scanResult.grade }, 'INFO');
      res.json(scanResult);

    } catch (err) {
      // Clear timeout
      clearTimeout(scanTimeout);

      logger.error('Scan error', {
        error: err.message,
        userId: req.user.id,
        domain,
        stack: err.stack
      });

      // Determine appropriate error response based on error type
      let statusCode = 500;
      let errorMessage = 'Scan failed due to internal error';

      if (err.message.includes('timeout')) {
        statusCode = 408;
        errorMessage = 'Scan timeout - please try again';
      } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
        statusCode = 400;
        errorMessage = 'Domain not found or unreachable';
      } else if (err.message.includes('ECONNREFUSED')) {
        statusCode = 400;
        errorMessage = 'Connection refused by target';
      }

      if (!res.headersSent) {
        res.status(statusCode).json({
          domain,
          url: fullUrl,
          error: errorMessage,
          status: 'error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
);

// ========================
// ENDPOINT DNS ENUMERATOR
// ========================
app.post('/api/dns-enum', authenticateTools, dnsLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const result = await runDnsEnumeration(domain);
    res.json(result);
  } catch (err) {
    const status = /non valido/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message, status: 'error', domain });
  }
});

// ========================
// ENDPOINT WHOIS LOOKUP
// ========================
app.post('/api/whois', authenticateTools, dnsLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const result = await runWhoisLookup(domain);
    if (result.status === 'failed') {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (err) {
    const status = /non valido/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT SUBDOMAIN FINDER
// ========================
app.post('/api/subdomain-finder', authenticateTools, dnsLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const result = await runSubdomainFinder(domain);
    res.json(result);
  } catch (err) {
    const status = /non valido/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT SSL CERTIFICATE ANALYZER
// ========================
app.post('/api/ssl-analyzer', authenticateTools, scanLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const result = await runSslAnalysis(domain);
    if (result.status === 'failed') {
      return res.status(502).json(result);
    }
    res.json(result);
  } catch (err) {
    const status = /non valido/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT HTTP HEADER AUDIT (ex vulnerability-scan)
// ========================
app.post('/api/vulnerability-scan', authenticateTools, scanLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  try {
    const result = await Promise.race([
      runHttpHeaderAudit(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Audit timeout')), 20000)
      )
    ]);
    res.json(result);
  } catch (err) {
    const status = err.message.includes('timeout') ? 408 : err.message.includes('Invalid URL') ? 400 : 500;
    res.status(status).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT REALTIME INCIDENTS (LIVE PUBLIC DATA)
// ========================
// Educational threat intelligence aggregation from verified public sources
// Data from NIST NVD, CISA, and official government cybersecurity agencies

// Carica cache iniziale dal disco o inizializza vuota
let incidentsCache = loadIncidentsCacheFromDisk() || {
  incidents: [],
  lastUpdate: null
};

function buildIncidentsApiResponse(cache) {
  const payload = cache || incidentsCache || { incidents: [] };
  return {
    status: 'success',
    timestamp: payload.lastUpdate || new Date().toISOString(),
    source: payload.source || 'Public Threat Intelligence',
    data_mode: payload.data_mode || 'cache',
    update_frequency: payload.update_frequency || 'Every 5 minutes',
    data_classification: 'Public Vulnerability & Advisory Intelligence',
    total_incidents: payload.total_incidents ?? (payload.incidents?.length || 0),
    monthly_trends: payload.monthly_trends || null,
    aggregated_stats: payload.aggregated_stats || null,
    regions: payload.regions || [],
    sources: payload.sources || [],
    incidents: payload.incidents || [],
    disclaimer: payload.disclaimer || 'EDUCATIONAL USE ONLY',
  };
}

// Endpoint pubblico (no login) — dati da cache aggiornata in background
app.get('/api/realtime-incidents', incidentsPublicLimiter, async (req, res) => {
  try {
    if (req.query.refresh === '1') {
      await refreshIncidentsCache();
    }
    if (!incidentsCache?.incidents?.length) {
      await refreshIncidentsCache();
    }
    res.json(buildIncidentsApiResponse(incidentsCache));
  } catch (err) {
    res.json({
      ...buildIncidentsApiResponse(incidentsCache),
      status: 'degraded',
      error: err.message,
    });
  }
});

// ==================== LABORATORIO VIRTUALE (VM isolate simulate) ====================
const vlabAuth = optionalAuthenticate;

app.get('/api/virtual-lab/catalog', vlabAuth, (req, res) => {
  try {
    res.json({
      labs: virtualLabService.catalogForClient(),
      attacker: virtualLabService.ATTACKER,
      disclaimer: 'Ambienti simulati EVIL — rete 10.42.x.x isolata, solo scopo didattico.',
      storage: process.env.REDIS_URL ? 'redis' : 'memory',
    });
  } catch (err) {
    logger.error('Virtual lab catalog error', { error: err.message });
    res.status(500).json({ error: 'Impossibile caricare il catalogo lab' });
  }
});

app.post('/api/virtual-lab/sessions', vlabAuth, virtualLabSessionLimiter, async (req, res) => {
  try {
    const labId = virtualLabService.validateLabId(req.body?.labId || '');
    if (!labId) {
      return res.status(400).json({ error: 'labId non valido' });
    }
    const ownerKey = virtualLabService.ownerKeyFromRequest(req);
    const session = await virtualLabService.createSession(labId, ownerKey);
    res.status(201).json({ session });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/virtual-lab/sessions/:id', vlabAuth, incidentsPublicLimiter, async (req, res) => {
  try {
    const ownerKey = virtualLabService.ownerKeyFromRequest(req);
    const session = await virtualLabService.getSession(req.params.id, ownerKey);
    const lab = virtualLabService.getLab(session.labId);
    res.json({ session: virtualLabService.sanitizeSession(session, lab) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/virtual-lab/sessions/:id/exec', vlabAuth, virtualLabLimiter, async (req, res) => {
  try {
    const command = sanitizeString(req.body?.command || '', { escapeHtml: false });
    if (!command) {
      return res.status(400).json({ error: 'command obbligatorio' });
    }
    const ownerKey = virtualLabService.ownerKeyFromRequest(req);
    const result = await virtualLabService.execCommand(req.params.id, ownerKey, command);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.delete('/api/virtual-lab/sessions/:id', vlabAuth, incidentsPublicLimiter, async (req, res) => {
  try {
    const ownerKey = virtualLabService.ownerKeyFromRequest(req);
    await virtualLabService.stopSession(req.params.id, ownerKey);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

const wsClients = new Set();

async function broadcastIncidents() {
  try {
    const data = buildIncidentsApiResponse(incidentsCache);
    wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  } catch (err) {
    console.error('Errore broadcast incidenti:', err.message);
  }
}

const server = http.createServer(app);
const wss2 = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url === '/ws/incidents' || url === '/ws/attacks') {
    wss2.handleUpgrade(request, socket, head, (ws) => {
      wsClients.add(ws);
      ws.send(JSON.stringify(buildIncidentsApiResponse(incidentsCache)));
      ws.on('close', () => wsClients.delete(ws));
      ws.on('error', (err) => console.error('WS Error:', err.message));
    });
  } else {
    socket.destroy();
  }
});

setInterval(broadcastIncidents, 5 * 60 * 1000);

async function refreshIncidentsCache() {
  try {
    console.log('⏳ Aggiornamento cache incidenti in corso...');
    const payload = await incidentsService.buildIncidentsPayload();
    incidentsCache = payload;
    saveIncidentsCacheToDisk(incidentsCache);
    broadcastIncidents();
    console.log(
      '✅ Cache incidenti aggiornata:',
      incidentsCache.lastUpdate,
      '|',
      incidentsCache.total_incidents,
      'record | mode:',
      incidentsCache.data_mode
    );
  } catch (err) {
    console.warn('⚠️ Errore aggiornamento cache incidenti:', err.message);
  }
}

// ========================
// ENDPOINT SOCIAL PROFILING
// ========================
app.post('/api/social-profile', authenticateTools, scanLimiter, async (req, res) => {
  const { username, email } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username required', status: 'error' });
  }
  try {
    const result = await runSocialProfiling({ username, email });
    res.json(result);
  } catch (err) {
    const code = /non valido/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT PUBLIC INFO GATHERING
// ========================
app.post('/api/osint-search', authenticateTools, scanLimiter, async (req, res) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  try {
    if (req.body.mode === 'person_detail' && req.body.wikidataId) {
      const result = await runPublicInfoPersonDetail(req.body.wikidataId);
      return res.json(result);
    }
    if (req.body.mode === 'registry' || (req.body.country && !req.body.firstName)) {
      const result = await runPublicInfoRegistrySearch({ ...req.body, mode: 'registry' });
      return res.json(result);
    }
    if (req.body.firstName && req.body.lastName) {
      const result = await runPublicInfoPersonSearch(req.body);
      return res.json(result);
    }
    const { target, type } = req.body;
    if (type === 'domain' && target) {
      const result = await runPublicInfoDomainSearch(target);
      return res.json(result);
    }
    return res.status(400).json({
      error: 'Fornire country (elenco territoriale), firstName+lastName (dossier) o target+type=domain',
      status: 'error'
    });
  } catch (err) {
    const code = /obblig/i.test(err.message) ? 400 : 500;
    res.status(code).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT PROGRESSI E TROFEI
// ========================

// Catalogo trofei (pubblico — nessun login richiesto)
function sendAchievementsCatalog(res) {
  const achievementsFile = resolveAchievementsFile();
  if (!fs.existsSync(achievementsFile)) {
    return res.status(404).json({ error: 'Achievements database not found', path: achievementsFile });
  }
  const data = fs.readFileSync(achievementsFile, 'utf8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.json(JSON.parse(data));
}

app.get('/api/achievements', (req, res) => {
  try {
    sendAchievementsCatalog(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/achievements.json', (req, res) => {
  try {
    sendAchievementsCatalog(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const defaultProgress = () => ({
  totalScans: 0,
  totalActivities: 0,
  unlockedAchievements: [],
  achievementMeta: {},
  completedActivities: [],
  activityLog: [],
  lastUnlockedAchievement: null
});

// Salva i progressi dell'utente
app.post('/api/progress/save', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    user.progress = req.body;
    user.progressUpdatedAt = new Date().toISOString();

    saveUsers();

    res.json({ status: 'success', message: 'Progressi salvati' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Carica i progressi dell'utente
app.get('/api/progress/load', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    res.json(user.progress || defaultProgress());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sblocca manualmente un trofeo (per testing)
app.post('/api/progress/unlock-achievement', authenticateToken, (req, res) => {
  const { achievementId } = req.body;
  if (!achievementId) {
    return res.status(400).json({ error: 'Achievement ID mancante' });
  }

  try {
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (!user.progress) {
      user.progress = defaultProgress();
    }
    if (!user.progress.achievementMeta) user.progress.achievementMeta = {};
    if (!user.progress.completedActivities) user.progress.completedActivities = [];

    if (!user.progress.unlockedAchievements.includes(achievementId)) {
      user.progress.unlockedAchievements.push(achievementId);
      user.progress.achievementMeta[achievementId] = { unlockedAt: new Date().toISOString() };
      user.progress.lastUnlockedAchievement = achievementId;
      saveUsers();
    }

    let achievement = null;
    const achievementsFile = path.join(root, 'achievements.json');
    if (fs.existsSync(achievementsFile)) {
      const db = JSON.parse(fs.readFileSync(achievementsFile, 'utf8'));
      achievement = (db.achievements || []).find((a) => a.id === achievementId) || null;
    }

    res.json({
      status: 'success',
      unlockedAchievements: user.progress.unlockedAchievements,
      achievement
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health API (diagnostica deploy — sempre JSON leggibile)
app.get('/api/health/ping', (req, res) => {
  res.json({
    ok: true,
    service: 'evil-platform',
    version: process.env.RENDER_GIT_COMMIT || 'local',
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/smtp', async (req, res) => {
  try {
    const configured = emailService.isConfigured();
    const doVerify = req.query.verify === '1' || req.query.verify === 'true';
    let check = { ok: null, skipped: true };
    if (configured && doVerify) {
      check = await emailService.verifyConnection();
    } else if (!configured) {
      check = { ok: false, error: 'SMTP non configurato' };
    }

    const hints =
      typeof emailService.getSmtpDiagnostics === 'function'
        ? emailService.getSmtpDiagnostics()
        : ['Aggiorna il deploy: manca getSmtpDiagnostics nel server.'];

    res.json({
      ok: check.ok === null ? null : Boolean(check.ok),
      configured,
      verifySkipped: Boolean(check.skipped),
      host: emailService.smtpHost,
      port: emailService.smtpPort,
      secure: emailService.smtpSecure,
      user: emailService.smtpUser ? `${emailService.smtpUser.slice(0, 6)}…` : '',
      mode: emailService.resolveDeliveryMode(),
      from: emailService.fromEmail,
      baseUrl: process.env.BASE_URL || emailService.baseUrl,
      usersFile,
      dataDir,
      emailDevOutbox: process.env.EMAIL_DEV_OUTBOX !== '0',
      hints,
      error: check.error || null,
      tip: 'Aggiungi ?verify=1 per testare la connessione SMTP (può richiedere ~8s).',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, route: '/api/health/smtp' });
  }
});

// ========================
// ENDPOINT AUTENTICAZIONE
// ========================

// REGISTRAZIONE
app.post('/api/auth/register', registerLimiter, validateRegister, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    const existingUser = users.find(u => u.email === normalizedEmail);
    if (existingUser) {
      return res.status(400).json({
        error: 'Questa email è già registrata. Prova ad accedere.'
      });
    }

    const verificationToken = emailService.generateVerificationToken();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpiresMs = parseInt(process.env.EMAIL_VERIFY_EXPIRY_MS || `${24 * 60 * 60 * 1000}`, 10);

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12);
    const hashedPassword = await bcryptjs.hash(password, rounds);

    const pendingUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : `uid_${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      verificationTokenHash,
      verificationTokenExpires: new Date(Date.now() + verificationExpiresMs).toISOString(),
      verificationCodeHash: null,
      verificationCodeExpires: null,
      loginHistory: [],
      failedLogins: 0,
      lockedUntil: null,
      progress: {
        scans: 0,
        activities: 0,
        unlockedAchievements: []
      }
    };

    users.push(pendingUser);
    if (!saveUsers()) {
      users = users.filter((u) => u.id !== pendingUser.id);
      return res.status(500).json({
        error:
          'Impossibile salvare l\'account sul server. Imposta DATA_DIR su una cartella scrivibile (es. /tmp/evil-data su Render).',
      });
    }

    const verificationLink = emailService.buildVerificationLink(verificationToken);

    auditLog.security('USER_REGISTERED_PENDING', { userId: pendingUser.id, email: normalizedEmail }, 'INFO');

    const payload = {
      status: 'success',
      message:
        'Account creato. Controlla la email oppure usa il link di verifica nella pagina successiva.',
      requiresVerification: true,
      userId: pendingUser.id,
      email: normalizedEmail,
      verificationLink,
      emailDelivery: 'pending',
      emailHint:
        'Se l\'email non arriva entro qualche minuto, apri il link di verifica mostrato nella pagina successiva.',
    };

    res.json(payload);

    setImmediate(() => {
      emailService
        .sendRegistrationVerification(normalizedEmail, verificationToken, name)
        .then((emailResult) => {
          if (emailResult.success) {
            logger.info('Email registrazione inviata in background', {
              email: normalizedEmail,
              delivery: emailResult.delivery,
            });
          } else {
            logger.warn('Email registrazione fallita in background', {
              email: normalizedEmail,
              error: emailResult.error,
            });
          }
        })
        .catch((emailErr) => {
          logger.warn('Email registrazione errore background', {
            email: normalizedEmail,
            error: emailErr.message,
          });
        });
    });
  } catch (err) {
    logger.error('Registration error', { error: err.message });
    res.status(500).json({ error: 'Errore registrazione' });
  }
});

// VERIFICA EMAIL VIA LINK (GET dal client mail)
app.get('/api/auth/verify-email', async (req, res) => {
  const fail = (reason) => {
    res.redirect(`/html/verify-email.html?status=error&reason=${encodeURIComponent(reason)}`);
  };

  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return fail('missing');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = users.find(u => u.verificationTokenHash === tokenHash);

    if (!user) {
      return fail('invalid');
    }

    if (user.emailVerified) {
      await establishAuthSession(res, user);
      return res.redirect('/html/verify-email.html?status=success');
    }

    if (user.verificationTokenExpires && new Date() > new Date(user.verificationTokenExpires)) {
      return fail('expired');
    }

    user.emailVerified = true;
    user.verificationTokenHash = null;
    user.verificationTokenExpires = null;
    user.verificationCodeHash = null;
    user.verificationCodeExpires = null;
    saveUsers();

    await establishAuthSession(res, user);
    auditLog.security('USER_EMAIL_VERIFIED', { userId: user.id, email: user.email }, 'INFO');

    res.redirect('/html/verify-email.html?status=success');
  } catch (err) {
    logger.error('Email link verification error', { error: err.message });
    fail('server');
  }
});

// VERIFICA CODICE EMAIL
app.post('/api/auth/verify-email-code', async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: 'User ID e codice obbligatori' });
    }

    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    // Controlla se il codice è scaduto
    if (new Date() > new Date(user.verificationCodeExpires)) {
      return res.status(403).json({ error: 'Codice di verifica scaduto. Registrati di nuovo.' });
    }

    // Verifica il codice
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.verificationCodeHash) {
      return res.status(403).json({ error: 'Codice di verifica non valido' });
    }

    // Marca email come verificata
    user.emailVerified = true;
    user.verificationCodeHash = null;
    user.verificationCodeExpires = null;
    saveUsers();

    await establishAuthSession(res, user);

    auditLog.security('USER_EMAIL_VERIFIED', { userId: user.id, email: user.email }, 'INFO');

    res.json({
      status: 'success',
      message: 'Email verificata con successo',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true
      }
    });
  } catch (err) {
    logger.error('Email verification error', { error: err.message });
    res.status(500).json({ error: 'Errore verifica email' });
  }
});

// LOGIN
app.post('/api/auth/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    // Check if account is locked
    const isLocked = await tokenManager.isAccountLocked(normalizedEmail);
    if (isLocked) {
      auditLog.accountLocked(null, normalizedEmail, req.ip, 'Account locked (too many attempts)');
      return res.status(429).json({
        error: 'Account temporarily locked due to failed login attempts'
      });
    }

    // Find user
    const user = users.find(u => u.email === normalizedEmail);
    if (!user) {
      auditLog.loginFailed(normalizedEmail, req.ip, 'Invalid credentials');
      // Generic error (no email enumeration)
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      // Increment failed logins
      user.failedLogins = (user.failedLogins || 0) + 1;
      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || 5);

      if (user.failedLogins >= maxAttempts) {
        const lockoutDuration = parseInt(process.env.LOCKOUT_DURATION || 1800000);
        await tokenManager.lockAccount(normalizedEmail, lockoutDuration);
        user.lockedUntil = new Date(Date.now() + lockoutDuration).toISOString();
        saveUsers();

        auditLog.accountLocked(user.id, normalizedEmail, req.ip, `Failed login attempts: ${user.failedLogins}`);
        return res.status(429).json({
          error: 'Account locked due to too many failed login attempts'
        });
      }

      saveUsers();
      auditLog.loginFailed(normalizedEmail, req.ip, `Failed attempts: ${user.failedLogins}/${maxAttempts}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error: 'Devi verificare la tua email prima di accedere. Controlla la inbox (e lo spam).',
        requiresVerification: true,
        userId: user.id,
        email: user.email
      });
    }

    // Reset failed logins on successful auth
    user.failedLogins = 0;
    user.lockedUntil = null;

    // Register login
    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.push({
      timestamp: new Date().toISOString(),
      ip: req.ip || 'unknown'
    });

    saveUsers();
    auditLog.loginSuccess(user.id, normalizedEmail, req.ip);

    await establishAuthSession(res, user);

    res.json({
      status: 'success',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: !!user.emailVerified
      }
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ error: 'Errore login' });
  }
});

// REFRESH TOKEN
// REFRESH TOKEN
app.post('/api/auth/refresh-token', refreshTokenLimiter, async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromCookie(req) || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH, async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Refresh token expired' });
        }
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // Check if token still exists in Redis
      const stored = await tokenManager.getRefreshToken(decoded.id);
      if (!stored || stored.token !== refreshToken) {
        return res.status(403).json({ error: 'Refresh token revoked or expired' });
      }

      const user = users.find(u => u.id === decoded.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await establishAuthSession(res, user);

      res.json({
        status: 'success',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: !!user.emailVerified
        }
      });
    });
  } catch (err) {
    logger.error('Token refresh error', { error: err.message });
    res.status(500).json({ error: 'Errore refresh token' });
  }
});

// LOGOUT
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await tokenManager.revokeRefreshToken(req.user.id);
    clearAuthCookies(res);

    auditLog.security('USER_LOGOUT', { userId: req.user.id }, 'INFO');
    res.json({ status: 'success', message: 'Logout completato' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    res.status(500).json({ error: 'Errore logout' });
  }
});

// PASSWORD RESET REQUEST
app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const genericResponse = {
      status: 'success',
      message: 'Se l\'indirizzo è registrato, riceverai un\'email con il link per reimpostare la password.'
    };

    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'Email obbligatoria' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = users.find((u) => u.email === normalizedEmail);

    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = emailService.generateVerificationToken();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpiryMs = parseInt(process.env.PASSWORD_RESET_EXPIRY_MS || `${15 * 60 * 1000}`, 10);

    user.passwordResetTokenHash = resetTokenHash;
    user.passwordResetTokenExpires = new Date(Date.now() + resetExpiryMs).toISOString();
    saveUsers();

    const emailResult = await emailService.sendPasswordResetEmail(
      normalizedEmail,
      resetToken,
      user.name || 'Utente'
    );

    if (!emailResult.success) {
      user.passwordResetTokenHash = null;
      user.passwordResetTokenExpires = null;
      saveUsers();
      return res.status(500).json({
        error: emailResult.error || 'Impossibile inviare l\'email di reset. Riprova più tardi.'
      });
    }

    auditLog.security('PASSWORD_RESET_REQUESTED', { userId: user.id, email: normalizedEmail }, 'INFO');

    res.json({
      ...genericResponse,
      emailDelivery: emailResult.delivery || 'smtp',
      emailHint: emailResult.hint || ''
    });
  } catch (err) {
    logger.error('Forgot password error', { error: err.message });
    res.status(500).json({ error: 'Errore durante la richiesta di reset' });
  }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, resetToken, newPassword, confirmPassword } = req.body;
    const rawToken = token || resetToken;

    if (!rawToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Tutti i campi obbligatori' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Le password non corrispondono' });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ error: strength.reason });
    }

    const tokenHash = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
    const user = users.find((u) => u.passwordResetTokenHash === tokenHash);

    if (!user) {
      return res.status(403).json({ error: 'Link non valido o già utilizzato. Richiedi un nuovo reset.' });
    }

    if (!user.passwordResetTokenExpires || new Date(user.passwordResetTokenExpires) < new Date()) {
      user.passwordResetTokenHash = null;
      user.passwordResetTokenExpires = null;
      saveUsers();
      return res.status(403).json({ error: 'Link scaduto. Richiedi un nuovo reset dalla pagina recupero password.' });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12, 10);
    user.password = await bcryptjs.hash(newPassword, rounds);
    user.passwordResetTokenHash = null;
    user.passwordResetTokenExpires = null;
    user.failedLogins = 0;
    user.lockedUntil = null;
    saveUsers();

    auditLog.security('PASSWORD_RESET_COMPLETED', { userId: user.id, email: user.email }, 'INFO');

    res.json({
      status: 'success',
      message: 'Password aggiornata. Puoi accedere con la nuova password.'
    });
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    res.status(500).json({ error: 'Errore durante il reset della password' });
  }
});

app.post('/api/auth/confirm-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token di conferma obbligatorio' });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Token di conferma non valido o scaduto' });
      }

      const user = users.find(u => u.id === decoded.id);
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      user.emailVerified = true;
      saveUsers();

      res.json({ status: 'success', message: 'Email confermata con successo' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore: ' + err.message });
  }
});

// REINVIA CODICE DI VERIFICA EMAIL
app.post('/api/auth/resend-verification-code', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID obbligatorio' });
    }

    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email già verificata' });
    }

    const verificationToken = emailService.generateVerificationToken();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpiresMs = parseInt(process.env.EMAIL_VERIFY_EXPIRY_MS || `${24 * 60 * 60 * 1000}`, 10);

    user.verificationTokenHash = verificationTokenHash;
    user.verificationTokenExpires = new Date(Date.now() + verificationExpiresMs).toISOString();
    saveUsers();

    const emailResult = await emailService.sendVerificationLink(user.email, verificationToken, user.name);

    if (!emailResult.success) {
      return res.status(500).json({ error: emailResult.error || 'Errore invio email. Riprova.' });
    }

    const payload = {
      status: 'success',
      message: 'Link di verifica reinviato',
      emailDelivery: emailResult.delivery,
      emailHint: emailResult.hint || ''
    };
    if (process.env.NODE_ENV !== 'production' && emailResult.verificationLink) {
      payload.devVerificationLink = emailResult.verificationLink;
    }
    res.json(payload);
  } catch (err) {
    logger.error('Resend verification code error', { error: err.message });
    res.status(500).json({ error: 'Errore: ' + err.message });
  }
});

// GET PROFILO
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(401).json({ error: 'Utente non trovato' });
    }

    res.json({
      status: 'success',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        emailVerified: !!user.emailVerified,
        progress: user.progress || defaultProgress(),
        loginHistory: (user.loginHistory || []).slice(-5)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VERIFICA TOKEN (sessione cookie o Bearer)
app.post('/api/auth/verify', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.json({ valid: false });
  }

  res.json({
    valid: true,
    user: { id: user.id, name: user.name, email: user.email }
  });
});

// ========================
// FILE UPLOAD
// ========================

/**
 * Static File Scanner — analisi in RAM, nessun salvataggio su disco
 */
async function handleFileScanRequest(req, res) {
  const started = Date.now();
  try {
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: 'File non fornito o vuoto' });
    }

    const result = runFileScan(req.file);
    result.scanDurationMs = Date.now() - started;
    result.timestamp = new Date().toISOString();

    const user = users.find((u) => u.id === req.user?.id);
    if (user) {
      if (!user.progress) user.progress = { scans: 0, activities: 0, unlockedAchievements: [] };
      user.progress.activities = (user.progress.activities || 0) + 1;
      if (!user.uploadedFiles) user.uploadedFiles = [];
      user.uploadedFiles.push({
        originalName: req.file.originalname,
        uploadedAt: result.timestamp,
        sha256: result.hashes.sha256,
        size: result.size,
        verdict: result.verdict.code
      });
      if (user.uploadedFiles.length > 50) user.uploadedFiles = user.uploadedFiles.slice(-50);
      saveUsers();
    }

    auditLog.fileUpload(
      req.user?.id || 'guest',
      `scan:${result.hashes.sha256.slice(0, 12)}`,
      result.size,
      result.fileType?.detected || 'unknown',
      req.ip
    );

    res.json({
      status: 'success',
      result,
      scanDurationMs: result.scanDurationMs,
      message: 'Scansione statica completata (file non persistito)'
    });
  } catch (err) {
    logger.error('File scan error', { error: err.message, userId: req.user?.id });
    res.status(500).json({ error: err.message || 'Errore scansione file', status: 'error' });
  }
}

app.post(
  '/api/file-scan',
  authenticateTools,
  uploadLimiter,
  scanUpload.single('file'),
  handleScanUploadError,
  handleFileScanRequest
);

/**
 * File Upload legacy — stesso motore sicuro in RAM (compatibilità UI vecchia)
 */
app.post(
  '/api/file-upload',
  authenticateTools,
  uploadLimiter,
  scanUpload.single('file'),
  handleScanUploadError,
  handleFileScanRequest
);

// ==================== REPORT GENERATOR ====================
app.post('/api/report-generator', authenticateTools, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

    const incident = req.body?.incident || null;

    // Crea documento PDF
    const doc = new PDFDocument({ bufferPages: true });
    let buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      
      // Invia il PDF come risposta
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
      res.send(pdfBuffer);
    });

    // Intestazione
    doc.fontSize(24).font('Helvetica-Bold').text('EVIL Security Report', { align: 'center' });
    doc.fontSize(10).fillColor('#666666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Informazioni utente
    doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold').text('User Information', { underline: true });
    doc.fontSize(10).fillColor('#000000').font('Helvetica').text(`Username: ${user.nome || 'N/A'}`);
    doc.text(`Email: ${user.email}`);
    doc.text(`Account Created: ${new Date(user.createdAt || Date.now()).toLocaleDateString()}`);
    doc.moveDown(1);

    if (incident) {
      doc.fontSize(14).font('Helvetica-Bold').text('Incident Report', { underline: true });
      doc.fontSize(10).font('Helvetica');
      if (incident.title) doc.text(`Title: ${incident.title}`);
      if (incident.target) doc.text(`Target: ${incident.target}`);
      if (incident.severity) doc.text(`Severity: ${incident.severity}`);
      if (incident.summary) doc.text(`Summary: ${incident.summary}`);
      if (incident.findings) doc.text(`Findings: ${incident.findings}`);
      if (incident.author) doc.text(`Author: ${incident.author}`);
      if (incident.systems) doc.text(`Systems: ${incident.systems}`);
      if (incident.usersAffected) doc.text(`Users affected: ${incident.usersAffected}`);
      doc.moveDown(1);
    }

    // Statistiche
    doc.fontSize(14).font('Helvetica-Bold').text('Activity Statistics', { underline: true });
    const activities = user.progress?.activities || 0;
    const scans = user.progress?.scans || 0;
    const files = user.uploadedFiles?.length || 0;
    
    doc.fontSize(10).font('Helvetica').text(`Total Activities: ${activities}`);
    doc.text(`Scans Performed: ${scans}`);
    doc.text(`Files Uploaded: ${files}`);
    doc.moveDown(1);

    // Lista file uploadi
    if (user.uploadedFiles && user.uploadedFiles.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Uploaded Files', { underline: true });
      doc.fontSize(9).font('Helvetica');

      // Calcola larghezzhe colonne
      const pageWidth = doc.page.width - 100;
      const colWidth = pageWidth / 3;

      // Intestazioni tabella
      const y = doc.y;
      doc.text('Filename', 50, y, { width: colWidth });
      doc.text('MD5', 50 + colWidth, y, { width: colWidth });
      doc.text('Upload Date', 50 + 2 * colWidth, y, { width: colWidth });
      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
      doc.moveDown(2);

      // Righe file
      user.uploadedFiles.slice(0, 10).forEach((file, index) => {
        doc.fontSize(8);
        const fileY = doc.y;
        doc.text(file.filename.substring(0, 25), 50, fileY, { width: colWidth });
        doc.text(file.md5.substring(0, 20) + '...', 50 + colWidth, fileY, { width: colWidth });
        doc.text(new Date(file.uploadedAt).toLocaleDateString(), 50 + 2 * colWidth, fileY, { width: colWidth });
        doc.moveDown(1.2);
      });

      if (user.uploadedFiles.length > 10) {
        doc.fontSize(8).fillColor('#999999').text(`... and ${user.uploadedFiles.length - 10} more files`);
      }
      doc.moveDown(1);
    }

    // Achievement summary
    if (user.progress?.unlockedAchievements && user.progress.unlockedAchievements.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Unlocked Achievements', { underline: true });
      doc.fontSize(10).font('Helvetica');
      
      user.progress.unlockedAchievements.slice(0, 5).forEach(achievement => {
        doc.text(`✓ ${achievement.name || achievement.id}`);
      });
      
      if (user.progress.unlockedAchievements.length > 5) {
        doc.fontSize(9).fillColor('#999999').text(`... and ${user.progress.unlockedAchievements.length - 5} more achievements`);
      }
      doc.moveDown(1);
    }

    // Footer
    doc.fontSize(8).fillColor('#999999');
    doc.text(`\nThis report contains confidential information about user activity.`, { align: 'center' });
    doc.text(`EVIL Cybersecurity Platform - ${new Date().getFullYear()}`, { align: 'center' });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Errore generazione report: ' + err.message });
  }
});

// ==================== ERROR HANDLING MIDDLEWARE ====================
// Global error handling middleware

// Catch 404 errors
app.use((req, res, next) => {
  const error = new Error(`Route ${req.originalUrl} not found`);
  error.statusCode = 404;
  next(error);
});

// Global error handler
app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log error with context
  logger.error('Request Error', {
    error: message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    statusCode,
    timestamp: new Date().toISOString()
  });

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const isHealthApi = (req.originalUrl || '').startsWith('/api/health');
  const isAuthApi = (req.originalUrl || '').startsWith('/api/auth');
  const showDetail = isDevelopment || isHealthApi || isAuthApi;
  const errorResponse = {
    error: showDetail ? message : 'Something went wrong',
    status: 'error',
    timestamp: new Date().toISOString()
  };

  // Add stack trace in development
  if (isDevelopment && error.stack) {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
});

// ==================== UNHANDLED REJECTION & EXCEPTION HANDLING ====================
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });

  // In production, you might want to exit the process
  if (process.env.NODE_ENV === 'production') {
    console.error('Unhandled Rejection - exiting...');
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Always exit on uncaught exception
  console.error('Uncaught Exception - exiting...');
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Avvia la cache degli incidenti dopo che tutte le funzioni sono state definite
setTimeout(() => {
  refreshIncidentsCache();
  setInterval(refreshIncidentsCache, 5 * 60 * 1000);
}, 100);

server.listen(PORT, '0.0.0.0', () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const corsOrigins = process.env.CORS_ORIGINS || 'any (dev)';
  console.log(`\n✅ EVIL Backend avviato su http://0.0.0.0:${PORT}`);
  const homeBundlePath = path.join(root, 'css', 'home.bundle.css');
  if (fs.existsSync(homeBundlePath)) {
    const kb = Math.round(fs.statSync(homeBundlePath).size / 1024);
    console.log(`🎨 Home CSS bundle: /css/home.bundle.css (${kb} KB)`);
  } else {
    console.warn('⚠️ Manca css/home.bundle.css — esegui: npm run build:home-css');
  }
  console.log(`🔧 Environment: ${nodeEnv}`);
  if (shouldEnforceHttps()) {
    console.log(`🔒 HTTPS: redirect attivo → ${getCanonicalOrigin() || '(host richiesta)'}`);
  } else {
    console.log('🔒 HTTPS: redirect disattivato (dev locale — Edge mostra "non sicuro" su http://localhost, è normale)');
  }
  console.log(`🔐 CORS Origins: ${corsOrigins}`);
  const toolsPublic = process.env.EVIL_TOOLS_PUBLIC === '1' || process.env.EVIL_TOOLS_PUBLIC === 'true';
  console.log(`🛠️  Strumenti API: ${toolsPublic ? 'accesso pubblico (EVIL_TOOLS_PUBLIC)' : 'login obbligatorio'}`);
  console.log(`📁 Utenti: ${usersFile}`);
  if (emailService.isConfigured()) {
    console.log(
      `📧 SMTP: ${emailService.smtpHost}:${emailService.smtpPort} secure=${emailService.smtpSecure} (modalità ${emailService.resolveDeliveryMode()})`
    );
    const smtpHints = emailService.getSmtpDiagnostics();
    smtpHints.forEach((h) => console.warn(`⚠️ SMTP config: ${h}`));
    emailService.verifyConnection().then((r) => {
      if (r.ok) console.log('📧 SMTP connessione OK');
      else console.warn(`⚠️ SMTP non raggiungibile: ${r.error}`);
    });
  } else {
    console.warn('⚠️ SMTP non configurato — in sviluppo le email vanno in data/email-outbox/');
  }
  console.log(`\n📍 Endpoint disponibili:`);
  console.log(`   • URL Security Check: POST /api/scan`);
  console.log(`   • DNS Enumerator: POST /api/dns-enum`);
  console.log(`   • Subdomain Finder: POST /api/subdomain-finder`);
  console.log(`   • SSL Analyzer: POST /api/ssl-analyzer`);
  console.log(`   • Vulnerability Scanner: POST /api/vulnerability-scan`);
  console.log(`   • Social Profiling: POST /api/social-profile`);
  console.log(`   • OSINT Search: POST /api/osint-search`);
  console.log(`   • Realtime Incidents: GET /api/realtime-incidents`);
  console.log(`   • WebSocket Incidents: WS /ws/incidents`);
  console.log(`   • Health Check: GET /api/health`);
  console.log(`   • Auth Register: POST /api/auth/register`);
  console.log(`   • Auth Verify Email Link: GET /api/auth/verify-email?token=...`);
  console.log(`   • Auth Login: POST /api/auth/login`);
  console.log(`   • Auth Logout: POST /api/auth/logout`);
  console.log(`   • Auth Profile: GET /api/auth/profile`);
  console.log(`   • Auth Verify: POST /api/auth/verify`);
  console.log(`   • File Scanner: POST /api/file-scan`);
  console.log(`   • File Upload (legacy): POST /api/file-upload`);
  console.log(`   • Report Generator: POST /api/report-generator`);
  console.log(`   • Achievements: GET /api/achievements`);
  console.log(`   • Progress Load: GET /api/progress/load`);
  console.log(`   • Progress Save: POST /api/progress/save`);
  console.log(`   • Unlock Achievement: POST /api/progress/unlock-achievement\n`);
});
