#!/usr/bin/env node
/**
 * Prima configurazione per sviluppo locale.
 * Crea .env da .env.example e genera JWT_SECRET se mancanti.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

const PLACEHOLDER_MARKERS = [
  'your_super_secret_key_change_this',
  'your_refresh_secret_key_change_this',
];

function needsNewSecrets(value) {
  if (!value || value.length < 32) return true;
  return PLACEHOLDER_MARKERS.some((m) => value.includes(m));
}

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function ensureEnvFile() {
  if (!fs.existsSync(examplePath)) {
    console.error('❌ File .env.example non trovato.');
    process.exit(1);
  }

  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ Creato .env da .env.example');
    return fs.readFileSync(envPath, 'utf8');
  }

  console.log('ℹ️  .env già presente');
  return fs.readFileSync(envPath, 'utf8');
}

function upsertEnvLine(content, key, value) {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, line);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

let content = ensureEnvFile();

const jwtMatch = content.match(/^JWT_SECRET=(.*)$/m);
const refreshMatch = content.match(/^JWT_SECRET_REFRESH=(.*)$/m);
const jwtVal = jwtMatch ? jwtMatch[1].trim() : '';
const refreshVal = refreshMatch ? refreshMatch[1].trim() : '';

let changed = false;

if (needsNewSecrets(jwtVal)) {
  content = upsertEnvLine(content, 'JWT_SECRET', generateSecret());
  changed = true;
  console.log('✅ JWT_SECRET generato per uso locale');
}

if (needsNewSecrets(refreshVal)) {
  content = upsertEnvLine(content, 'JWT_SECRET_REFRESH', generateSecret());
  changed = true;
  console.log('✅ JWT_SECRET_REFRESH generato per uso locale');
}

if (!/^NODE_ENV=/m.test(content)) {
  content = upsertEnvLine(content, 'NODE_ENV', 'development');
  changed = true;
}

if (!/^PORT=/m.test(content)) {
  content = upsertEnvLine(content, 'PORT', '5000');
  changed = true;
}

if (!/^BASE_URL=/m.test(content)) {
  content = upsertEnvLine(content, 'BASE_URL', 'http://localhost:5000');
  changed = true;
}

if (changed) {
  fs.writeFileSync(envPath, content, 'utf8');
}

const usersPath = path.join(root, 'users.json');
if (!fs.existsSync(usersPath) && fs.existsSync(path.join(root, 'users.json.example'))) {
  fs.copyFileSync(path.join(root, 'users.json.example'), usersPath);
  console.log('✅ Creato users.json da users.json.example');
}

console.log('\n🚀 Setup locale completato.');
console.log('   Avvia con: npm start');
console.log('   Apri:      http://localhost:5000/\n');
