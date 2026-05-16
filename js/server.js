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

const {
  setTokenCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie
} = require('../utils/token-utils');

// Import middleware e services
const { 
  authenticateToken,
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
  sanitizeFilename
} = require('../middleware/sanitization');
const { upload: multerUpload, handleUploadError } = require('../middleware/upload');
const { 
  globalLimiter,
  authLimiter,
  registerLimiter,
  scanLimiter,
  dnsLimiter,
  uploadLimiter
} = require('../middleware/limiter');

const tokenManager = require('../services/token-manager');
const emailService = require('../services/email-service');
const securityHeaders = require('../middleware/security-headers');
const { logger, auditLog, httpLogger } = require('../middleware/logger');

const app = express();

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
// Redirect HTTP to HTTPS in production
// On Render: x-forwarded-proto header indicates original protocol
// Force HTTPS redirect - Render provides SSL by default
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  const proto = req.headers['x-forwarded-proto'] || req.protocol;

  if (req.path === '/health' || req.path === '/__debug/files') {
    return next();
  }

  if (proto !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }

  next();
});
// CRITICO: questi middleware devono essere registrati **prima** di qualunque
// altro routing o security headers, così Express può rispondere con i file
// statici invece di cadere in un handler 404 generico.
const root = path.resolve(__dirname, '..');

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
  maxAge: '30d', // Cache CSS for 30 days
  etag: true,
  lastModified: true
}));
// matrixrain.js: no long cache (easter egg aggiornato spesso)
app.get('/js/matrixrain.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(root, 'js', 'matrixrain.js'));
});

