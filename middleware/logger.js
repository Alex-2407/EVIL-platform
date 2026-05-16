// ==================== LOGGING SYSTEM ====================
// Structured logging with Winston for better debugging and monitoring

const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'evil-platform' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),

    // Audit log for security events
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
      })
    )
  }));
}

// HTTP request logger middleware
const httpLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

// Audit logging for security events
const auditLog = {
  /**
   * Log successful login
   */
  loginSuccess: (userId, email, ip, userAgent) => {
    logger.info('AUDIT: Login successful', {
      event: 'LOGIN_SUCCESS',
      userId,
      email,
      ip,
      userAgent
    });
  },

  /**
   * Log failed login attempt
   */
  loginFailed: (email, ip, reason = 'Invalid credentials', userAgent) => {
    logger.warn('AUDIT: Login failed', {
      event: 'LOGIN_FAILED',
      email,
      ip,
      reason,
      userAgent
    });
  },

  /**
   * Log account lockout
   */
  accountLocked: (userId, email, ip, reason = 'Too many failed attempts', userAgent) => {
    logger.warn('AUDIT: Account locked', {
      event: 'ACCOUNT_LOCKED',
      userId,
      email,
      ip,
      reason,
      userAgent
    });
  },

  /**
   * Log file upload
   */
  fileUpload: (userId, filename, size, mimetype, ip) => {
    logger.info('AUDIT: File uploaded', {
      event: 'FILE_UPLOAD',
      userId,
      filename,
      size,
      mimetype,
      ip
    });
  },

  /**
   * Log rate limit breach
   */
  rateLimitBreach: (section, key, limit, ip) => {
    logger.warn('AUDIT: Rate limit exceeded', {
      event: 'RATE_LIMIT_EXCEEDED',
      section,
      key,
      limit,
      ip
    });
  },

  /**
   * Log security event
   */
  security: (event, details, severity = 'INFO') => {
    logger.warn(`AUDIT: Security event - ${event}`, {
      event,
      details,
      severity
    });
  }
};

module.exports = {
  logger,
  auditLog,
  httpLogger
};
