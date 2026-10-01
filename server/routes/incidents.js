'use strict';
/**
 * Feed pubblico della mappa di avvisi e vulnerabilità (/api/realtime-incidents) + WebSocket.
 *
 * - la cache contiene dati neutri rispetto alla lingua; risposta HTTP e messaggi WebSocket
 *   escono nella lingua del client (req.lang; per il WebSocket ?lang= o cookie evil_lang)
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
const { localizePayload, SCHEMA } = require('../../services/incidents-service');
const { normalizeLang, DEFAULT_LANG, LANGS } = require('../i18n');

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
        // le cache del formato precedente avevano paesi dedotti e dati demo: si scartano
        if (cached?.schema !== SCHEMA || cached.data_mode !== 'live') return null;
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

  /** Risposta nella lingua richiesta: i dati in cache sono neutri, i testi si traducono qui. */
  function buildIncidentsApiResponse(cache, lang) {
    return { status: 'success', ...localizePayload(cache || incidentsCache, lang) };
  }

  // ------------------------------------------------------------ WebSocket
  const wsClients = new Set();
  const wsPerIp = new Map();

  function broadcastIncidents() {
    if (!wsClients.size) return;
    const messages = {};
    try {
      for (const l of LANGS) messages[l] = JSON.stringify(buildIncidentsApiResponse(incidentsCache, l));
    } catch (err) {
      logger.error('Errore broadcast incidenti', { error: err.message });
      return;
    }
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) client.send(messages[client.lang] || messages[DEFAULT_LANG]);
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
    if (payload.data_mode === 'live') saveCacheToDisk(incidentsCache); // gli esempi non si salvano
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
        res.json(buildIncidentsApiResponse(incidentsCache, req.lang));
      } catch (err) {
        logger.error('Feed incidenti non disponibile', { error: err.message });
        res.json({ ...buildIncidentsApiResponse(incidentsCache, req.lang), status: 'degraded' });
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

  /** Lingua del client WebSocket: ?lang= nell'URL, poi cookie evil_lang, altrimenti italiano. */
  function wsLang(request) {
    const q = /[?&]lang=([a-z]{2})/i.exec(request.url || '');
    const fromQuery = q && normalizeLang(q[1]);
    if (fromQuery) return fromQuery;
    const c = /(?:^|;\s*)evil_lang=([a-z]{2})/i.exec(String(request.headers.cookie || ''));
    return (c && normalizeLang(c[1])) || DEFAULT_LANG;
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
        ws.lang = wsLang(request);
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
        ws.send(JSON.stringify(buildIncidentsApiResponse(incidentsCache, ws.lang)));
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