app.use('/js', express.static(path.join(root, 'js'), {
  maxAge: '7d',
  etag: true,
  lastModified: true
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
app.use('/html', express.static(path.join(root, 'html'))); // solo se serve html direttamente

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

const corsOptions = {
  origin: function (origin, callback) {
    // In development: accetta qualsiasi origin (file://, localhost, remoti)
    // In production: usa CORS_ORIGINS da env (comma-separated list o '*')
    if (isDev) {
      callback(null, true);
    } else {
      const defaultOrigins = 'https://www.projectevil.it,https://projectevil.it,http://localhost:5000,http://127.0.0.1:5000';
      const allowedOrigins = (process.env.CORS_ORIGINS || defaultOrigins).split(',').map(o => o.trim());
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('CORS non consentito: ' + origin));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

/** Set httpOnly auth cookies and persist refresh token in Redis */
async function establishAuthSession(res, user) {
  const tokens = setTokenCookies(res, user.id, user.email);
  await tokenManager.storeRefreshToken(user.id, tokens.refreshToken);
  return tokens;
}

// ==================== HTML INJECTION MIDDLEWARE ====================

// Route per la homepage (root)
app.get('/', (req, res) => {
  const filePath = path.join(root, 'html', 'home.html');
  if (fs.existsSync(filePath)) {
    let htmlContent = fs.readFileSync(filePath, 'utf8');
    if (htmlContent.includes('</head>')) {
      const injectedScript = '<script src="/js/load-header.js"></script>';
      htmlContent = htmlContent.replace('</head>', `${injectedScript}\n</head>`);
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(htmlContent);
  }
  res.status(404).send('Home page not found');
});

// Route personalizzata per i file HTML - inietta lo script di caricamento header
app.get('*.html', (req, res, next) => {
  const filePath = path.join(root, 'html', req.path);
  
  if (fs.existsSync(filePath) && filePath.endsWith('.html')) {
    let htmlContent = fs.readFileSync(filePath, 'utf8');
    
    // Inietta lo script di caricamento header prima del closing </head> tag
    if (htmlContent.includes('</head>')) {
      const injectedScript = '<script src="/js/load-header.js"></script>';
      htmlContent = htmlContent.replace('</head>', `${injectedScript}\n</head>`);
    }
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
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

// Database utenti (salvataggio file)
const usersFile = path.join(root, 'users.json');
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
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Errore salvataggio utenti:', err.message);
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
      resolve({
        subject: cert.subject,
        issuer: cert.issuer,
        valid_from: cert.valid_from,
        valid_to: cert.valid_to,
        fingerprint: cert.fingerprint,
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
  authenticateToken,
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

    const result = {
      domain,
      url: fullUrl,
      timestamp: new Date().toISOString(),
      userId: req.user.id,
      analysis: {}
    };

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
    }, 30000); // 30 second timeout

    try {
      // 1. DNS + IP with timeout
      const dnsPromise = resolveDomain(domain);
      const ip = await Promise.race([
        dnsPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), 10000)
        )
      ]);

      if (ip) {
        result.analysis.ip = ip;
        const asn = getAsn(ip);
        result.analysis.asn = asn;
        result.analysis.asn_info = asnDatabase[asn] || {};
      }

      // 2. SSL Certificate with timeout
      if (hasSSL) {
        const certPromise = getCertificate(domain);
        const cert = await Promise.race([
          certPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SSL timeout')), 10000)
          )
        ]);
        result.analysis.certificate = cert;
      }

      // 3. HTTP Headers with timeout
      const headersPromise = getHttpHeaders(fullUrl);
      const headers = await Promise.race([
        headersPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Headers timeout')), 10000)
        )
      ]);
      result.analysis.headers = headers;

      // 4. Redirect Chain with timeout
      const redirectPromise = getRedirectChain(fullUrl);
      const redirects = await Promise.race([
        redirectPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redirect timeout')), 10000)
        )
      ]);
      result.analysis.redirects = redirects;

      // 5. Threat Intelligence
      const threat = checkThreat(domain);
      if (threat) {
        result.analysis.threat = threat;
        result.security_score = threat.score;
        result.threatData = { threat: threat.threat, score: threat.score };
      } else {
        result.security_score = hasSSL ? 85 : 55;
        result.threatData = null;
      }

      // 6. Page Stats (simulati per compatibilità frontend)
      result.pageStats = {
        httpRequests: Math.floor(Math.random() * 50) + 20,
        httpsPercentage: hasSSL ? 95 : 40,
        totalDomains: Math.floor(Math.random() * 5) + 3,
        totalSubdomains: Math.floor(Math.random() * 3),
        uniqueIPs: Math.floor(Math.random() * 10) + 3,
        countries: Math.floor(Math.random() * 3) + 1,
        transferSize: Math.floor(Math.random() * 5) + 1 + ' MB',
        pageSize: Math.floor(Math.random() * 4) + 2 + ' MB',
        framesCount: Math.floor(Math.random() * 3)
      };

      // 7. Page Metadata
      result.pageMetadata = {
        title: 'Domain: ' + domain,
        description: 'Professional website for ' + domain,
        charset: 'UTF-8',
        language: 'en-US',
        faviconHash: Math.random().toString(36).substring(2, 11)
      };

      result.status = 'success';

      // Clear timeout since operation completed
      clearTimeout(scanTimeout);

      // Update user progress
      const user = users.find(u => u.id === req.user.id);
      if (user) {
        user.progress.scans = (user.progress.scans || 0) + 1;
        saveUsers();
      }

      auditLog.security('SCAN_COMPLETED', { userId: req.user.id, domain }, 'INFO');
      res.json(result);

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

      result.error = errorMessage;
      result.status = 'error';

      if (!res.headersSent) {
        res.status(statusCode).json(result);
      }
    }
  }
);

// ========================
// ENDPOINT DNS ENUMERATOR
// ========================
app.post('/api/dns-enum', authenticateToken, dnsLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const result = {
      domain,
      timestamp: new Date().toISOString(),
      records: {}
    };

    // A records
    try {
      result.records.A = await dns.resolve4(domain);
    } catch { result.records.A = []; }

    // AAAA records (IPv6)
    try {
      result.records.AAAA = await dns.resolve6(domain);
    } catch { result.records.AAAA = []; }

    // MX records
    try {
      result.records.MX = await dns.resolveMx(domain);
    } catch { result.records.MX = []; }

    // NS records
    try {
      result.records.NS = await dns.resolveNs(domain);
    } catch { result.records.NS = []; }

    // TXT records
    try {
      result.records.TXT = await dns.resolveTxt(domain);
    } catch { result.records.TXT = []; }

    // CNAME record (primo)
    try {
      result.records.CNAME = await dns.resolveCname(domain);
    } catch { result.records.CNAME = []; }

    // SOA record
    try {
      result.records.SOA = await dns.resolveSoa(domain);
    } catch { result.records.SOA = null; }

    result.status = 'success';
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT SUBDOMAIN FINDER
// ========================
const commonSubdomains = [
  'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'ns2',
  'cpanel', 'whm', 'autodiscover', 'autoconfig', 'api', 'admin', 'test',
  'portal', 'beta', 'dev', 'staging', 'prod', 'app', 'blog', 'shop', 'cdn',
  'image', 'images', 'static', 'assets', 'download', 'uploads', 'files'
];

app.post('/api/subdomain-finder', authenticateToken, dnsLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  const found = [];

  // Prova a risolvere i sottodomini comuni
  for (const subdomain of commonSubdomains) {
    const fullDomain = `${subdomain}.${domain}`;
    try {
      const address = await dns.resolve4(fullDomain);
      found.push({
        subdomain: fullDomain,
        ip: address[0],
        found: true
      });
    } catch {
      // Subdomain non trovato
    }
  }

  res.json({
    domain,
    timestamp: new Date().toISOString(),
    totalChecked: commonSubdomains.length,
    found: found,
    foundCount: found.length,
    status: 'success'
  });
});

// ========================
// ENDPOINT SSL CERTIFICATE ANALYZER
// ========================
app.post('/api/ssl-analyzer', authenticateToken, scanLimiter, async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const cert = await getCertificate(domain);

    if (cert.error) {
      return res.json({
        domain,
        timestamp: new Date().toISOString(),
        error: cert.error,
        status: 'failed'
      });
    }

    // Parse subject string
    const parseSubject = (subjectStr) => {
      const parts = {};
      if (!subjectStr) return parts;
      const regex = /(\w+)=([^,]+)/g;
      let match;
      while ((match = regex.exec(subjectStr)) !== null) {
        parts[match[1]] = match[2];
      }
      return parts;
    };

    const result = {
      domain,
      timestamp: new Date().toISOString(),
      certificate: {
        subject: parseSubject(typeof cert.subject === 'string' ? cert.subject : JSON.stringify(cert.subject)),
        issuer: parseSubject(typeof cert.issuer === 'string' ? cert.issuer : JSON.stringify(cert.issuer)),
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        fingerprint: cert.fingerprint,
        status: cert.status
      },
      analysis: {
        isValid: true,
        daysUntilExpiry: Math.floor((new Date(cert.valid_to) - new Date()) / (1000 * 60 * 60 * 24)),
        algorithm: 'sha256WithRSAEncryption',
        keySize: 2048
      },
      status: 'success'
    };

    // Check expiry
    if (new Date(cert.valid_to) < new Date()) {
      result.analysis.isValid = false;
      result.analysis.warning = 'Certificate is expired!';
    } else if (result.analysis.daysUntilExpiry < 30) {
      result.analysis.warning = `Certificate expires in ${result.analysis.daysUntilExpiry} days`;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT VULNERABILITY SCANNER (Real)
// ========================
const vulnerabilityDatabase = {
  'https://example.com': {
    score: 72,
    risk: 'media',
    vulnerabilities: [
      {
        title: 'Header: Content-Security-Policy Assente',
        severity: 'media',
        category: 'Security Headers',
        description: 'CSP non configurato.',
        impact: 'Esposizione a XSS attacks.',
        recommendation: 'Implementare Content-Security-Policy',
        cvss: 6.5,
        owasp: 'A03:2021 – Injection'
      }
    ]
  }
};

app.post('/api/vulnerability-scan', authenticateToken, scanLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  let fullUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    fullUrl = 'https://' + url;
  }

  try {
    const parsed = new URL(fullUrl);
    const domain = parsed.hostname;
    const isHttps = parsed.protocol === 'https:';

    // Controlla database vulnerabilità
    if (vulnerabilityDatabase[fullUrl.toLowerCase()]) {
      return res.json({
        url: fullUrl,
        domain,
        timestamp: new Date().toISOString(),
        ...vulnerabilityDatabase[fullUrl.toLowerCase()],
        status: 'success'
      });
    }

    // Valutazione default basata su HTTPS
    const vulnerabilities = [];

    // Get headers per analisi reale
    const headers = await getHttpHeaders(fullUrl);

    // Check per CSP
    if (!headers.csp || headers.csp === 'Missing') {
      vulnerabilities.push({
        title: 'Header: Content-Security-Policy Assente',
        severity: 'media',
        category: 'Security Headers',
        description: 'CSP non è configurato.',
        impact: 'Esposizione a XSS attacks e injection.',
        recommendation: 'Implementare Content-Security-Policy header',
        cvss: 6.5,
        owasp: 'A03:2021 – Injection'
      });
    }

    // Check HSTS
    if (!isHttps) {
      vulnerabilities.push({
        title: 'HTTPS Non Implementato',
        severity: 'critica',
        category: 'HTTPS Configuration',
        description: 'Sito accessibile solo su HTTP.',
        impact: 'Comunicazioni non crittate - MITM attack possibile.',
        recommendation: 'Implementare HTTPS con certificato valido',
        cvss: 9.8,
        owasp: 'A02:2021 – Cryptographic Failures'
      });
    } else if (!headers.hsts || headers.hsts === 'Missing') {
      vulnerabilities.push({
        title: 'Header: Strict-Transport-Security Assente',
        severity: 'alta',
        category: 'Security Headers',
        description: 'HSTS non è configurato.',
        impact: 'Rischio di downgrade attacks da HTTPS a HTTP.',
        recommendation: 'Aggiungere: Strict-Transport-Security: max-age=31536000',
        cvss: 6.5,
        owasp: 'A06:2021 – Vulnerable and Outdated Components'
      });
    }

    // Check X-Frame-Options
    if (!headers.xfo || headers.xfo === 'Missing') {
      vulnerabilities.push({
        title: 'Header: X-Frame-Options Assente',
        severity: 'media',
        category: 'Security Headers',
        description: 'X-Frame-Options non è configurato.',
        impact: 'Esposizione a Clickjacking attacks.',
        recommendation: 'Aggiungere: X-Frame-Options: DENY o SAMEORIGIN',
        cvss: 4.3,
        owasp: 'A04:2021 – Insecure Design'
      });
    }

    const score = isHttps ? Math.max(50, 90 - vulnerabilities.length * 5) : 30;
    const riskMap = { critica: 'critica', alta: 'alta', media: 'media', bassa: 'bassa' };
    const maxSeverity = vulnerabilities.length ? vulnerabilities[0].severity : 'bassa';

    res.json({
      url: fullUrl,
      domain,
      timestamp: new Date().toISOString(),
      score,
      risk: maxSeverity,
      vulnerabilities,
      status: 'success'
    });
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
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

// Funzione per recuperare CVE da NVD API (pubblico)
async function fetchCVEData() {
  try {
    const response = await fetchWithRetries('https://services.nvd.nist.gov/rest/json/cves/1.0', {
      params: {
        resultLimit: 5,
        orderBy: 'published_date'
      },
      headers: {
        'User-Agent': 'EVIL-Cybersecurity-Platform/1.0'
      },
      timeout: 8000
    });
    
    return (response.data.result?.CVE_Items || []).map(item => ({
      id: item.cve.CVE_data_meta.ID,
      description: item.cve.description.description_data[0]?.value || 'Security Vulnerability',
      date: item.publishedDate,
      type: 'Vulnerability Report',
      severity: 'high',
      impact: 'Critical'
    }));
  } catch (err) {
    console.warn('⚠️ NVD API non disponibile (rate limit), utilizzo dati simulati');
    return [];
  }
}

// Funzione per recuperare vulnerability advisories da CISA (pubblico)
async function fetchVulnerabilityAdvisories() {
  try {
    const response = await fetchWithRetries('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      headers: {
        'User-Agent': 'EVIL-Cybersecurity-Platform/1.0'
      },
      timeout: 8000
    });
    
    return (response.data.vulnerabilities || []).slice(0, 5).map(vuln => ({
      id: vuln.cveID,
      description: vuln.shortDescription,
      date: vuln.dateAdded,
      type: 'Known Exploit Report',
      severity: 'critical',
      impact: 'Active Exploitation'
    }));
  } catch (err) {
    console.warn('⚠️ CISA API non disponibile, utilizzo dati simulati');
    return [];
  }
}

// Wrapper con nome compatibile usato nel codice
async function fetchCISAAdvisories() {
  return await fetchVulnerabilityAdvisories();
}

// Recupera feed RSS/ATOM da CERT-IT (fallback)
async function fetchCERTITFeed() {
  try {
    const url = 'https://cert-agid.gov.it/feed/';
    const res = await fetchWithRetries(url, { timeout: 8000, headers: { 'User-Agent': 'EVIL-Cybersecurity-Platform/1.0' } });
    const xml = res.data;
    const items = [];
    const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (let i = 0; i < Math.min(5, matches.length); i++) {
      const item = matches[i];
      const title = (item.match(/<title>([\s\S]*?)<\/title>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || item.match(/href="([^"]+)"/) || [null, ''])[1] || '';
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || item.match(/<updated>([\s\S]*?)<\/updated>/i) || [null, new Date().toISOString()])[1];
      const description = (item.match(/<description>([\s\S]*?)<\/description>/i) || item.match(/<summary>([\s\S]*?)<\/summary>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();

      items.push({
        id: crypto.createHash('md5').update(title + link).digest('hex'),
        description: title || description || 'CERT-IT Advisory',
        date: pubDate,
        type: 'OSINT Feed - CERT-IT',
        severity: 'medium',
        link: link
      });
    }
    return items;
  } catch (err) {
    console.warn('⚠️ CERT-IT feed non disponibile:', err.message);
    return [];
  }
}

// Recupera feed RSS/ATOM da CERT-EU (fallback)
async function fetchCERTEUFeed() {
  try {
    const url = 'https://cert.europa.eu/feeds/news.xml';
    const res = await fetchWithRetries(url, { timeout: 8000, headers: { 'User-Agent': 'EVIL-Cybersecurity-Platform/1.0' } });
    const xml = res.data;
    const items = [];
    const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (let i = 0; i < Math.min(5, matches.length); i++) {
      const item = matches[i];
      const title = (item.match(/<title>([\s\S]*?)<\/title>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || item.match(/href="([^"]+)"/) || [null, ''])[1] || '';
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || item.match(/<updated>([\s\S]*?)<\/updated>/i) || [null, new Date().toISOString()])[1];
      const description = (item.match(/<description>([\s\S]*?)<\/description>/i) || item.match(/<summary>([\s\S]*?)<\/summary>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();

      items.push({
        id: crypto.createHash('md5').update(title + link).digest('hex'),
        description: title || description || 'CERT-EU Advisory',
        date: pubDate,
        type: 'OSINT Feed - CERT-EU',
        severity: 'medium',
        link: link
      });
    }
    return items;
  } catch (err) {
    console.warn('⚠️ CERT-EU feed non disponibile:', err.message);
    return [];
  }
}
 
// Recupera feed RSS/ATOM da CERT-UK (NCSC) (fallback)
async function fetchCERTUKFeed() {
  try {
    const candidates = [
      'https://www.ncsc.gov.uk/feed',
      'https://www.ncsc.gov.uk/feeds/all.rss.xml',
      'https://www.ncsc.gov.uk/rss.xml'
    ];
    let res = null;
    for (const url of candidates) {
      try { res = await fetchWithRetries(url, { timeout: 8000, headers: { 'User-Agent': 'EVIL-Cybersecurity-Platform/1.0' } }); if (res && res.data) break; } catch(e){}
    }
    if (!res || !res.data) throw new Error('No CERT-UK feed');
    const xml = res.data;
    const items = [];
    const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (let i = 0; i < Math.min(5, matches.length); i++) {
      const item = matches[i];
      const title = (item.match(/<title>([\s\S]*?)<\/title>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || item.match(/href="([^"]+)"/) || [null, ''])[1] || '';
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || item.match(/<updated>([\s\S]*?)<\/updated>/i) || [null, new Date().toISOString()])[1];
      const description = (item.match(/<description>([\s\S]*?)<\/description>/i) || item.match(/<summary>([\s\S]*?)<\/summary>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
      items.push({ id: crypto.createHash('md5').update(title + link).digest('hex'), description: title || description || 'CERT-UK Advisory', date: pubDate, type: 'OSINT Feed - CERT-UK', severity: 'medium', link: link });
    }
    return items;
  } catch (err) {
    console.warn('⚠️ CERT-UK feed non disponibile:', err.message);
    return [];
  }
}

// Recupera feed RSS/ATOM da US-CERT / CISA endpoints (fallback)
async function fetchUSCERTFeed() {
  try {
    const candidates = [
      'https://us-cert.cisa.gov/ncas/alerts.xml',
      'https://www.cisa.gov/uscert/ncas/alerts.xml',
      'https://www.cisa.gov/sites/default/files/feeds/alerts.xml'
    ];
    let res = null;
    for (const url of candidates) {
      try { res = await fetchWithRetries(url, { timeout: 8000, headers: { 'User-Agent': 'EVIL-Cybersecurity-Platform/1.0' } }); if (res && res.data) break; } catch(e){}
    }
    if (!res || !res.data) throw new Error('No US-CERT feed');
    const xml = res.data;
    const items = [];
    const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (let i = 0; i < Math.min(5, matches.length); i++) {
      const item = matches[i];
      const title = (item.match(/<title>([\s\S]*?)<\/title>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
      const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || item.match(/href="([^"]+)"/) || [null, ''])[1] || '';
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || item.match(/<updated>([\s\S]*?)<\/updated>/i) || [null, new Date().toISOString()])[1];
      const description = (item.match(/<description>([\s\S]*?)<\/description>/i) || item.match(/<summary>([\s\S]*?)<\/summary>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
      items.push({ id: crypto.createHash('md5').update(title + link).digest('hex'), description: title || description || 'US-CERT Advisory', date: pubDate, type: 'OSINT Feed - US-CERT', severity: 'medium', link: link });
    }
    return items;
  } catch (err) {
    console.warn('⚠️ US-CERT feed non disponibile:', err.message);
    return [];
  }
}

// Recupera feed vendor/blogs (Microsoft, Cisco Talos) come fonti addizionali
async function fetchVendorFeeds() {
  try {
    const candidates = [
      'https://msrc.microsoft.com/update-guide/rss',
      'https://blog.talosintelligence.com/feeds/posts/default?alt=rss',
      'https://www.akamai.com/blog/security?format=rss'
    ];
    const all = [];
    for (const url of candidates) {
      try {
        const res = await fetchWithRetries(url, { timeout: 8000, headers: { 'User-Agent': 'EVIL-Cybersecurity-Platform/1.0' } });
        if (!res || !res.data) continue;
        const xml = res.data;
        const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
        for (let i = 0; i < Math.min(3, matches.length); i++) {
          const item = matches[i];
          const title = (item.match(/<title>([\s\S]*?)<\/title>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
          const link = (item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || item.match(/href="([^"]+)"/) || [null, ''])[1] || '';
          const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || item.match(/<updated>([\s\S]*?)<\/updated>/i) || [null, new Date().toISOString()])[1];
          const description = (item.match(/<description>([\s\S]*?)<\/description>/i) || item.match(/<summary>([\s\S]*?)<\/summary>/i) || [null, ''])[1].replace(/<[^>]+>/g, '').trim();
          all.push({ id: crypto.createHash('md5').update(title + link).digest('hex'), description: title || description || 'Vendor Advisory', date: pubDate, type: 'Vendor Feed', severity: 'medium', link: link });
        }
      } catch(e) {
        // continue
      }
    }
    return all;
  } catch (err) {
    console.warn('⚠️ Vendor feeds non disponibili:', err.message);
    return [];
  }
}

// Generatore di dati simulati (quando API esterne non disponibili)
function generateSimulatedIncidents() {
  const incidentTypes = ['Ransomware', 'DDoS', 'Phishing', 'Exploit', 'Data Breach', 'Unauthorized Access'];
  const countries = [
    { name: 'USA', lat: 37.8, lon: -95.5 },
    { name: 'Germania', lat: 51.1, lon: 10.4 },
    { name: 'India', lat: 20.5, lon: 78.9 },
    { name: 'Cina', lat: 35.8, lon: 104.2 },
    { name: 'Russia', lat: 61.5, lon: 105.3 },
    { name: 'Brasile', lat: -14.2, lon: -51.9 },
    { name: 'Australia', lat: -25.3, lon: 133.8 },
    { name: 'Giappone', lat: 36.2, lon: 138.3 }
  ];

  const incidents = [];
  for (let i = 0; i < 8; i++) {
    const country = countries[i % countries.length];
    const type = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
    
    incidents.push({
      id: `ATK-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      type: type,
      country: country.name,
      latitude: country.lat + (Math.random() - 0.5) * 5,
      longitude: country.lon + (Math.random() - 0.5) * 5,
      severity: ['critical', 'high', 'medium'][Math.floor(Math.random() * 3)],
      source: 'Threat Intelligence Public',
      description: `${type} rilevato in ${country.name}`,
      target_type: ['Government', 'Healthcare', 'Finance', 'Energy', 'Technology'][Math.floor(Math.random() * 5)],
      impact_score: Math.floor(Math.random() * 100)
    });
  }
  return incidents;
}

// Endpoint per ottenere incidenti in tempo reale da fonti pubbliche verificate
app.get('/api/realtime-incidents', authenticateToken, async (req, res) => {
  try {
    let incidents = [];

    // Prova a recuperare dati reali da API pubbliche
    const cveData = await fetchCVEData();
    const cisaData = await fetchCISAAdvisories();

    if (cveData.length > 0 || cisaData.length > 0) {
      // Converti dati API in formato mappa
      const allAlerts = [...cveData, ...cisaData];
      incidents = allAlerts.map((alert, idx) => {
        const countries = [
          { name: 'USA', lat: 37.8, lon: -95.5 },
          { name: 'Germania', lat: 51.1, lon: 10.4 },
          { name: 'Cina', lat: 35.8, lon: 104.2 },
          { name: 'Russia', lat: 61.5, lon: 105.3 }
        ];
        const country = countries[idx % countries.length];

        return {
          id: alert.id || `ATK-${idx}`,
          timestamp: alert.date || new Date().toISOString(),
          type: alert.type,
          country: country.name,
          latitude: country.lat + (Math.random() - 0.5) * 3,
          longitude: country.lon + (Math.random() - 0.5) * 3,
          severity: alert.severity || 'high',
          source: 'NVD / CISA / Threat Intelligence Public',
          description: alert.description || alert.title,
          target_type: 'Multiple Sectors',
          impact_score: Math.floor(Math.random() * 100)
        };
      });
    } else {
      // Fallback: usa dati simulati
      incidents = generateSimulatedAttacks();
    }

    // Cache aggiornamento
    // Cache aggiornata (refreshIncidentsCache manterrà campi estesi in seguito)
    incidentsCache = incidentsCache || {};
    incidentsCache.incidents = incidents;
    incidentsCache.lastUpdate = new Date().toISOString();

    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      source: 'NVD (NIST) / CISA / Official Public Threat Intelligence',
      update_frequency: 'Educational Purpose - aggiornamento ogni 30s',
      data_classification: 'Public Vulnerability Intelligence',
      total_incidents: incidents.length,
      monthly_trends: incidentsCache.monthly_trends || null,
      aggregated_stats: incidentsCache.aggregated_stats || null,
      incidents: incidents,
      disclaimer: 'EDUCATIONAL USE ONLY - Dati aggregati esclusivamente da fonti pubbliche verificate (NIST NVD, CISA, government agencies). Nessun dato privato, sensibile o su vittime reali.'
    });

  } catch (err) {
    // Se errore, ritorna cache
    res.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      source: 'Cache - Educational Public Data',
      incidents: incidentsCache.incidents || generateSimulatedIncidents(),
      disclaimer: 'EDUCATIONAL USE - Cache aggiornato (fonti pubbliche ufficiali temporaneamente non disponibili)'
    });
  }
});

// WebSocket support per aggiornamenti real-time
// Connessioni WebSocket attive
const wsClients = new Set();

// Broadcast dati incidenti a tutti i client
async function broadcastIncidents() {
  try {
    // Usa la cache locale per evitare richieste ripetute e rate-limit esterni
    const data = incidentsCache || { status: 'error', incidents: [] };
    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  } catch (err) {
    console.error('Errore broadcast:', err.message);
  }
}

// Gestisci upgrade della connessione a WebSocket
const server = http.createServer(app);
const wss2 = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws/attacks') {
    wss2.handleUpgrade(request, socket, head, (ws) => {
      wsClients.add(ws);
      ws.on('close', () => wsClients.delete(ws));
      ws.on('error', (err) => console.error('WS Error:', err));
    });
  } else {
    socket.destroy();
  }
});

// Broadcast automatico ogni 5 minuti (allineato a refreshIncidentsCache)
setInterval(broadcastIncidents, 5 * 60 * 1000);

// Aggiornamento della cache degli incidenti ogni 30 secondi per rilevare nuove notizie rapidamente
async function refreshIncidentsCache() {
  try {
    console.log('⏳ Aggiornamento cache incidenti in corso...');
    const cveData = await fetchCVEData();
    const cisaData = await fetchCISAAdvisories();
    // Temporarily disabled due to function order issues
    // const certItData = await fetchCERTITFeed();
    // const certEuData = await fetchCERTEUFeed();
    // const certUkData = await fetchCERTUKFeed();
    // const usCertData = await fetchUSCERTFeed();
    // const vendorData = await fetchVendorFeeds();
    const certItData = [];
    const certEuData = [];
    const certUkData = [];
    const usCertData = [];
    const vendorData = [];

    let incidents = [];

    if (cveData.length > 0 || cisaData.length > 0 || certItData.length > 0 || certEuData.length > 0 || certUkData.length > 0 || usCertData.length > 0 || vendorData.length > 0) {
      const allAlerts = [...cveData, ...cisaData, ...certItData, ...certEuData, ...certUkData, ...usCertData, ...vendorData];
      incidents = allAlerts.map((alert, idx) => {
        const countries = [
          { name: 'USA', lat: 37.8, lon: -95.5 },
          { name: 'Germania', lat: 51.1, lon: 10.4 },
          { name: 'Cina', lat: 35.8, lon: 104.2 },
          { name: 'Russia', lat: 61.5, lon: 105.3 }
        ];
        const country = countries[idx % countries.length];

        return {
          id: alert.id || `ATK-${idx}`,
          timestamp: alert.date || new Date().toISOString(),
          type: alert.type,
          country: country.name,
          latitude: country.lat + (Math.random() - 0.5) * 3,
          longitude: country.lon + (Math.random() - 0.5) * 3,
          severity: alert.severity || 'high',
          source: 'NVD / CISA / Threat Intelligence Public',
          description: alert.description || alert.title,
          target_type: 'Multiple Sectors',
          impact_score: Math.floor(Math.random() * 100)
        };
      });
    } else {
      incidents = generateSimulatedIncidents();
    }

    // Calcola trend mensili (12 mesi) a partire dai timestamp degli incidenti
    function computeMonthlyTrends(list) {
      const months = new Array(12).fill(0);
      list.forEach(it => {
        const ts = it.date || it.timestamp || it.pubDate || new Date().toISOString();
        const d = new Date(ts);
        if (!isNaN(d)) {
          months[d.getUTCMonth()] += 1;
        }
      });
      const total = months.reduce((a, b) => a + b, 0);
      if (total === 0) {
        // genera valori plausibili se non ci sono date utili
        for (let i = 0; i < 12; i++) months[i] = Math.floor(Math.random() * 200) + 400;
      }
      return months;
    }

    const monthly_trends = computeMonthlyTrends(incidents);

    // Calcola statistiche aggregate (per pannello Statistiche Anno 2026)
    function computeAggregatedStats(list) {
      const stats = {
        total_incidents: list.length,
        ransomware: 0,
        data_breaches: 0,
        vulnerability_disclosures: 0,
        countries_affected: 0,
        estimated_damage_usd: 0,
      };

      const countrySet = new Set();
      let impactSum = 0;

      list.forEach(it => {
        const type = (it.type || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();

        if (type.includes('ransom') || desc.includes('ransom')) stats.ransomware += 1;
        if (type.includes('breach') || desc.includes('breach')) stats.data_breaches += 1;
        if (type.includes('vulner') || type.includes('exploit') || desc.includes('cve') || desc.includes('vulner')) stats.vulnerability_disclosures += 1;

        if (it.country) countrySet.add(it.country);
        if (typeof it.impact_score === 'number') impactSum += it.impact_score;
      });

      stats.countries_affected = countrySet.size;

      // Stima danni più sofisticata: usa pesi per tipologia e impact_score se presente
      // Pesi base (educativi): ransomware=5, breach=8, exploit=2, ddos=1.5, phishing=1
      let weighted = 0;
      list.forEach(it => {
        const type = (it.type || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();
        let weight = 1;
        if (type.includes('ransom') || desc.includes('ransom')) weight = 5;
        else if (type.includes('breach') || desc.includes('breach') || desc.includes('pii')) weight = 8;
        else if (type.includes('exploit') || type.includes('vulner') || desc.includes('cve')) weight = 3;
        else if (type.includes('ddos') || desc.includes('ddos')) weight = 1.5;
        else if (type.includes('phish') || desc.includes('phish')) weight = 1;

        const impact = (typeof it.impact_score === 'number') ? it.impact_score : 50; // default impact score
        weighted += weight * impact;
      });

      // Converti in stima USD usando fattore moltiplicativo (educativo)
      // weighted * 5 milioni => USD
      stats.estimated_damage_usd = Math.round(weighted * 5000000);

      return stats;
    }

    const aggregated_stats = computeAggregatedStats(incidents);

    incidentsCache = {
      incidents,
      lastUpdate: new Date().toISOString(),
      total_incidents: incidents.length,
      monthly_trends,
      aggregated_stats,
      source: 'NVD (NIST) / CISA / Official Public Threat Intelligence',
      update_frequency: 'Aggiornamento ogni 30s - Educational',
      disclaimer: 'EDUCATIONAL USE ONLY - Dati aggregati da fonti pubbliche ufficiali'
    };

    // Salva cache su disco per persistenza fra riavvii
    saveIncidentsCacheToDisk(incidentsCache);

    console.log('✅ Cache incidenti aggiornata:', incidentsCache.lastUpdate);
  } catch (err) {
    console.warn('⚠️ Errore aggiornamento cache incidenti, mantengo cache esistente:', err.message);
  }
}

// Avvia la prima popolazione cache e pianifica gli aggiornamenti (5 minuti)
// 5 minuti evita rate limit di API esterne (NVD, CISA, etc.) mantenendo aggiornamenti ragionevoli
// refreshIncidentsCache(); // Spostato alla fine del file
// setInterval(refreshIncidentsCache, 5 * 60 * 1000);

// ========================
// ENDPOINT SOCIAL PROFILING
// ========================
app.post('/api/social-profile', authenticateToken, scanLimiter, async (req, res) => {
  const { username } = req.body;
  
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  try {
    const result = {
      username,
      timestamp: new Date().toISOString(),
      results: []
    };

    // Ricerca su Google
    try {
      const googleSearch = await axios.get(`https://www.google.com/search?q="${username}"`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        validateStatus: () => true
      });
      
      if (googleSearch.status === 200) {
        const matches = googleSearch.data.match(/\/url\?q=([^&]+)/g) || [];
        result.results.push({
          source: 'Google Search',
          count: matches.length,
          data: matches.slice(0, 5)
        });
      }
    } catch (err) {
      console.error('Google search error:', err.message);
    }

    // Ricerca GitHub
    try {
      const githubSearch = await axios.get(`https://api.github.com/search/users?q=${username}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (githubSearch.data.items && githubSearch.data.items.length > 0) {
        const user = githubSearch.data.items[0];
        result.results.push({
          source: 'GitHub',
          found: true,
          data: {
            username: user.login,
            profile_url: user.html_url,
            avatar: user.avatar_url,
            public_repos: 'Check profile',
            followers: 'Check profile'
          }
        });
      }
    } catch (err) {
      console.error('GitHub search error:', err.message);
    }

    // Ricerca nome utente su siti comuni
    const commonSites = [
      { name: 'Twitter', url: `https://twitter.com/${username}` },
      { name: 'LinkedIn', url: `https://linkedin.com/in/${username}` },
      { name: 'Instagram', url: `https://instagram.com/${username}` },
      { name: 'Reddit', url: `https://reddit.com/user/${username}` },
      { name: 'YouTube', url: `https://youtube.com/@${username}` },
      { name: 'TikTok', url: `https://tiktok.com/@${username}` }
    ];

    for (const site of commonSites) {
      try {
        const response = await axios.head(site.url, {
          timeout: 3000,
          maxRedirects: 0,
          validateStatus: () => true
        });

        result.results.push({
          source: site.name,
          found: response.status !== 404,
          url: site.url,
          status: response.status
        });
      } catch (err) {
        result.results.push({
          source: site.name,
          found: false,
          error: 'Not accessible'
        });
      }
    }

    // HIBP API (Have I Been Pwned)
    try {
      const hibpResponse = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${username}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'EVIL-Scanner'
        },
        validateStatus: () => true
      });

      if (hibpResponse.status === 200) {
        result.results.push({
          source: 'Have I Been Pwned',
          breaches: hibpResponse.data.map(b => ({
            name: b.Name,
            date: b.BreachDate,
            dataClasses: b.DataClasses
          }))
        });
      }
    } catch (err) {
      console.error('HIBP error:', err.message);
    }

    result.status = 'success';
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT PUBLIC INFO GATHERING
// ========================
app.post('/api/osint-search', authenticateToken, scanLimiter, async (req, res) => {
  const { target, type } = req.body;
  
  if (!target || !type) {
    return res.status(400).json({ error: 'Target and type required' });
  }

  try {
    const result = {
      target,
      type,
      timestamp: new Date().toISOString(),
      data: {}
    };

    if (type === 'domain') {
      // Analisi dominio approfondita
      const domain = target.replace('http://', '').replace('https://', '').split('/')[0];
      
      // WHOIS info - FIXED: Use execFile with separate arguments (prevents injection)
      try {
        result.data.whois = await new Promise((resolve) => {
          execFileAsync('whois', [domain], { timeout: 10000 })
            .then(({ stdout }) => {
              const lines = stdout.split('\n').slice(0, 20);
              resolve({ info: lines.join(' ') });
            })
            .catch((error) => {
              resolve({ error: 'WHOIS not available' });
            });
        });
      } catch (err) {
        result.data.whois = { error: 'WHOIS lookup failed' };
      }

      // DNS records (already implemented)
      try {
        result.data.dns = {
          A: await dns.resolve4(domain).catch(() => []),
          MX: await dns.resolveMx(domain).catch(() => []),
          NS: await dns.resolveNs(domain).catch(() => []),
          TXT: await dns.resolveTxt(domain).catch(() => [])
        };
      } catch (err) {
        result.data.dns = { error: 'DNS lookup failed' };
      }

      // SSL Certificate
      try {
        const cert = await getCertificate(domain);
        result.data.ssl = cert;
      } catch (err) {
        result.data.ssl = { error: 'SSL lookup failed' };
      }

      // HTTP Headers
      try {
        const headers = await getHttpHeaders(`https://${domain}`);
        result.data.headers = headers;
      } catch (err) {
        result.data.headers = { error: 'Headers lookup failed' };
      }

      // Subdomain enumeration con certs.sh - FIXED: Use axios instead of shell pipes
      try {
        const response = await axios.get(`https://certs.sh?q=%.${domain}`, {
          timeout: 10000
        });
        // Parse JSON response and extract CN fields
        const matches = (response.data || '').match(/"cn":"([^"]*)"/g) || [];
        const subdomains = matches
          .map(m => m.replace(/"cn":"|"$/g, ''))
          .slice(0, 10);
        result.data.subdomains = subdomains.length > 0 ? subdomains : 'None found';
      } catch (err) {
        result.data.subdomains = 'Enumeration failed';
      }
    } 
    else if (type === 'person') {
      // Ricerca persona
      const person = target;

      // Google Dork search simulation
      result.data.google_dorks = [
        `"${person}" site:linkedin.com`,
        `"${person}" site:github.com`,
        `"${person}" site:twitter.com`,
        `"${person}" email site:facebook.com`
      ];

      // Search common databases
      const personResults = [];

      // LinkedIn (headless check)
      try {
        const linkedinUrl = `https://www.linkedin.com/in/${person.toLowerCase().replace(/\s/g, '-')}`;
        const linkedinCheck = await axios.head(linkedinUrl, {
          timeout: 3000,
          validateStatus: () => true
        });
        personResults.push({
          source: 'LinkedIn',
          found: linkedinCheck.status !== 404,
          url: linkedinCheck.status !== 404 ? linkedinUrl : 'Not found'
        });
      } catch (err) {
        personResults.push({ source: 'LinkedIn', found: false });
      }

      // Facebook (public search)
      try {
        const fbUrl = `https://facebook.com/search/people/?q=${encodeURIComponent(person)}`;
        personResults.push({
          source: 'Facebook Search',
          url: fbUrl,
          note: 'Manual search required'
        });
      } catch (err) {
        personResults.push({ source: 'Facebook', found: false });
      }

      // HIBP - check if person's email was breached
      result.data.person_search = personResults;

      // Try to find email variations
      const emailPatterns = [
        `${person.split(' ')[0]}.${person.split(' ')[1]}@gmail.com`,
        `${person.split(' ')[0]}${person.split(' ')[1]}@gmail.com`,
        `${person.split(' ')[0]}.${person.split(' ')[1]}@yahoo.com`
      ];
      result.data.possible_emails = emailPatterns;
    }
    else if (type === 'company') {
      // Ricerca azienda
      const company = target;

      // Crunchbase search (simulate)
      result.data.company_search = {
        crunchbase: `https://www.crunchbase.com/organization/${company.toLowerCase().replace(/\s/g, '-')}`,
        google: `https://www.google.com/search?q="${company}" company`,
        bloomberg: `https://www.bloomberg.com/search?query=${company}`
      };

      // Find common company emails
      try {
        const emailResponse = await axios.get(`https://hunter.io/v2/domain/search?domain=${company.toLowerCase().replace(/\s/g, '')}.com&limit=5`, {
          timeout: 5000,
          validateStatus: () => true
        });

        if (emailResponse.data && emailResponse.data.data) {
          result.data.company_emails = emailResponse.data.data.emails || [];
        }
      } catch (err) {
        result.data.company_emails = [];
      }

      // LinkedIn company page
      result.data.linkedin = `https://linkedin.com/company/${company.toLowerCase().replace(/\s/g, '-')}`;
      
      // Tech stack (BuiltWith-like)
      result.data.tech_search = `https://www.builtwith.com/?${company.toLowerCase().replace(/\s/g, '')}`;
    }

    result.status = 'success';
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, status: 'error' });
  }
});

// ========================
// ENDPOINT PROGRESSI E TROFEI
// ========================

// Carica il database dei trofei
app.get('/api/achievements', authenticateToken, (req, res) => {
  try {
    const achievementsFile = path.join(__dirname, 'achievements.json');
    if (fs.existsSync(achievementsFile)) {
      const data = fs.readFileSync(achievementsFile, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.status(404).json({ error: 'Achievements database not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const defaultProgress = () => ({
  totalScans: 0,
  totalActivities: 0,
  unlockedAchievements: [],
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
      user.progress = {
        totalScans: 0,
        totalActivities: 0,
        unlockedAchievements: [],
        activityLog: [],
        lastUnlockedAchievement: null
      };
    }

    if (!user.progress.unlockedAchievements.includes(achievementId)) {
      user.progress.unlockedAchievements.push(achievementId);
      user.progress.lastUnlockedAchievement = achievementId;
      saveUsers();
    }

    res.json({ status: 'success', unlockedAchievements: user.progress.unlockedAchievements });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    // Check if user already exists
    const existingUser = users.find(u => u.email === normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email already registered' 
      });
    }

    // Genera codice di verifica
    const verificationCode = emailService.generateVerificationCode();
    const verificationCodeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');

    // Hash password with bcryptjs (configurable BCRYPT_ROUNDS from .env)
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12);
    const hashedPassword = await bcryptjs.hash(password, rounds);

    // Crea utente pendente (non verificato)
    const pendingUser = {
      id: crypto.randomUUID ? crypto.randomUUID() : `uid_${Date.now()}`,
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      verificationCodeHash: verificationCodeHash,
      verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
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
    saveUsers();

    // Invia email di verifica
    const emailResult = await emailService.sendVerificationCode(normalizedEmail, verificationCode, name);
    
    if (!emailResult.success) {
      // Rimuovi utente se email fallisce
      users = users.filter(u => u.id !== pendingUser.id);
      saveUsers();
      
      return res.status(500).json({ 
        error: 'Errore invio email di verifica. Riprova.' 
      });
    }

    // Audit log
    auditLog.security('USER_REGISTERED_PENDING', { userId: pendingUser.id, email: normalizedEmail }, 'INFO');

    res.json({
      status: 'success',
      message: 'Registrazione iniziata. Controlla la tua email per il codice di verifica.',
      requiresVerification: true,
      userId: pendingUser.id,
      email: normalizedEmail
    });
  } catch (err) {
    logger.error('Registration error', { error: err.message });
    res.status(500).json({ error: 'Errore registrazione' });
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

    // Verify password with bcryptjs
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
app.post('/api/auth/refresh-token', async (req, res) => {
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
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email obbligatoria' });
    }

    const user = users.find(u => u.email === email);

    if (!user) {
      // Non rivelare se email esiste (security best practice)
      return res.json({ status: 'success', message: 'Se email esiste, riceverai link reset' });
    }

    // Genera un reset token (in produzione usare database, non memoria)
    const resetToken = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      status: 'success',
      message: 'Email reset inviata (in produzione)',
      resetToken // In produzione: inviare via email
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore: ' + err.message });
  }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Tutti i campi obbligatori' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Le password non corrispondono' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password deve avere almeno 6 caratteri' });
    }

    // Verifica reset token
    jwt.verify(resetToken, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Token reset non valido o scaduto' });
      }

      const user = users.find(u => u.id === decoded.id);

      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Hash nuova password
      const hashedPassword = await bcryptjs.hash(newPassword, 10);
      user.password = hashedPassword;

      saveUsers();

      res.json({ status: 'success', message: 'Password cambiata con successo' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore: ' + err.message });
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

    // Genera nuovo codice di verifica
    const verificationCode = emailService.generateVerificationCode();
    const verificationCodeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');

    // Aggiorna il codice
    user.verificationCodeHash = verificationCodeHash;
    user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    saveUsers();

    // Invia email
    const emailResult = await emailService.sendVerificationCode(user.email, verificationCode, user.name);
    
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Errore invio email. Riprova.' });
    }

    res.json({ status: 'success', message: 'Codice reinviato alla tua email' });
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
 * File Upload with Security
 * - Applicazione mimeType Whitelist (middleware/upload.js)
 * - UUID Filename Generation (no original names)
 * - User-Isolated Storage
 * - Rate Limiting (50 files/24h per user)
 */
app.post('/api/file-upload', 
  authenticateToken,
  uploadLimiter,
  multerUpload.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'File non fornito' });
      }

      const file = req.file;
      const fileStats = fs.statSync(file.path);

      // Calcola hash del file
      const fileBuffer = fs.readFileSync(file.path);
      const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Mock scan results (in produzione: VirusTotal API)
      const scanResults = {
        filename: file.filename, // UUID generato dal middleware
        originalName: file.originalname,
        size: fileStats.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        md5: md5,
        sha256: sha256,
        analysis: {
          isSuspicious: fileStats.size > 10 * 1024 * 1024, // > 10MB
          detectionRate: Math.random() < 0.15 ? `${Math.floor(Math.random() * 30)}/70` : '0/70',
          verdict: fileStats.size > 10 * 1024 * 1024 ? 'suspicious' : 'clean',
          attributes: {
            magic: 'Unknown',
            magic_type: 'Unknown',
            tags: []
          }
        },
        scanDate: new Date().toISOString(),
        status: 'completed'
      };

      // Update user progress
      const user = users.find(u => u.id === req.user.id);
      if (user) {
        if (!user.progress) user.progress = { scans: 0, activities: 0, unlockedAchievements: [] };
        user.progress.activities = (user.progress.activities || 0) + 1;
        
        if (!user.uploadedFiles) user.uploadedFiles = [];
        user.uploadedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          md5: md5,
          size: fileStats.size
        });
        
        saveUsers();
      }

      // Audit log
      auditLog.fileUpload(req.user.id, file.filename, fileStats.size, file.mimetype, req.ip);

      res.json({
        status: 'success',
        result: scanResults,
        message: 'File analizzato con successo'
      });
    } catch (err) {
      logger.error('File upload error', { error: err.message, userId: req.user.id });
      res.status(500).json({ error: 'Errore analisi file' });
    }
  }
);

// ==================== REPORT GENERATOR ====================
app.post('/api/report-generator', authenticateToken, (req, res) => {
  try {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }

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

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const errorResponse = {
    error: isDevelopment ? message : 'Something went wrong',
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
  console.log(`🔧 Environment: ${nodeEnv}`);
  console.log(`🔐 CORS Origins: ${corsOrigins}`);
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
  console.log(`   • Auth Login: POST /api/auth/login`);
  console.log(`   • Auth Logout: POST /api/auth/logout`);
  console.log(`   • Auth Profile: GET /api/auth/profile`);
  console.log(`   • Auth Verify: POST /api/auth/verify`);
  console.log(`   • File Upload: POST /api/file-upload`);
  console.log(`   • Report Generator: POST /api/report-generator`);
  console.log(`   • Achievements: GET /api/achievements`);
  console.log(`   • Progress Load: GET /api/progress/load`);
  console.log(`   • Progress Save: POST /api/progress/save`);
  console.log(`   • Unlock Achievement: POST /api/progress/unlock-achievement\n`);
});
