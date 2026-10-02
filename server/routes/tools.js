'use strict';
// Endpoint degli strumenti (estratto da js/server.js)
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const { assertPublicDestination, isBlockedError, blockedMessage } = require('../lib/safe-http');
const { toolError } = require('../lib/tool-errors');
const { localizeToolMessage } = require('../../services/tools/tool-i18n');

// S-13: il dettaglio tecnico di un errore (messaggio della libreria di rete) solo fuori produzione
const EXPOSE_ERROR_DETAIL = process.env.NODE_ENV !== 'production';

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
    runSslAnalysis, runFileScan, runSocialProfiling,
    runPublicInfoDomainSearch, runPublicInfoPersonDetail,
  } = tools;

  /** Risposta d'errore uniforme: messaggio per l'utente, dettaglio tecnico solo nei log. */
  // Errori di input già scritti (e tradotti) dai servizi (ToolInputError) passano così come sono;
  // gli altri diventano un messaggio comprensibile nella lingua della richiesta.
  function sendToolError(res, err, tool, extra = {}) {
    const lang = res.req && res.req.lang;
    if (err && err.userFacing) {
      logger.warn(`${tool}: ${err.message}`);
      if (!res.headersSent) res.status(err.status || 400).json({ error: err.message, status: 'error', ...extra });
      return;
    }
    const { status, error, internal } = toolError(err);
    if (internal) logger.error(`${tool}: errore`, { error: err.message, stack: err.stack });
    else logger.warn(`${tool}: ${err.message}`);
    if (!res.headersSent) res.status(status).json({ error: localizeToolMessage(lang, error), status: 'error', ...extra });
  }

  /** Risultato "failed" di WHOIS e TLS: messaggio per l'utente, dettaglio tecnico solo fuori produzione. */
  function sendFailedResult(req, res, result, tool, fallback) {
    const cause = result.cause || Object.assign(new Error(String(result.error || '')), { code: result.code || undefined });
    const mapped = toolError(cause);
    logger.warn(`${tool}: ${result.error}`, { domain: result.domain });
    const body = { ...result, error: mapped.internal ? fallback : localizeToolMessage(req.lang, mapped.error) };
    delete body.cause;
    delete body.code;
    if (EXPOSE_ERROR_DETAIL) body.detail = String(result.error || '');
    else delete body.detail;
    return res.status(502).json(body);
  }

  // Endpoint principale
  // URL SECURITY CHECK SCAN
  app.post('/api/scan', 
    authenticateTools,
    scanLimiter,
    body('url')
      .trim()
      .notEmpty().withMessage((value, { req }) => req.t('Inserisci un URL.'))
      .isURL().withMessage((value, { req }) => req.t('URL non valido: scrivilo per intero, per esempio https://esempio.it')),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        auditLog.security('SCAN_VALIDATION_FAILED', { userId: req.user.id, errors: errors.array() }, 'WARN');
        return res.status(400).json({ error: errors.array()[0]?.msg || req.t('URL non valido.'), status: 'error' });
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
          error: req.t('URL non valido o non consentito.'),
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
          throw new Error('Dominio non valido (troppo lungo).');
        }

        await assertPublicDestination(fullUrl);
      } catch (err) {
        auditLog.security('SCAN_INVALID_DOMAIN', {
          userId: req.user.id,
          url: fullUrl,
          error: err.message
        }, 'WARN');
        return res.status(400).json({
          error: isBlockedError(err) ? localizeToolMessage(req.lang, blockedMessage(err)) : req.t('Dominio non valido o inesistente.'),
          status: 'error'
        });
      }

      // Set timeout for the entire scan operation
      const scanTimeout = setTimeout(() => {
        logger.warn('Scan timeout', { userId: req.user.id, domain });
        if (!res.headersSent) {
          res.status(504).json({
            error: req.t('La scansione ha impiegato troppo tempo. Riprova tra poco.'),
            status: 'timeout',
            domain
          });
        }
      }, 45000);

      try {
        const scanResult = await Promise.race([
          runUrlScan(fullUrl, domain, hasSSL, req.lang),
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

        const { status: statusCode, error: errorMessage } = toolError(err);

        if (!res.headersSent) {
          res.status(statusCode).json({
            domain,
            url: fullUrl,
            error: localizeToolMessage(req.lang, errorMessage),
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
    if (!domain) return res.status(400).json({ error: req.t('Inserisci un dominio, per esempio esempio.it'), status: 'error' });

    try {
      const result = await runDnsEnumeration(domain, req.lang);
      res.json(result);
    } catch (err) {
      sendToolError(res, err, 'DNS', { domain });
    }
  });

  // ========================
  // ENDPOINT WHOIS LOOKUP
  // ========================
  app.post('/api/whois', authenticateTools, dnsLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: req.t('Inserisci un dominio, per esempio esempio.it'), status: 'error' });

    try {
      const result = await runWhoisLookup(domain, req.lang);
      if (result.status === 'failed') {
        // il messaggio del servizio è già per l'utente; la causa tecnica resta nei log
        const body = { ...result };
        delete body.cause;
        if (EXPOSE_ERROR_DETAIL && result.cause) body.detail = String(result.cause.message || result.cause);
        logger.warn(`WHOIS: ${result.cause ? result.cause.message : result.error}`, { domain: result.domain });
        return res.status(502).json(body);
      }
      res.json(result);
    } catch (err) {
      sendToolError(res, err, 'WHOIS');
    }
  });

  // ========================
  // ENDPOINT SUBDOMAIN FINDER
  // ========================
  app.post('/api/subdomain-finder', authenticateTools, dnsLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: req.t('Inserisci un dominio, per esempio esempio.it'), status: 'error' });

    try {
      const result = await runSubdomainFinder(domain, req.lang);
      res.json(result);
    } catch (err) {
      sendToolError(res, err, 'Sottodomini');
    }
  });

  // ========================
  // ENDPOINT SSL CERTIFICATE ANALYZER
  // ========================
  app.post('/api/ssl-analyzer', authenticateTools, scanLimiter, async (req, res) => {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: req.t('Inserisci un dominio, per esempio esempio.it'), status: 'error' });

    try {
      const result = await runSslAnalysis(domain, req.lang);
      if (result.status === 'failed') {
        return sendFailedResult(req, res, result, 'TLS', req.t('Connessione sicura (TLS) non riuscita con questo dominio.'));
      }
      res.json(result);
    } catch (err) {
      sendToolError(res, err, 'TLS');
    }
  });

  // ========================
  // ENDPOINT HTTP HEADER AUDIT (ex vulnerability-scan)
  // ========================
  app.post('/api/vulnerability-scan', authenticateTools, scanLimiter, async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: req.t('Inserisci un URL.'), status: 'error' });

    try {
      const result = await Promise.race([
        runHttpHeaderAudit(url, req.lang),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Audit timeout')), 20000)
        )
      ]);
      res.json(result);
    } catch (err) {
      sendToolError(res, err, 'Audit header HTTP');
    }
  });


  // ========================
  // ENDPOINT SOCIAL PROFILING
  // ========================
  // Messaggi già scritti per l'utente dai servizi OSINT (err.expose): si restituiscono così come sono
  function sendOsintError(res, err, tool) {
    if (err && err.expose) return res.status(err.status || 400).json({ error: err.message, status: 'error' });
    return sendToolError(res, err, tool);
  }

  app.post('/api/social-profile', authenticateTools, scanLimiter, async (req, res) => {
    const { username, checkOwnEmail, email } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: req.t('Inserisci uno username.'), status: 'error' });
    }
    // Data breach (HIBP): solo l'email dell'account, mai quella di terzi
    const ownEmail = req.user && req.user.id !== 'guest' ? req.user.email : null;
    if (email && (!ownEmail || String(email).trim().toLowerCase() !== String(ownEmail).toLowerCase())) {
      return res.status(403).json({
        error: req.t('Il controllo dei data breach è disponibile solo per l\'email del tuo account EVIL.'),
        status: 'error'
      });
    }
    try {
      const result = await runSocialProfiling(
        { username, email: checkOwnEmail || email ? ownEmail : null },
        { lang: req.lang }
      );
      res.json(result);
    } catch (err) {
      sendOsintError(res, err, 'Social profiling');
    }
  });

  // ========================
  // ENDPOINT PUBLIC INFO GATHERING
  // ========================
  // Ricerche su persone solo per figure pubbliche (voce su Wikipedia). Gli elenchi di persone per
  // comune di nascita e i dossier per nome/cognome/azienda/alias sono profilazione di terzi
  // (GDPR art. 6 e 14) e non sono più disponibili.
  const { runPublicFigureSearch } = require('../../services/tools/public-info-registry-service');

  app.post('/api/osint-search', authenticateTools, scanLimiter, async (req, res) => {
    req.setTimeout(120000);
    res.setTimeout(120000);
    const body = req.body || {};
    try {
      if (body.mode === 'person_detail' && body.wikidataId) {
        return res.json(await runPublicInfoPersonDetail(body.wikidataId, { lang: req.lang }));
      }
      if (body.mode === 'public_figure') {
        return res.json(await runPublicFigureSearch({ name: body.name }, { lang: req.lang }));
      }
      if (body.mode === 'registry' || body.country || body.firstName || body.lastName) {
        return res.status(410).json({
          error: req.t('Le ricerche su persone per luogo, nome, azienda o alias non sono più disponibili: profilano persone senza una base giuridica. Puoi cercare solo figure pubbliche o valutare la tua esposizione online.'),
          status: 'error'
        });
      }
      const { target, type } = body;
      if (type === 'domain' && target) {
        const result = await runPublicInfoDomainSearch(target);
        return res.json(result);
      }
      return res.status(400).json({
        error: req.t('Scrivi il nome di una figura pubblica.'),
        status: 'error'
      });
    } catch (err) {
      sendOsintError(res, err, 'OSINT');
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
        return res.status(400).json({ error: req.t('Nessun file ricevuto, oppure il file è vuoto.'), status: 'error' });
      }

      const result = runFileScan(req.file, req.lang);
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
        message: req.t('Analisi statica completata: il file è stato scartato dalla memoria del server.')
      });
    } catch (err) {
      sendToolError(res, err, 'Analisi file');
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
  // Struttura del report: sintesi, perimetro e autorizzazione, timeline, evidenze e IoC,
  // impatto, raccomandazioni. Le etichette sono tradotte con req.t() al momento della stampa.
  const REPORT_SECTIONS = [
    ['summary', 'Sintesi'],
    ['scope', 'Perimetro e autorizzazione'],
    ['timeline', 'Timeline'],
    ['evidence', 'Evidenze e indicatori di compromissione (IoC)'],
    ['findings', 'Impatto'],
    ['systems', 'Sistemi coinvolti'],
    ['usersAffected', 'Utenti coinvolti'],
    ['recommendations', 'Raccomandazioni'],
  ];
  const REPORT_SHORT_FIELDS = new Set(['title', 'target', 'author', 'date', 'severity', 'incidentTypes']);
  const REPORT_FIELDS = ['title', 'target', 'severity', 'author', 'date', 'incidentTypes', ...REPORT_SECTIONS.map(([k]) => k)];
  const SEVERITY_LABELS = { critical: 'Critica', high: 'Alta', medium: 'Media', low: 'Bassa' };

  function cleanText(value, max = 4000) {
    if (value == null) return '';
    return String(value)
      // eslint-disable-next-line no-control-regex -- i caratteri di controllo vanno proprio tolti
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max);
  }

  app.post('/api/report-generator', authenticateTools, (req, res) => {
    const user = req.userRecord || null;
    const locale = req.lang === 'en' ? 'en-GB' : 'it-IT';
    const raw = req.body?.incident && typeof req.body.incident === 'object' ? req.body.incident : {};
    const incident = {};
    for (const key of REPORT_FIELDS) {
      incident[key] = cleanText(raw[key], REPORT_SHORT_FIELDS.has(key) ? 200 : 4000);
    }
    if (SEVERITY_LABELS[incident.severity]) incident.severity = req.t(SEVERITY_LABELS[incident.severity]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(incident.date)) {
      const d = new Date(`${incident.date}T12:00:00Z`);
      if (!Number.isNaN(d.getTime())) incident.date = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    }

    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 56,
        info: { Title: incident.title || req.t('Report di sicurezza'), Author: incident.author || 'EVIL' },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('error', (err) => {
        logger.error('PDF error', { error: err.message });
        if (!res.headersSent) res.status(500).json({ error: req.t('Errore nella generazione del PDF.') });
      });
      doc.on('end', () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="report-evil.pdf"');
        res.send(Buffer.concat(chunks));
      });

      const now = new Date();
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111').text(incident.title || req.t('Report di sicurezza'));
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(10).fillColor('#555555')
        .text(req.t('Generato il {date} alle {time} con EVIL', {
          date: now.toLocaleDateString(locale),
          time: now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        }));
      doc.moveDown(1);

      const meta = [
        [req.t('Organizzazione'), incident.target],
        [req.t('Data dell\'incidente'), incident.date],
        [req.t('Severità'), incident.severity],
        [req.t('Tipo di incidente'), incident.incidentTypes],
        [req.t('Autore'), incident.author || user?.name],
      ].filter(([, v]) => v);
      for (const [label, value] of meta) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(value);
      }
      if (meta.length) doc.moveDown(1);

      REPORT_SECTIONS.forEach(([key, label], i) => {
        if (!incident[key]) return;
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(`${i + 1}. ${req.t(label)}`);
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(10.5).fillColor('#222222').text(incident[key], { align: 'left' });
        doc.moveDown(0.9);
      });

      if (user) {
        const p = normalizeProgress(user.progress);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text(req.t('Attività su EVIL'));
        doc.font('Helvetica').fontSize(10).fillColor('#333333')
          .text(req.t('Scansioni completate: {scans} · Attività: {activities} · Trofei sbloccati: {trophies}', {
            scans: p.totalScans,
            activities: p.totalActivities,
            trophies: p.unlockedAchievements.length,
          }));
      }

      doc.moveDown(2);
      doc.font('Helvetica').fontSize(8).fillColor('#777777')
        .text(req.t('Documento generato con EVIL a scopo didattico e professionale. Verificane i contenuti e la classificazione prima di diffonderlo.'), { align: 'center' });
      doc.end();
    } catch (err) {
      logger.error('Report generator error', { error: err.message });
      if (!res.headersSent) res.status(500).json({ error: req.t('Errore nella generazione del PDF.') });
    }
  });
};
