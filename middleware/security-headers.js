// ==================== SECURITY HEADERS MIDDLEWARE ====================
// Header di sicurezza per TUTTE le risposte (pagine, statici e API).
// Va registrato prima di express.static e delle route HTML: una route che
// risponde chiude la catena e i middleware successivi non vengono eseguiti.

const helmet = require('helmet');
const { isSecureRequest, shouldEnforceHttps } = require('./https-enforce');

const CDN = 'https://cdnjs.cloudflare.com';

/**
 * Content-Security-Policy.
 * 'unsafe-inline' resta per script e stili perché le pagine usano ancora
 * <script> inline e ~100 attributi onclick: rimuoverlo richiede prima di
 * spostarli in file .js (vedi README, sezione sicurezza).
 */
function buildCsp(req) {
  const host = req.get('host') || '';
  const wsOrigin = host ? `${isSecureRequest(req) ? 'wss' : 'ws'}://${host}` : '';
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${CDN}`,
    `style-src 'self' 'unsafe-inline' ${CDN}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${CDN}${wsOrigin ? ' ' + wsOrigin : ''}`,
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  if (shouldEnforceHttps() && process.env.NODE_ENV === 'production') {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}

const securityHeaders = (app) => {
  app.use(
    helmet({
      contentSecurityPolicy: false, // impostata sotto, per richiesta
      frameguard: { action: 'deny' },
      hsts: false, // gestita sotto, solo su richieste HTTPS reali
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false, // impostata sotto: stretta per le API, aperta per gli asset
      // X-XSS-Protection: 0 (default helmet): il filtro XSS dei browser è deprecato
    })
  );

  app.use((req, res, next) => {
    if (process.env.CSP_ENABLED !== 'false') {
      res.setHeader('Content-Security-Policy', buildCsp(req));
    }

    if (shouldEnforceHttps() && isSecureRequest(req)) {
      const maxAge = parseInt(process.env.HSTS_MAX_AGE || 31536000, 10);
      let hsts = `max-age=${maxAge}`;
      if (process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false') hsts += '; includeSubDomains';
      if (process.env.HSTS_PRELOAD === '1') hsts += '; preload';
      res.setHeader('Strict-Transport-Security', hsts);
    }

    // Le risposte API (dati dell'utente) non devono essere leggibili da altri siti;
    // immagini, CSS e JS pubblici sì (per esempio il logo nelle email).
    res.setHeader(
      'Cross-Origin-Resource-Policy',
      req.path.startsWith('/api/') ? 'same-origin' : 'cross-origin'
    );
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    res.removeHeader('X-Powered-By');
    next();
  });
};

module.exports = securityHeaders;
module.exports.buildCsp = buildCsp;
