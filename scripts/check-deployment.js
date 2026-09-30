#!/usr/bin/env node
/**
 * Controllo della configurazione prima di un deploy.
 * Legge le variabili d'ambiente (e il .env, se c'è) e segnala cosa manca o è rischioso.
 *
 * Uso:
 *   npm run check:deploy                       configurazione locale (.env)
 *   NODE_ENV=production ... npm run check:deploy   con le variabili di Render
 *   npm run check:deploy -- --url https://www.projectevil.it   controlla anche il sito online
 *
 * Esce con codice 1 se c'è almeno un errore.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const env = require('../utils/env');

const results = [];
const ok = (msg) => results.push({ level: 'ok', msg });
const warn = (msg) => results.push({ level: 'warn', msg });
const fail = (msg) => results.push({ level: 'fail', msg });

const production = env.isProduction();
const WEAK = ['your_super_secret', 'change_this', 'minimum_32', 'example', 'secret123'];

// ---------------------------------------------------------------- runtime e file
const major = Number(process.versions.node.split('.')[0]);
if (major >= 22) ok(`Node ${process.versions.node}`);
else fail(`Node ${process.versions.node}: serve Node 22 (engines in package.json)`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (/22/.test(pkg.engines?.node || '')) ok(`engines.node = ${pkg.engines.node}`);
else warn('package.json: engines.node non indica Node 22 (Render sceglie la versione da qui)');

if (fs.existsSync(path.join(root, 'node_modules'))) ok('dipendenze installate');
else fail('node_modules mancante: esegui npm install');

try {
  const parts = ['home-hero.css', 'home-unified.css', 'home-motion.css', 'home-footer.css'];
  const bundle = fs.readFileSync(path.join(root, 'css', 'home.bundle.css'), 'utf8');
  const stale = parts.some((p) => !bundle.includes(fs.readFileSync(path.join(root, 'css', p), 'utf8')));
  if (stale) warn('css/home.bundle.css non corrisponde ai sorgenti: esegui npm run build (npm start lo fa comunque)');
  else ok('css/home.bundle.css aggiornato');
} catch (err) {
  fail(`CSS della home: ${err.message}`);
}

// ---------------------------------------------------------------- ambiente
if (!env.nodeEnv()) warn('NODE_ENV non impostato: il server applica le regole di produzione (impostalo esplicitamente)');
else ok(`NODE_ENV = ${env.nodeEnv()}`);

const jwt = process.env.JWT_SECRET || '';
const refresh = process.env.JWT_SECRET_REFRESH || '';
for (const [name, value] of [['JWT_SECRET', jwt], ['JWT_SECRET_REFRESH', refresh]]) {
  if (!value) fail(`${name} mancante (node scripts/generate-secrets.js)`);
  else if (value.length < 32 || WEAK.some((w) => value.includes(w))) {
    (production ? fail : warn)(`${name} troppo corto o di esempio${production ? ': in produzione il server non parte' : ''}`);
  } else ok(`${name} impostato`);
}
if (jwt && jwt === refresh) (production ? fail : warn)('JWT_SECRET e JWT_SECRET_REFRESH sono uguali');

const baseUrl = process.env.BASE_URL || '';
if (production && !/^https:\/\//.test(baseUrl)) fail(`BASE_URL deve essere https in produzione (ora: "${baseUrl || 'vuota'}")`);
else if (baseUrl) ok(`BASE_URL = ${baseUrl}`);
else warn('BASE_URL vuota: i link nelle email useranno http://localhost:5000');

// ---------------------------------------------------------------- archivio utenti
const dataDir = process.env.DATA_DIR || '';
if (process.env.DATABASE_URL) ok('account in Postgres (DATABASE_URL)');
else if (production) {
  const onRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  if (!dataDir || /^\/(var\/)?tmp(\/|$)/.test(dataDir) || onRender) {
    fail('account su file in una cartella non persistente: imposta DATABASE_URL (Postgres, es. Neon gratuito)');
  } else warn(`account su file in ${dataDir}: va bene solo con un disco persistente`);
} else ok(`account su file (${dataDir || 'data/'}) — va bene in locale`);

// ---------------------------------------------------------------- email
const apiToken = process.env.MAILTRAP_API_TOKEN || '';
const smtpOk = process.env.SMTP_USER && process.env.SMTP_PASS && !/incolla_|your_/.test(`${process.env.SMTP_USER}${process.env.SMTP_PASS}`);
if (apiToken && process.env.EMAIL_USE_MAILTRAP_API !== '0') ok('email via API Mailtrap');
else if (smtpOk) {
  const onRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  (onRender ? warn : ok)(`email via SMTP (${process.env.SMTP_HOST || 'host?'})${onRender ? ': Render free blocca le porte SMTP, usa MAILTRAP_API_TOKEN' : ''}`);
} else if (production) fail('email non configurata: registrazione e reset password non funzioneranno');
else ok('email non configurata: in sviluppo i messaggi vanno in data/email-outbox');

if (!process.env.HELP_SUPPORT_EMAIL) warn('HELP_SUPPORT_EMAIL non impostata: le richieste di supporto vanno a SMTP_FROM_EMAIL');

// ---------------------------------------------------------------- altro
if (process.env.EVIL_TOOLS_PUBLIC === '1' || process.env.EVIL_TOOLS_PUBLIC === 'true') {
  (production ? fail : warn)('EVIL_TOOLS_PUBLIC attivo: scansioni e OSINT aperti a chiunque senza login');
}
if ((process.env.CORS_ORIGINS || '').split(',').some((o) => o.trim() === '*')) warn('CORS_ORIGINS contiene "*": viene ignorato');
if (production && !process.env.COOKIE_DOMAIN) warn('COOKIE_DOMAIN non impostato: la sessione non vale tra projectevil.it e www.projectevil.it');

// ---------------------------------------------------------------- sito online (facoltativo)
async function checkOnline(url) {
  const base = url.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.status === 'ok') ok(`${base}/api/health risponde (env: ${body.env || '?'})`);
    else fail(`${base}/api/health: HTTP ${res.status}`);
    const page = await fetch(`${base}/`, { signal: AbortSignal.timeout(15000) });
    if (page.headers.get('content-security-policy')) ok('header di sicurezza presenti sulla home');
    else fail('la home non ha la Content-Security-Policy');
    const robots = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(15000) });
    (robots.ok ? ok : warn)(`/robots.txt: HTTP ${robots.status}`);
  } catch (err) {
    fail(`${base} non raggiungibile: ${err.message}`);
  }
}

(async () => {
  const i = process.argv.indexOf('--url');
  if (i > 0 && process.argv[i + 1]) await checkOnline(process.argv[i + 1]);

  const icon = { ok: '✅', warn: '⚠️ ', fail: '❌' };
  console.log(`\nControllo deploy (${production ? 'regole di produzione' : 'sviluppo'})\n`);
  for (const r of results) console.log(`${icon[r.level]} ${r.msg}`);
  const fails = results.filter((r) => r.level === 'fail').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log(`\n${fails} errori, ${warns} avvisi.`);
  process.exit(fails ? 1 : 0);
})();
