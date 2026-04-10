// ==================== TOKEN MANAGER SERVICE ====================
// Manage JWT tokens with Redis persistence
// Handles token storage, validation, and revocation

const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

class TokenManager {
  constructor() {
    const redisUrl = process.env.REDIS_URL && process.env.REDIS_URL.trim();
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl);
        // log only the first error to avoid spam
        let logged = false;
        this.redis.on('error', (err) => {
          if (!logged) {
            console.warn('⚠️ Redis connection warning:', err.message);
            logged = true;
          }
        });
        this.connected = true;
      } catch (err) {
        console.warn('⚠️ Redis initialization failed, using memory-based token storage');
        this.memoryStore = {};
        this.connected = false;
      }
    } else {
      console.info('ℹ️ Redis URL not provided, operating in-memory only');
      this.memoryStore = {};
      this.connected = false;
    }
  }

  /**
   * Store refresh token in Redis with expiry
   */
  async storeRefreshToken(userId, token) {
    const key = `refresh_token:${userId}`;
    const ttl = 7 * 24 * 60 * 60; // 7 days in seconds

    if (this.connected && this.redis) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify({
          token,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
        }));
        return true;
      } catch (err) {
        console.error('Error storing refresh token:', err);
        return false;
      }
    } else {
      // Fallback to memory
      this.memoryStore[key] = {
        token,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
      };
      return true;
    }
  }

  /**
   * Verify and retrieve refresh token
   */
  async getRefreshToken(userId) {
    const key = `refresh_token:${userId}`;

    if (this.connected && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (!data) return null;
        return JSON.parse(data);
      } catch (err) {
        console.error('Error retrieving refresh token:', err);
        return null;
      }
    } else {
      // Fallback to memory
      return this.memoryStore[key] || null;
    }
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeRefreshToken(userId) {
    const key = `refresh_token:${userId}`;

    if (this.connected && this.redis) {
      try {
        await this.redis.del(key);
        return true;
      } catch (err) {
        console.error('Error revoking refresh token:', err);
        return false;
      }
    } else {
      // Fallback to memory
      delete this.memoryStore[key];
      return true;
    }
  }

  /**
   * Store password reset token with short TTL (15 minutes)
   */
  async storeResetToken(userId, token) {
    const key = `reset_token:${userId}`;
    const ttl = 15 * 60; // 15 minutes

    if (this.connected && this.redis) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify({
          token,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
        }));
        return true;
      } catch (err) {
        console.error('Error storing reset token:', err);
        return false;
      }
    } else {
      this.memoryStore[key] = {
        token,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
      };
      return true;
    }
  }

  /**
   * Retrieve and validate reset token
   */
  async getResetToken(userId) {
    const key = `reset_token:${userId}`;

    if (this.connected && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (!data) return null;
        return JSON.parse(data);
      } catch (err) {
        console.error('Error retrieving reset token:', err);
        return null;
      }
    } else {
      return this.memoryStore[key] || null;
    }
  }

  /**
   * Revoke reset token after use
   */
  async revokeResetToken(userId) {
    const key = `reset_token:${userId}`;

    if (this.connected && this.redis) {
      try {
        await this.redis.del(key);
        return true;
      } catch (err) {
        console.error('Error revoking reset token:', err);
        return false;
      }
    } else {
      delete this.memoryStore[key];
      return true;
    }
  }

  /**
   * Store account lockout status
   */
  async lockAccount(userId, durationMs) {
    const key = `account_locked:${userId}`;
    const ttl = Math.ceil(durationMs / 1000);

    if (this.connected && this.redis) {
      try {
        await this.redis.setex(key, ttl, '1');
        return true;
      } catch (err) {
        console.error('Error locking account:', err);
        return false;
      }
    } else {
      this.memoryStore[key] = { lockedUntil: Date.now() + durationMs };
      return true;
    }
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(userId) {
    const key = `account_locked:${userId}`;

    if (this.connected && this.redis) {
      try {
        const locked = await this.redis.exists(key);
        return locked === 1;
      } catch (err) {
        console.error('Error checking account lock:', err);
        return false;
      }
    } else {
      const data = this.memoryStore[key];
      if (!data) return false;
      if (Date.now() > data.lockedUntil) {
        delete this.memoryStore[key];
        return false;
      }
      return true;
    }
  }

  /**
   * Unlock account
   */
  async unlockAccount(userId) {
    const key = `account_locked:${userId}`;

    if (this.connected && this.redis) {
      try {
        await this.redis.del(key);
        return true;
      } catch (err) {
        console.error('Error unlocking account:', err);
        return false;
      }
    } else {
      delete this.memoryStore[key];
      return true;
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      provider: this.connected ? 'Redis' : 'Memory',
      url: this.connected ? process.env.REDIS_URL : 'N/A'
    };
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    if (this.connected && this.redis) {
      try {
        await this.redis.quit();
        this.connected = false;
        // Redis disconnected
      } catch (err) {
        console.error('Error disconnecting Redis:', err);
      }
    }
  }
}

// Export singleton instance
module.exports = new TokenManager();
