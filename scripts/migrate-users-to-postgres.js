#!/usr/bin/env node
/**
 * Copia gli utenti dal file JSON (DATA_DIR/users.json o DB_FILE) nel database Postgres di DATABASE_URL.
 * Si può rilanciare: gli utenti già presenti vengono aggiornati, non duplicati.
 *
 * Uso:  DATABASE_URL=postgres://... node scripts/migrate-users-to-postgres.js [percorso/users.json]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PgBackend, resolveDataDir, resolveUsersFile } = require('../server/lib/user-store');

async function main() {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('❌ Imposta DATABASE_URL (stringa di connessione Postgres).');
    process.exit(1);
  }
  const root = path.join(__dirname, '..');
  const file = process.argv[2] ? path.resolve(process.argv[2]) : resolveUsersFile(root, resolveDataDir(root));
  if (!fs.existsSync(file)) {
    console.error(`❌ File utenti non trovato: ${file}`);
    process.exit(1);
  }
  const users = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(users)) {
    console.error('❌ Il file non contiene un array di utenti.');
    process.exit(1);
  }

  const pg = new PgBackend(databaseUrl);
  await pg.init();
  let ok = 0;
  for (const user of users) {
    if (!user?.id || !user?.email) {
      console.warn('⚠️ Utente senza id o email, saltato');
      continue;
    }
    await pg.upsert(user);
    ok += 1;
  }
  await pg.close();
  console.log(`✅ ${ok} utenti copiati da ${file} in Postgres (${pg.table}).`);
}

main().catch((err) => {
  console.error('❌ Migrazione non riuscita:', err.message);
  process.exit(1);
});
