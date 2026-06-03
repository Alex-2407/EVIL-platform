const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'js', 'server.js');
let c = fs.readFileSync(serverPath, 'utf8');

const start = '// Funzione per recuperare CVE da NVD API (pubblico)';
const end = '// ========================\n// ENDPOINT SOCIAL PROFILING';
const i0 = c.indexOf(start);
const i1 = c.indexOf(end);

if (i0 < 0 || i1 < 0) {
  console.error('Markers not found', { i0, i1 });
  process.exit(1);
}

const replacement = `function buildIncidentsApiResponse(cache) {
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

const server = http.createServer(app);
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

setInterval(broadcastIncidents, 5 * 60 * 1000);

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

`;

c = c.slice(0, i0) + replacement + c.slice(i1);

const serverCount = (c.match(/const server = http\.createServer\(app\)/g) || []).length;
if (serverCount > 1) {
  console.error('Duplicate server declaration count:', serverCount);
  process.exit(1);
}

fs.writeFileSync(serverPath, c);
console.log('Patched server.js OK. Removed', i1 - i0, 'chars, added', replacement.length);
