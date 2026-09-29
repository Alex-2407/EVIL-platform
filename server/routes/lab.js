'use strict';
// Laboratorio virtuale (estratto da js/server.js)

module.exports = function registerLab(app, ctx) {
  const {
    logger, optionalAuthenticate, sanitizeString, virtualLabService,
    virtualLabSessionLimiter, virtualLabLimiter, incidentsPublicLimiter,
  } = ctx;

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
};
