'use strict';
/**
 * Notizie di sicurezza: GET /api/news (pubblica). Aggiornamento automatico ogni ora,
 * cache su disco per ripartire con gli ultimi articoli reali.
 */
const fs = require('fs');
const path = require('path');
const { createNewsService } = require('../../services/news-service');

const HOUR = 60 * 60 * 1000;
const root = path.resolve(__dirname, '..', '..');

module.exports = function createNews(ctx) {
  const { logger, incidentsPublicLimiter } = ctx;
  const service = ctx.newsService || createNewsService();
  const cacheDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root;
  const cacheFile = path.join(cacheDir, '.news-cache.json');
  const useDisk = process.env.NODE_ENV !== 'test';

  try {
    if (useDisk && fs.existsSync(cacheFile)) service.load(JSON.parse(fs.readFileSync(cacheFile, 'utf8')));
  } catch (err) {
    logger.warn('Cache news illeggibile', { error: err.message });
  }

  let inflight = null;
  let lastAttempt = 0;
  async function refresh() {
    if (inflight) return inflight;
    lastAttempt = Date.now();
    inflight = (async () => {
      try {
        const snap = await service.refresh();
        const tmp = `${cacheFile}.${process.pid}.tmp`;
        if (useDisk) try {
          fs.mkdirSync(cacheDir, { recursive: true });
          fs.writeFileSync(tmp, JSON.stringify(snap));
          fs.renameSync(tmp, cacheFile);
        } catch (err) {
          logger.warn('Cache news non salvata', { error: err.message });
        }
        logger.info('News aggiornate', { items: snap.items.length, fonti: snap.sources.filter((s) => s.ok).length });
      } catch (err) {
        logger.warn('Aggiornamento news fallito', { error: err.message });
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  function payload() {
    const snap = service.snapshot();
    const next = snap.updatedAt ? Date.parse(snap.updatedAt) + HOUR : null;
    return {
      status: 'success',
      updatedAt: snap.updatedAt,
      nextRefreshAt: next ? new Date(next).toISOString() : null,
      count: snap.items.length,
      sources: snap.sources,
      items: snap.items,
    };
  }

  return {
    register(app) {
      app.get('/api/news', incidentsPublicLimiter || ((req, res, next) => next()), async (req, res) => {
        const snap = service.snapshot();
        const age = snap.updatedAt ? Date.now() - Date.parse(snap.updatedAt) : Infinity;
        // al primo accesso, o se il timer è fermo da troppo, si aggiorna subito (max un tentativo ogni 5 minuti)
        if ((!snap.items.length || age > HOUR * 1.25) && Date.now() - lastAttempt > 5 * 60 * 1000) {
          await Promise.race([refresh(), new Promise((r) => setTimeout(r, 12000))]);
        }
        res.set('Cache-Control', 'public, max-age=300');
        res.json(payload());
      });
    },
    start() {
      const first = setTimeout(refresh, 4000);
      first.unref();
      const timer = setInterval(refresh, HOUR);
      timer.unref();
    },
    refresh,
    _service: service,
  };
};
