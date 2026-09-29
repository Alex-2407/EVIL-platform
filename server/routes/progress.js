'use strict';
// Catalogo trofei e progressi (estratto da js/server.js)
const fs = require('fs');
const path = require('path');

module.exports = function registerProgress(app, ctx) {
  const { db, authenticateToken, resolveAchievementsFile, root } = ctx;

  // ========================
  // ENDPOINT PROGRESSI E TROFEI
  // ========================

  // Catalogo trofei (pubblico — nessun login richiesto)
  function sendAchievementsCatalog(res) {
    const achievementsFile = resolveAchievementsFile();
    if (!fs.existsSync(achievementsFile)) {
      return res.status(404).json({ error: 'Achievements database not found', path: achievementsFile });
    }
    const data = fs.readFileSync(achievementsFile, 'utf8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.json(JSON.parse(data));
  }

  app.get('/api/achievements', (req, res) => {
    try {
      sendAchievementsCatalog(res);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/achievements.json', (req, res) => {
    try {
      sendAchievementsCatalog(res);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const defaultProgress = () => ({
    totalScans: 0,
    totalActivities: 0,
    unlockedAchievements: [],
    achievementMeta: {},
    completedActivities: [],
    activityLog: [],
    lastUnlockedAchievement: null
  });

  // Salva i progressi dell'utente
  app.post('/api/progress/save', authenticateToken, (req, res) => {
    try {
      const user = db.users.find(u => u.id === req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      user.progress = req.body;
      user.progressUpdatedAt = new Date().toISOString();

      db.save();

      res.json({ status: 'success', message: 'Progressi salvati' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Carica i progressi dell'utente
  app.get('/api/progress/load', authenticateToken, (req, res) => {
    try {
      const user = db.users.find(u => u.id === req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      res.json(user.progress || defaultProgress());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Sblocca manualmente un trofeo (per testing)
  app.post('/api/progress/unlock-achievement', authenticateToken, (req, res) => {
    const { achievementId } = req.body;
    if (!achievementId) {
      return res.status(400).json({ error: 'Achievement ID mancante' });
    }

    try {
      const user = db.users.find(u => u.id === req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      if (!user.progress) {
        user.progress = defaultProgress();
      }
      if (!user.progress.achievementMeta) user.progress.achievementMeta = {};
      if (!user.progress.completedActivities) user.progress.completedActivities = [];

      if (!user.progress.unlockedAchievements.includes(achievementId)) {
        user.progress.unlockedAchievements.push(achievementId);
        user.progress.achievementMeta[achievementId] = { unlockedAt: new Date().toISOString() };
        user.progress.lastUnlockedAchievement = achievementId;
        db.save();
      }

      let achievement = null;
      const achievementsFile = path.join(root, 'achievements.json');
      if (fs.existsSync(achievementsFile)) {
        const db = JSON.parse(fs.readFileSync(achievementsFile, 'utf8'));
        achievement = (db.achievements || []).find((a) => a.id === achievementId) || null;
      }

      res.json({
        status: 'success',
        unlockedAchievements: user.progress.unlockedAchievements,
        achievement
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
};
