'use strict';
/**
 * Archivio utenti.
 *
 * Gli utenti restano in memoria (letture sincrone e veloci) e ogni modifica
 * viene scritta subito sul backend:
 *   - Postgres, se è impostata DATABASE_URL (consigliato in produzione: il
 *     filesystem di Render free è effimero e si svuota a ogni deploy/riavvio);
 *   - file JSON, altrimenti, con scrittura atomica (file temporaneo + rename)
 *     e copia di sicurezza .bak all'avvio.
 *
 * Con un file corrotto l'avvio si ferma con un errore chiaro: prima il server
 * ripartiva con zero utenti e al primo salvataggio sovrascriveva tutto.
 */
const fs = require('fs');
const path = require('path');

class DuplicateEmailError extends Error {
  constructor(email) {
    super(`Email già registrata: ${email}`);
    this.code = 'EVIL_DUPLICATE_EMAIL';
  }
}

// ---------------------------------------------------------------- backend file JSON
class FileBackend {
  constructor(filePath) {
    this.filePath = filePath;
    this.kind = 'file';
  }

  async init() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
  }

  async loadAll() {
    if (!fs.existsSync(this.filePath)) return [];
    const raw = fs.readFileSync(this.filePath, 'utf8');
    if (!raw.trim()) return [];
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Il file utenti ${this.filePath} non è JSON valido (${err.message}). ` +
          `Il server non parte per non sovrascriverlo: ripristina ${this.filePath}.bak o correggi il file.`
      );
    }
    if (!Array.isArray(data)) {
      throw new Error(`Il file utenti ${this.filePath} non contiene un array di utenti.`);
    }
    // copia di sicurezza della versione letta all'avvio
    try {
      fs.copyFileSync(this.filePath, `${this.filePath}.bak`);
    } catch {
      /* non bloccante */
    }
    return data;
  }

  /** Scrittura atomica: o c'è il file vecchio intero o quello nuovo intero, mai uno troncato. */
  async saveAll(users) {
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    const fd = fs.openSync(tmp, 'w', 0o600);
    try {
      fs.writeSync(fd, JSON.stringify(users, null, 2));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, this.filePath);
  }

  async close() {}
}

// ---------------------------------------------------------------- backend Postgres
class PgBackend {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const local = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(connectionString);
    let ssl;
    if (process.env.DATABASE_SSL === '0' || local) ssl = false;
    else ssl = { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== '0' };
    this.pool = new Pool({ connectionString, ssl, max: parseInt(process.env.DATABASE_POOL_MAX || '5', 10) });
    this.kind = 'postgres';
    this.table = process.env.DATABASE_USERS_TABLE || 'evil_users';
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(this.table)) throw new Error('DATABASE_USERS_TABLE non valido');
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
  }

  async loadAll() {
    const { rows } = await this.pool.query(`SELECT data FROM ${this.table} ORDER BY created_at, id`);
    return rows.map((r) => r.data);
  }

  async upsert(user) {
    await this.pool.query(
      `INSERT INTO ${this.table} (id, email, data, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, data = EXCLUDED.data, updated_at = now()`,
      [user.id, String(user.email).toLowerCase(), JSON.stringify(user)]
    );
  }

  async remove(id) {
    await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  async close() {
    await this.pool.end();
  }
}

// ---------------------------------------------------------------- archivio in memoria
class UserStore {
  constructor(backend, { usersFile = null, dataDir = null } = {}) {
    this.backend = backend;
    this.kind = backend.kind;
    this.usersFile = usersFile;
    this.dataDir = dataDir;
    this.list = [];
    this.byId = new Map();
    this.byEmail = new Map();
    this.queues = new Map(); // scritture sequenziali per utente (Postgres)
    this.fileQueue = Promise.resolve();
  }

  async load() {
    await this.backend.init();
    const list = await this.backend.loadAll();
    this.list = [];
    this.byId.clear();
    this.byEmail.clear();
    for (const user of list) this.index(user);
    return this.list.length;
  }

  index(user) {
    this.list.push(user);
    this.byId.set(user.id, user);
    if (user.email) this.byEmail.set(String(user.email).toLowerCase(), user);
  }

  get users() {
    return this.list;
  }

  count() {
    return this.list.length;
  }

  findById(id) {
    return typeof id === 'string' ? this.byId.get(id) || null : null;
  }

  findByEmail(email) {
    return typeof email === 'string' ? this.byEmail.get(email.trim().toLowerCase()) || null : null;
  }

  find(predicate) {
    return this.list.find(predicate) || null;
  }

  async insert(user) {
    if (!user?.id || !user?.email) throw new Error('Utente senza id o email');
    if (this.findByEmail(user.email)) throw new DuplicateEmailError(user.email);
    this.index(user);
    try {
      await this.persist(user);
    } catch (err) {
      this.unindex(user.id);
      throw err;
    }
    return user;
  }

  unindex(id) {
    const user = this.byId.get(id);
    if (!user) return;
    this.list = this.list.filter((u) => u.id !== id);
    this.byId.delete(id);
    if (user.email) this.byEmail.delete(String(user.email).toLowerCase());
  }

  async remove(id) {
    const user = this.byId.get(id);
    if (!user) return false;
    this.unindex(id);
    if (typeof this.backend.remove === 'function') {
      await this.enqueue(id, () => this.backend.remove(id));
    } else {
      await this.writeFile();
    }
    return true;
  }

  /** Salva le modifiche fatte a un utente già presente */
  async save(user) {
    if (!user || !this.byId.has(user.id)) throw new Error('Utente sconosciuto');
    await this.persist(user);
  }

  async persist(user) {
    if (typeof this.backend.upsert === 'function') {
      // la serializzazione avviene quando tocca a questa scrittura: vince sempre lo stato più recente
      await this.enqueue(user.id, () => this.backend.upsert(user));
    } else {
      await this.writeFile();
    }
  }

  enqueue(id, task) {
    const prev = this.queues.get(id) || Promise.resolve();
    const next = prev.catch(() => {}).then(task);
    this.queues.set(id, next);
    next.finally(() => {
      if (this.queues.get(id) === next) this.queues.delete(id);
    }).catch(() => {});
    return next;
  }

  writeFile() {
    const next = this.fileQueue.catch(() => {}).then(() => this.backend.saveAll(this.list));
    this.fileQueue = next;
    return next;
  }

  async flush() {
    await Promise.allSettled([...this.queues.values(), this.fileQueue]);
  }

  async close() {
    await this.flush();
    await this.backend.close();
  }
}

// ---------------------------------------------------------------- apertura
function resolveDataDir(root) {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
}

function resolveUsersFile(root, dataDir) {
  const custom = (process.env.DB_FILE || '').trim();
  if (custom) return path.isAbsolute(custom) ? custom : path.join(root, custom);
  return path.join(dataDir, 'users.json');
}

/**
 * Apre l'archivio scegliendo il backend dall'ambiente.
 * Migrazione storica: se esiste solo il vecchio users.json nella root, viene copiato nella cartella dati.
 */
async function openUserStore({ root, databaseUrl = process.env.DATABASE_URL } = {}) {
  const dataDir = resolveDataDir(root);
  fs.mkdirSync(dataDir, { recursive: true });
  const usersFile = resolveUsersFile(root, dataDir);

  let backend;
  if (databaseUrl && databaseUrl.trim()) {
    backend = new PgBackend(databaseUrl.trim());
  } else {
    const legacy = path.join(root, 'users.json');
    if (!fs.existsSync(usersFile) && fs.existsSync(legacy)) {
      fs.mkdirSync(path.dirname(usersFile), { recursive: true });
      fs.copyFileSync(legacy, usersFile);
      console.log('📁 Utenti migrati da users.json root →', usersFile);
    }
    backend = new FileBackend(usersFile);
  }

  const store = new UserStore(backend, { usersFile: backend.kind === 'file' ? usersFile : null, dataDir });
  await store.load();
  return store;
}

module.exports = {
  openUserStore,
  UserStore,
  FileBackend,
  PgBackend,
  DuplicateEmailError,
  resolveDataDir,
  resolveUsersFile,
};
