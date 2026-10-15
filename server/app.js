'use strict';
// Composizione dell'app Express: l'ordine dei middleware è quello di js/server.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const securityHeaders = require('../middleware/security-headers');
const { httpsRedirectMiddleware } = require('../middleware/https-enforce');
const { logger, httpLogger } = require('../middleware/logger');
const { globalLimiter } = require('../middleware/limiter');
const pages = require('./pages');
const { i18nMiddleware } = require('./i18n');
const { registerHealth, registerDiagnostics } = require('./routes/health');
const registerTools = require('./routes/tools');
const registerLab = require('./routes/lab');
const registerProgress = require('./routes/progress');
const registerHelp = require('./routes/help');
const registerAuth = require('./routes/auth');
const { registerCertificates } = require('./routes/certificates');
const registerCourses = require('./routes/courses');
const { isDevelopment, isProduction, isTest } = require('../utils/env');
const { parseTrustProxy, describeTrustProxy } = require('../utils/trust-proxy');
const { isOriginAllowed, wildcardConfigured } = require('./lib/origins');

const root = pages.root;

// req.t esiste dopo i18nMiddleware; gli errori possono nascere prima (JSON malformato…)
// t() segna il testo per `node scripts/i18n.js extract-server`
const t = (text) => text;
const tr = (req, text) => (typeof req.t === 'function' ? req.t(text) : text);

function createApp(ctx) {
  const app = express();
  app.disable('x-powered-by'); // anche per /health, registrato prima di helmet

  registerHealth(app);

  // IP reale del visitatore (rate limit, sessioni lab): ci si fida di X-Forwarded-For solo se
  // TRUST_PROXY lo dichiara (numero di proxy o elenco IP/CIDR). Su Render: TRUST_PROXY=1 (S-02).
  const trust = parseTrustProxy();
  app.set('trust proxy', trust.value);
  if (trust.error) logger.warn(`TRUST_PROXY non valido: ${trust.error}`);
  if (!isTest()) {
    logger.info(`Trust proxy: ${describeTrustProxy()}`);
    if (isProduction() && trust.value === false) {
      logger.warn('TRUST_PROXY non impostato: dietro un proxy (Render) tutti i visitatori avranno lo stesso IP e condivideranno i limiti di richieste. Su Render imposta TRUST_PROXY=1.');
    }
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

  // Header di sicurezza PRIMA degli statici e delle pagine: prima erano registrati
  // dopo, e le pagine HTML uscivano senza CSP, X-Frame-Options e nosniff.
  securityHeaders(app);

  pages.mountStatic(app);

  // Cookie letti anche dal limite globale (conteggio per utente autenticato)
  app.use(cookieParser());
  // lingua della richiesta (req.lang, req.t) per i messaggi delle API
  app.use(i18nMiddleware);

  // Limite globale solo sulle API: statici e pagine non passano di qui
  app.use('/api', globalLimiter);

  // ==================== APPLY LOGGING MIDDLEWARE ====================
  app.use(httpLogger);

  // ==================== CORS ====================
  // Le comodità di sviluppo si accendono solo con NODE_ENV=development esplicito
  // (prima bastava che NODE_ENV non fosse "production", anche se mancava del tutto).
  const isDev = isDevelopment();

  // Debug locale: elenco dei file serviti (esclusi node_modules, .git e dati)
  if (isDev) {
    const SKIP = new Set(['node_modules', '.git', 'data', 'logs', 'uploads']);
    app.get('/__debug/files', (req, res) => {
      try {
        const walk = (dir) => {
          let results = [];
          for (const file of fs.readdirSync(dir)) {
            if (SKIP.has(file) || file.startsWith('.env')) continue;
            const full = path.join(dir, file);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) results = results.concat(walk(full));
            else results.push(path.relative(root, full));
          }
          return results;
        };
        res.json({ cwd: process.cwd(), root, files: walk(root) });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
  }

  function isCorsOriginAllowed(origin, req) {
    if (isDev) return true;
    return isOriginAllowed(origin, req.get('host'));
  }

  if (wildcardConfigured()) {
    logger.warn('CORS_ORIGINS contiene "*": valore ignorato (con i cookie di sessione non è sicuro)');
  }

  const corsMiddleware = cors({
    origin: true, // riflette l'origine, già verificata qui sotto
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-EVIL-Lang'],
  });

  app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && !isCorsOriginAllowed(origin, req)) {
      // Richiesta da un altro sito: rifiutata prima di arrivare alle route
      logger.warn('CORS blocked', { origin, host: req.get('host'), path: req.path });
      return res.status(403).json({ error: req.t('Origine non consentita.'), code: 'CORS_FORBIDDEN' });
    }
    return corsMiddleware(req, res, next);
  });
  app.use(express.json({ limit: '256kb' }));

  pages.mountPageRoutes(app);

  registerTools(app, ctx);
  ctx.incidents.register(app);
  ctx.news.register(app);
  registerLab(app, ctx);
  registerProgress(app, ctx);
  registerHelp(app, ctx);
  registerDiagnostics(app, ctx);
  registerAuth(app, ctx);
  registerCourses(app, ctx);
  registerCertificates(app, ctx);

  // ==================== 404 ====================
  const notFoundPage = path.join(root, 'html', '404.html');
  app.use((req, res) => {
    const wantsHtml = req.method === 'GET' && !req.path.startsWith('/api/') && req.accepts(['html', 'json']) === 'html';
    if (wantsHtml && fs.existsSync(notFoundPage)) {
      res.status(404);
      return res.sendFile(notFoundPage);
    }
    return res.status(404).json({ error: tr(req, t('Risorsa non trovata.')), code: 'NOT_FOUND', status: 'error' });
  });

  // ==================== ERRORI ====================
  app.use((error, req, res, next) => {
    const statusCode = Number(error.statusCode || error.status) || 500;

    // Errori del client (JSON malformato, corpo troppo grande, ...): niente stack nei log
    if (statusCode < 500) {
      logger.warn('Richiesta non valida', { status: statusCode, type: error.type, url: req.originalUrl, method: req.method, ip: req.ip });
      const friendly =
        error.type === 'entity.parse.failed' ? tr(req, t('Il corpo della richiesta non è un JSON valido.'))
          : error.type === 'entity.too.large' ? tr(req, t('Richiesta troppo grande.'))
            : error.expose && error.message ? error.message
              : tr(req, t('Richiesta non valida.'));
      return res.status(statusCode).json({ error: friendly, status: 'error' });
    }

    logger.error('Request Error', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode,
    });

    if (res.headersSent) return next(error);
    const body = { error: tr(req, t('Errore interno del server. Riprova tra poco.')), status: 'error' };
    if (isDev) {
      body.detail = error.message;
      body.stack = error.stack;
    }
    return res.status(statusCode).json(body);
  });

  return app;
}

module.exports = { createApp };
