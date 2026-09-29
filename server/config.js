'use strict';
// Configurazione da variabili d'ambiente (estratto da js/server.js)
require('dotenv').config();

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const weakPatterns = ['your_super_secret', 'change_this', 'minimum_32', 'example'];
  const secrets = [process.env.JWT_SECRET, process.env.JWT_SECRET_REFRESH].filter(Boolean);

  for (const secret of secrets) {
    if (secret.length < 32 || weakPatterns.some((p) => secret.includes(p))) {
      console.error('❌ CRITICAL: JWT secrets must be 32+ chars and unique in production');
      process.exit(1);
    }
  }

  if (!process.env.BASE_URL || !/^https:\/\//i.test(process.env.BASE_URL)) {
    console.warn('⚠️ BASE_URL should be https://your-domain in production');
  }

  if (process.env.EMAIL_DEV_OUTBOX === '1') {
    console.warn('⚠️ EMAIL_DEV_OUTBOX=1 in production — emails will not reach users');
  }

  if (process.env.EVIL_TOOLS_PUBLIC === '1' || process.env.EVIL_TOOLS_PUBLIC === 'true') {
    console.warn('⚠️ EVIL_TOOLS_PUBLIC enabled in production — scan/OSINT APIs are open to guests');
  }

  if (!process.env.REDIS_URL) {
    console.warn('⚠️ REDIS_URL not set — refresh tokens and rate limits are per-process only');
  }
}

validateProductionEnvironment();

const PORT = process.env.PORT || 5000;

// ==================== JWT CONFIGURATION ====================
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.error('❌ CRITICAL: JWT_SECRET not configured in .env');
  console.error('Run: node scripts/generate-secrets.js');
  process.exit(1);
})();

const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH || (() => {
  console.error('❌ CRITICAL: JWT_SECRET_REFRESH not configured in .env');
  console.error('Run: node scripts/generate-secrets.js');
  process.exit(1);
})();

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

module.exports = {
  PORT,
  JWT_SECRET,
  JWT_SECRET_REFRESH,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
};
