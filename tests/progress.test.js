'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mergeClientProgress, normalizeProgress, defaultProgress } = require('../server/lib/progress');
const { createTestApp, registeredAgent } = require('./helpers/app');

const CATALOG = new Set(['first_scan', 'ethical_hacker', 'lab_master']);

test('trofei inesistenti nel catalogo vengono scartati (EVL-09)', () => {
  const merged = mergeClientProgress(defaultProgress(), {
    totalScans: 1,
    totalActivities: 1,
    unlockedAchievements: ['first_scan', 'trofeo_inventato'],
  }, CATALOG);
  assert.deepEqual(merged.unlockedAchievements, ['first_scan']);
});

test('i contatori non possono diminuire', () => {
  const current = { ...defaultProgress(), totalScans: 10, totalActivities: 20, unlockedAchievements: ['lab_master'] };
  const merged = mergeClientProgress(current, { totalScans: 0, totalActivities: 0, unlockedAchievements: [] }, CATALOG);
  assert.equal(merged.totalScans, 10);
  assert.equal(merged.totalActivities, 20);
  assert.ok(merged.unlockedAchievements.includes('lab_master'), 'un trofeo già sbloccato non si perde');
});

test('dati malformati rifiutati con errore 400', () => {
  assert.throws(
    () => mergeClientProgress(defaultProgress(), { totalScans: 'tanti', unlockedAchievements: 'x' }, CATALOG),
    (err) => err.status === 400
  );
});

test('i record vecchi ({ scans, activities }) vengono convertiti', () => {
  const p = normalizeProgress({ scans: 3, activities: 7, unlockedAchievements: [{ id: 'first_scan' }] });
  assert.equal(p.totalScans, 3);
  assert.equal(p.totalActivities, 7);
  assert.deepEqual(p.unlockedAchievements, ['first_scan']);
});

let app;
let ctx;
before(async () => {
  ({ app, ctx } = await createTestApp());
});
after(async () => {
  await ctx.db.close();
});

test('API: salvataggio e lettura dei progressi con il catalogo reale', async () => {
  const { agent } = await registeredAgent(app);
  const catalog = (await agent.get('/api/achievements').expect(200)).body;
  const realId = catalog.achievements[0].id;
  const saved = await agent
    .post('/api/progress/save')
    .send({ totalScans: 2, totalActivities: 3, unlockedAchievements: [realId, 'falso'], activityLog: [{ name: 'scan', timestamp: new Date().toISOString() }] })
    .expect(200);
  assert.deepEqual(saved.body.progress.unlockedAchievements, [realId]);
  const loaded = await agent.get('/api/progress/load').expect(200);
  assert.equal(loaded.body.totalScans, 2);
});

test('catalogo trofei con ETag: 304 se non è cambiato', async () => {
  const { request } = require('./helpers/app');
  const first = await request(app).get('/api/achievements').expect(200);
  const etag = first.headers.etag;
  assert.ok(etag);
  await request(app).get('/api/achievements').set('If-None-Match', etag).expect(304);
});
