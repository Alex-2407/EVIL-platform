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
  // eslint-disable-next-line no-control-regex -- i caratteri di controllo vanno proprio tolti
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
      sanitized.match(/^vbscript:/i) ||
      sanitized.match(/^file:/i)) {
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

// Protezione SSRF: implementazione unica in server/lib/safe-http.js.
// Queste funzioni restano per compatibilità con il codice che le importava.
const safeHttp = require('../server/lib/safe-http');

function isBlockedHostname(hostname) {
  try {
    safeHttp.assertHostnameAllowed(hostname);
    return false;
  } catch {
    return true;
  }
}

function isPrivateIp(ip) {
  return !safeHttp.isPublicAddress(ip);
}

async function assertSafePublicUrl(urlString) {
  await safeHttp.assertPublicDestination(urlString);
  return urlString;
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
  let sanitized = filename.replace(/[/\\:*?"<>|]/g, '_');

  // Remove null bytes and control characters
  // eslint-disable-next-line no-control-regex -- i caratteri di controllo vanno proprio tolti
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }

  return sanitized;
}

module.exports = {
  sanitizeString,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeFilename,
  assertSafePublicUrl,
  isBlockedHostname,
  isPrivateIp,
};