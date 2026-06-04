// ==================== RATE LIMITING MIDDLEWARE ====================
// Redis-backed rate limiting with per-user and per-IP tracking

const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

// Initialize Redis client for rate limiting
let redis = null;
const redisUrl = process.env.REDIS_URL && process.env.REDIS_URL.trim();

if (redisUrl) {
  try {
    redis = new Redis(redisUrl);
    // log only first connection error to reduce log spam
    let redisLogged = false;
    redis.on('error', (err) => {
      if (!redisLogged) {
        console.warn('⚠️ Redis connection warning:', err.message);
        redisLogged = true;
      }
      // fallback to memory-based limiting automatically happens
    });
  } catch (err) {
    console.warn('⚠️ Redis initialization failed, using memory-based rate limiting');
    redis = null;
  }
} else {
  console.info('ℹ️ Redis disabled for rate limiting (no REDIS_URL)');
}


/**
 * Custom store for Redis-backed rate limiting
 */
class RedisStore {
  async getKey(key) {
    try {
      if (!redis) return null;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : { totalHits: 0, resetTime: Date.now() + 60000 };
    } catch (err) {
      console.error('Redis get error:', err);
      return null;
    }
  }

  async setKey(key, value, windowMs) {
    try {
      if (!redis) return;
      await redis.setex(key, Math.ceil(windowMs / 1000), JSON.stringify(value));
    } catch (err) {
      console.error('Redis set error:', err);
    }
  }

  async increment(key, windowMs) {
    try {
      if (!redis) return { totalHits: 1, resetTime: Date.now() + windowMs };

      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttl = await redis.ttl(key);
      const ttlMs = ttl > 0 ? ttl * 1000 : windowMs;
      return {
        totalHits: current,
        resetTime: Date.now() + ttlMs,
      };
    } catch (err) {
      console.error('Redis increment error:', err);
      return { totalHits: 1, resetTime: Date.now() + windowMs };
    }
  }
}

const REDIS_RATE_LIMIT_MS = 2500;

function withRedisTimeout(promise, ms = REDIS_RATE_LIMIT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis rate limit timeout')), ms);
    }),
  ]);
}

const redisStore = new RedisStore();

/**
 * Store express-rate-limit v7 (increment → { totalHits, resetTime: Date })
 */
const createRedisLimiterStore = (windowMs = 15 * 60 * 1000) => {
  return {
    async increment(key) {
      try {
        const data = await withRedisTimeout(redisStore.increment(key, windowMs));
        return {
          totalHits: Math.max(1, Number(data.totalHits) || 1),
          resetTime: new Date(data.resetTime || Date.now() + windowMs),
        };
      } catch (err) {
        console.warn('⚠️ Rate limit Redis, uso fallback in-memory:', err.message);
        return {
          totalHits: 1,
          resetTime: new Date(Date.now() + windowMs),
        };
      }
    },

    async decrement(key) {
      try {
        if (!redis) return;
        await withRedisTimeout(redis.decr(key));
      } catch (err) {
        console.error('Redis decrement error:', err);
      }
    },

    async resetKey(key) {
      try {
        if (redis) await withRedisTimeout(redis.del(key));
      } catch (err) {
        console.error('Redis reset error:', err);
      }
    },
  };
};

// ==================== RATE LIMITERS ====================

/**
 * Global rate limiter: 100 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || 900000),
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || 100),
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.ip,
  skip: (req) => !req.ip,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP
 * Skips if successful (200 status)
 */
const authLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || 900000),
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || 5),
  message: {
    error: 'Too many login attempts, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Rate limit by email + IP to prevent enumeration
    return `${req.body.email || 'unknown'}:${req.ip}`;
  },
  skip: (req) => !req.ip,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Register rate limiter: 5 account / hour per IP
 */
