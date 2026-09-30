'use strict';
// Configurazione da variabili d'ambiente
require('dotenv').config({ quiet: true });

const env = require('../utils/env');

// Le funzioni di debug (CORS aperto, /__debug/files, stack trace negli errori, email su file)
// si accendono solo con NODE_ENV=development esplicito. Variabile assente o scritta male =
// regole di produzione: una configurazione dimenticata chiude invece di aprire (EVL-10).
const NODE_ENV = env.nodeEnv() || 'production';
const IS_DEV = env.isDevelopment();
const IS_TEST = env.isTest();
const IS_PROD = env.isProduction();

if (!env.nodeEnv()) {
  console.warn('⚠️ NODE_ENV non impostato: il server applica le regole di produzione. In locale aggiungi NODE_ENV=development al .env');
}

function fail(message) {
  console.error(`❌ ${message}`);
  if (IS_TEST) throw new Error(message);
  process.exit(1);
}

function validateProductionEnvironment() {
  if (!IS_PROD) return;

  const weakPatterns = ['your_super_secret', 'change_this', 'minimum_32', 'example'];
  const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_REFRESH].filter(Boolean);
  for (const secret of secrets) {
    if (secret.length < 32 || weakPatterns.some((p) => secret.includes(p))) {
      fail(
        'Regole di produzione attive: JWT_SECRET e JWT_SECRET_REFRESH devono avere almeno 32 caratteri e non essere quelli di esempio. ' +
          '(In locale imposta NODE_ENV=development nel .env.)'
      );
    }
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET === process.env.JWT_SECRET_REFRESH) {
    fail('JWT_SECRET e JWT_SECRET_REFRESH devono essere diversi.');
  }
  if (!process.env.BASE_URL || !/^https:\/\//i.test(process.env.BASE_URL)) {
    console.warn('⚠️ BASE_URL dovrebbe essere https://tuo-dominio in produzione');
  }
  if (process.env.EVIL_TOOLS_PUBLIC === '1' || process.env.EVIL_TOOLS_PUBLIC === 'true') {
    console.warn('⚠️ EVIL_TOOLS_PUBLIC attivo in produzione: scansioni e OSINT sono aperti agli ospiti');
  }
}

/** Avvisa se gli account stanno su un disco che si svuota (Render free, /tmp). */
function warnAboutStorage(db) {
  if (!IS_PROD || db.kind !== 'file') return;
  const dir = db.dataDir || '';
  const onTmp = /^\/tmp(\/|$)/.test(dir) || /^\/var\/tmp(\/|$)/.test(dir);
  const onRender = Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  if (onTmp || (onRender && !process.env.DATA_DIR)) {
    console.warn(
      '⚠️ Gli account sono salvati su file in una cartella non persistente: un deploy o un riavvio li cancella. ' +
        'Imposta DATABASE_URL (Postgres, per esempio Neon gratuito) oppure un disco persistente con DATA_DIR.'
    );
  }
}

validateProductionEnvironment();

const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET || fail('JWT_SECRET mancante nel .env (esegui: node scripts/setup-local.js)');
const JWT_SECRET_REFRESH =
  process.env.JWT_SECRET_REFRESH || fail('JWT_SECRET_REFRESH mancante nel .env (esegui: node scripts/setup-local.js)');

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

module.exports = {
  NODE_ENV,
  IS_DEV,
  IS_PROD,
  IS_TEST,
  PORT,
  JWT_SECRET,
  JWT_SECRET_REFRESH,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  warnAboutStorage,
};
