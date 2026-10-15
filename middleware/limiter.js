// ==================== RATE LIMITING ====================
// Tutti i limiter usano express-rate-limit. Con REDIS_URL i contatori sono
// condivisi tra istanze; se Redis non risponde si ripiega su un contatore in
// memoria (i limiti restano attivi, solo per singolo processo).
//
// Prima: scan/dns/upload/lab usavano uno store scritto a mano che non bloccava
// mai (senza Redis getKey restituiva null, con Redis leggeva un numero dove si
// aspettava un oggetto), e tutti i limiter condividevano le stesse chiavi Redis.

const { rateLimit, MemoryStore } = require('express-rate-limit');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isTest } = require('../utils/env');

// Segna i messaggi per l'estrazione delle traduzioni; tradotti nel handler con req.t()
const t = (s) => s;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function envInt(name, fallback) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// ---------------------------------------------------------------- Redis (opzionale)
let redis = null;
const redisUrl = (process.env.REDIS_URL || '').trim();
if (redisUrl && !isTest()) {
  redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false });
  let logged = false;
  redis.on('error', (err) => {
    if (!logged) {
      console.warn('⚠️ Redis rate limit non raggiungibile, uso contatori in memoria:', err.message);
      logged = true;
    }
  });
}

function withTimeout(promise, ms) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error('Redis timeout')), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

/** Store Redis per express-rate-limit v7, con ripiego automatico in memoria */
class ResilientRedisStore {
  constructor(name) {
    this.prefix = `rl:${name}:`;
    this.fallback = new MemoryStore();
    this.windowMs = MINUTE;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  async increment(key) {
    const k = this.prefix + key;
    try {
      const res = await withTimeout(redis.multi().incr(k).pttl(k).exec(), 1500);
      const hits = Number(res[0][1]);
      let ttl = Number(res[1][1]);
      if (ttl < 0) {
        await withTimeout(redis.pexpire(k, this.windowMs), 1500);
        ttl = this.windowMs;
      }
      return { totalHits: hits, resetTime: new Date(Date.now() + ttl) };
    } catch {
      return this.fallback.increment(key);
    }
  }

  async decrement(key) {
    try {
      await withTimeout(redis.decr(this.prefix + key), 1500);
    } catch {
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key) {
    try {
      await withTimeout(redis.del(this.prefix + key), 1500);
    } catch {
      /* ignora */
    }
    await this.fallback.resetKey(key);
  }
}

// ---------------------------------------------------------------- chiavi
/** Utente autenticato (se il middleware di auth è già passato) oppure IP */
function userOrIpKey(req) {
  if (req.user?.id && req.user.id !== 'guest') return `u:${req.user.id}`;
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Per il limite globale (eseguito prima dell'autenticazione): se il cookie di
 * accesso è valido conta per utente, così una classe dietro lo stesso IP non
 * si blocca a vicenda.
 */
function globalKey(req) {
  const token = req.cookies?.accessToken || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (payload?.id) return `u:${payload.id}`;
    } catch {
      /* token scaduto o non valido: conta per IP */
    }
  }
  return `ip:${req.ip || 'unknown'}`;
}

function emailKey(req) {
  return String(req.body?.email || '').trim().toLowerCase().slice(0, 254) || 'none';
}

function emailHash(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 32);
}

// ---------------------------------------------------------------- ritardo progressivo (login)
/**
 * Dopo LOGIN_DELAY_AFTER errori consecutivi sulla stessa email, ogni nuovo tentativo
 * aspetta un po' di più (raddoppia fino a LOGIN_DELAY_MAX_MS). L'attesa è un timer: non
 * occupa CPU. Vale per qualunque email, esistente o no (nessuna differenza di tempi).
 * Contatori in memoria del processo, azzerati da un login riuscito o dal reset password.
 */
function createLoginDelay({
  after = envInt('LOGIN_DELAY_AFTER', 3),
  baseMs = envInt('LOGIN_DELAY_BASE_MS', isTest() ? 5 : 250),
  maxMs = envInt('LOGIN_DELAY_MAX_MS', 8000),
  windowMs = HOUR,
  maxEntries = 50000,
} = {}) {
  const failures = new Map(); // hash email → { count, first }

  function entry(email) {
    const key = emailHash(String(email || '').trim().toLowerCase());
    const e = failures.get(key);
    if (e && Date.now() - e.first > windowMs) {
      failures.delete(key);
      return { key, e: null };
    }
    return { key, e };
  }

  function delayFor(email) {
    const { e } = entry(email);
    if (!e || e.count < after) return 0;
    return Math.min(maxMs, baseMs * 2 ** (e.count - after));
  }

  async function wait(email) {
    const ms = delayFor(email);
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return ms;
  }

  function fail(email) {
    const { key, e } = entry(email);
    if (e) e.count += 1;
    else {
      if (failures.size >= maxEntries) failures.delete(failures.keys().next().value);
      failures.set(key, { count: 1, first: Date.now() });
    }
  }

  function reset(email) {
    failures.delete(entry(email).key);
  }

  return { wait, fail, reset, delayFor };
}

const loginDelay = createLoginDelay();

// ---------------------------------------------------------------- fabbrica
function makeLimiter(name, { windowMs, max, message, keyGenerator = userOrIpKey, skip, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests,
    store: redis ? new ResilientRedisStore(name) : undefined,
    keyGenerator,
    skip,
    handler: (req, res, next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      res.status(429).json({ error: req.t ? req.t(message) : message, code: 'RATE_LIMITED', retryAfter });
    },
  });
}