/** Registrazione: solo memoria (Redis può ritardare la risposta su hosting condiviso) */
const registerLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS || 3600000),
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || 5),
  message: { error: 'Troppi tentativi di registrazione. Riprova più tardi.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => !req.ip,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Password reset rate limiter: 5 richieste / 15 min per IP+email
 */
const passwordResetLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: parseInt(process.env.RATE_LIMIT_RESET_WINDOW_MS || 900000),
  max: parseInt(process.env.RATE_LIMIT_RESET_MAX || 5),
  message: { error: 'Troppe richieste di reset password. Riprova più tardi.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.body?.email || 'unknown'}:${req.ip || 'unknown'}`,
  skip: (req) => !req.ip,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Refresh token rate limiter
 */
const refreshTokenLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_REFRESH_MAX || 30),
  message: { error: 'Troppi refresh token. Riprova più tardi.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  skip: (req) => !req.ip,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Scan rate limiter: 50 scans per hour per user
 */
const scanLimiter = (req, res, next) => {
  const key = `scan:${req.user?.id || req.ip}`;
  const maxAttempts = parseInt(process.env.RATE_LIMIT_SCAN_MAX || 50);
  const windowMs = parseInt(process.env.RATE_LIMIT_SCAN_WINDOW_MS || 3600000);

  redisStore.getKey(key).then((data) => {
    if (data && data.totalHits >= maxAttempts) {
      return res.status(429).json({
        error: `Too many scan requests. Limit: ${maxAttempts} per hour.`,
        retryAfter: Math.ceil((data.resetTime - Date.now()) / 1000)
      });
    }

    redisStore.increment(key, windowMs).then(() => next());
  });
};

/**
 * DNS enumeration rate limiter: 100 requests per hour per user
 */
const dnsLimiter = (req, res, next) => {
  const key = `dns:${req.user?.id || req.ip}`;
  const maxAttempts = parseInt(process.env.RATE_LIMIT_DNS_MAX || 100);
  const windowMs = parseInt(process.env.RATE_LIMIT_DNS_WINDOW_MS || 3600000);

  redisStore.getKey(key).then((data) => {
    if (data && data.totalHits >= maxAttempts) {
      return res.status(429).json({
        error: `Too many DNS requests. Limit: ${maxAttempts} per hour.`,
        retryAfter: Math.ceil((data.resetTime - Date.now()) / 1000)
      });
    }

    redisStore.increment(key, windowMs).then(() => next());
  });
};

/**
 * Public incidents feed: 120 requests per 15 minutes per IP (no auth required)
 */
const incidentsPublicLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { error: 'Too many requests to incidents feed. Retry in a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => !req.ip,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Upload rate limiter: 50 files per 24 hours per user
 */
const uploadLimiter = (req, res, next) => {
  const key = `upload:${req.user?.id || req.ip}`;
  const maxAttempts = parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || 50);
  const windowMs = parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS || 86400000);

  redisStore.getKey(key).then((data) => {
    if (data && data.totalHits >= maxAttempts) {
      return res.status(429).json({
        error: `Too many upload requests. Limit: ${maxAttempts} per 24 hours.`,
        retryAfter: Math.ceil((data.resetTime - Date.now()) / 1000)
      });
    }

    redisStore.increment(key, windowMs).then(() => next());
  });
};

/**
 * Virtual lab: 300 command exec per hour per IP/user
 */
function resolveLimiterClientKey(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = String(forwarded).split(',')[0].trim();
    if (ip) return `ip:${ip}`;
  }
  if (req.ip) return `ip:${req.ip}`;
  return 'ip:unknown';
}

const virtualLabSessionLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_VLAB_SESSION_MAX || 30, 10),
  message: { error: 'Troppi avvii lab. Riprova tra qualche minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `vlab-start:${resolveLimiterClientKey(req)}`,
  skip: () => false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});

const virtualLabLimiter = (req, res, next) => {
  const key = `vlab:${resolveLimiterClientKey(req)}`;
  const maxAttempts = parseInt(process.env.RATE_LIMIT_VLAB_MAX || 300, 10);
  const windowMs = parseInt(process.env.RATE_LIMIT_VLAB_WINDOW_MS || 3600000, 10);

  redisStore
    .getKey(key)
    .then((data) => {
      if (data && data.totalHits >= maxAttempts) {
        return res.status(429).json({
          error: `Limite comandi lab raggiunto (${maxAttempts}/ora).`,
          retryAfter: Math.ceil((data.resetTime - Date.now()) / 1000),
        });
      }
      return redisStore.increment(key, windowMs).then(() => next());
    })
    .catch((err) => {
      console.error('virtualLabLimiter error:', err.message);
      next();
    });
};

module.exports = {
  globalLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  refreshTokenLimiter,
  scanLimiter,
  dnsLimiter,
  uploadLimiter,
  incidentsPublicLimiter,
  virtualLabSessionLimiter,
  virtualLabLimiter,
};
