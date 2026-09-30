'use strict';
/**
 * Dipendenze condivise dalle route. È asincrono perché l'archivio utenti
 * può essere un database (Postgres) da aprire prima di accettare richieste.
 */
const config = require('./config');
const pages = require('./pages');
const { openUserStore } = require('./lib/user-store');
const { createSessionManager } = require('./lib/sessions');
const { defaultProgress, normalizeProgress, mergeClientProgress, recordScan } = require('./lib/progress');

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
const tokenUtils = require('../utils/token-utils');
const {
  createAuthMiddleware,
  validateRegister,
  validateLogin,
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
} = require('../middleware/auth');
const { sanitizeString, sanitizeUrl } = require('../middleware/sanitization');
const limiters = require('../middleware/limiter');
const emailService = require('../services/email-service');
const incidentsService = require('../services/incidents-service');
const virtualLabService = require('../services/virtual-lab-service');
const { logger, auditLog } = require('../middleware/logger');

/**
 * @param {object} [overrides] sostituzioni per i test (per esempio store o emailService)
 */
async function buildContext(overrides = {}) {
  const db = overrides.db || (await openUserStore({ root: pages.root }));
  const sessions = createSessionManager({
    store: db,
    accessSecret: config.JWT_SECRET,
    refreshSecret: config.JWT_SECRET_REFRESH,
    accessTtl: config.ACCESS_TOKEN_EXPIRY,
    refreshTtl: config.REFRESH_TOKEN_EXPIRY,
  });
  const auth = createAuthMiddleware({ sessions });

  const ctx = {
    ...config,
    db,
    sessions,
    root: pages.root,
    resolveAchievementsFile: pages.resolveAchievementsFile,
    logger,
    auditLog,
    emailService,
    incidentsService,
    virtualLabService,
    ...auth,
    validateRegister,
    validateLogin,
    verifyPassword,
    hashPassword,
    validatePasswordStrength,
    sanitizeString,
    sanitizeUrl,
    ...tokenUtils,
    scanUpload,
    handleScanUploadError,
    defaultProgress,
    normalizeProgress,
    mergeClientProgress,
    recordScan,
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
    ...overrides,
  };

  ctx.incidents = overrides.incidents || require('./routes/incidents')(ctx);
  return ctx;
}

module.exports = { buildContext };
