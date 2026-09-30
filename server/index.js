'use strict';
// Avvio del server HTTP + WebSocket
const http = require('http');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { buildContext } = require('./context');
const { createApp } = require('./app');
const { logger } = require('../middleware/logger');
const { shouldEnforceHttps, getCanonicalOrigin } = require('../middleware/https-enforce');
const { isProduction, describeEnv } = require('../utils/env');

async function main() {
  const ctx = await buildContext();
  const { emailService, incidents, db } = ctx;

  const app = createApp(ctx);
  const server = http.createServer(app);
  incidents.attach(server);

  let shuttingDown = false;
  async function shutdown(code, reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Arresto del server (${reason})`);
    const timer = setTimeout(() => process.exit(code), 8000);
    timer.unref();
    server.close();
    try {
      await db.close(); // attende le scritture in corso sull'archivio utenti
    } catch (err) {
      logger.error('Errore chiusura archivio utenti', { error: err.message });
    }
    process.exit(code);
  }

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason: reason?.message || String(reason), stack: reason?.stack });
    if (isProduction()) shutdown(1, 'unhandledRejection');
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    shutdown(1, 'uncaughtException');
  });
  process.on('SIGTERM', () => shutdown(0, 'SIGTERM'));
  process.on('SIGINT', () => shutdown(0, 'SIGINT'));

  incidents.start();

  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`\n✅ EVIL avviato su http://0.0.0.0:${config.PORT} (${describeEnv()}, Node ${process.version})`);

    if (!fs.existsSync(path.join(ctx.root, 'css', 'home.bundle.css'))) {
      console.warn('⚠️ Manca css/home.bundle.css — esegui: npm run build:home-css');
    }
    console.log(
      shouldEnforceHttps()
        ? `🔒 HTTPS: redirect attivo → ${getCanonicalOrigin() || '(host richiesta)'}`
        : '🔒 HTTPS: redirect disattivato (sviluppo locale)'
    );
    console.log(
      `🛠️  Strumenti: ${process.env.EVIL_TOOLS_PUBLIC === '1' || process.env.EVIL_TOOLS_PUBLIC === 'true' ? 'accesso pubblico (EVIL_TOOLS_PUBLIC)' : 'login obbligatorio'}`
    );
    console.log(
      db.kind === 'postgres'
        ? `🗄️  Utenti: Postgres (${db.count()} account)`
        : `📁 Utenti: ${db.usersFile} (${db.count()} account)`
    );
    config.warnAboutStorage(db);

    if (emailService.isConfigured()) {
      const transport = emailService.getEmailTransport ? emailService.getEmailTransport() : 'smtp';
      if (transport === 'mailtrap_api') {
        console.log('📧 Email: Mailtrap API (HTTPS)');
      } else {
        console.log(`📧 SMTP: ${emailService.smtpHost}:${emailService.smtpPort} (modalità ${emailService.resolveDeliveryMode()})`);
        emailService.verifyConnection().then((r) => {
          if (r.ok) console.log('📧 SMTP connessione OK');
          else console.warn(`⚠️ SMTP non raggiungibile: ${r.error}`);
        });
      }
      emailService.getSmtpDiagnostics().forEach((h) => console.warn(`⚠️ Email: ${h}`));
    } else {
      console.warn('⚠️ Email non configurata — in sviluppo le email vanno in data/email-outbox/');
    }
  });

  return { app, server, ctx };
}

module.exports = main().catch((err) => {
  console.error(`\n❌ Avvio non riuscito: ${err.message}\n`);
  process.exit(1);
});
