// ==================== RATE LIMITING MIDDLEWARE ====================
// Redis-backed rate limiting with per-user and per-IP tracking

const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');

// Initialize Redis client for rate limiting
let redis = null;

try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  redis.on('error', (err) => {
    console.warn('⚠️ Redis connection warning:', err.message);
    // Fall back to memory-based limiting if Redis unavailable
  });
} catch (err) {
  console.warn('⚠️ Redis not available, using memory-based rate limiting');
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
      return {
        totalHits: current,
        resetTime: Date.now() + (ttl * 1000)
      };
    } catch (err) {
      console.error('Redis increment error:', err);
      return { totalHits: 1, resetTime: Date.now() + windowMs };
    }
  }
}

const redisStore = new RedisStore();

/**
 * Custom store for express-rate-limit
 */
const createRedisLimiterStore = () => {
  return {
    incr: async (key) => {
      const data = await redisStore.increment(key, 15 * 60 * 1000);
      return data.totalHits;
    },
    
    resetKey: async (key) => {
      try {
        if (redis) await redis.del(key);
      } catch (err) {
        console.error('Redis reset error:', err);
      }
    },
    
    decrement: async (key) => {
      try {
        if (!redis) return;
        await redis.decr(key);
      } catch (err) {
        console.error('Redis decrement error:', err);
      }
    }
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
 * Register rate limiter: 3 attempts per hour per IP
 */
const registerLimiter = rateLimit({
  store: redis ? createRedisLimiterStore() : undefined,
  windowMs: parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW_MS || 3600000),
  max: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || 3),
  message: {
    error: 'Too many registration attempts, please try again after 1 hour.'
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

module.exports = {
  globalLimiter,
  authLimiter,
  registerLimiter,
  scanLimiter,
  dnsLimiter,
  uploadLimiter
};
