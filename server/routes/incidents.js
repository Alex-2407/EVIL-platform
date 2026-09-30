'use strict';
/**
 * Feed incidenti pubblico (mappa attacchi) + WebSocket.
 *
 * - un solo aggiornamento alla volta: richieste concorrenti aspettano lo stesso (single-flight)
 * - ?refresh=1 viene rispettato solo se i dati hanno più di MIN_FORCED_REFRESH_MS: nessuno
 *   può più far interrogare le fonti esterne a ogni richiesta (EVL-14)
 * - se le fonti sono irraggiungibili si tengono gli ultimi dati reali (marcati come cache)
 *   invece di sostituirli con quelli dimostrativi
 * - WebSocket: origine verificata, massimo di connessioni per IP e in totale, messaggi dei
 *   client ignorati (maxPayload 1 KB), connessioni morte chiuse con ping/pong
 */
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { isOriginAllowed } = require('../lib/origins');
const { isDevelopment, trustProxy } = require('../../utils/env');

const root = path.resolve(__dirname, '..', '..');

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const MIN_FORCED_REFRESH_MS = parseInt(process.env.INCIDENTS_MIN_REFRESH_MS || `${2 * 60 * 1000}`, 10);
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
const MAX_WS_CLIENTS = parseInt(process.env.WS_MAX_CLIENTS || '500', 10);
const MAX_WS_PER_IP = parseInt(process.env.WS_MAX_PER_IP || '5', 10);
const WS_HEARTBEAT_MS = 30 * 1000;
const WS_PATHS = new Set(['/ws/incidents', '/ws/attacks']);

