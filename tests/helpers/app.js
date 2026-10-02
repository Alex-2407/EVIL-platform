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

/** Token di verifica dall'ultima email ricevuta (link /verify-email.html#token=…). */
function verificationTokenFor(email) {
  const link = linkIn(mailsTo(email).pop() || '', 'verify-email');
  const m = link && link.match(/[#?&]token=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

/** Dati di registrazione validi (acceptedTerms obbligatorio). */
function registrationBody({ name = 'Giulia Neri', email = uniqueEmail(), password = 'Password.Sicura2026' } = {}) {
  return { name, email, password, confirmPassword: password, acceptedTerms: true };
}

/**
 * Registra, conferma l'indirizzo (POST /api/auth/verify, come la pagina verify-email.html),
 * accede e restituisce un agente con la sessione attiva.
 */
async function registeredAgent(app, { name = 'Giulia Neri', password = 'Password.Sicura2026' } = {}) {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const res = await agent.post('/api/auth/register').send(registrationBody({ name, email, password }));
  if (res.status !== 201) throw new Error(`registrazione: ${res.status} ${JSON.stringify(res.body)}`);
  const token = verificationTokenFor(email);
  const verified = await agent.post('/api/auth/verify').send({ token });
  if (verified.status !== 200) throw new Error(`verifica: ${verified.status} ${JSON.stringify(verified.body)}`);
  const login = await agent.post('/api/auth/login').send({ email, password });
  if (login.status !== 200) throw new Error(`login: ${login.status} ${JSON.stringify(login.body)}`);
  return { agent, email, password, userId: login.body.user.id };
}

module.exports = {
  createTestApp,
  outboxFiles,
  mailsTo,
  linkIn,
  uniqueEmail,
  registeredAgent,
  registrationBody,
  verificationTokenFor,
  request,
};
