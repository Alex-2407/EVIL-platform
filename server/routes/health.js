'use strict';
// Health check e diagnostica deploy
const crypto = require('crypto');
const { isDevelopment, isTest, describeEnv } = require('../../utils/env');

/**
 * La diagnostica email espone host SMTP, mittente e percorsi del server: in produzione
 * risponde solo con ?key=<DIAGNOSTICS_TOKEN> (se il token non è impostato, è disattivata).
 */
function diagnosticsAllowed(req) {
  if (isDevelopment() || isTest()) return true;
  const expected = process.env.DIAGNOSTICS_TOKEN || '';
  const given = typeof req.query.key === 'string' ? req.query.key : '';
  if (!expected || expected.length < 16 || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function registerHealth(app) {
  // Health checks (Railway/Render/load balancer)
  app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'evil-platform',
      env: describeEnv(),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
}

function registerDiagnostics(app, ctx) {
  const { emailService, db } = ctx;

  // Health API (diagnostica deploy — sempre JSON leggibile)
  app.get('/api/health/ping', (req, res) => {
    res.json({
      ok: true,
      service: 'evil-platform',
      version: process.env.RENDER_GIT_COMMIT || 'local',
      nodeEnv: describeEnv(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health/smtp', async (req, res) => {
    if (!diagnosticsAllowed(req)) return res.status(404).json({ error: 'Non trovato' });
    try {
      const configured = emailService.isConfigured();
      const transport = emailService.getEmailTransport
        ? emailService.getEmailTransport()
        : 'smtp';
      const doVerify = req.query.verify === '1' || req.query.verify === 'true';
      let check = { ok: null, skipped: true };
      if (configured && doVerify) {
        if (transport === 'mailtrap_api') {
          check = { ok: true, mode: 'mailtrap_api', note: 'Verifica invio reale: registrati con una email di test.' };
        } else {
          check = await emailService.verifyConnection();
        }
      } else if (!configured) {
        check = { ok: false, error: 'Email non configurata (SMTP o MAILTRAP_API_TOKEN)' };
      }

      const hints =
        typeof emailService.getSmtpDiagnostics === 'function'
          ? emailService.getSmtpDiagnostics()
          : ['Aggiorna il deploy: manca getSmtpDiagnostics nel server.'];

      res.json({
        ok: check.ok === null ? null : Boolean(check.ok),
        configured,
        verifySkipped: Boolean(check.skipped),
        transport,
        renderHosting: Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID),
        mailtrapApi: transport === 'mailtrap_api',
        host: emailService.smtpHost,
        port: emailService.smtpPort,
        secure: emailService.smtpSecure,
        user: emailService.smtpUser ? `${emailService.smtpUser.slice(0, 6)}…` : '',
        mode: emailService.resolveDeliveryMode(),
        from: emailService.fromEmail,
        baseUrl: process.env.BASE_URL || emailService.baseUrl,
        storage: db.kind,
        usersFile: db.usersFile,
        dataDir: db.dataDir,
        emailDevOutbox: emailService.outboxAllowed(),
        hints,
        error: check.error || null,
        tip:
          transport === 'mailtrap_api'
            ? 'Render free: email via API HTTPS (non SMTP). Prova la registrazione.'
            : 'Aggiungi ?verify=1 per testare SMTP (~8s). Su Render free usa MAILTRAP_API_TOKEN.',
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message, route: '/api/health/smtp' });
    }
  });
}

module.exports = { registerHealth, registerDiagnostics };
