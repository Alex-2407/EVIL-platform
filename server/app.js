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
const { registerHealth, registerDiagnostics } = require('./routes/health');
const registerTools = require('./routes/tools');
const registerLab = require('./routes/lab');
const registerProgress = require('./routes/progress');
const registerHelp = require('./routes/help');
const registerAuth = require('./routes/auth');

const root = pages.root;

function createApp(ctx) {
  const app = express();

  registerHealth(app);

  // Dietro nginx/Cloudflare in produzione: IP reale per rate limit e sessioni lab
  if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
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

  // Limite globale solo sulle API: statici e pagine non passano di qui
  app.use('/api', globalLimiter);

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
  app.use(express.json({ limit: '256kb' }));

  pages.mountPageRoutes(app);

  registerTools(app, ctx);
  ctx.incidents.register(app);
  registerLab(app, ctx);
  registerProgress(app, ctx);
  registerHelp(app, ctx);
  registerDiagnostics(app, ctx);
  registerAuth(app, ctx);

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

  return app;
}

module.exports = { createApp };
