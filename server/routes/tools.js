'use strict';
// Endpoint degli strumenti (estratto da js/server.js)
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const { assertPublicDestination, isBlockedError, blockedMessage } = require('../lib/safe-http');

module.exports = function registerTools(app, ctx) {
  const {
    db, logger, auditLog, recordScan, normalizeProgress,
    authenticateTools, sanitizeUrl,
    scanLimiter, dnsLimiter, uploadLimiter,
    scanUpload, handleScanUploadError,
    tools,
  } = ctx;
  const {
    runUrlScan, runHttpHeaderAudit, runDnsEnumeration, runWhoisLookup, runSubdomainFinder,
    runSslAnalysis, runFileScan, runSocialProfiling, runPublicInfoPersonSearch,
    runPublicInfoDomainSearch, runPublicInfoRegistrySearch, runPublicInfoPersonDetail,
  } = tools;

  // Endpoint principale
  // URL SECURITY CHECK SCAN
  app.post('/api/scan', 
    authenticateTools,
    scanLimiter,
    body('url')
      .trim()
      .notEmpty().withMessage('URL required')
      .isURL().withMessage('Invalid URL format'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        auditLog.security('SCAN_VALIDATION_FAILED', { userId: req.user.id, errors: errors.array() }, 'WARN');
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      next();
    },
    async (req, res) => {
      const { url } = req.body;

      // Sanitize and validate URL
      const sanitizedUrl = sanitizeUrl(url);
      if (!sanitizedUrl) {
        auditLog.security('SCAN_INVALID_URL', { userId: req.user.id, originalUrl: url }, 'WARN');
        return res.status(400).json({
          error: 'Invalid or dangerous URL format',
          status: 'error'
        });
      }

      let fullUrl = sanitizedUrl;
      let domain, hasSSL;

      try {
        const parsed = new URL(fullUrl);
        domain = parsed.hostname;
        hasSSL = parsed.protocol === 'https:';

        // Additional domain validation
        if (!domain || domain.length > 253) {
          throw new Error('Invalid domain length');
        }

        await assertPublicDestination(fullUrl);
      } catch (err) {
        auditLog.security('SCAN_INVALID_DOMAIN', {
          userId: req.user.id,
          url: fullUrl,
          error: err.message
        }, 'WARN');
        return res.status(400).json({
          error: isBlockedError(err) ? blockedMessage(err) : 'Dominio non valido o non risolvibile',
          status: 'error'
        });
      }

      // Set timeout for the entire scan operation
      const scanTimeout = setTimeout(() => {
        logger.warn('Scan timeout', { userId: req.user.id, domain });
        if (!res.headersSent) {
          res.status(408).json({
            error: 'Scan timeout - operation took too long',
            status: 'timeout',
            domain
          });
        }
      }, 45000);

      try {
        const scanResult = await Promise.race([
          runUrlScan(fullUrl, domain, hasSSL),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Scan timeout')), 40000)
          )
        ]);

        scanResult.userId = req.user.id;
        clearTimeout(scanTimeout);

        const user = req.userRecord;
        if (user) {
          recordScan(user, 'scan', { domain, grade: scanResult.grade });
          await db.save(user).catch((err) => logger.warn('Progress save failed', { error: err.message }));
        }

        auditLog.security('SCAN_COMPLETED', { userId: req.user.id, domain, grade: scanResult.grade }, 'INFO');
        res.json(scanResult);

      } catch (err) {
        // Clear timeout
        clearTimeout(scanTimeout);

        logger.error('Scan error', {
          error: err.message,
          userId: req.user.id,
          domain,
          stack: err.stack
        });

        // Determine appropriate error response based on error type
        let statusCode = 500;
        let errorMessage = 'Scan failed due to internal error';

        if (isBlockedError(err)) {
          statusCode = 400;
          errorMessage = blockedMessage(err);
        } else if (err.message.includes('timeout')) {
          statusCode = 408;
          errorMessage = 'Scan timeout - please try again';
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
          statusCode = 400;
          errorMessage = 'Domain not found or unreachable';
        } else if (err.message.includes('ECONNREFUSED')) {
          statusCode = 400;
          errorMessage = 'Connection refused by target';
        }

        if (!res.headersSent) {
          res.status(statusCode).json({
            domain,
            url: fullUrl,
            error: errorMessage,
            status: 'error',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  );

  // ========================
  // ENDPOINT DNS ENUMERATOR
  // ========================
  app.post('/api/dns-enum', authenticateTools, dnsLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain required' });

    try {
      const result = await runDnsEnumeration(domain);
      res.json(result);
    } catch (err) {
      const status = /non valido/i.test(err.message) ? 400 : 500;
      res.status(status).json({ error: err.message, status: 'error', domain });
    }
  });

  // ========================
  // ENDPOINT WHOIS LOOKUP
  // ========================
  app.post('/api/whois', authenticateTools, dnsLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain required' });

    try {
      const result = await runWhoisLookup(domain);
      if (result.status === 'failed') {
        return res.status(502).json(result);
      }
      res.json(result);
    } catch (err) {
      const status = /non valido/i.test(err.message) ? 400 : 500;
      res.status(status).json({ error: err.message, status: 'error' });
    }
  });

  // ========================
  // ENDPOINT SUBDOMAIN FINDER
  // ========================
  app.post('/api/subdomain-finder', authenticateTools, dnsLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain required' });

    try {
      const result = await runSubdomainFinder(domain);
      res.json(result);
    } catch (err) {
      const status = /non valido/i.test(err.message) ? 400 : 500;
      res.status(status).json({ error: err.message, status: 'error' });
    }
  });

  // ========================
  // ENDPOINT SSL CERTIFICATE ANALYZER
  // ========================
  app.post('/api/ssl-analyzer', authenticateTools, scanLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'Domain required' });

    try {
      const result = await runSslAnalysis(domain);
      if (result.status === 'failed') {
        return res.status(502).json(result);
      }
      res.json(result);
    } catch (err) {
      const status = isBlockedError(err) || /non valido/i.test(err.message) ? 400 : 500;
      res.status(status).json({ error: isBlockedError(err) ? blockedMessage(err) : err.message, status: 'error' });
    }
  });

  // ========================
  // ENDPOINT HTTP HEADER AUDIT (ex vulnerability-scan)
  // ========================
  app.post('/api/vulnerability-scan', authenticateTools, scanLimiter, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
      const result = await Promise.race([
        runHttpHeaderAudit(url),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Audit timeout')), 20000)
        )
      ]);
      res.json(result);
    } catch (err) {
      if (isBlockedError(err)) {
        return res.status(400).json({ error: blockedMessage(err), status: 'error' });
      }
      const status = err.message.includes('timeout') ? 408 : err.message.includes('Invalid URL') ? 400 : 500;
      res.status(status).json({ error: err.message, status: 'error' });
    }
  });


  // ========================
  // ENDPOINT SOCIAL PROFILING
  // ========================
  app.post('/api/social-profile', authenticateTools, scanLimiter, async (req, res) => {
    const { username, email } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username required', status: 'error' });
    }
    try {
      const result = await runSocialProfiling({ username, email });
      res.json(result);
    } catch (err) {
      const code = /non valido/i.test(err.message) ? 400 : 500;
      res.status(code).json({ error: err.message, status: 'error' });
    }
  });

  // ========================
  // ENDPOINT PUBLIC INFO GATHERING
  // ========================
  app.post('/api/osint-search', authenticateTools, scanLimiter, async (req, res) => {
    req.setTimeout(120000);
    res.setTimeout(120000);
    try {
      if (req.body.mode === 'person_detail' && req.body.wikidataId) {
        const result = await runPublicInfoPersonDetail(req.body.wikidataId);
        return res.json(result);
      }
      if (req.body.mode === 'registry' || (req.body.country && !req.body.firstName)) {
        const result = await runPublicInfoRegistrySearch({ ...req.body, mode: 'registry' });
        return res.json(result);
      }
      if (req.body.firstName && req.body.lastName) {
        const result = await runPublicInfoPersonSearch(req.body);
        return res.json(result);
      }
      const { target, type } = req.body;
      if (type === 'domain' && target) {
        const result = await runPublicInfoDomainSearch(target);
        return res.json(result);
      }
      return res.status(400).json({
        error: 'Fornire country (elenco territoriale), firstName+lastName (dossier) o target+type=domain',
        status: 'error'
      });
    } catch (err) {
      const code = /obblig/i.test(err.message) ? 400 : 500;
      res.status(code).json({ error: err.message, status: 'error' });
    }
  });


  // ========================
  // FILE UPLOAD
  // ========================

  /**
   * Static File Scanner — analisi in RAM, nessun salvataggio su disco
   */
  async function handleFileScanRequest(req, res) {
    const started = Date.now();
    try {
      if (!req.file?.buffer?.length) {
        return res.status(400).json({ error: 'File non fornito o vuoto' });
      }

      const result = runFileScan(req.file);
      result.scanDurationMs = Date.now() - started;
      result.timestamp = new Date().toISOString();

      const user = req.userRecord;
      if (user) {
        recordScan(user, 'file_scan', { verdict: result.verdict?.code });
        user.uploadedFiles = [
          ...(user.uploadedFiles || []),
          {
            originalName: String(req.file.originalname || '').slice(0, 120),
            uploadedAt: result.timestamp,
            sha256: result.hashes.sha256,
            size: result.size,
            verdict: result.verdict?.code,
          },
        ].slice(-50);
        await db.save(user).catch((err) => logger.warn('Progress save failed', { error: err.message }));
      }

      auditLog.fileUpload(
        req.user?.id || 'guest',
        `scan:${result.hashes.sha256.slice(0, 12)}`,
        result.size,
        result.fileType?.detected || 'unknown',
        req.ip
      );

      res.json({
        status: 'success',
        result,
        scanDurationMs: result.scanDurationMs,
        message: 'Scansione statica completata (file non persistito)'
      });
    } catch (err) {
      logger.error('File scan error', { error: err.message, userId: req.user?.id });
      res.status(500).json({ error: err.message || 'Errore scansione file', status: 'error' });
    }
  }

  app.post(
    '/api/file-scan',
    authenticateTools,
    uploadLimiter,
    scanUpload.single('file'),
    handleScanUploadError,
    handleFileScanRequest
  );


  // ==================== REPORT GENERATOR ====================
  const REPORT_FIELDS = {
    title: 'Titolo',
    target: 'Organizzazione',
    severity: 'Severità',
    author: 'Autore',
    summary: 'Descrizione',
    findings: 'Impatto',
    systems: 'Sistemi coinvolti',
    usersAffected: 'Utenti coinvolti',
    recommendations: 'Raccomandazioni',
  };

  function cleanText(value, max = 4000) {
    if (value == null) return '';
    return String(value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
  }

  app.post('/api/report-generator', authenticateTools, (req, res) => {
    const user = req.userRecord || null;
    const raw = req.body?.incident && typeof req.body.incident === 'object' ? req.body.incident : {};
    const incident = {};
    for (const key of Object.keys(REPORT_FIELDS)) {
      incident[key] = cleanText(raw[key], key === 'title' || key === 'author' || key === 'target' ? 200 : 4000);
    }

    try {
      const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: incident.title || 'Report EVIL', Author: incident.author || 'EVIL Platform' } });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('error', (err) => {
        logger.error('PDF error', { error: err.message });
        if (!res.headersSent) res.status(500).json({ error: 'Errore nella generazione del PDF.' });
      });
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="report-evil.pdf"');
        res.send(Buffer.concat(chunks));
      });

      const now = new Date();
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111').text(incident.title || 'Report di sicurezza');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#555555')
        .text(`Generato il ${now.toLocaleDateString('it-IT')} alle ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} con EVIL Platform`);
      doc.moveDown(1);

      const meta = [
        ['Organizzazione', incident.target],
        ['Severità', incident.severity],
        ['Autore', incident.author || user?.name],
      ].filter(([, v]) => v);
      for (const [label, value] of meta) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(value);
      }
      if (meta.length) doc.moveDown(1);

      for (const key of ['summary', 'findings', 'systems', 'usersAffected', 'recommendations']) {
        if (!incident[key]) continue;
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(REPORT_FIELDS[key]);
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10.5).fillColor('#222222').text(incident[key], { align: 'left' });
        doc.moveDown(0.9);
      }

      if (user) {
        const p = normalizeProgress(user.progress);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text('Attività su EVIL');
        doc.font('Helvetica').fontSize(10).fillColor('#333333')
          .text(`Scansioni completate: ${p.totalScans} · Attività: ${p.totalActivities} · Trofei sbloccati: ${p.unlockedAchievements.length}`);
      }

      doc.moveDown(2);
      doc.font('Helvetica').fontSize(8).fillColor('#777777')
        .text('Documento generato a scopo didattico e professionale. Verificare i contenuti prima della diffusione.', { align: 'center' });
      doc.end();
    } catch (err) {
      logger.error('Report generator error', { error: err.message });
      if (!res.headersSent) res.status(500).json({ error: 'Errore nella generazione del PDF.' });
    }
  });
};
