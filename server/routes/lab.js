'use strict';
// Laboratorio virtuale (estratto da js/server.js)

module.exports = function registerLab(app, ctx) {
  const {
    logger, optionalAuthenticate, sanitizeString, virtualLabService,
    virtualLabSessionLimiter, virtualLabLimiter, virtualLabIpLimiter, getAuthCookieOptions,
  } = ctx;

  // ==================== LABORATORIO VIRTUALE (VM simulate) ====================
  // Ospiti: identificati da un cookie casuale (evil_lab_anon), non dall'IP
  const secure = typeof getAuthCookieOptions === 'function' ? Boolean(getAuthCookieOptions(null).secure) : false;
  const labOwner = [optionalAuthenticate, virtualLabService.ensureAnonOwner({ secure })];

  function fail(res, err, what) {
    const status = err.status || 500;
    if (status >= 500 && status !== 503) {
      logger.error(`Virtual lab: ${what}`, { error: err.message });
      return res.status(500).json({ error: 'Errore del laboratorio. Riprova tra qualche istante.' });
    }
    return res.status(status).json({ error: err.message });
  }

  app.get('/api/virtual-lab/catalog', optionalAuthenticate, (req, res) => {
    try {
      res.json({
        labs: virtualLabService.catalogForClient(),
        attacker: virtualLabService.ATTACKER,
        disclaimer: 'Ambienti simulati EVIL — rete 10.42.x.x isolata, solo scopo didattico.',
        storage: process.env.REDIS_URL ? 'redis' : 'memory',
      });
    } catch (err) {
      logger.error('Virtual lab catalog error', { error: err.message });
      res.status(500).json({ error: 'Impossibile caricare il catalogo dei lab.' });
    }
  });

  app.post('/api/virtual-lab/sessions', labOwner, virtualLabIpLimiter, virtualLabSessionLimiter, async (req, res) => {
    try {
      const labId = virtualLabService.validateLabId(req.body?.labId || '');
      if (!labId) {
        return res.status(400).json({ error: 'Lab non valido.' });
      }
      const ownerKey = virtualLabService.ownerKeyFromRequest(req);
      const session = await virtualLabService.createSession(labId, ownerKey, { ip: req.ip });
      res.status(201).json({ session });
    } catch (err) {
      fail(res, err, 'avvio sessione');
    }
  });

  app.get('/api/virtual-lab/sessions/:id', labOwner, virtualLabIpLimiter, async (req, res) => {
    try {
      const ownerKey = virtualLabService.ownerKeyFromRequest(req);
      const session = await virtualLabService.getSession(req.params.id, ownerKey);
      const lab = virtualLabService.getLab(session.labId);
      res.json({ session: virtualLabService.sanitizeSession(session, lab) });
    } catch (err) {
      fail(res, err, 'lettura sessione');
    }
  });

  app.post('/api/virtual-lab/sessions/:id/exec', labOwner, virtualLabIpLimiter, virtualLabLimiter, async (req, res) => {
    try {
      const command = sanitizeString(req.body?.command || '', { escapeHtml: false });
      if (!command) {
        return res.status(400).json({ error: 'Scrivi un comando.' });
      }
      const ownerKey = virtualLabService.ownerKeyFromRequest(req);
      const result = await virtualLabService.execCommand(req.params.id, ownerKey, command);
      res.json(result);
    } catch (err) {
      fail(res, err, 'esecuzione comando');
    }
  });

  app.delete('/api/virtual-lab/sessions/:id', labOwner, virtualLabIpLimiter, async (req, res) => {
    try {
      const ownerKey = virtualLabService.ownerKeyFromRequest(req);
      await virtualLabService.stopSession(req.params.id, ownerKey);
      res.json({ ok: true });
    } catch (err) {
      fail(res, err, 'chiusura sessione');
    }
  });
};
