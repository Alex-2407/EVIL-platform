// ==================== SECURITY HEADERS MIDDLEWARE ====================
// Implements comprehensive security headers (helmet + custom)

const helmet = require('helmet');

/**
 * Configure security headers with helmet and custom middleware
 */
const securityHeaders = (app) => {
  // ==================== HELMET CORE HEADERS ====================
  
  app.use(helmet({
    // X-Frame-Options: DENY (prevent clickjacking)
    frameguard: {
      action: 'deny'
    },
    
    // X-Content-Type-Options: nosniff (prevent MIME sniffing)
    noSniff: true,
    
    // X-XSS-Protection: 1; mode=block (legacy XSS protection)
    xssFilter: true,
    
    // Referrer-Policy: strict-origin (send referrer only for same-origin HTTPS)
    referrerPolicy: {
      policy: 'strict-origin'
    },
    
    // Permissions-Policy (Feature-Policy)
    permittedCrossDomainPolicies: false,
    
    // Disable X-Powered-By header
    hidePoweredBy: true
  }));

  // ==================== HSTS (HTTP Strict-Transport-Security) ====================
  // Force HTTPS for 1 year
  app.use((req, res, next) => {
    const maxAge = parseInt(process.env.HSTS_MAX_AGE || 31536000);
    const includeSubDomains = process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false';
    
    let hstsHeader = `max-age=${maxAge}`;
    if (includeSubDomains) {
      hstsHeader += '; includeSubDomains';
    }
    if (process.env.NODE_ENV === 'production') {
      hstsHeader += '; preload';
    }
    
    res.setHeader('Strict-Transport-Security', hstsHeader);
    next();
  });

  // ==================== CONTENT SECURITY POLICY (CSP) ====================
  if (process.env.CSP_ENABLED !== 'false') {
    app.use((req, res, next) => {
      const isDev = process.env.NODE_ENV !== 'production';
      
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: https:",
        isDev ? "connect-src 'self' https: http://localhost:5000" : "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ];
      
      res.setHeader('Content-Security-Policy', csp.join('; '));
      next();
    });
  }

  // ==================== CUSTOM SECURITY HEADERS ====================
  
  app.use((req, res, next) => {
    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', process.env.X_CONTENT_TYPE_OPTIONS || 'nosniff');
    
    // X-Frame-Options
    res.setHeader('X-Frame-Options', process.env.FRAME_GUARD || 'DENY');
    
    // X-UA-Compatible
    res.setHeader('X-UA-Compatible', 'IE=edge');
    
    // Disable unnecessary headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // Add security tagging headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Expect-CT (Certificate Transparency)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }
    
    // Additional privacy headers
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  });
};

module.exports = securityHeaders;
