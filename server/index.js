'use strict';
// Avvio del server HTTP + WebSocket (estratto da js/server.js)
const http = require('http');
const config = require('./config');
const ctx = require('./context');
const { createApp } = require('./app');
const { logger } = require('../middleware/logger');
const { shouldEnforceHttps, getCanonicalOrigin } = require('../middleware/https-enforce');
const path = require('path');
const fs = require('fs');

const { PORT } = config;
const { emailService, incidents } = ctx;
const usersFile = ctx.db.usersFile;
const root = ctx.root;

const app = createApp(ctx);
const server = http.createServer(app);
incidents.attach(server);


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

incidents.start();

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
    const transport = emailService.getEmailTransport ? emailService.getEmailTransport() : 'smtp';
    if (transport === 'mailtrap_api') {
      console.log('📧 Email: Mailtrap API (HTTPS) — adatto a Render free tier');
    } else {
      console.log(
        `📧 SMTP: ${emailService.smtpHost}:${emailService.smtpPort} secure=${emailService.smtpSecure} (modalità ${emailService.resolveDeliveryMode()})`
      );
    }
    const smtpHints = emailService.getSmtpDiagnostics();
    smtpHints.forEach((h) => console.warn(`⚠️ Email: ${h}`));
    if (transport === 'mailtrap_api') {
      console.log('📧 Verifica invio: registrati con una email di test (SMTP disabilitato su Render free).');
    } else {
      emailService.verifyConnection().then((r) => {
        if (r.ok) console.log('📧 SMTP connessione OK');
        else console.warn(`⚠️ SMTP non raggiungibile: ${r.error}`);
      });
    }
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

module.exports = { app, server };
