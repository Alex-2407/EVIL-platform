'use strict';
const { outbox } = require('./setup');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

/** App completa con un feed incidenti finto (nessuna chiamata di rete). */
async function createTestApp(overrides = {}) {
  const { buildContext } = require('../../server/context');
  const { createApp } = require('../../server/app');
  const incidentsService = {
    buildIncidentsPayload: async () => ({ incidents: [], total_incidents: 0, data_mode: 'simulated', lastUpdate: new Date().toISOString() }),
  };
  const ctx = await buildContext({ incidentsService, ...overrides });
  const app = createApp(ctx);
  return { app, ctx };
}

/** Email salvate nella cartella di anteprima (in test non si invia nulla). */
function outboxFiles() {
  return fs.existsSync(outbox) ? fs.readdirSync(outbox).sort() : [];
}

function mailsTo(address) {
  const safe = address.replace(/[^a-zA-Z0-9._-]/g, '_');
  return outboxFiles()
    .filter((f) => f.endsWith(`-${safe}.html`))
    .map((f) => fs.readFileSync(path.join(outbox, f), 'utf8'));
}

function linkIn(html, pattern) {
  const m = html.match(new RegExp(`href="([^"]*${pattern}[^"]*)"`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/^https?:\/\/[^/]+/, '') : null;
}

let counter = 0;
function uniqueEmail(prefix = 'utente') {
  counter += 1;
  return `${prefix}.${process.pid}.${Date.now()}.${counter}@example.com`;
}

/** Registra, verifica e restituisce un agente con la sessione attiva. */
async function registeredAgent(app, { name = 'Giulia Neri', password = 'Password.Sicura2026' } = {}) {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const res = await agent.post('/api/auth/register').send({ name, email, password, confirmPassword: password });
  if (res.status !== 201) throw new Error(`registrazione: ${res.status} ${JSON.stringify(res.body)}`);
  const link = linkIn(mailsTo(email).pop(), 'verify-email');
  await agent.get(link).expect(302);
  return { agent, email, password, userId: res.body.userId };
}

module.exports = { createTestApp, outboxFiles, mailsTo, linkIn, uniqueEmail, registeredAgent, request };
