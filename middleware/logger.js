// ==================== LOGGING & AUDIT MIDDLEWARE ====================
// Centralized logging for security events and errors

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || './logs';
const AUDIT_LOG_FILE = path.join(LOG_DIR, 'audit.log');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'error.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Log levels
 */
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  AUDIT: 'AUDIT'
};

/**
 * Format timestamp for logs
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * General logger
 */
const logger = {
  error: (message, meta = {}) => {
    const logEntry = {
      timestamp: getTimestamp(),
      level: LOG_LEVELS.ERROR,
      message,
      ...meta
    };
    
    console.error(`[ERROR] ${message}`, meta);
    
    // Write to error log file
    fs.appendFileSync(ERROR_LOG_FILE, JSON.stringify(logEntry) + '\n');
  },

  warn: (message, meta = {}) => {
    const logEntry = {
      timestamp: getTimestamp(),
      level: LOG_LEVELS.WARN,
      message,
      ...meta
    };
    
    console.warn(`[WARN] ${message}`, meta);
  },

  info: (message, meta = {}) => {
    if (process.env.LOG_LEVEL !== 'ERROR') {
      const logEntry = {
        timestamp: getTimestamp(),
        level: LOG_LEVELS.INFO,
        message,
        ...meta
      };
      
      console.log(`[INFO] ${message}`, meta);
    }
  },

  debug: (message, meta = {}) => {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      const logEntry = {
        timestamp: getTimestamp(),
        level: LOG_LEVELS.DEBUG,
        message,
        ...meta
      };
      
      console.debug(`[DEBUG] ${message}`, meta);
    }
  }
};

/**
 * Audit logger - for security-relevant events
 */
const auditLog = {
  /**
   * Log successful login
   */
  loginSuccess: (userId, email, ip) => {
    const entry = {
      timestamp: getTimestamp(),
      event: 'LOGIN_SUCCESS',
      userId,
      email,
      ip,
      userAgent: process.env._USER_AGENT || 'N/A'
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
    logger.info('Login successful', { userId, email, ip });
  },

  /**
   * Log failed login attempt
   */
  loginFailed: (email, ip, reason = 'Invalid credentials') => {
    const entry = {
      timestamp: getTimestamp(),
      event: 'LOGIN_FAILED',
      email,
      ip,
      reason,
      userAgent: process.env._USER_AGENT || 'N/A'
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
    logger.warn('Login failed', { email, ip, reason });
  },

  /**
   * Log account lockout
   */
  accountLocked: (userId, email, ip, reason = 'Too many failed attempts') => {
    const entry = {
      timestamp: getTimestamp(),
      event: 'ACCOUNT_LOCKED',
      userId,
      email,
      ip,
      reason,
      userAgent: process.env._USER_AGENT || 'N/A'
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
    logger.warn('Account locked', { userId, email, reason });
  },

  /**
   * Log file upload
   */
  fileUpload: (userId, filename, size, mimetype, ip) => {
    const entry = {
      timestamp: getTimestamp(),
      event: 'FILE_UPLOAD',
      userId,
      filename,
      size,
      mimetype,
      ip
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
    logger.info('File uploaded', { userId, filename, size });
  },

  /**
   * Log rate limit breach
   */
  rateLimitBreach: (section, key, limit, ip) => {
    const entry = {
      timestamp: getTimestamp(),
      event: 'RATE_LIMIT_EXCEEDED',
      section,
      key,
      limit,
      ip
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
    logger.warn('Rate limit exceeded', { section, key, limit });
  },

  /**
   * Log security event
   */
  security: (event, details, severity = 'INFO') => {
    const entry = {
      timestamp: getTimestamp(),
      event,
      details,
      severity
    };
    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n');
    logger.warn(`Security: ${event}`, details);
  }
};

/**
 * Middleware: Log HTTP requests (optional)
 */
const httpLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: getTimestamp(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };
    
    // Log 4xx and 5xx status codes
    if (res.statusCode >= 400) {
      fs.appendFileSync(ERROR_LOG_FILE, JSON.stringify(logData) + '\n');
    }
  });
  
  next();
};

module.exports = {
  logger,
  auditLog,
  httpLogger,
  LOG_LEVELS
};
