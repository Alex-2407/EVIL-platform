// ==================== TOKEN UTILITIES ====================
// Secure token generation and management
// Features: httpOnly cookies, CSRF protection, refresh token rotation

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function parseExpiryMs(expiry) {
  if (typeof expiry === 'string') {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (match) {
      const n = parseInt(match[1], 10);
      const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
      return n * unit;
    }
  }
  return 60 * 60 * 1000;
}

// ==================== TOKEN GENERATION ====================

/**
 * Generate Access Token (15 minutes)
 * Used for API authentication
 */
function generateAccessToken(userId, email) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      id: userId,
      email: email,
      type: 'access'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '1h',
      issuer: 'evil-platform',
      audience: 'api'
    }
  );
}

/**
 * Generate Refresh Token (7 days)
 * Used to obtain new access tokens
 */
function generateRefreshToken(userId, email) {
  if (!process.env.JWT_SECRET_REFRESH) {
    throw new Error('JWT_SECRET_REFRESH not configured');
  }

  return jwt.sign(
    {
      id: userId,
      email: email,
      type: 'refresh'
    },
    process.env.JWT_SECRET_REFRESH,
    {
      expiresIn: '7d',
      issuer: 'evil-platform',
      audience: 'refresh'
    }
  );
}

/**
 * Set both access and refresh tokens in httpOnly cookies
 * CRITICAL: Both cookies are httpOnly, Secure, SameSite:Strict
 * Only accessible to server, not JavaScript
 */
function setTokenCookies(res, userId, email) {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId, email);

  // Access Token Cookie (15 minutes, httpOnly, Secure, SameSite)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,              // NOT accessible to JavaScript
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'strict',          // CSRF protection: only same-site requests
    maxAge: parseExpiryMs(process.env.JWT_ACCESS_EXPIRY || '1h'),
    path: '/',
    domain: undefined            // current domain only
  });

  // Refresh Token Cookie (7 days, httpOnly, Secure, SameSite)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,              // NOT accessible to JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
    domain: undefined
  });

  return { accessToken, refreshToken };
}

/**
 * Extract access token from httpOnly cookie in request
 * Used instead of Authorization header
 */
function getAccessTokenFromCookie(req) {
  return req.cookies?.accessToken || null;
}

/**
 * Extract refresh token from httpOnly cookie in request
 */
function getRefreshTokenFromCookie(req) {
  return req.cookies?.refreshToken || null;
}

/**
 * Clear both authentication cookies
 * Used for logout
 */
function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

// ==================== CSRF TOKEN MANAGEMENT ====================

/**
 * Generate CSRF token for forms
 * Random 32-byte token, hex encoded
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token with timing-safe comparison
 * Prevents timing-based attacks
 */
function verifyCSRFToken(providedToken, sessionToken) {
  if (!providedToken || !sessionToken) {
    return false;
  }
  // Timing-safe comparison: prevents timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(providedToken),
    Buffer.from(sessionToken)
  );
}

// ==================== REFRESH TOKEN ROTATION ====================

/**
 * Rotate tokens: issue new access + refresh token pair
 * Used when access token expires or on sensitive operations
 */
function rotateTokens(res, userId, email) {
  // Clear old tokens
  clearAuthCookies(res);
  // Set new tokens
  return setTokenCookies(res, userId, email);
}

// ==================== MIDDLEWARE ====================

/**
 * Middleware to extract token from httpOnly cookie
 * Attach to req.token for downstream middleware
 */
function extractTokenFromCookie(req, res, next) {
  req.token = getAccessTokenFromCookie(req);
  next();
}

/**
 * Middleware to verify CSRF token from request
 * Used on POST/PUT/DELETE endpoints
 */
function verifyCRSFFromRequest(req, res, next) {
  const csrfTokenFromRequest = req.headers['x-csrf-token'] || req.body?._csrf;
  const csrfTokenFromSession = req.session?.csrfToken;

  if (!csrfTokenFromRequest || !csrfTokenFromSession) {
    return res.status(403).json({
      error: 'CSRF token missing or invalid',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  try {
    if (verifyCSRFToken(csrfTokenFromRequest, csrfTokenFromSession)) {
      next();
    } else {
      res.status(403).json({
        error: 'CSRF token mismatch',
        code: 'CSRF_TOKEN_INVALID'
      });
    }
  } catch (err) {
    res.status(403).json({
      error: 'CSRF verification failed',
      code: 'CSRF_VERIFICATION_FAILED'
    });
  }
}

// ==================== EXPORTS ====================
module.exports = {
  // Token Generation
  generateAccessToken,
  generateRefreshToken,
  setTokenCookies,
  rotateTokens,
  // Token Extraction
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
  clearAuthCookies,
  extractTokenFromCookie,
  // CSRF Management
  generateCSRFToken,
  verifyCSRFToken,
  verifyCRSFFromRequest
};
