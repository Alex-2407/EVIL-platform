'use strict';
/**
 * Ambiente dei test: va richiesto PRIMA di qualunque modulo del server.
 * - NODE_ENV=test (log silenziosi, regole di produzione per CORS e debug)
 * - dati ed email in una cartella temporanea, mai nel .env o nel database dello sviluppatore
 * - limiti di richieste alti, così i test non si bloccano a vicenda
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evil-test-'));

const env = {
  NODE_ENV: 'test',
  PORT: '0',
  BASE_URL: 'http://localhost:5000',
  DATA_DIR: tmp,
  EMAIL_OUTBOX_DIR: path.join(tmp, 'outbox'),
  EMAIL_DEV_OUTBOX: '1',
  EMAIL_REGISTER_SKIP_SMTP: '0',
  JWT_SECRET: 'test-access-secret-0123456789abcdef0123456789abcdef',
  JWT_SECRET_REFRESH: 'test-refresh-secret-fedcba9876543210fedcba9876543210',
  BCRYPT_ROUNDS: '4',
  HELP_SUPPORT_EMAIL: 'support@example.test',
  // valori vuoti: dotenv non li sovrascrive con quelli di un eventuale .env locale
  DATABASE_URL: '',
  REDIS_URL: '',
  SMTP_USER: '',
  SMTP_PASS: '',
  MAILTRAP_API_TOKEN: '',
  EMAIL_USE_MAILTRAP_API: '0',
  EVIL_TOOLS_PUBLIC: '0',
  CORS_ORIGINS: 'http://localhost:5000',
  TRUST_PROXY: '0',
  FORCE_HTTPS: '0',
  RATE_LIMIT_GLOBAL_MAX: '100000',
  RATE_LIMIT_LOGIN_MAX: '1000',
  RATE_LIMIT_LOGIN_IP_MAX: '1000',
  RATE_LIMIT_REGISTER_MAX: '1000',
  RATE_LIMIT_RESET_MAX: '1000',
  RATE_LIMIT_RESET_EMAIL_MAX: '1000',
  RATE_LIMIT_VERIFY_MAX: '1000',
  RATE_LIMIT_HELP_MAX: '1000',
  RATE_LIMIT_SCAN_MAX: '1000',
  RATE_LIMIT_VLAB_SESSION_MAX: '1000',
  RATE_LIMIT_VLAB_MAX: '10000',
};
for (const [k, v] of Object.entries(env)) process.env[k] = v;

module.exports = { tmp, outbox: env.EMAIL_OUTBOX_DIR };
