/**
 * Email Service — verifica account, reset password, modulo di supporto.
 *
 * Tutti gli invii passano da deliver():
 * - API HTTPS di Mailtrap se configurata (Render free blocca le porte SMTP)
 * - altrimenti SMTP (Mailtrap Sandbox/Live, Gmail, ...)
 * - solo con NODE_ENV=development, se l'invio non è possibile il messaggio viene
 *   salvato come file HTML in EMAIL_OUTBOX_DIR (mai in produzione)
 *
 * Lingua: ogni email per l'utente è in italiano o in inglese (parametro `lang`, di solito
 * user.lang salvato alla registrazione). Le traduzioni sono in
 * i18n/en/server/services__email-service.json. L'email allo staff resta in italiano.
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const { logger } = require('../middleware/logger');
const { isDevelopment, isTest } = require('../utils/env');
const { maskEmail } = require('../utils/mask');
const { t, normalizeLang, DEFAULT_LANG } = require('../server/i18n');

const MAILTRAP_SEND_API = 'https://send.api.mailtrap.io/api/send';

const SMTP_PLACEHOLDERS = new Set([
  '',
  'your_mailtrap_username',
  'your_mailtrap_password',
  'your_username',
  'your_password',
  'changeme',
  'incolla_username_da_mailtrap_sandboxes',
  'incolla_password_da_mailtrap_sandboxes'
]);

/** Lingua delle email: quella dell'account o della richiesta, italiano se sconosciuta. */
function mailLang(lang) {
  return normalizeLang(lang) || DEFAULT_LANG;
}

/** Prefisso delle pagine nella lingua (/en/...); l'italiano resta alla radice. */
function langPrefix(lang) {
  const l = mailLang(lang);
  return l === DEFAULT_LANG ? '' : `/${l}`;
}

/** Oggetto e intestazioni su una sola riga. */
function oneLine(value, max = 200) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

