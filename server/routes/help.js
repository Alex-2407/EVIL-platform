'use strict';
/**
 * Modulo di supporto (help.html).
 *
 * - la richiesta va sempre e solo all'indirizzo dello staff (HELP_SUPPORT_EMAIL),
 *   con Reply-To sull'indirizzo indicato dall'utente
 * - l'email di conferma parte solo se chi scrive ha fatto l'accesso e l'indirizzo
 *   del modulo è quello verificato del suo account: il modulo non può più essere
 *   usato per inviare email a indirizzi di terzi (EVL-08)
 * - limite per IP (helpLimiter) e campo trappola per i bot
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, max) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max + 1);
}

module.exports = function registerHelp(app, ctx) {
  const { helpLimiter, optionalAuthenticate, emailService, logger } = ctx;

  app.post('/api/help', helpLimiter, optionalAuthenticate, async (req, res) => {
    try {
      const body = req.body || {};
      // Campo nascosto: le persone non lo vedono, molti bot lo compilano
      if (clean(body.website, 200)) {
        logger.warn('Help form: campo trappola compilato', { event: 'HELP_HONEYPOT', ip: req.ip });
        return res.json({
          status: 'success',
          message: 'Richiesta inviata. Ti risponderemo entro 2–5 giorni lavorativi.',
          confirmationSent: false,
        });
      }

      const name = clean(body.name, 100).replace(/\s+/g, ' ');
      const email = clean(body.email, 254).toLowerCase();
      const subject = clean(body.subject, 120).replace(/\s+/g, ' ');
      const message = clean(body.message, 4000);
      const page = clean(body.page || req.get('Referer') || '', 500);

      if (name.length < 2 || name.length > 100) {
        return res.status(400).json({ error: 'Scrivi il tuo nome (da 2 a 100 caratteri).', field: 'name' });
      }
      if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Controlla l\'indirizzo email: serve per risponderti.', field: 'email' });
      }
      if (subject.length < 3 || subject.length > 120) {
        return res.status(400).json({ error: 'L\'oggetto deve avere da 3 a 120 caratteri.', field: 'subject' });
      }
      if (message.length < 10 || message.length > 4000) {
        return res.status(400).json({ error: 'Il messaggio deve avere da 10 a 4000 caratteri.', field: 'message' });
      }

      if (!emailService.isConfigured() && !emailService.outboxAllowed()) {
        logger.error('Help form: email non configurata sul server');
        return res.status(503).json({
          error: 'Il modulo di supporto non è disponibile in questo momento. Riprova più tardi.',
        });
      }

      const user = req.userRecord || null;
      const ownsAddress = Boolean(user && user.emailVerified && String(user.email).toLowerCase() === email);

      const result = await emailService.sendHelpRequest({
        name,
        email,
        subject,
        message,
        page,
        account: user ? { id: user.id, verified: Boolean(user.emailVerified) } : null,
        confirmTo: ownsAddress ? user.email : null,
        confirmName: ownsAddress ? user.name : null,
      });

      if (!result.success) {
        logger.error('Help form: invio non riuscito', { error: result.error });
        return res.status(502).json({
          error: 'Non siamo riusciti a inviare la richiesta. Riprova tra qualche minuto.',
        });
      }

      logger.info('Help request sent', {
        event: 'HELP_REQUEST',
        userId: user?.id || null,
        page,
        confirmationSent: result.confirmationSent,
        ip: req.ip,
      });

      return res.json({
        status: 'success',
        message: `Richiesta inviata. Ti risponderemo a ${email} entro 2–5 giorni lavorativi.`,
        confirmationSent: Boolean(result.confirmationSent),
      });
    } catch (err) {
      logger.error('Help form error', { error: err.message });
      return res.status(500).json({ error: 'Errore interno durante l\'invio della richiesta. Riprova.' });
    }
  });
};
