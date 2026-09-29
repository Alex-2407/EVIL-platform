'use strict';
// Dipendenze condivise dalle route (estratto da js/server.js)
const config = require('./config');
const db = require('./lib/users-db');
const pages = require('./pages');

const { runUrlScan } = require('../services/tools/url-scanner-service');
const { runHttpHeaderAudit } = require('../services/tools/http-header-audit-service');
const { runDnsEnumeration } = require('../services/tools/dns-enumerator-service');
const { runWhoisLookup } = require('../services/tools/whois-service');
const { runSubdomainFinder } = require('../services/tools/subdomain-finder-service');
const { runSslAnalysis } = require('../services/tools/ssl-analyzer-service');
const { runFileScan } = require('../services/tools/file-scanner-service');
const { runSocialProfiling } = require('../services/tools/social-profiling-service');
const { runPublicInfoPersonSearch, runPublicInfoDomainSearch } = require('../services/tools/public-info-service');
const { runPublicInfoRegistrySearch, runPublicInfoPersonDetail } = require('../services/tools/public-info-registry-service');
const { scanUpload, handleScanUploadError } = require('../middleware/file-scanner-upload');
const { setTokenCookies, clearAuthCookies, getRefreshTokenFromCookie } = require('../utils/token-utils');
const {
  authenticateToken,
  optionalAuthenticate,
  authenticateTools,
  validateRegister,
  validateLogin,
  verifyPassword,
  validatePasswordStrength,
} = require('../middleware/auth');
const { sanitizeString, sanitizeUrl, assertSafePublicUrl } = require('../middleware/sanitization');
const limiters = require('../middleware/limiter');
const tokenManager = require('../services/token-manager');
const emailService = require('../services/email-service');
const incidentsService = require('../services/incidents-service');
const virtualLabService = require('../services/virtual-lab-service');
const { logger, auditLog } = require('../middleware/logger');

const ctx = {
  ...config,
  db,
  root: pages.root,
  resolveAchievementsFile: pages.resolveAchievementsFile,
  logger,
  auditLog,
  emailService,
  tokenManager,
  incidentsService,
  virtualLabService,
  authenticateToken,
  optionalAuthenticate,
  authenticateTools,
  validateRegister,
  validateLogin,
  verifyPassword,
  validatePasswordStrength,
  sanitizeString,
  sanitizeUrl,
  assertSafePublicUrl,
  setTokenCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie,
  scanUpload,
  handleScanUploadError,
  ...limiters,
  tools: {
    runUrlScan,
    runHttpHeaderAudit,
    runDnsEnumeration,
    runWhoisLookup,
    runSubdomainFinder,
    runSslAnalysis,
    runFileScan,
    runSocialProfiling,
    runPublicInfoPersonSearch,
    runPublicInfoDomainSearch,
    runPublicInfoRegistrySearch,
    runPublicInfoPersonDetail,
  },
};

ctx.incidents = require('./routes/incidents')(ctx);

module.exports = ctx;
