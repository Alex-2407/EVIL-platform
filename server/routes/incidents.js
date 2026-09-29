'use strict';
// Feed incidenti pubblico + WebSocket (estratto da js/server.js)
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..', '..');

module.exports = function createIncidents(ctx) {
  const { incidentsService, incidentsPublicLimiter } = ctx;

  // Cache file per persistenza incidenti fra riavvii
  const cacheFile = path.join(root, '.incidents-cache.json');

  // Carica cache dal disco se esiste
  function loadIncidentsCacheFromDisk() {
    try {
      if (fs.existsSync(cacheFile)) {
        const data = fs.readFileSync(cacheFile, 'utf8');
        const cached = JSON.parse(data);
        console.log('💾 Cache incidenti caricata dal disco:', cached.lastUpdate);
        return cached;
      }
    } catch (err) {
      console.warn('⚠️ Errore caricamento cache dal disco:', err.message);
    }
    return null;
  }

  // Salva cache su disco
  function saveIncidentsCacheToDisk(cache) {
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
    } catch (err) {
      console.warn('⚠️ Errore salvataggio cache su disco:', err.message);
    }
  }


  // ========================
  // ENDPOINT REALTIME INCIDENTS (LIVE PUBLIC DATA)
  // ========================
  // Educational threat intelligence aggregation from verified public sources
  // Data from NIST NVD, CISA, and official government cybersecurity agencies

  // Carica cache iniziale dal disco o inizializza vuota
  let incidentsCache = loadIncidentsCacheFromDisk() || {
    incidents: [],
    lastUpdate: null
  };

  function buildIncidentsApiResponse(cache) {
    const payload = cache || incidentsCache || { incidents: [] };
    return {
      status: 'success',
      timestamp: payload.lastUpdate || new Date().toISOString(),
      source: payload.source || 'Public Threat Intelligence',
      data_mode: payload.data_mode || 'cache',
      update_frequency: payload.update_frequency || 'Every 5 minutes',
      data_classification: 'Public Vulnerability & Advisory Intelligence',
      total_incidents: payload.total_incidents ?? (payload.incidents?.length || 0),
      monthly_trends: payload.monthly_trends || null,
      aggregated_stats: payload.aggregated_stats || null,
      regions: payload.regions || [],
      sources: payload.sources || [],
      incidents: payload.incidents || [],
      disclaimer: payload.disclaimer || 'EDUCATIONAL USE ONLY',
    };
  }


  const wsClients = new Set();

  async function broadcastIncidents() {
    try {
      const data = buildIncidentsApiResponse(incidentsCache);
      wsClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (err) {
      console.error('Errore broadcast incidenti:', err.message);
    }
  }


  async function refreshIncidentsCache() {
    try {
      console.log('⏳ Aggiornamento cache incidenti in corso...');
      const payload = await incidentsService.buildIncidentsPayload();
      incidentsCache = payload;
      saveIncidentsCacheToDisk(incidentsCache);
      broadcastIncidents();
      console.log(
        '✅ Cache incidenti aggiornata:',
        incidentsCache.lastUpdate,
        '|',
        incidentsCache.total_incidents,
        'record | mode:',
        incidentsCache.data_mode
      );
    } catch (err) {
      console.warn('⚠️ Errore aggiornamento cache incidenti:', err.message);
    }
  }


  function register(app) {
    // Endpoint pubblico (no login) — dati da cache aggiornata in background
    app.get('/api/realtime-incidents', incidentsPublicLimiter, async (req, res) => {
      try {
        if (req.query.refresh === '1') {
          await refreshIncidentsCache();
        }
        if (!incidentsCache?.incidents?.length) {
          await refreshIncidentsCache();
        }
        res.json(buildIncidentsApiResponse(incidentsCache));
      } catch (err) {
        res.json({
          ...buildIncidentsApiResponse(incidentsCache),
          status: 'degraded',
          error: err.message,
        });
      }
    });
  }

  function attach(server) {
    const wss2 = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      const url = request.url || '';
      if (url === '/ws/incidents' || url === '/ws/attacks') {
        wss2.handleUpgrade(request, socket, head, (ws) => {
          wsClients.add(ws);
          ws.send(JSON.stringify(buildIncidentsApiResponse(incidentsCache)));
          ws.on('close', () => wsClients.delete(ws));
          ws.on('error', (err) => console.error('WS Error:', err.message));
        });
      } else {
        socket.destroy();
      }
    });
  }

  function start() {
    setInterval(broadcastIncidents, 5 * 60 * 1000);

    // Avvia la cache degli incidenti dopo che tutte le funzioni sono state definite
    setTimeout(() => {
      refreshIncidentsCache();
      setInterval(refreshIncidentsCache, 5 * 60 * 1000);
    }, 100);
  }

  return { register, attach, start, refreshIncidentsCache };
};
