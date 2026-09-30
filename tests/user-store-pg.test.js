'use strict';
/**
 * Archivio utenti su Postgres. Parte solo se è impostata TEST_DATABASE_URL
 * (in CI c'è un Postgres di servizio; in locale, per esempio:
 *  TEST_DATABASE_URL=postgres://utente:password@localhost:5432/evil_test npm test).
 * Usa una tabella dedicata che viene cancellata alla fine.
 */
const { tmp } = require('./helpers/setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const url = process.env.TEST_DATABASE_URL;
const table = `evil_users_test_${process.pid}`;

test('Postgres: inserimento, duplicati, aggiornamento e rilettura', { skip: !url && 'TEST_DATABASE_URL non impostata' }, async () => {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_USERS_TABLE = table;
  const { openUserStore } = require('../server/lib/user-store');
  const store = await openUserStore({ root: tmp, databaseUrl: url });
  try {
    assert.equal(store.kind, 'postgres');
    await store.insert({ id: 'pg-1', email: 'pg@example.com', name: 'Pg', createdAt: new Date().toISOString() });
    await assert.rejects(
      () => store.insert({ id: 'pg-2', email: 'pg@example.com', name: 'Doppio' }),
      (err) => err.code === 'EVIL_DUPLICATE_EMAIL'
    );
    const u = store.findByEmail('pg@example.com');
    u.name = 'Aggiornato';
    await store.save(u);
    await store.flush();

    const again = await openUserStore({ root: tmp, databaseUrl: url });
    assert.equal(again.findByEmail('pg@example.com').name, 'Aggiornato');
    await again.close();
  } finally {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: url });
    await pool.query(`DROP TABLE IF EXISTS ${table}`).catch(() => {});
    await pool.end();
    await store.close();
  }
});
