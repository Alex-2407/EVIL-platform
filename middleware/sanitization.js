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

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
]);

function isBlockedHostname(hostname) {
  if (!hostname) return true;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return true;
  }
  return false;
}

function isPrivateIp(ip) {
  const version = require('net').isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fe80:')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }
  return false;
}

/**
 * Blocca SSRF verso reti private / metadata cloud
 */
async function assertSafePublicUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('URL non valido');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Protocollo non consentito');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Host non consentito');
  }

  const dns = require('dns').promises;
  let records;
  try {
    records = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Dominio non risolvibile');
  }

  if (!records.length) {
    throw new Error('Dominio non risolvibile');
  }

  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error('Indirizzo di destinazione non consentito');
    }
  }

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
  checkRateLimit,
  assertSafePublicUrl,
  isBlockedHostname,
  isPrivateIp,
};