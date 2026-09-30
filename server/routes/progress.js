'use strict';
// Catalogo trofei e progressi utente
const fs = require('fs');
const crypto = require('crypto');

module.exports = function registerProgress(app, ctx) {
  const { db, logger, authenticateToken, resolveAchievementsFile, normalizeProgress, mergeClientProgress } = ctx;

  // Catalogo letto una volta e riletto solo se il file cambia
  let cache = { mtimeMs: 0, body: null, etag: null, ids: new Set() };
  function loadCatalog() {
    const file = resolveAchievementsFile();
    const stat = fs.statSync(file);
    if (cache.body && cache.mtimeMs === stat.mtimeMs) return cache;
    const body = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(body);
    cache = {
      mtimeMs: stat.mtimeMs,
      body,
      etag: `"${crypto.createHash('sha1').update(body).digest('hex').slice(0, 16)}"`,
      ids: new Set((parsed.achievements || []).map((a) => a.id)),
    };
    return cache;
  }

  function sendAchievementsCatalog(req, res) {
    try {
      const catalog = loadCatalog();
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('ETag', catalog.etag);
      if (req.headers['if-none-match'] === catalog.etag) return res.status(304).end();
      res.type('application/json').send(catalog.body);
    } catch (err) {
      logger.error('Achievements catalog error', { error: err.message });
      res.status(500).json({ error: 'Catalogo trofei non disponibile' });
    }
  }

  app.get('/api/achievements', sendAchievementsCatalog);
  app.get('/achievements.json', sendAchievementsCatalog);

  app.get('/api/progress/load', authenticateToken, (req, res) => {
    const user = req.userRecord;
    res.setHeader('Cache-Control', 'no-store');
    res.json(normalizeProgress(user.progress));
  });

  // Il browser invia i propri progressi: vengono validati e fusi con quelli del server
  // (i trofei devono esistere nel catalogo, i contatori non possono diminuire).
  app.post('/api/progress/save', authenticateToken, async (req, res) => {
    const user = req.userRecord;
    try {
      let ids = null;
      try {
        ids = loadCatalog().ids;
      } catch {
        ids = null;
      }
      user.progress = mergeClientProgress(user.progress, req.body, ids);
      user.progressUpdatedAt = new Date().toISOString();
      await db.save(user);
      res.json({ status: 'success', message: 'Progressi salvati', progress: user.progress });
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ error: err.message });
      logger.error('Progress save error', { error: err.message, userId: user.id });
      res.status(500).json({ error: 'Impossibile salvare i progressi. Riprova.' });
    }
  });
};