// Letture leggere e frequenti che non devono consumare il limite globale
const GLOBAL_EXEMPT = new Set([
  '/api/health',
  '/api/health/ping',
  '/api/auth/session',
  '/api/achievements',
  '/api/virtual-lab/catalog',
]);

const globalLimiter = makeLimiter('global', {
  windowMs: envInt('RATE_LIMIT_GLOBAL_WINDOW_MS', 15 * MINUTE),
  max: envInt('RATE_LIMIT_GLOBAL_MAX', 1000),
  message: t('Troppe richieste in poco tempo. Riprova tra qualche minuto.'),
  keyGenerator: globalKey,
  skip: (req) => GLOBAL_EXEMPT.has(req.path) || GLOBAL_EXEMPT.has(req.baseUrl + req.path),
});

// Login: contano solo i tentativi falliti, per coppia email+IP e per IP
const authLimiter = makeLimiter('login', {
  windowMs: envInt('RATE_LIMIT_LOGIN_WINDOW_MS', 15 * MINUTE),
  max: envInt('RATE_LIMIT_LOGIN_MAX', 10),
  message: t('Troppi tentativi di accesso con questa email. Riprova tra 15 minuti.'),
  keyGenerator: (req) => `${emailKey(req)}|${req.ip || 'unknown'}`,
  skipSuccessfulRequests: true,
});

// Per account (S-09): tetto ai tentativi falliti su una stessa email da qualunque IP
// (contro gli attacchi distribuiti). Si azzera con il reset della password.
const accountLoginLimiter = makeLimiter('login-account', {
  windowMs: envInt('RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_LOGIN_ACCOUNT_MAX', 30),
  message: t('Troppi tentativi di accesso a questo account. Riprova tra un\'ora o reimposta la password.'),
  keyGenerator: (req) => `acct:${emailHash(emailKey(req))}`,
  skipSuccessfulRequests: true,
});

const loginIpLimiter = makeLimiter('login-ip', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_LOGIN_IP_MAX', 50),
  message: t('Troppi tentativi di accesso da questa rete. Riprova tra 15 minuti.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
  skipSuccessfulRequests: true,
});

