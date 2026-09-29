'use strict';
// Database utenti su file JSON (estratto da js/server.js senza modifiche di comportamento)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

// Database utenti — cartella scrivibile (Render: imposta DATA_DIR)
function ensureDataDir() {
  const dir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(root, 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const dataDir = ensureDataDir();

function resolveUsersFile() {
  const custom = (process.env.DB_FILE || '').trim();
  if (custom) {
    const resolved = path.isAbsolute(custom) ? custom : path.join(root, custom);
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    return resolved;
  }
  return path.join(dataDir, 'users.json');
}

const usersFile = resolveUsersFile();
const legacyUsersFile = path.join(root, 'users.json');
let users = [];

// Carica utenti dal file
function loadUsers() {
  try {
    if (!fs.existsSync(usersFile) && fs.existsSync(legacyUsersFile)) {
      fs.copyFileSync(legacyUsersFile, usersFile);
      console.log('📁 Utenti migrati da users.json root →', usersFile);
    }
    if (fs.existsSync(usersFile)) {
      const data = fs.readFileSync(usersFile, 'utf8');
      users = JSON.parse(data);
    }
  } catch (err) {
    console.error('Errore caricamento utenti:', err.message);
    users = [];
  }
}

// Salva utenti nel file
function saveUsers() {
  try {
    ensureDataDir();
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
    return true;
  } catch (err) {
    console.error('Errore salvataggio utenti:', err.message, usersFile);
    return false;
  }
}

// Carica utenti all'avvio
loadUsers();

const db = {
  get users() {
    return users;
  },
  set users(value) {
    users = value;
  },
  save: saveUsers,
  load: loadUsers,
  ensureDataDir,
  usersFile,
  dataDir,
};

module.exports = db;
