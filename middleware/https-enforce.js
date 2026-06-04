// ==================== HTTPS ENFORCEMENT ====================
// Redirect HTTP → HTTPS e allinea l'host a BASE_URL (certificato TLS sul dominio canonico).

function shouldEnforceHttps() {
  const off = process.env.FORCE_HTTPS;
  if (off === '0' || off === 'false') return false;
  if (off === '1' || off === 'true') return true;
  if (process.env.NODE_ENV === 'production') return true;
  if (process.env.BASE_URL && /^https:\/\//i.test(process.env.BASE_URL)) return true;
  return false;
}

function getCanonicalOrigin() {
  const raw = (process.env.BASE_URL || process.env.CANONICAL_URL || '').trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withScheme);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
      url.protocol = 'https:';
    }
    return url.origin;
  } catch (_) {
    return null;
  }
}

/**
 * True se la richiesta arriva già su HTTPS (anche dietro reverse proxy).
 */
function isSecureRequest(req) {
  if (req.secure) return true;

  const forwarded = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwarded === 'https') return true;

  if (String(req.headers['x-forwarded-ssl'] || '').toLowerCase() === 'on') return true;

  const cfVisitor = req.headers['cf-visitor'];
  if (cfVisitor && String(cfVisitor).includes('https')) return true;

  return false;
}

function skipHttpsRedirect(req) {
  const p = req.path || '';
  return p === '/health' || p === '/api/health' || p === '/__debug/files';
}

/**
 * Redirect 301 verso origin canonico (HTTPS + host da BASE_URL).
 */
function httpsRedirectMiddleware(req, res, next) {
  if (!shouldEnforceHttps() || skipHttpsRedirect(req)) {
    return next();
  }

  const canonical = getCanonicalOrigin();
  const secure = isSecureRequest(req);
  const host = (req.get('host') || '').toLowerCase();

  let targetOrigin = canonical;
  if (!targetOrigin) {
    if (secure) return next();
    targetOrigin = `https://${req.get('host')}`;
  }

  let targetHost = '';
  try {
    targetHost = new URL(targetOrigin).host.toLowerCase();
  } catch (_) {
    return next();
  }

  const needsHttps = !secure;
  const needsHost = host && targetHost && host !== targetHost;

  if (!needsHttps && !needsHost) {
    return next();
  }

  try {
    const url = new URL(req.originalUrl || req.url || '/', targetOrigin);
    return res.redirect(301, url.toString());
  } catch (_) {
    return res.redirect(301, `${targetOrigin}${req.originalUrl || '/'}`);
  }
}

module.exports = {
  shouldEnforceHttps,
  getCanonicalOrigin,
  isSecureRequest,
  httpsRedirectMiddleware,
};