const registerLimiter = makeLimiter('register', {
  windowMs: envInt('RATE_LIMIT_REGISTER_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_REGISTER_MAX', 5),
  message: t('Troppi tentativi di registrazione. Riprova più tardi.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

const passwordResetLimiter = makeLimiter('reset', {
  windowMs: envInt('RATE_LIMIT_RESET_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_RESET_MAX', 10),
  message: t('Troppe richieste di reset password. Riprova più tardi.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

// Per email: evita di tempestare una casella con email di reset da IP diversi
const passwordResetEmailLimiter = makeLimiter('reset-email', {
  windowMs: HOUR,
  max: envInt('RATE_LIMIT_RESET_EMAIL_MAX', 3),
  message: t('Abbiamo già inviato alcune email di reset a questo indirizzo. Controlla la casella o riprova tra un\'ora.'),
  keyGenerator: emailKey,
});

const verificationLimiter = makeLimiter('verify', {
  windowMs: HOUR,
  max: envInt('RATE_LIMIT_VERIFY_MAX', 5),
  message: t('Troppe richieste di invio email di verifica. Riprova più tardi.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

const verificationStatusLimiter = makeLimiter('verify-status', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_VERIFY_STATUS_MAX', 200),
  message: t('Troppe richieste di stato verifica. Riprova tra qualche minuto.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

const refreshTokenLimiter = makeLimiter('refresh', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_REFRESH_MAX', 60),
  message: t('Troppi rinnovi di sessione. Riprova più tardi.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

const helpLimiter = makeLimiter('help', {
  windowMs: envInt('RATE_LIMIT_HELP_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_HELP_MAX', 5),
  message: t('Troppe richieste dal modulo Help. Riprova più tardi.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

// Strumenti che generano traffico verso terzi: per utente
const scanLimiter = makeLimiter('scan', {
  windowMs: envInt('RATE_LIMIT_SCAN_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_SCAN_MAX', 50),
  message: t('Hai raggiunto il limite di scansioni per quest\'ora. Riprova più tardi.'),
});

const dnsLimiter = makeLimiter('dns', {
  windowMs: envInt('RATE_LIMIT_DNS_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_DNS_MAX', 100),
  message: t('Hai raggiunto il limite di interrogazioni DNS/WHOIS per quest\'ora.'),
});

const uploadLimiter = makeLimiter('upload', {
  windowMs: envInt('RATE_LIMIT_UPLOAD_WINDOW_MS', 24 * HOUR),
  max: envInt('RATE_LIMIT_UPLOAD_MAX', 50),
  message: t('Hai raggiunto il limite di file analizzati per oggi.'),
});

const incidentsPublicLimiter = makeLimiter('incidents', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_INCIDENTS_MAX', 120),
  message: t('Troppe richieste al feed incidenti. Riprova tra qualche minuto.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

/** Laboratorio: per utente o per ospite (cookie anonimo impostato dal servizio lab) */
function labKey(req) {
  if (req.user?.id) return `u:${req.user.id}`;
  const anon = req.cookies?.evil_lab_anon;
  if (anon && /^[a-f0-9-]{16,64}$/i.test(anon)) return `a:${anon}`;
  return `ip:${req.ip || 'unknown'}`;
}

const virtualLabSessionLimiter = makeLimiter('lab-start', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_VLAB_SESSION_MAX', 30),
  message: t('Troppi avvii di laboratorio. Riprova tra qualche minuto.'),
  keyGenerator: labKey,
});

const virtualLabLimiter = makeLimiter('lab-exec', {
  windowMs: envInt('RATE_LIMIT_VLAB_WINDOW_MS', HOUR),
  max: envInt('RATE_LIMIT_VLAB_MAX', 600),
  message: t('Limite comandi del laboratorio raggiunto per quest\'ora.'),
  keyGenerator: labKey,
});

// Verifica pubblica dei diplomi: per IP, per non far enumerare i codici
const certificateVerifyLimiter = makeLimiter('cert-verify', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_CERT_MAX', isTest() ? 10000 : 60),
  message: t('Troppe verifiche di diplomi. Riprova tra qualche minuto.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

const courseExamLimiter = makeLimiter('course-exam', {
  windowMs: HOUR,
  max: envInt('RATE_LIMIT_COURSE_EXAM_MAX', isTest() ? 1000 : 20),
  message: t('Troppi tentativi di esame. Riprova tra qualche minuto.'),
  keyGenerator: (req) => `user:${req.userRecord?.id || req.ip || 'unknown'}`,
});

const courseContentLimiter = makeLimiter('course-content', {
  windowMs: HOUR,
  max: envInt('RATE_LIMIT_COURSE_CONTENT_MAX', isTest() ? 10000 : 600),
  message: t('Troppe richieste ai corsi. Riprova tra qualche minuto.'),
  keyGenerator: (req) => `user:${req.userRecord?.id || req.ip || 'unknown'}`,
});

// Tetto per IP sul laboratorio, indipendente dai cookie (che un abuso può azzerare)
const virtualLabIpLimiter = makeLimiter('lab-ip', {
  windowMs: 15 * MINUTE,
  max: envInt('RATE_LIMIT_VLAB_IP_MAX', 3000),
  message: t('Troppe richieste al laboratorio da questa rete. Riprova tra qualche minuto.'),
  keyGenerator: (req) => `ip:${req.ip || 'unknown'}`,
});

module.exports = {
  globalLimiter,
  authLimiter,
  accountLoginLimiter,
  loginDelay,
  createLoginDelay,
  loginIpLimiter,
  registerLimiter,
  passwordResetLimiter,
  passwordResetEmailLimiter,
  verificationLimiter,
  verificationStatusLimiter,
  refreshTokenLimiter,
  helpLimiter,
  scanLimiter,
  dnsLimiter,
  uploadLimiter,
  incidentsPublicLimiter,
  virtualLabSessionLimiter,
  virtualLabLimiter,
  virtualLabIpLimiter,
  certificateVerifyLimiter,
  courseExamLimiter,
  courseContentLimiter,
  ResilientRedisStore,
  _internals: { userOrIpKey, globalKey, labKey, emailKey, emailHash, GLOBAL_EXEMPT },
};
