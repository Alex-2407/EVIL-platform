// ==================== AUTHENTICATION MIDDLEWARE ====================
// Secure JWT verification, password validation, and token management

const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

// Password strength validation regex
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Middleware: Verify JWT Access Token
 * Returns 401 if token missing/invalid/expired
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // httpOnly cookie (preferred) or legacy header
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'NO_TOKEN'
    });
  }

  // CRITICAL: JWT_SECRET is mandatory - no fallback to weak defaults
  if (!process.env.JWT_SECRET) {
    console.error('❌ CRITICAL: JWT_SECRET environment variable not configured');
    process.exit(1);
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(403).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    req.user = user;
    next();
  });
};

/**
 * Validate password strength
 * Requirements:
 * - Minimum 12 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character (@$!%*?&)
 */
const validatePasswordStrength = (password) => {
  if (!password || password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one uppercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one number' };
  }
  if (!/[@$!%*?&]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character (@$!%*?&)' };
  }
  return { valid: true };
};

/**
 * Validation chain for registration
 * - Name: 2-100 characters, no special chars
 * - Email: valid email format, normalized
 * - Password: strength check
 * -confirmPassword: matches password
 */
const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name contains invalid characters'),
  
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 255 })
    .withMessage('Email too long'),
  
  body('password')
    .custom((value) => {
      const check = validatePasswordStrength(value);
      if (!check.valid) throw new Error(check.reason);
      return true;
    }),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  // Middleware to handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array().map(e => ({ field: e.param, message: e.msg }))
      });
    }
    next();
  }
];

/**
 * Validation chain for login
 * - Email: valid format, normalized
 * - Password: required
 */
const validateLogin = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  // Middleware to handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array().map(e => ({ field: e.param, message: e.msg }))
      });
    }
    next();
  }
];

/**
 * Validation chain for password reset
 */
const validatePasswordReset = [
  body('resetToken')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .custom((value) => {
      const check = validatePasswordStrength(value);
      if (!check.valid) throw new Error(check.reason);
      return true;
    }),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array().map(e => ({ field: e.param, message: e.msg }))
      });
    }
    next();
  }
];

/**
 * Hash password with bcrypt
 */
const hashPassword = async (password) => {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12);
  return await bcrypt.hash(password, rounds);
};

/**
 * Verify password against bcrypt hash
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  authenticateToken,
  validateRegister,
  validateLogin,
  validatePasswordReset,
  validatePasswordStrength,
  hashPassword,
  verifyPassword
};
