'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registeredAgent, mailsTo, outboxFiles, uniqueEmail, request } = require('./helpers/app');

let app;
let ctx;
const msg = { subject: 'Domanda sul lab', message: 'Il lab non parte, cosa devo controllare?' };

before(async () => {
  ({ app, ctx } = await createTestApp());
});
after(async () => {
  await ctx.db.close();
});

function supportMails() {
  return mailsTo(process.env.HELP_SUPPORT_EMAIL);
}

test('ospite: la richiesta va solo allo staff, nessuna email all\'indirizzo indicato (EVL-08)', async () => {
  const victim = uniqueEmail('vittima');
  const before = supportMails().length;
  const res = await request(app).post('/api/help').send({ name: 'Mario', email: victim, ...msg }).expect(200);
  assert.equal(res.body.confirmationSent, false);
  assert.equal(mailsTo(victim).length, 0);
  assert.equal(supportMails().length, before + 1);
});

test('utente verificato con il proprio indirizzo: riceve la conferma', async () => {
  const { agent, email } = await registeredAgent(app);
  const res = await agent.post('/api/help').send({ name: 'Giulia', email, ...msg }).expect(200);
  assert.equal(res.body.confirmationSent, true);
  assert.ok(mailsTo(email).some((m) => m.includes('Richiesta di supporto ricevuta') || m.includes('Richiesta ricevuta')));
});

test('utente verificato che indica un altro indirizzo: nessuna conferma', async () => {
  const { agent } = await registeredAgent(app);
  const other = uniqueEmail('altro');
  const res = await agent.post('/api/help').send({ name: 'Giulia', email: other, ...msg }).expect(200);
  assert.equal(res.body.confirmationSent, false);
  assert.equal(mailsTo(other).length, 0);
});

test('campo trappola compilato: risposta normale ma nessuna email', async () => {
  const beforeCount = outboxFiles().length;
  await request(app).post('/api/help').send({ name: 'Bot', email: uniqueEmail('bot'), website: 'http://spam.example', ...msg }).expect(200);
  assert.equal(outboxFiles().length, beforeCount);
});

test('errori di validazione indicano il campo', async () => {
  const res = await request(app).post('/api/help').send({ name: 'M', email: 'x@example.com', ...msg });
  assert.equal(res.status, 400);
  assert.equal(res.body.field, 'name');
});
