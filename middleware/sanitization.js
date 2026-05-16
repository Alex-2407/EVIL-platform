// ==================== INPUT SANITIZATION UTILITIES ====================
// Sanitize and validate user inputs to prevent XSS and injection attacks

const validator = require('validator');

/**
 * Sanitize string input
 * @param {string} input - Input string to sanitize
 * @param {object} options - Sanitization options
 * @returns {string} Sanitized string
 */
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return '';

  let sanitized = input.trim();

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Escape HTML entities
  if (options.escapeHtml !== false) {
    sanitized = validator.escape(sanitized);
  }

  // Remove potentially dangerous characters
  if (options.removeSpecialChars) {
    sanitized = sanitized.replace(/[<>'"&]/g, '');
  }

  // Limit length
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  return sanitized;
}

/**
 * Sanitize URL input
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';

  let sanitized = url.trim();

  // Remove dangerous protocols
  if (sanitized.match(/^javascript:/i) ||
      sanitized.match(/^data:/i) ||
      sanitized.match(/^vbscript:/i)) {
    return '';
  }

  // Ensure http/https prefix
  if (!sanitized.match(/^https?:\/\//i)) {
    sanitized = 'https://' + sanitized;
  }

  // Validate URL format
  if (!validator.isURL(sanitized, {
    protocols: ['http', 'https'],
    require_protocol: true
  })) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize email input
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';

  const sanitized = email.trim().toLowerCase();

  if (!validator.isEmail(sanitized)) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize filename
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return '';

  // Remove path separators and dangerous characters
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}

/**
 * Rate limit helper with exponential backoff
 * @param {string} key - Rate limit key
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} True if allowed, false if rate limited
 */
function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  // This would integrate with Redis in production
  // For now, return true (allow)
  return true;
}

module.exports = {
  sanitizeString,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeFilename,
  checkRateLimit
};