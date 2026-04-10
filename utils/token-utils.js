// ==================== TOKEN UTILITIES ====================
// Secure token generation, management, and rotation
// Implements access + refresh token pattern with httpOnly cookies

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

if (!JWT_SECRET || !JWT_SECRET_REFRESH) {
  console.error('❌ CRITICAL: JWT secrets not configured');
  process.exit(1);
}

/**
 * ✅ Generate Access Token (short-lived, 15 minutes)
 * Stored in Memory - NOT exposed to XSS attacks
 */
function generateAccessToken(userId, email) {
  return jwt.sign(
    { 
      userId, 
      email,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * ✅ Generate Refresh Token (long-lived, 7 days)
 * Stored in httpOnly Cookie - Protected from XSS
 */
function generateRefreshToken(userId) {
  return jwt.sign(
    { 
      userId,
      type: 'refresh'
    },
    JWT_SECRET_REFRESH,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * ✅ Verify Access Token
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      return { valid: false, error: 'Invalid token type' };
    }
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * ✅ Verify Refresh Token
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET_REFRESH);
    if (decoded.type !== 'refresh') {
      return { valid: false, error: 'Invalid token type' };
    }
    return { valid: true, decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * ✅ Set Token Cookies (httpOnly, Secure, SameSite)
 */
function setTokenCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Access Token (15 minutes) - In-memory recommended, but can send if needed
  res.cookie('accessToken', accessToken, {
    httpOnly: true,        // 🔒 Not accessible via JavaScript (prevents XSS token theft)
    secure: isProduction,  // HTTPS only in production
    sameSite: 'strict',    // CSRF protection
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined
  });

  // Refresh Token (7 days) - httpOnly + Secure
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,        // 🔒 Protected from JavaScript access
    secure: isProduction,  // HTTPS only in production
    sameSite: 'strict',    // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth/refresh', // Only sent to refresh endpoint
    domain: process.env.COOKIE_DOMAIN || undefined
  });
}

/**
 * ✅ Clear Token Cookies (Logout)
 */
function clearTokenCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
}

/**
 * ✅ Generate CSRF Token (for form submissions)
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * ✅ Verify CSRF Token
 */
function verifyCSRFToken(token, sessionToken) {
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(sessionToken)
  );
}

/**
 * ✅ Set CSRF Cookie
 */
function setCSRFCookie(res, token) {
  res.cookie('X-CSRF-Token', token, {
    httpOnly: false,       // Readable by JavaScript (for form submissions)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000, // 1 hour
    path: '/'
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setTokenCookies,
  clearTokenCookies,
  generateCSRFToken,
  verifyCSRFToken,
  setCSRFCookie
};
