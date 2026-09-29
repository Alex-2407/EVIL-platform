'use strict';
// Modulo supporto (estratto da js/server.js)

module.exports = function registerHelp(app, ctx) {
  const { helpLimiter, emailService, logger } = ctx;

  // Modulo Help — invio richieste supporto via email
  app.post('/api/help', helpLimiter, async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const email = String(req.body?.email || '').trim().toLowerCase();
      const subject = String(req.body?.subject || '').trim();
      const message = String(req.body?.message || '').trim();
      const page = String(req.body?.page || req.get('Referer') || '').trim().slice(0, 500);

      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'Nome non valido (minimo 2 caratteri).' });
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Indirizzo email non valido.' });
      }
      if (subject.length < 3 || subject.length > 120) {
        return res.status(400).json({ error: 'Oggetto non valido (3–120 caratteri).' });
      }
      if (message.length < 10 || message.length > 4000) {
        return res.status(400).json({ error: 'Messaggio non valido (10–4000 caratteri).' });
      }

      if (!emailService.isConfigured()) {
        return res.status(503).json({
          error: 'Servizio email non configurato sul server.',
          hint: 'Configura MAILTRAP_API_TOKEN o SMTP in produzione.',
        });
      }

      const result = await emailService.sendHelpRequest({ name, email, subject, message, page });
      if (!result.success) {
        return res.status(502).json({
          error: result.error || 'Invio email non riuscito.',
          hint: result.hint || null,
        });
      }

      logger.info('Help request sent', {
        event: 'HELP_REQUEST',
        email,
        subject,
        page,
        confirmationSent: result.confirmationSent,
        ip: req.ip,
      });

      res.json({
        status: 'success',
        message: 'Richiesta inviata. Il team ti risponderà entro 2–5 giorni lavorativi.',
        confirmationSent: Boolean(result.confirmationSent),
        hint: result.hint || result.confirmationHint || null,
      });
    } catch (err) {
      logger.error('Help form error', { error: err.message });
      res.status(500).json({ error: 'Errore interno durante l\'invio della richiesta.' });
    }
  });
};
