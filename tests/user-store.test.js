'use strict';
const { tmp } = require('./helpers/setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { openUserStore } = require('../server/lib/user-store');

function makeUser(email) {
  return { id: `id-${email}`, email, name: 'Test', password: 'x', createdAt: new Date().toISOString() };
}

test('archivio su file: inserimento, ricerca, email duplicata e rilettura', async () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'store-'));
  process.env.DATA_DIR = dir;
  const store = await openUserStore({ root: dir, databaseUrl: '' });
  assert.equal(store.kind, 'file');
  await store.insert(makeUser('a@example.com'));
  await assert.rejects(() => store.insert(makeUser('a@example.com')), (err) => err.code === 'EVIL_DUPLICATE_EMAIL');
  const u = store.findByEmail('a@example.com');
  u.name = 'Aggiornato';
  await store.save(u);
  await store.close();

  const onDisk = JSON.parse(fs.readFileSync(store.usersFile, 'utf8'));
  assert.equal(onDisk.length, 1);
  assert.equal(onDisk[0].name, 'Aggiornato');

  const again = await openUserStore({ root: dir, databaseUrl: '' });
  assert.equal(again.findByEmail('a@example.com').name, 'Aggiornato');
  await again.close();
});

test('file utenti corrotto: l\'avvio si ferma invece di ripartire vuoto', async () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'store-bad-'));
  process.env.DATA_DIR = dir;
  const probe = await openUserStore({ root: dir, databaseUrl: '' });
  const file = probe.usersFile;
  await probe.close();
  fs.writeFileSync(file, '[{"id": "rotto"');
  await assert.rejects(() => openUserStore({ root: dir, databaseUrl: '' }));
});

test('scritture concorrenti sullo stesso utente non perdono dati', async () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'store-conc-'));
  process.env.DATA_DIR = dir;
  const store = await openUserStore({ root: dir, databaseUrl: '' });
  const user = makeUser('c@example.com');
  user.counter = 0;
  await store.insert(user);
  await Promise.all(Array.from({ length: 20 }, async () => {
    const u = store.findByEmail('c@example.com');
    u.counter += 1;
    await store.save(u);
  }));
  await store.close();
  const onDisk = JSON.parse(fs.readFileSync(store.usersFile, 'utf8'));
  assert.equal(onDisk[0].counter, 20);
});