class EmailService {
  constructor() {
    this.smtpHost = (process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io').trim();
    this.smtpPort = parseInt(process.env.SMTP_PORT || 587, 10);
    this.smtpSecure = process.env.SMTP_SECURE === 'true';
    this.smtpUser = (process.env.SMTP_USER || '').trim();
    this.smtpPass = (process.env.SMTP_PASS || '').trim();
    this.smtpMode = (process.env.SMTP_MODE || 'auto').toLowerCase();
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@evil-platform.com';
    this.baseUrl = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
    const dataRoot = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.join(process.cwd(), 'data');
    this.outboxDir = path.resolve(
      process.env.EMAIL_OUTBOX_DIR || path.join(dataRoot, 'email-outbox')
    );

    this.smtpSendTimeoutMs = parseInt(process.env.SMTP_SEND_TIMEOUT_MS || '15000', 10);
    this.registerSmtpTimeoutMs = parseInt(
      process.env.REGISTER_SMTP_TIMEOUT_MS || '25000',
      10
    );

    this.applyProviderDefaults();
    this.smtpAuth = this.resolveSmtpAuth();

    if (this.isConfigured()) {
      this.transporter = this.createSmtpTransporter(this.smtpSendTimeoutMs);
    } else {
      this.transporter = null;
    }
  }

  isPlaceholder(value) {
    return SMTP_PLACEHOLDERS.has(String(value || '').trim());
  }

  withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms);
      })
    ]);
  }

  isConfigured() {
    if (this.useMailtrapApi() && this.getMailtrapApiToken()) {
      return Boolean(this.fromEmail && !this.isPlaceholder(this.fromEmail));
    }
    return Boolean(
      this.smtpUser &&
      this.smtpPass &&
      !this.isPlaceholder(this.smtpUser) &&
      !this.isPlaceholder(this.smtpPass)
    );
  }

  onRenderHosting() {
    return Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID);
  }

  getMailtrapApiToken() {
    const explicit = (process.env.MAILTRAP_API_TOKEN || '').trim();
    if (explicit && !this.isPlaceholder(explicit)) return explicit;
    const pass = String(this.smtpPass || '');
    if (/^[a-f0-9]{20,}$/i.test(pass)) return pass;
    return '';
  }

  /** Render free tier blocca porte SMTP 587/465 — usa API HTTPS (porta 443). */
  useMailtrapApi() {
    if (process.env.EMAIL_USE_MAILTRAP_API === '0') return false;
    if (process.env.EMAIL_USE_MAILTRAP_API === '1') return true;
    const transport = (process.env.EMAIL_TRANSPORT || '').toLowerCase();
    if (transport === 'mailtrap_api' || transport === 'api') return true;
    if (transport === 'smtp') return false;
    if (this.onRenderHosting() && this.getMailtrapApiToken()) return true;
    return false;
  }

  getEmailTransport() {
    return this.useMailtrapApi() ? 'mailtrap_api' : 'smtp';
  }

  async sendViaMailtrapApi({ to, subject, text, html, replyTo = null, category = 'Account', lang = DEFAULT_LANG }) {
    const token = this.getMailtrapApiToken();
    if (!token) {
      return { success: false, error: 'MAILTRAP_API_TOKEN mancante (token Sending Mailtrap).' };
    }

    const fromEmail = this.fromEmail;
    const payload = {
      from: { email: fromEmail, name: 'EVIL Platform' },
      to: [{ email: to }],
      subject: oneLine(subject),
      text,
      html,
      category,
    };
    if (replyTo) payload.headers = { 'Reply-To': oneLine(replyTo, 254) };

    try {
      const res = await axios.post(
        process.env.MAILTRAP_API_URL || MAILTRAP_SEND_API,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: parseInt(process.env.MAILTRAP_API_TIMEOUT_MS || '20000', 10),
          validateStatus: (s) => s >= 200 && s < 300,
        }
      );
      logger.info('Email inviata via Mailtrap API', {
        recipient: maskEmail(to),
        category,
        status: res.status,
      });
      return {
        success: true,
        delivery: 'mailtrap_api',
        messageId: res.data?.message_ids?.[0] || res.data?.message_id || null,
        hint: this.getDeliveryHint('mailtrap_api', lang),
      };
    } catch (err) {
      const detail =
        err.response?.data?.errors?.[0] ||
        err.response?.data?.message ||
        err.message;
      logger.error('Errore Mailtrap API', {
        error: detail,
        status: err.response?.status,
        recipient: maskEmail(to),
        category,
      });
      return {
        success: false,
        error: typeof detail === 'string' ? detail : JSON.stringify(detail),
      };
    }
  }

  /**
   * Unico punto di invio. Restituisce sempre { success, delivery, hint, ... } senza lanciare.
   * @param {object} opts
   * @param {string} opts.to destinatario
   * @param {{subject,text,html,attachments?}} opts.mail messaggio già costruito
   * @param {string} [opts.replyTo] indirizzo per le risposte (modulo di supporto)
   * @param {string} [opts.category] categoria Mailtrap (Account, Support, ...)
   * @param {string} [opts.label] descrizione per log ed errori
   * @param {number} [opts.timeoutMs] timeout SMTP (default SMTP_SEND_TIMEOUT_MS)
   * @param {object} [opts.outbox] anteprima da salvare in sviluppo:
   *   { actionLink, buildMail: () => mail con logo incorporato, titleLabel, buttonLabel }
   */
  async deliver({ to, mail, replyTo = null, category = 'Account', label = 'Invio email', timeoutMs, outbox = null, lang = DEFAULT_LANG }) {
    const saveToOutbox = (reason) => {
      if (!this.outboxAllowed()) return null;
      const result = this.writeOutboxPreview({
        lang,
        email: to,
        actionLink: outbox?.actionLink || '#',
        mail: outbox?.buildMail ? outbox.buildMail() : mail,
        titleLabel: outbox?.titleLabel || label,
        buttonLabel: outbox?.buttonLabel || 'Anteprima',
      });
      if (result.success && reason) result.sendError = reason;
      return result.success ? result : null;
    };

    if (!this.isConfigured()) {
      return (
        saveToOutbox(null) || {
          success: false,
          error: 'Email non configurata: imposta MAILTRAP_API_TOKEN (produzione) oppure SMTP_USER e SMTP_PASS.',
        }
      );
    }

    if (this.useMailtrapApi()) {
      const result = await this.sendViaMailtrapApi({
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        replyTo,
        category,
        lang,
      });
      if (result.success) return result;
      return saveToOutbox(result.error) || result;
    }

    const ms = timeoutMs || this.smtpSendTimeoutMs;
    const dedicated = ms !== this.smtpSendTimeoutMs;
    const transport = dedicated ? this.createSmtpTransporter(ms) : this.transporter;
    try {
      const info = await this.withTimeout(
        transport.sendMail({
          from: this.fromEmail,
          to,
          replyTo: replyTo ? oneLine(replyTo, 254) : undefined,
          subject: oneLine(mail.subject),
          text: mail.text,
          html: mail.html,
          attachments: mail.attachments || [],
        }),
        ms,
        label
      );
      const delivery = this.resolveDeliveryMode();
      logger.info('Email inviata via SMTP', { recipient: maskEmail(to), category, delivery });
      return {
        success: true,
        delivery,
        messageId: info.messageId,
        hint: this.getDeliveryHint(delivery, lang),
      };
    } catch (err) {
      logger.error('Errore invio SMTP', { error: err.message, recipient: maskEmail(to), category, host: this.smtpHost });
      return saveToOutbox(err.message) || { success: false, error: err.message };
    } finally {
      if (dedicated && transport?.close) {
        try {
          transport.close();
        } catch (_) {
          /* ignore */
        }
      }
    }
  }

  async sendVerificationEmail(email, token, name, lang) {
    const verificationLink = this.buildVerificationLink(token, lang);
    return this.deliver({
      to: email,
      lang,
      mail: this.buildVerificationMail(name, verificationLink, { lang }),
      category: 'Account',
      label: 'Invio email di verifica',
      timeoutMs: this.registerSmtpTimeoutMs,
      outbox: {
        actionLink: verificationLink,
        buildMail: () => this.buildVerificationMail(name, verificationLink, { embedLogo: true, lang }),
        titleLabel: 'verifica',
        buttonLabel: 'Apri link di verifica',
      },
    });
  }

  resolveSmtpAuth() {
    const host = this.smtpHost.toLowerCase();
    const pass = String(this.smtpPass || '');
    if (
      (host.includes('mailtrap') || host.includes('live.smtp')) &&
      /^[a-f0-9]{20,}$/i.test(pass)
    ) {
      return { user: 'api', pass };
    }
    return { user: this.smtpUser, pass: this.smtpPass };
  }

  createSmtpTransporter(socketTimeoutMs) {
    const ms = socketTimeoutMs || this.smtpSendTimeoutMs;
    return nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      requireTLS: this.smtpPort === 587 && !this.smtpSecure,
      connectionTimeout: Math.min(20000, ms),
      greetingTimeout: Math.min(20000, ms),
      socketTimeout: ms,
      pool: false,
      maxConnections: 1,
      auth: this.smtpAuth,
    });
  }

  /** Mailtrap Live: 587 + STARTTLS; Gmail: 465 + SSL */
  applyProviderDefaults() {
    const host = this.smtpHost.toLowerCase();
    if (host.includes('mailtrap') || host.includes('live.smtp')) {
      if (this.smtpPort === 587) {
        this.smtpSecure = false;
      }
      if (host.includes('live.smtp') && this.smtpPort === 465 && process.env.SMTP_SECURE !== 'true') {
        this.smtpSecure = true;
      }
    }
    if (host.includes('gmail') && this.smtpPort === 465) {
      this.smtpSecure = true;
    }
  }

  getSmtpDiagnostics() {
    const host = this.smtpHost.toLowerCase();
    const hints = [];
    if (host.includes('mailtrap')) {
      if (!host.includes('live.smtp') && !host.includes('smtp.mailtrap')) {
        hints.push('Per invio reale usa SMTP_HOST=live.smtp.mailtrap.io (non sandbox).');
      }
      const pass = String(this.smtpPass || '');
      if (this.smtpUser !== 'api' && !pass.startsWith('mt') && !/^[a-f0-9]{20,}$/i.test(pass)) {
        hints.push('Mailtrap Live: SMTP_USER=api (o apismtp@mailtrap.io) e SMTP_PASS=<API token Sending>.');
      }
      if (this.fromEmail.includes('@gmail.com')) {
        hints.push('SMTP_FROM_EMAIL deve essere @projectevil.it (dominio verificato su Mailtrap), non Gmail.');
      }
      if (this.smtpPort === 465 && this.smtpSecure) {
        hints.push('Mailtrap consiglia PORT=587 e SMTP_SECURE=false (STARTTLS).');
      }
    }
    if (host.includes('gmail') && process.env.SMTP_MODE === 'live') {
      hints.push('Stai usando Gmail SMTP: il DNS Mailtrap (DKIM) non serve per Gmail.');
    }
    if (this.onRenderHosting() && !this.useMailtrapApi()) {
      hints.push(
        'Render (piano free) blocca SMTP su porte 587/465. Imposta MAILTRAP_API_TOKEN e EMAIL_USE_MAILTRAP_API=1, oppure passa a un piano Render a pagamento.'
      );
    }
    if (this.useMailtrapApi()) {
      hints.push('Invio email via Mailtrap API (HTTPS) — adatto a Render free tier.');
    }
    return hints;
  }

  resolveDeliveryMode() {
    if (this.smtpMode === 'sandbox') return 'sandbox';
    if (this.smtpMode === 'live') return 'live';
    const host = this.smtpHost.toLowerCase();
    if (host.includes('sandbox')) return 'sandbox';
    if (host.includes('live.smtp.mailtrap') || host.includes('smtp.mailtrap.live')) return 'live';
    if (host.includes('gmail') || host.includes('sendgrid') || host.includes('office365')) {
      return 'live';
    }
    return 'smtp';
  }

  /** Frase mostrata all'utente dopo l'invio: tecnica solo in sviluppo. */
  getDeliveryHint(delivery, lang) {
    if (delivery === 'sandbox') {
      return t(lang, 'Sviluppo: l\'email è nella Sandbox di Mailtrap (https://mailtrap.io/sandboxes), non nella tua casella.');
    }
    if (delivery === 'outbox') {
      return t(lang, 'Sviluppo: email non inviata, salvata come file in {dir}.', { dir: this.outboxDir });
    }
    return t(lang, 'Se non la vedi entro qualche minuto, controlla la cartella spam o promozioni.');
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Link di verifica: porta alla pagina, che chiede conferma e chiama POST /api/auth/verify.
   * Il token sta nel frammento (#token=…): non arriva nei log del server né nel Referer.
   * Aprire il link non attiva l'account e non fa accedere (S-05).
   */
  buildVerificationLink(token, lang) {
    return `${this.baseUrl}${langPrefix(lang)}/verify-email.html#token=${encodeURIComponent(token)}`;
  }

  brandUrl(lang) {
    return (process.env.EMAIL_BRAND_URL || '').trim() || `${this.baseUrl}${langPrefix(lang)}/`;
  }

  escapeHtml(value) {
    const str = String(value ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  getLogoFilePath() {
    const root = path.join(__dirname, '..');
    const candidates = [
      path.join(root, 'assets', 'evil-logo-128.png'), // 5 KB invece dei 173 KB dell'originale
      path.join(root, 'public', 'generated-image.png')
    ];
    return candidates.find((filePath) => fs.existsSync(filePath)) || null;
  }

  getLogoCid() {
    return 'evil-logo@projectevil.it';
  }

  getLogoDataUri() {
    if (this._logoDataUri !== undefined) {
      return this._logoDataUri;
    }
    const filePath = this.getLogoFilePath();
    if (!filePath) {
      this._logoDataUri = null;
      return null;
    }
    try {
      const base64 = fs.readFileSync(filePath).toString('base64');
      this._logoDataUri = `data:image/png;base64,${base64}`;
    } catch (err) {
      logger.warn('Logo email non leggibile', { error: err.message });
      this._logoDataUri = null;
    }
    return this._logoDataUri;
  }

  buildLogoAttachment() {
    const filePath = this.getLogoFilePath();
    if (!filePath) return null;
    return {
      filename: 'evil-logo.png',
      path: filePath,
      cid: this.getLogoCid()
    };
  }

  /**
   * Logo in email: URL pubblico (EMAIL_LOGO_URL), allegato CID (SMTP) o base64 (outbox/anteprima).
   */
  resolveEmailLogo({ embed = false } = {}) {
    // In produzione il logo si carica dal sito (BASE_URL https), senza allegati
    const publicUrl =
      (process.env.EMAIL_LOGO_URL || '').trim() ||
      (/^https:\/\//i.test(this.baseUrl) ? `${this.baseUrl}/assets/evil-logo-128.png` : '');
    if (!embed && /^https:\/\//i.test(publicUrl)) {
      return { src: publicUrl, attachment: null };
    }

    if (embed) {
      const dataUri = this.getLogoDataUri();
      return { src: dataUri, attachment: null };
    }

    const attachment = this.buildLogoAttachment();
    if (attachment) {
      return { src: `cid:${this.getLogoCid()}`, attachment };
    }

    return { src: this.getLogoDataUri(), attachment: null };
  }

  buildLogoHtml(logoSrc) {
    if (logoSrc) {
      return `<img src="${logoSrc}" width="48" height="48" alt="EVIL" style="display:block;border-radius:10px;border:1px solid rgba(125,211,252,0.25);background:#0c1019;">`;
    }
    return `<div style="width:48px;height:48px;border-radius:10px;border:1px solid rgba(125,211,252,0.35);background:linear-gradient(135deg,#1e293b,#0f172a);text-align:center;line-height:48px;font-size:14px;font-weight:800;color:#f59e0b;">E</div>`;
  }

  buildVerificationMail(name, verificationLink, options = {}) {
    const lang = mailLang(options.lang);
    const who = name || t(lang, 'Utente');
    const safeName = this.escapeHtml(who);
    const safeLink = this.escapeHtml(verificationLink);
    const brandUrl = this.brandUrl(lang);
    const logo = this.resolveEmailLogo({ embed: options.embedLogo === true });
    const logoHtml = this.buildLogoHtml(logo.src);
    const year = new Date().getFullYear();

    const text = [
      t(lang, 'Ciao {name},', { name: who }),
      '',
      t(lang, 'Grazie per esserti registrato su EVIL, la piattaforma didattica di cybersecurity.'),
      t(lang, 'Apri questo link e conferma il tuo indirizzo per attivare l\'account:'),
      verificationLink,
      '',
      t(lang, 'Il link scade tra 24 ore.'),
      t(lang, 'Se non ti sei registrato tu, ignora questo messaggio: senza conferma l\'account viene cancellato entro 7 giorni.'),
      '',
      '— EVIL'
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${t(lang, 'Conferma email — EVIL')}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media (prefers-reduced-motion: reduce) {
      .evil-pulse, .evil-scan, .evil-aurora { animation: none !important; }
    }
    @keyframes evilBtnPulse {
      0%, 100% { box-shadow: 0 4px 18px rgba(245, 158, 11, 0.35); }
      50% { box-shadow: 0 6px 32px rgba(245, 158, 11, 0.55), 0 0 40px rgba(125, 211, 252, 0.2); }
    }
    @keyframes evilScanline {
      0%, 100% { opacity: 0.35; }
      50% { opacity: 1; }
    }
    @keyframes evilAurora {
      0%, 100% { opacity: 0.55; }
      50% { opacity: 0.9; }
    }
    @media only screen and (max-width: 620px) {
      .evil-wrap { width: 100% !important; }
      .evil-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .evil-title { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#06080e;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${t(lang, 'Conferma la tua email per attivare l\'account EVIL — link valido 24 ore.')}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#06080e;background-image:linear-gradient(180deg,#070a11 0%,#06080e 50%,#05070c 100%);">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- aurora glow (decorative) -->
        <table role="presentation" class="evil-wrap" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="height:1px;line-height:1px;font-size:0;">
              <div class="evil-aurora" style="height:120px;margin:0 auto  -100px;max-width:480px;background:radial-gradient(ellipse at 50% 0%, rgba(56,189,248,0.22) 0%, transparent 70%);animation:evilAurora 8s ease-in-out infinite;"></div>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:16px;overflow:hidden;border:1px solid rgba(125,211,252,0.22);box-shadow:0 0 0 1px rgba(15,23,42,0.8), 0 24px 48px rgba(0,0,0,0.45);">
                <!-- gradient top bar -->
                <tr>
                  <td height="4" style="background:linear-gradient(90deg,#f59e0b 0%,#7dd3fc 45%,#34d399 100%);font-size:0;line-height:4px;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="background-color:#0c1019;background-image:linear-gradient(rgba(125,211,252,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,0.04) 1px, transparent 1px);background-size:28px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td class="evil-pad" style="padding:36px 40px 28px;">
                          <!-- header -->
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="padding-bottom:24px;border-bottom:1px solid rgba(125,211,252,0.12);">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td valign="middle" style="padding-right:14px;">
                                      ${logoHtml}
                                    </td>
                                    <td valign="middle">
                                      <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7dd3fc;font-weight:600;">${t(lang, 'Piattaforma di cybersecurity')}</p>
                                      <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:0.04em;">EVIL</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:28px 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b;font-weight:600;">${t(lang, 'Quasi fatto')}</p>
                          <h1 class="evil-title" style="margin:0 0 16px;font-size:28px;font-weight:700;color:#f8fafc;line-height:1.25;">${t(lang, 'Conferma la tua email')}</h1>
                          <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#cbd5e1;">
                            ${t(lang, 'Ciao {name},', { name: `<strong style="color:#f8fafc;">${safeName}</strong>` })}
                          </p>
                          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#94a3b8;">
                            ${t(lang, 'Grazie per esserti registrato. Manca un ultimo passo per attivare l\'account e usare laboratori, quiz e strumenti di EVIL.')}
                          </p>
                          <!-- steps -->
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;background:rgba(15,23,42,0.55);border-radius:12px;border:1px solid rgba(125,211,252,0.1);">
                            <tr>
                              <td class="evil-pad" style="padding:20px 22px;">
                                <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7dd3fc;">${t(lang, 'Come procedere')}</p>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#cbd5e1;"><span style="color:#f59e0b;font-weight:700;margin-right:8px;">1.</span> ${t(lang, 'Apri il link con il pulsante qui sotto')}</td></tr>
                                  <tr><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#cbd5e1;"><span style="color:#f59e0b;font-weight:700;margin-right:8px;">2.</span> ${t(lang, 'Sulla pagina di EVIL conferma il tuo indirizzo')}</td></tr>
                                  <tr><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#cbd5e1;"><span style="color:#f59e0b;font-weight:700;margin-right:8px;">3.</span> ${t(lang, 'Accedi con email e password')}</td></tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <!-- CTA -->
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td align="center" style="padding:8px 0 28px;">
                                <!--[if mso]>
                                <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeLink}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="50%" strokecolor="#f59e0b" fillcolor="#f59e0b">
                                  <w:anchorlock/>
                                  <center style="color:#1a1208;font-family:sans-serif;font-size:16px;font-weight:bold;">${t(lang, 'Verifica email')}</center>
                                </v:roundrect>
                                <![endif]-->
                                <!--[if !mso]><!-->
                                <a href="${safeLink}" class="evil-pulse" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#1a1208;text-decoration:none;border-radius:999px;font-size:16px;font-weight:700;letter-spacing:0.02em;animation:evilBtnPulse 2.8s ease-in-out infinite;">${t(lang, 'Verifica email')}</a>
                                <!--<![endif]-->
                              </td>
                            </tr>
                          </table>
                          <p class="evil-scan" style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;animation:evilScanline 4s ease-in-out infinite;">
                            ${t(lang, 'Il link scade tra <strong style="color:#7dd3fc;">24 ore</strong>')}
                          </p>
                          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                            ${t(lang, 'Oppure copia l\'indirizzo nel browser:')}<br>
                            <a href="${safeLink}" style="color:#7dd3fc;word-break:break-all;text-decoration:underline;">${safeLink}</a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 40px 32px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="border-top:1px solid rgba(125,211,252,0.1);padding-top:24px;">
                                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#475569;text-align:center;">
                                  ${t(lang, 'Non ti sei registrato? Ignora questa email: senza conferma l\'account viene cancellato.')}
                                </p>
                                <p style="margin:0;font-size:12px;line-height:1.5;color:#475569;text-align:center;">
                                  <a href="${this.escapeHtml(brandUrl)}" style="color:#7dd3fc;text-decoration:none;">EVIL</a>
                                  · © ${year} projectevil.it
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-size:11px;line-height:1.5;color:#475569;text-align:center;">
              ${t(lang, 'Messaggio automatico: non rispondere a questa email.')}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
      subject: t(lang, 'EVIL — Conferma la tua email'),
      text,
      html,
      attachments: logo.attachment ? [logo.attachment] : []
    };
  }

  writeOutboxPreview({ email, actionLink, mail, titleLabel, buttonLabel, lang = DEFAULT_LANG }) {
    try {
      fs.mkdirSync(this.outboxDir, { recursive: true });
      const safeLocal = email.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}-${safeLocal}.html`;
      const filePath = path.join(this.outboxDir, fileName);
      const preview = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>EVIL — ${this.escapeHtml(titleLabel)} ${this.escapeHtml(email)}</title></head><body style="font-family:system-ui;padding:24px;max-width:640px">
        <p style="color:#64748b;font-size:13px;">Outbox locale — SMTP non attivo. Destinatario: <strong>${this.escapeHtml(email)}</strong></p>
        <p><a href="${this.escapeHtml(actionLink)}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#1a1208;border-radius:8px;font-weight:700;text-decoration:none;">${this.escapeHtml(buttonLabel)}</a></p>
        <hr>${mail.html}</body></html>`;
      fs.writeFileSync(filePath, preview, 'utf8');
      logger.warn('Email salvata in outbox locale (nessun SMTP reale)', {
        filePath,
        email: maskEmail(email)
      });
      return {
        success: true,
        delivery: 'outbox',
        outboxFile: filePath,
        actionLink,
        hint: this.getDeliveryHint('outbox', lang)
      };
    } catch (err) {
      logger.error('Outbox email write failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  sendViaOutbox(email, name, verificationLink, lang) {
    const mail = this.buildVerificationMail(name, verificationLink, { embedLogo: true, lang });
    return this.writeOutboxPreview({
      lang,
      email,
      actionLink: verificationLink,
      mail,
      titleLabel: 'verifica',
      buttonLabel: 'Apri link di verifica'
    });
  }

  async verifyConnection(timeoutMs) {
    if (!this.isConfigured() || !this.transporter) {
      return { ok: false, error: 'SMTP non configurato (credenziali mancanti o placeholder nel .env)' };
    }
    const ms = timeoutMs || parseInt(process.env.SMTP_VERIFY_TIMEOUT_MS || '8000', 10);
    try {
      await this.withTimeout(this.transporter.verify(), ms, 'Verifica SMTP');
      return { ok: true, mode: this.resolveDeliveryMode(), host: this.smtpHost };
    } catch (err) {
      return { ok: false, error: err.message, host: this.smtpHost };
    }
  }

  /** Anteprime su file solo in sviluppo/test, mai in produzione (contengono link di accesso). */
  outboxAllowed() {
    return (isDevelopment() || isTest()) && process.env.EMAIL_DEV_OUTBOX !== '0';
  }

  /** Registrazione e reinvio: senza email di verifica l'account non si crea. */
  async sendRegistrationVerification(email, token, name, lang) {
    if (this.outboxAllowed() && process.env.EMAIL_REGISTER_SKIP_SMTP === '1') {
      return this.sendViaOutbox(email, name, this.buildVerificationLink(token, lang), lang);
    }
    return this.sendVerificationEmail(email, token, name, lang);
  }

  async sendVerificationLink(email, token, name, lang) {
    return this.sendRegistrationVerification(email, token, name, lang);
  }

  buildPasswordResetLink(token, lang) {
    return `${this.baseUrl}${langPrefix(lang)}/reset-password.html?token=${encodeURIComponent(token)}`;
  }

  buildPasswordResetMail(name, resetLink, options = {}) {
    const lang = mailLang(options.lang);
    const who = name || t(lang, 'Utente');
    const safeName = this.escapeHtml(who);
    const safeLink = this.escapeHtml(resetLink);
    const brandUrl = this.escapeHtml(this.brandUrl(lang));
    const logo = this.resolveEmailLogo({ embed: options.embedLogo === true });
    const logoHtml = this.buildLogoHtml(logo.src);
    const year = new Date().getFullYear();

    const text = [
      t(lang, 'Ciao {name},', { name: who }),
      '',
      t(lang, 'Abbiamo ricevuto una richiesta di reimpostare la password del tuo account EVIL.'),
      t(lang, 'Apri questo link per scegliere una nuova password:'),
      resetLink,
      '',
      t(lang, 'Il link scade tra 15 minuti e vale una sola volta.'),
      t(lang, 'Se non sei stato tu, ignora questa email: la password attuale resta valida.'),
      '',
      '— EVIL'
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t(lang, 'Reimposta la password — EVIL')}</title>
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    @media (prefers-reduced-motion: reduce) { .evil-pulse { animation: none !important; } }
    @keyframes evilBtnPulse {
      0%, 100% { box-shadow: 0 4px 18px rgba(245, 158, 11, 0.35); }
      50% { box-shadow: 0 6px 32px rgba(245, 158, 11, 0.55), 0 0 40px rgba(125, 211, 252, 0.2); }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#06080e;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${t(lang, 'Reimposta la password del tuo account EVIL — link valido 15 minuti.')}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(180deg,#070a11 0%,#06080e 50%,#05070c 100%);">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(125,211,252,0.22);">
        <tr><td height="4" style="background:linear-gradient(90deg,#f59e0b,#7dd3fc,#34d399);font-size:0;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="background-color:#0c1019;padding:36px 40px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="padding-bottom:20px;border-bottom:1px solid rgba(125,211,252,0.12);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td valign="middle" style="padding-right:14px;">${logoHtml}</td>
                <td valign="middle"><p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7dd3fc;">EVIL</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#f8fafc;">${t(lang, 'Reimposta la password')}</p></td>
              </tr></table>
            </td>
          </tr></table>
          <p style="margin:24px 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b;">${t(lang, 'Sicurezza dell\'account')}</p>
          <h1 style="margin:0 0 16px;font-size:26px;color:#f8fafc;">${t(lang, 'Reimposta la password')}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#cbd5e1;">${t(lang, 'Ciao {name},', { name: `<strong style="color:#f8fafc;">${safeName}</strong>` })}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#94a3b8;">${t(lang, 'Abbiamo ricevuto una richiesta di reimpostare la password del tuo account. Usa il pulsante per sceglierne una nuova.')}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;background:rgba(15,23,42,0.55);border-radius:12px;border:1px solid rgba(125,211,252,0.1);">
            <tr><td style="padding:18px 20px;font-size:14px;line-height:1.55;color:#cbd5e1;">
              <span style="color:#f59e0b;font-weight:700;">1.</span> ${t(lang, 'Apri il link entro 15 minuti')}<br>
              <span style="color:#f59e0b;font-weight:700;">2.</span> ${t(lang, 'Inserisci la nuova password')}<br>
              <span style="color:#f59e0b;font-weight:700;">3.</span> ${t(lang, 'Accedi con le nuove credenziali')}
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" style="padding:8px 0 24px;">
              <a href="${safeLink}" class="evil-pulse" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1208;text-decoration:none;border-radius:999px;font-size:16px;font-weight:700;animation:evilBtnPulse 2.8s ease-in-out infinite;">${t(lang, 'Reimposta la password')}</a>
            </td>
          </tr></table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">${t(lang, 'Oppure copia l\'indirizzo nel browser:')}<br><a href="${safeLink}" style="color:#7dd3fc;word-break:break-all;">${safeLink}</a></p>
        </td></tr>
        <tr><td style="padding:0 40px 28px;border-top:1px solid rgba(125,211,252,0.1);">
          <p style="margin:20px 0 8px;font-size:12px;color:#475569;text-align:center;">${t(lang, 'Non hai chiesto tu il reset? Ignora questa email.')}</p>
          <p style="margin:0;font-size:12px;color:#475569;text-align:center;"><a href="${brandUrl}" style="color:#7dd3fc;text-decoration:none;">EVIL</a> · © ${year}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return {
      subject: t(lang, 'EVIL — Reimposta la password'),
      text,
      html,
      attachments: logo.attachment ? [logo.attachment] : []
    };
  }

  async sendPasswordResetEmail(email, resetToken, name, lang) {
    const resetLink = this.buildPasswordResetLink(resetToken, lang);
    return this.deliver({
      to: email,
      lang,
      mail: this.buildPasswordResetMail(name, resetLink, { lang }),
      category: 'Account',
      label: 'Invio email reset password',
      outbox: {
        actionLink: resetLink,
        buildMail: () => this.buildPasswordResetMail(name, resetLink, { embedLogo: true, lang }),
        titleLabel: 'reset password',
        buttonLabel: 'Apri link reset password',
      },
    });
  }

  /**
   * Qualcuno ha provato a registrarsi con un indirizzo che ha già un account verificato
   * (S-06): la risposta dell'API è identica a una registrazione nuova, l'avviso arriva
   * solo al proprietario della casella.
   */
  buildAccountExistsMail(name, options = {}) {
    const lang = mailLang(options.lang);
    const who = name || t(lang, 'Utente');
    const loginLink = `${this.baseUrl}${langPrefix(lang)}/login.html`;
    const resetLink = `${this.baseUrl}${langPrefix(lang)}/forgot-password.html`;
    const text = [
      t(lang, 'Ciao {name},', { name: who }),
      '',
      t(lang, 'Qualcuno (forse tu) ha provato a creare un nuovo account EVIL con questo indirizzo email, ma un account esiste già.'),
      t(lang, 'Puoi accedere qui:'),
      loginLink,
      t(lang, 'Se non ricordi la password, reimpostala qui:'),
      resetLink,
      '',
      t(lang, 'Se non sei stato tu, puoi ignorare questa email: il tuo account non è stato modificato.'),
      '',
      '— EVIL'
    ].join('\n');
    const e = (v) => this.escapeHtml(v);
    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${e(t(lang, 'Hai già un account EVIL'))}</title></head><body style="margin:0;padding:24px;background:#06080e;color:#e2e8f0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#0c1019;border:1px solid rgba(125,211,252,0.22);border-radius:16px;">
        <tr><td style="padding:32px 36px;">
          <h1 style="margin:0 0 16px;font-size:24px;color:#f8fafc;">${e(t(lang, 'Hai già un account EVIL'))}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#cbd5e1;">${e(t(lang, 'Ciao {name},', { name: who }))}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#94a3b8;">${e(t(lang, 'Qualcuno (forse tu) ha provato a creare un nuovo account EVIL con questo indirizzo email, ma un account esiste già.'))}</p>
          <p style="margin:0 0 24px;"><a href="${e(loginLink)}" style="display:inline-block;padding:14px 30px;background:#f59e0b;color:#1a1208;text-decoration:none;border-radius:999px;font-weight:700;">${e(t(lang, 'Accedi'))}</a></p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#94a3b8;">${e(t(lang, 'Se non ricordi la password, reimpostala qui:'))} <a href="${e(resetLink)}" style="color:#7dd3fc;">${e(resetLink)}</a></p>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${e(t(lang, 'Se non sei stato tu, puoi ignorare questa email: il tuo account non è stato modificato.'))}</p>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#475569;">${e(t(lang, 'Messaggio automatico: non rispondere a questa email.'))}</p>
      </td></tr></table>
    </body></html>`;
    return { subject: t(lang, 'EVIL — Hai già un account'), text, html, attachments: [] };
  }

  async sendAccountExistsEmail(email, name, lang) {
    return this.deliver({
      to: email,
      lang,
      mail: this.buildAccountExistsMail(name, { lang }),
      category: 'Account',
      label: 'Invio avviso account esistente',
      outbox: { actionLink: `${this.baseUrl}${langPrefix(lang)}/login.html`, titleLabel: 'account esistente', buttonLabel: 'Apri login' },
    });
  }

  buildHelpMail({ name, email, subject, message, page, account = null }) {
    const safeName = this.escapeHtml(name);
    const safeEmail = this.escapeHtml(email);
    const safeSubject = this.escapeHtml(subject);
    const safeMessage = this.escapeHtml(message).replace(/\n/g, '<br>');
    const safePage = this.escapeHtml(page || '—');
    const accountLine = account
      ? `utente registrato (id ${account.id}${account.verified ? ', email verificata' : ', email NON verificata'})`
      : 'non autenticato: l\'indirizzo non è verificato';
    const text = [
      `Richiesta supporto EVIL`,
      ``,
      `Da: ${name} <${email}>`,
      `Account: ${accountLine}`,
      `Oggetto: ${subject}`,
      `Pagina: ${page || '—'}`,
      ``,
      message,
      ``,
      '— Inviato dal modulo Help EVIL (rispondi a questa email per scrivere all\'utente)'
    ].join('\n');

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#06080e;color:#e2e8f0;padding:24px;">
      <h2 style="color:#f59e0b;margin:0 0 16px;">Richiesta supporto EVIL</h2>
      <p><strong>Nome:</strong> ${safeName}<br><strong>Email:</strong> ${safeEmail}<br><strong>Account:</strong> ${this.escapeHtml(accountLine)}<br><strong>Oggetto:</strong> ${safeSubject}<br><strong>Pagina:</strong> ${safePage}</p>
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(125,211,252,0.15);border-radius:12px;padding:16px;line-height:1.6;">${safeMessage}</div>
      <p style="color:#64748b;font-size:13px;">Rispondi a questa email per scrivere direttamente all'utente.</p>
    </body></html>`;

    return { subject: `[EVIL Help] ${oneLine(subject, 120)}`, text, html, attachments: [] };
  }

  buildHelpConfirmationMail(name, lang) {
    lang = mailLang(lang);
    const who = name || t(lang, 'Utente');
    const safeName = this.escapeHtml(who);
    const text = [
      t(lang, 'Ciao {name},', { name: who }),
      ``,
      t(lang, 'Abbiamo ricevuto la tua richiesta di supporto su EVIL.'),
      t(lang, 'Ti risponderemo all\'indirizzo indicato entro 2–5 giorni lavorativi.'),
      ``,
      t(lang, 'Se il tuo account potrebbe essere stato compromesso, scrivilo nell\'oggetto dei prossimi messaggi.'),
      ``,
      '— EVIL'
    ].join('\n');

    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#06080e;color:#e2e8f0;padding:24px;">
      <h2 style="color:#7dd3fc;margin:0 0 12px;">${t(lang, 'Richiesta ricevuta')}</h2>
      <p>${t(lang, 'Ciao {name},', { name: `<strong>${safeName}</strong>` })}</p>
      <p>${t(lang, 'Abbiamo ricevuto la tua richiesta di supporto. Ti risponderemo all\'indirizzo email indicato entro <strong>2–5 giorni lavorativi</strong>.')}</p>
      <p style="color:#64748b;font-size:13px;">${t(lang, 'Messaggio automatico: non rispondere a questa email.')}</p>
    </body></html>`;

    return {
      subject: t(lang, 'EVIL — Richiesta di supporto ricevuta'),
      text,
      html,
      attachments: []
    };
  }

  async sendMailTo({ to, mail, replyTo = null, category = 'Support', lang = DEFAULT_LANG }) {
    return this.deliver({ to, mail, replyTo, category, lang, label: 'Invio email di supporto' });
  }

  /**
   * Modulo di supporto. La richiesta va sempre allo staff (Reply-To = indirizzo indicato).
   * La conferma all'utente parte solo se il route ha verificato che l'indirizzo è suo
   * (account con email verificata): così il modulo non può essere usato per mandare
   * email a indirizzi di terzi.
   */
  async sendHelpRequest({ name, email, subject, message, page, account = null, confirmTo = null, confirmName = null, lang = DEFAULT_LANG }) {
    const supportTo =
      (process.env.HELP_SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || 'support@projectevil.it').trim();
    const staffMail = this.buildHelpMail({ name, email, subject, message, page, account });

    // allo staff in italiano; gli hint per l'utente nella sua lingua
    const staffResult = await this.sendMailTo({ to: supportTo, mail: staffMail, replyTo: email, lang });
    if (!staffResult.success) return staffResult;

    let confirmationSent = false;
    if (confirmTo) {
      const userResult = await this.sendMailTo({
        to: confirmTo,
        lang,
        mail: this.buildHelpConfirmationMail(confirmName || name, lang),
      });
      confirmationSent = Boolean(userResult.success);
    }
    return {
      success: true,
      delivery: staffResult.delivery,
      hint: staffResult.hint,
      confirmationSent,
    };
  }
}

module.exports = new EmailService();
module.exports.maskEmail = maskEmail;
