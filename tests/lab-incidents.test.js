'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, request } = require('./helpers/app');
const createIncidents = require('../server/routes/incidents');

let app;
let ctx;
before(async () => {
  ({ app, ctx } = await createTestApp());
});
after(async () => {
  await ctx.db.close();
});

test('lab: ogni browser ospite ha le sue sessioni, X-Forwarded-For non conta', async () => {
  const a = request.agent(app);
  const b = request.agent(app);
  const labId = (await a.get('/api/virtual-lab/catalog').expect(200)).body.labs[0].id;

  const started = await a.post('/api/virtual-lab/sessions').send({ labId }).expect(201);
  const cookie = String(started.headers['set-cookie'] || '');
  assert.match(cookie, /evil_lab_anon=/);
  assert.match(cookie, /HttpOnly/i);
  const sessionId = started.body.session.id;

  await a.post('/api/virtual-lab/sessions').send({ labId }).expect(201);
  await a.post('/api/virtual-lab/sessions').send({ labId }).expect(201);
  const fourth = await a.post('/api/virtual-lab/sessions').send({ labId });
  assert.equal(fourth.status, 429, 'massimo 3 lab per persona');

  // un altro browser (stesso IP) può aprire il suo lab ma non usare quello di A
  await b.post('/api/virtual-lab/sessions').set('X-Forwarded-For', '203.0.113.9').send({ labId }).expect(201);
  const steal = await b.post(`/api/virtual-lab/sessions/${sessionId}/exec`).send({ command: 'help' });
  assert.equal(steal.status, 403);
  await a.post(`/api/virtual-lab/sessions/${sessionId}/exec`).send({ command: 'help' }).expect(200);
});

test('lab: ID di sessione non valido → 404', async () => {
  const res = await request(app).get('/api/virtual-lab/sessions/..%2F..%2Fetc');
  assert.equal(res.status, 404);
});

test('feed incidenti: un solo aggiornamento alla volta e dati reali tenuti se le fonti cadono (EVL-14)', async () => {
  let calls = 0;
  let mode = 'live';
  const incidentsService = {
    buildIncidentsPayload: async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return { incidents: [{ id: calls }], total_incidents: 1, data_mode: mode, lastUpdate: new Date().toISOString() };
    },
  };
  const logger = { warn() {}, error() {}, info() {} };
  const inc = createIncidents({ incidentsService, incidentsPublicLimiter: (req, res, next) => next(), logger });

  await Promise.all([inc.refreshIncidentsCache(), inc.refreshIncidentsCache(), inc.refreshIncidentsCache()]);
  assert.equal(calls, 1);

  mode = 'simulated';
  await inc.refreshIncidentsCache();
  const state = inc._state().incidentsCache;
  assert.equal(state.data_mode, 'cache');
  assert.equal(state.incidents[0].id, 1, 'restano gli incidenti reali');
});

test('feed incidenti: ?refresh=1 non forza le fonti se i dati sono recenti', async () => {
  const first = await request(app).get('/api/realtime-incidents').expect(200);
  const again = await request(app).get('/api/realtime-incidents?refresh=1').expect(200);
  assert.equal(again.body.timestamp, first.body.timestamp);
});

test('lab: nessun comando comune manda in errore un laboratorio (regressione "raw is not defined")', async () => {
  const agent = request.agent(app);
  const labs = (await agent.get('/api/virtual-lab/catalog').expect(200)).body.labs;
  for (const lab of labs) {
    const started = await agent.post('/api/virtual-lab/sessions').send({ labId: lab.id }).expect(201);
    const id = started.body.session.id;
    for (const command of ['help', `nmap ${lab.targetIp}`, `curl http://${lab.targetIp}/`, `curl -H "Authorization: Bearer x" http://${lab.targetIp}/api/profile`, 'whoami', 'ls']) {
      const res = await agent.post(`/api/virtual-lab/sessions/${id}/exec`).send({ command });
      assert.notEqual(res.status, 500, `${lab.id}: "${command}" → ${JSON.stringify(res.body)}`);
    }
    await agent.delete(`/api/virtual-lab/sessions/${id}`).expect(200);
  }
});
