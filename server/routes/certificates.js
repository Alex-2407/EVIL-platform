'use strict';
/**
 * Rotte dei diplomi verificabili.
 * Verifica pubblica senza login; elenco e PDF solo per il titolare.
 * L'emissione non ha rotta pubblica: si chiama issueCertificate dal codice dei corsi.
 */
const certs = require('../lib/certificates');
const { buildCertificatePdf, pdfToBuffer } = require('../lib/certificate-pdf');
const { resolvePublicBaseUrl } = require('../../utils/resolve-base-url');
const { isProduction } = require('../../utils/env');

const t = (s) => s;

function originOf(req) {
  const configured = resolvePublicBaseUrl();
  if (configured) return configured.replace(/\/$/, '');
  if (isProduction()) throw new Error('BASE_URL or RENDER_EXTERNAL_URL is required for certificate links');
  const host = req.get('host') || 'localhost:5000';
  const proto = req.protocol || 'http';
  return `${proto}://${host}`.replace(/\/$/, '');
}

function verifyUrl(req, code) {
  return `${originOf(req)}/verify.html?c=${encodeURIComponent(code)}`;
}

function notFound(req, res) {
  return res.status(404).json({ error: req.t(t('Diploma non trovato.')), code: 'NOT_FOUND' });
}

function parseCode(param) {
  const code = String(param || '').trim().toUpperCase();
  return certs.CODE_RE.test(code) ? code : null;
}

async function publicPayload(req, certificate) {
  const check = certs.verifyRecord(certificate);
  const fp = certs.fingerprint(certificate.signature);
  fp.microtext = certs.microtextFor(certificate.name, certificate.code);
  const qr = await certs.qrSvg(verifyUrl(req, certificate.code));
  return {
    valid: check.valid,
    certificate: certs.publicCertificate(certificate, req.lang),
    signature: certificate.signature,
    keyId: certificate.keyId,
    signedText: check.signedText,
    fingerprint: fp,
    qrSvg: qr,
  };
}

function registerCertificates(app, ctx) {
  const { db, logger, authenticateToken, certificateVerifyLimiter } = ctx;

  app.get('/api/certificates/public-key', certificateVerifyLimiter, (req, res) => {
    const info = certs.publicKeyInfo({ logger });
    if (!info) {
      return res.status(503).json({
        error: req.t(t('La verifica indipendente non è disponibile: manca la chiave di firma sul server.')),
        code: 'CERT_UNAVAILABLE',
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json(info);
  });

  app.get('/api/certificates/mine', authenticateToken, (req, res) => {
    const list = (req.userRecord.certificates || []).map((c) => certs.publicCertificate(c, req.lang));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ certificates: list });
  });

  app.get('/api/certificates/:code/pdf', authenticateToken, async (req, res, next) => {
    const code = parseCode(req.params.code);
    if (!code) return notFound(req, res);
    const found = certs.findByCode(db, code);
    if (!found || found.user.id !== req.userRecord.id) return notFound(req, res);
    if (!certs.verifyRecord(found.certificate).valid) return notFound(req, res);
    try {
      const doc = buildCertificatePdf({
        certificate: found.certificate,
        verifyUrl: verifyUrl(req, found.certificate.code),
        lang: req.lang,
      });
      const buf = await pdfToBuffer(doc);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="diploma-${found.certificate.code}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(buf);
    } catch (err) {
      logger.error('PDF diploma', { error: err.message, code });
      return next(err);
    }
  });

  app.get('/api/certificates/:code', certificateVerifyLimiter, async (req, res, next) => {
    const code = parseCode(req.params.code);
    if (!code) return notFound(req, res);
    const found = certs.findByCode(db, code);
    if (!found) return notFound(req, res);
    try {
      const body = await publicPayload(req, found.certificate);
      res.setHeader('Cache-Control', 'no-store');
      return res.json(body);
    } catch (err) {
      logger.error('Verifica diploma', { error: err.message, code });
      return next(err);
    }
  });
}

module.exports = { registerCertificates };