module.exports = function createIncidents(ctx) {
  const { incidentsService, incidentsPublicLimiter, logger } = ctx;

  const cacheDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : root;
  const cacheFile = path.join(cacheDir, '.incidents-cache.json');

  function loadCacheFromDisk() {
    try {
      if (fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        console.log('💾 Cache incidenti caricata dal disco:', cached.lastUpdate);
        return cached;
      }
    } catch (err) {
      logger.warn('Cache incidenti illeggibile', { error: err.message });
    }
    return null;
  }

  function saveCacheToDisk(cache) {
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(cache));
      fs.renameSync(tmp, cacheFile);
    } catch (err) {
      logger.warn('Cache incidenti non salvata', { error: err.message });
      try {
        fs.unlinkSync(tmp);
      } catch (_) {
        /* ignore */
      }
    }
  }

  let incidentsCache = loadCacheFromDisk() || { incidents: [], lastUpdate: null };
  let refreshPromise = null;
  let lastAttemptAt = 0;
  let lastFailureAt = 0;

  function cacheAgeMs() {
    const t = Date.parse(incidentsCache?.lastUpdate || '');
    return Number.isFinite(t) ? Date.now() - t : Infinity;
  }

  function buildIncidentsApiResponse(cache) {
    const payload = cache || incidentsCache || { incidents: [] };
    return {
      status: 'success',
      timestamp: payload.lastUpdate || new Date().toISOString(),
      source: payload.source || 'Fonti pubbliche',
      data_mode: payload.data_mode || 'cache',
      update_frequency: payload.update_frequency || 'Aggiornamento automatico ogni 5 minuti',
      data_classification: 'Vulnerabilità e avvisi da fonti pubbliche',
      total_incidents: payload.total_incidents ?? (payload.incidents?.length || 0),
      monthly_trends: payload.monthly_trends || null,
      aggregated_stats: payload.aggregated_stats || null,
      regions: payload.regions || [],
      sources: payload.sources || [],
      incidents: payload.incidents || [],
      disclaimer: payload.disclaimer || 'Solo a scopo educativo.',
    };
  }

  // ------------------------------------------------------------ WebSocket
  const wsClients = new Set();
  const wsPerIp = new Map();

  function broadcastIncidents() {
    if (!wsClients.size) return;
    let message;
    try {
      message = JSON.stringify(buildIncidentsApiResponse(incidentsCache));
    } catch (err) {
      logger.error('Errore broadcast incidenti', { error: err.message });
      return;
    }
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  // ------------------------------------------------------------ aggiornamento
  async function doRefresh() {
    lastAttemptAt = Date.now();
    console.log('⏳ Aggiornamento cache incidenti in corso...');
    const payload = await incidentsService.buildIncidentsPayload();
    const hadLiveData = incidentsCache?.data_mode === 'live' || (incidentsCache?.data_mode === 'cache' && incidentsCache?.incidents?.length);

    if (payload.data_mode !== 'live' && hadLiveData) {
      // fonti irraggiungibili: meglio i dati reali di prima (segnalati come cache) che quelli demo
      lastFailureAt = Date.now();
      incidentsCache = { ...incidentsCache, data_mode: 'cache' };
      logger.warn('Fonti incidenti non raggiungibili: restano gli ultimi dati reali', {
        lastUpdate: incidentsCache.lastUpdate,
      });
      return incidentsCache;
    }

    if (payload.data_mode !== 'live') lastFailureAt = Date.now();
    incidentsCache = payload;
    saveCacheToDisk(incidentsCache);
    broadcastIncidents();
    console.log(
      '✅ Cache incidenti aggiornata:',
      incidentsCache.lastUpdate,
      '|',
      incidentsCache.total_incidents,
      'record | mode:',
      incidentsCache.data_mode
    );
    return incidentsCache;
  }

  /** Single-flight: chi arriva durante un aggiornamento aspetta quello in corso. */
  function refreshIncidentsCache() {
    if (!refreshPromise) {
      refreshPromise = doRefresh()
        .catch((err) => {
          lastFailureAt = Date.now();
          logger.warn('Errore aggiornamento cache incidenti', { error: err.message });
          return incidentsCache;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  function shouldRefreshOnRequest(forced) {
    if (refreshPromise) return true; // si aggancia a quello in corso
    const age = cacheAgeMs();
    const sinceFailure = Date.now() - lastFailureAt;
    if (!incidentsCache?.incidents?.length) return sinceFailure > RETRY_AFTER_FAILURE_MS;
    if (forced) return age > MIN_FORCED_REFRESH_MS && Date.now() - lastAttemptAt > MIN_FORCED_REFRESH_MS;
    return false;
  }

  function register(app) {
    // Endpoint pubblico (niente login): dati dalla cache aggiornata in background
    app.get('/api/realtime-incidents', incidentsPublicLimiter, async (req, res) => {
      try {
        if (shouldRefreshOnRequest(req.query.refresh === '1')) {
          await refreshIncidentsCache();
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.json(buildIncidentsApiResponse(incidentsCache));
      } catch (err) {
        logger.error('Feed incidenti non disponibile', { error: err.message });
        res.json({ ...buildIncidentsApiResponse(incidentsCache), status: 'degraded' });
      }
    });
  }

  function clientIp(request) {
    if (trustProxy()) {
      const forwarded = String(request.headers['x-forwarded-for'] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (forwarded.length) return forwarded[forwarded.length - 1];
    }
    return request.socket?.remoteAddress || 'unknown';
  }

  function reject(socket, status, text) {
    try {
      socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    } catch (_) {
      /* ignore */
    }
    socket.destroy();
  }

  function attach(server) {
    const wss = new WebSocket.Server({ noServer: true, maxPayload: 1024, perMessageDeflate: false, clientTracking: false });

    server.on('upgrade', (request, socket, head) => {
      const pathname = (request.url || '').split('?')[0];
      if (!WS_PATHS.has(pathname)) return reject(socket, 404, 'Not Found');

      const origin = request.headers.origin;
      if (!isDevelopment() && !isOriginAllowed(origin, request.headers.host)) {
        logger.warn('WebSocket rifiutato: origine non ammessa', { origin });
        return reject(socket, 403, 'Forbidden');
      }

      const ip = clientIp(request);
      const perIp = wsPerIp.get(ip) || 0;
      if (wsClients.size >= MAX_WS_CLIENTS || perIp >= MAX_WS_PER_IP) {
        return reject(socket, 429, 'Too Many Requests');
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wsClients.add(ws);
        wsPerIp.set(ip, (wsPerIp.get(ip) || 0) + 1);
        ws.isAlive = true;
        ws.on('pong', () => {
          ws.isAlive = true;
        });
        ws.on('message', () => {
          /* il feed è in sola lettura: i messaggi dei client sono ignorati */
        });
        ws.on('close', () => {
          wsClients.delete(ws);
          const n = (wsPerIp.get(ip) || 1) - 1;
          if (n <= 0) wsPerIp.delete(ip);
          else wsPerIp.set(ip, n);
        });
        ws.on('error', (err) => logger.warn('WebSocket errore', { error: err.message }));
        ws.send(JSON.stringify(buildIncidentsApiResponse(incidentsCache)));
      });
    });

    // Chiude le connessioni che non rispondono più (schede chiuse senza close, reti mobili)
    const heartbeat = setInterval(() => {
      for (const ws of wsClients) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch (_) {
          /* ignore */
        }
      }
    }, WS_HEARTBEAT_MS);
    heartbeat.unref();
    server.on('close', () => clearInterval(heartbeat));
  }

  function start() {
    // Primo aggiornamento subito dopo l'avvio, poi ogni 5 minuti
    setTimeout(() => {
      refreshIncidentsCache();
      setInterval(refreshIncidentsCache, REFRESH_INTERVAL_MS).unref();
    }, 100).unref();
  }

  return { register, attach, start, refreshIncidentsCache, _state: () => ({ incidentsCache, wsClients: wsClients.size }) };
};
