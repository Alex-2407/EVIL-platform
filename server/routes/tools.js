'use strict';
// Endpoint degli strumenti (estratto da js/server.js)
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const { assertPublicDestination, isBlockedError, blockedMessage } = require('../lib/safe-http');

module.exports = function registerTools(app, ctx) {
  const {
    db, logger, auditLog,
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

        const user = db.users.find(u => u.id === req.user.id);
        if (user) {
          user.progress.scans = (user.progress.scans || 0) + 1;
          db.save();
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

      const user = db.users.find((u) => u.id === req.user?.id);
      if (user) {
        if (!user.progress) user.progress = { scans: 0, activities: 0, unlockedAchievements: [] };
        user.progress.activities = (user.progress.activities || 0) + 1;
        if (!user.uploadedFiles) user.uploadedFiles = [];
        user.uploadedFiles.push({
          originalName: req.file.originalname,
          uploadedAt: result.timestamp,
          sha256: result.hashes.sha256,
          size: result.size,
          verdict: result.verdict.code
        });
        if (user.uploadedFiles.length > 50) user.uploadedFiles = user.uploadedFiles.slice(-50);
        db.save();
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

  /**
   * File Upload legacy — stesso motore sicuro in RAM (compatibilità UI vecchia)
   */
  app.post(
    '/api/file-upload',
    authenticateTools,
    uploadLimiter,
    scanUpload.single('file'),
    handleScanUploadError,
    handleFileScanRequest
  );

  // ==================== REPORT GENERATOR ====================
  app.post('/api/report-generator', authenticateTools, (req, res) => {
    try {
      const user = db.users.find(u => u.id === req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      const incident = req.body?.incident || null;

      // Crea documento PDF
      const doc = new PDFDocument({ bufferPages: true });
      let buffers = [];
    
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
      
        // Invia il PDF come risposta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
        res.send(pdfBuffer);
      });

      // Intestazione
      doc.fontSize(24).font('Helvetica-Bold').text('EVIL Security Report', { align: 'center' });
      doc.fontSize(10).fillColor('#666666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Informazioni utente
      doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold').text('User Information', { underline: true });
      doc.fontSize(10).fillColor('#000000').font('Helvetica').text(`Username: ${user.nome || 'N/A'}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Account Created: ${new Date(user.createdAt || Date.now()).toLocaleDateString()}`);
      doc.moveDown(1);

      if (incident) {
        doc.fontSize(14).font('Helvetica-Bold').text('Incident Report', { underline: true });
        doc.fontSize(10).font('Helvetica');
        if (incident.title) doc.text(`Title: ${incident.title}`);
        if (incident.target) doc.text(`Target: ${incident.target}`);
        if (incident.severity) doc.text(`Severity: ${incident.severity}`);
        if (incident.summary) doc.text(`Summary: ${incident.summary}`);
        if (incident.findings) doc.text(`Findings: ${incident.findings}`);
        if (incident.author) doc.text(`Author: ${incident.author}`);
        if (incident.systems) doc.text(`Systems: ${incident.systems}`);
        if (incident.usersAffected) doc.text(`Users affected: ${incident.usersAffected}`);
        doc.moveDown(1);
      }

      // Statistiche
      doc.fontSize(14).font('Helvetica-Bold').text('Activity Statistics', { underline: true });
      const activities = user.progress?.activities || 0;
      const scans = user.progress?.scans || 0;
      const files = user.uploadedFiles?.length || 0;
    
      doc.fontSize(10).font('Helvetica').text(`Total Activities: ${activities}`);
      doc.text(`Scans Performed: ${scans}`);
      doc.text(`Files Uploaded: ${files}`);
      doc.moveDown(1);

      // Lista file uploadi
      if (user.uploadedFiles && user.uploadedFiles.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').text('Uploaded Files', { underline: true });
        doc.fontSize(9).font('Helvetica');

        // Calcola larghezzhe colonne
        const pageWidth = doc.page.width - 100;
        const colWidth = pageWidth / 3;

        // Intestazioni tabella
        const y = doc.y;
        doc.text('Filename', 50, y, { width: colWidth });
        doc.text('MD5', 50 + colWidth, y, { width: colWidth });
        doc.text('Upload Date', 50 + 2 * colWidth, y, { width: colWidth });
        doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke();
        doc.moveDown(2);

        // Righe file
        user.uploadedFiles.slice(0, 10).forEach((file, index) => {
          doc.fontSize(8);
          const fileY = doc.y;
          doc.text(file.filename.substring(0, 25), 50, fileY, { width: colWidth });
          doc.text(file.md5.substring(0, 20) + '...', 50 + colWidth, fileY, { width: colWidth });
          doc.text(new Date(file.uploadedAt).toLocaleDateString(), 50 + 2 * colWidth, fileY, { width: colWidth });
          doc.moveDown(1.2);
        });

        if (user.uploadedFiles.length > 10) {
          doc.fontSize(8).fillColor('#999999').text(`... and ${user.uploadedFiles.length - 10} more files`);
        }
        doc.moveDown(1);
      }

      // Achievement summary
      if (user.progress?.unlockedAchievements && user.progress.unlockedAchievements.length > 0) {
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000').text('Unlocked Achievements', { underline: true });
        doc.fontSize(10).font('Helvetica');
      
        user.progress.unlockedAchievements.slice(0, 5).forEach(achievement => {
          doc.text(`✓ ${achievement.name || achievement.id}`);
        });
      
        if (user.progress.unlockedAchievements.length > 5) {
          doc.fontSize(9).fillColor('#999999').text(`... and ${user.progress.unlockedAchievements.length - 5} more achievements`);
        }
        doc.moveDown(1);
      }

      // Footer
      doc.fontSize(8).fillColor('#999999');
      doc.text(`\nThis report contains confidential information about user activity.`, { align: 'center' });
      doc.text(`EVIL Cybersecurity Platform - ${new Date().getFullYear()}`, { align: 'center' });

      doc.end();
    } catch (err) {
      res.status(500).json({ error: 'Errore generazione report: ' + err.message });
    }
  });
};
