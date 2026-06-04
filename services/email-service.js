/**
 * Email Service — verifica account via link
 * SMTP reale, Mailtrap Sandbox (solo inbox Mailtrap) o outbox locale in sviluppo
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logger } = require('../middleware/logger');

const SMTP_PLACEHOLDERS = new Set([
  '',
  'your_mailtrap_username',
  'your_mailtrap_password',
  'your_username',
  'your_password',
  'changeme'
]);

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
      process.env.REGISTER_SMTP_TIMEOUT_MS || '12000',
      10
    );

    this.applyProviderDefaults();

    if (this.isConfigured()) {
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpSecure,
        requireTLS: this.smtpPort === 587 && !this.smtpSecure,
        connectionTimeout: Math.min(8000, this.registerSmtpTimeoutMs),
        greetingTimeout: Math.min(8000, this.registerSmtpTimeoutMs),
        socketTimeout: this.smtpSendTimeoutMs,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass
        }
      });
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
    return Boolean(
      this.smtpUser &&
      this.smtpPass &&
      !this.isPlaceholder(this.smtpUser) &&
      !this.isPlaceholder(this.smtpPass)
    );
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

  getDeliveryHint(delivery) {
    if (delivery === 'sandbox') {
      return 'Email catturata da Mailtrap Sandbox: apri https://mailtrap.io/sandboxes (non arriva nella tua casella Gmail/Outlook).';
    }
    if (delivery === 'outbox') {
      return 'SMTP non configurato: il messaggio è salvato in data/email-outbox sul PC.';
    }
    if (delivery === 'live' || delivery === 'smtp') {
      return 'Email inviata via SMTP: controlla la inbox (e la cartella spam).';
    }
    return '';
  }

  generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  buildVerificationLink(token) {
    return `${this.baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
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
    const candidates = [
      path.join(process.cwd(), 'html', 'generated-image.png'),
      path.join(process.cwd(), 'public', 'generated-image.png')
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
    const publicUrl = (process.env.EMAIL_LOGO_URL || '').trim();
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
    const safeName = this.escapeHtml(name);
    const safeLink = this.escapeHtml(verificationLink);
    const brandUrl = this.escapeHtml(
      (process.env.EMAIL_BRAND_URL || `${this.baseUrl}/html/home.html`).replace(/\/$/, '')
    );
    const logo = this.resolveEmailLogo({ embed: options.embedLogo === true });
    const logoHtml = this.buildLogoHtml(logo.src);
    const year = new Date().getFullYear();

    const text = [
      `Ciao ${name},`,
      '',
      'Grazie per esserti registrato su EVIL Cybersecurity Platform.',
      'Apri questo link per verificare la tua email e attivare l\'account:',
      verificationLink,
      '',
      'Il link scade tra 24 ore.',
      'Se non ti sei registrato, ignora questo messaggio.',
      '',
      '— EVIL Platform'
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Conferma email — EVIL Platform</title>
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
    Conferma la tua email per attivare l'account EVIL — link valido 24 ore.
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
                                      <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7dd3fc;font-weight:600;">Cybersecurity Platform</p>
                                      <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:0.04em;">EVIL</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:28px 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b;font-weight:600;">Quasi fatto</p>
                          <h1 class="evil-title" style="margin:0 0 16px;font-size:28px;font-weight:700;color:#f8fafc;line-height:1.25;">Conferma la tua email</h1>
                          <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#cbd5e1;">
                            Ciao <strong style="color:#f8fafc;">${safeName}</strong>,
                          </p>
                          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#94a3b8;">
                            Grazie per esserti registrato. Un ultimo passo per attivare l'account e accedere a laboratori, strumenti e intelligence della piattaforma EVIL.
                          </p>
                          <!-- steps -->
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:28px;background:rgba(15,23,42,0.55);border-radius:12px;border:1px solid rgba(125,211,252,0.1);">
                            <tr>
                              <td class="evil-pad" style="padding:20px 22px;">
                                <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#7dd3fc;">Come procedere</p>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#cbd5e1;"><span style="color:#f59e0b;font-weight:700;margin-right:8px;">1.</span> Clicca il pulsante qui sotto</td></tr>
                                  <tr><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#cbd5e1;"><span style="color:#f59e0b;font-weight:700;margin-right:8px;">2.</span> Verrai reindirizzato su EVIL con account attivo</td></tr>
                                  <tr><td style="padding:6px 0;font-size:14px;line-height:1.5;color:#cbd5e1;"><span style="color:#f59e0b;font-weight:700;margin-right:8px;">3.</span> Accedi con email e password</td></tr>
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
                                  <center style="color:#1a1208;font-family:sans-serif;font-size:16px;font-weight:bold;">Verifica email</center>
                                </v:roundrect>
                                <![endif]-->
                                <!--[if !mso]><!-->
                                <a href="${safeLink}" class="evil-pulse" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#f59e0b 0%,#fbbf24 100%);color:#1a1208;text-decoration:none;border-radius:999px;font-size:16px;font-weight:700;letter-spacing:0.02em;animation:evilBtnPulse 2.8s ease-in-out infinite;">Verifica email</a>
                                <!--<![endif]-->
                              </td>
                            </tr>
                          </table>
                          <p class="evil-scan" style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#64748b;text-align:center;animation:evilScanline 4s ease-in-out infinite;">
                            Il link scade tra <strong style="color:#7dd3fc;">24 ore</strong>
                          </p>
                          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">
                            Oppure copia nel browser:<br>
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
                                  Non ti sei registrato? Ignora questa email — nessuna azione richiesta.
                                </p>
                                <p style="margin:0;font-size:12px;line-height:1.5;color:#475569;text-align:center;">
                                  <a href="${this.escapeHtml(brandUrl)}" style="color:#7dd3fc;text-decoration:none;">EVIL Platform</a>
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
              Messaggio automatico — non rispondere a questa email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return {
      subject: 'EVIL Platform — Conferma la tua email',
      text,
      html,
      attachments: logo.attachment ? [logo.attachment] : []
    };
  }

  writeOutboxPreview({ email, actionLink, mail, titleLabel, buttonLabel }) {
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
        email,
        actionLink
      });
      return {
        success: true,
        delivery: 'outbox',
        outboxFile: filePath,
        actionLink,
        hint: this.getDeliveryHint('outbox')
      };
    } catch (err) {
      logger.error('Outbox email write failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  sendViaOutbox(email, name, verificationLink) {
    const mail = this.buildVerificationMail(name, verificationLink, { embedLogo: true });
    return this.writeOutboxPreview({
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

  outboxAllowed() {
    return process.env.EMAIL_DEV_OUTBOX !== '0';
  }

  /** Fallback registrazione se SMTP lento (anche con EMAIL_DEV_OUTBOX=0) */
  registrationFallbackEnabled() {
    return process.env.EMAIL_REGISTER_FALLBACK !== '0';
  }

  /**
   * Registrazione: timeout SMTP breve + fallback outbox (evita hang su projectevil.it)
   */
  async sendRegistrationVerification(email, token, name = 'Utente') {
    const verificationLink = this.buildVerificationLink(token);
    const mail = this.buildVerificationMail(name, verificationLink);
    const allowOutbox = this.outboxAllowed() || this.registrationFallbackEnabled();
    const skipSmtp = process.env.EMAIL_REGISTER_SKIP_SMTP === '1';

    if (!this.isConfigured() || skipSmtp) {
      if (allowOutbox) {
        return this.sendViaOutbox(email, name, verificationLink);
      }
      return {
        success: false,
        error:
          'SMTP non configurato. Imposta SMTP_USER e SMTP_PASS oppure EMAIL_REGISTER_SKIP_SMTP=1 con DATA_DIR scrivibile.',
      };
    }

    try {
      const info = await this.withTimeout(
        this.transporter.sendMail({
          from: this.fromEmail,
          to: email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          attachments: mail.attachments || [],
        }),
        this.registerSmtpTimeoutMs,
        'Invio email registrazione'
      );
      const delivery = this.resolveDeliveryMode();
      logger.info('Email verifica registrazione inviata via SMTP', {
        messageId: info.messageId,
        recipient: email,
        delivery,
        host: this.smtpHost,
      });
      return {
        success: true,
        delivery,
        messageId: info.messageId,
        actionLink: verificationLink,
        hint: this.getDeliveryHint(delivery),
      };
    } catch (err) {
      logger.error('Errore SMTP registrazione', {
        error: err.message,
        recipient: email,
        host: this.smtpHost,
      });
      if (allowOutbox) {
        const outbox = this.sendViaOutbox(email, name, verificationLink);
        outbox.smtpError = err.message;
        outbox.hint =
          `L'invio email non è riuscito (${err.message}). Usa il link di verifica mostrato nella pagina successiva.`;
        return outbox;
      }
      return { success: false, error: err.message };
    }
  }

  async sendVerificationLink(email, token, name = 'Utente') {
    const verificationLink = this.buildVerificationLink(token);
    const mail = this.buildVerificationMail(name, verificationLink);
    const allowOutbox = this.outboxAllowed();

    if (!this.isConfigured()) {
      if (allowOutbox) {
        return this.sendViaOutbox(email, name, verificationLink);
      }
      return {
        success: false,
        error: 'SMTP non configurato. Imposta SMTP_USER e SMTP_PASS nel file .env (vedi SETUP_EMAIL_VERIFICATION.md).'
      };
    }

    try {
      const info = await this.withTimeout(
        this.transporter.sendMail({
          from: this.fromEmail,
          to: email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          attachments: mail.attachments || []
        }),
        this.smtpSendTimeoutMs,
        'Invio email verifica'
      );
      const delivery = this.resolveDeliveryMode();
      logger.info('Email verifica inviata via SMTP', {
        messageId: info.messageId,
        recipient: email,
        delivery,
        host: this.smtpHost
      });
      return {
        success: true,
        delivery,
        messageId: info.messageId,
        actionLink: verificationLink,
        hint: this.getDeliveryHint(delivery)
      };
    } catch (err) {
      logger.error('Errore invio SMTP verifica', {
        error: err.message,
        recipient: email,
        host: this.smtpHost
      });
      if (allowOutbox) {
        const outbox = this.sendViaOutbox(email, name, verificationLink);
        outbox.smtpError = err.message;
        outbox.hint = `SMTP fallito (${err.message}). ${outbox.hint}`;
        return outbox;
      }
      return { success: false, error: err.message };
    }
  }

  /**
   * Genera un codice di verifica di 6 cifre (legacy)
   */
  generateVerificationCode() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  validateSmtpConfig() {
    if (!this.isConfigured()) {
      return { success: false, error: 'SMTP non configurato' };
    }
    return { success: true };
  }

  async sendVerificationCode(email, code, name = 'Utente') {
    const configCheck = this.validateSmtpConfig();
    if (!configCheck.success) return configCheck;

    const safeName = this.escapeHtml(name);
    const safeCode = this.escapeHtml(code);

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: 'EVIL Platform - Codice di Verifica Email',
        text: `Ciao ${name},\n\nCodice: ${code}\n\nScade tra 10 minuti.`,
        html: `<p>Ciao <strong>${safeName}</strong>,</p><p>Codice: <strong>${safeCode}</strong></p>`
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  buildPasswordResetLink(token) {
    return `${this.baseUrl}/html/reset-password.html?token=${encodeURIComponent(token)}`;
  }

  buildPasswordResetMail(name, resetLink, options = {}) {
    const safeName = this.escapeHtml(name);
    const safeLink = this.escapeHtml(resetLink);
    const brandUrl = this.escapeHtml(
      (process.env.EMAIL_BRAND_URL || `${this.baseUrl}/html/home.html`).replace(/\/$/, '')
    );
    const logo = this.resolveEmailLogo({ embed: options.embedLogo === true });
    const logoHtml = this.buildLogoHtml(logo.src);
    const year = new Date().getFullYear();

    const text = [
      `Ciao ${name},`,
      '',
      'Hai richiesto il reset della password su EVIL Platform.',
      'Apri questo link per impostare una nuova password:',
      resetLink,
      '',
      'Il link scade tra 15 minuti.',
      'Se non hai richiesto il reset, ignora questa email.',
      '',
      '— EVIL Platform'
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset password — EVIL Platform</title>
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
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Reimposta la password del tuo account EVIL — link valido 15 minuti.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(180deg,#070a11 0%,#06080e 50%,#05070c 100%);">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(125,211,252,0.22);">
        <tr><td height="4" style="background:linear-gradient(90deg,#f59e0b,#7dd3fc,#34d399);font-size:0;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="background-color:#0c1019;padding:36px 40px 28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="padding-bottom:20px;border-bottom:1px solid rgba(125,211,252,0.12);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td valign="middle" style="padding-right:14px;">${logoHtml}</td>
                <td valign="middle"><p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7dd3fc;">EVIL Platform</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#f8fafc;">Reset password</p></td>
              </tr></table>
            </td>
          </tr></table>
          <p style="margin:24px 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f59e0b;">Sicurezza account</p>
          <h1 style="margin:0 0 16px;font-size:26px;color:#f8fafc;">Reimposta la password</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#cbd5e1;">Ciao <strong style="color:#f8fafc;">${safeName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#94a3b8;">Abbiamo ricevuto una richiesta di reset per il tuo account. Clicca il pulsante per scegliere una nuova password.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;background:rgba(15,23,42,0.55);border-radius:12px;border:1px solid rgba(125,211,252,0.1);">
            <tr><td style="padding:18px 20px;font-size:14px;line-height:1.55;color:#cbd5e1;">
              <span style="color:#f59e0b;font-weight:700;">1.</span> Apri il link entro 15 minuti<br>
              <span style="color:#f59e0b;font-weight:700;">2.</span> Inserisci la nuova password<br>
              <span style="color:#f59e0b;font-weight:700;">3.</span> Accedi con le nuove credenziali
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" style="padding:8px 0 24px;">
              <a href="${safeLink}" class="evil-pulse" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1208;text-decoration:none;border-radius:999px;font-size:16px;font-weight:700;animation:evilBtnPulse 2.8s ease-in-out infinite;">Reimposta password</a>
            </td>
          </tr></table>
          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;text-align:center;">Link alternativo:<br><a href="${safeLink}" style="color:#7dd3fc;word-break:break-all;">${safeLink}</a></p>
        </td></tr>
        <tr><td style="padding:0 40px 28px;border-top:1px solid rgba(125,211,252,0.1);">
          <p style="margin:20px 0 8px;font-size:12px;color:#475569;text-align:center;">Non hai richiesto il reset? Ignora questa email.</p>
          <p style="margin:0;font-size:12px;color:#475569;text-align:center;"><a href="${brandUrl}" style="color:#7dd3fc;text-decoration:none;">EVIL Platform</a> · © ${year}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return {
      subject: 'EVIL Platform — Reimposta la password',
      text,
      html,
      attachments: logo.attachment ? [logo.attachment] : []
    };
  }

  async sendPasswordResetEmail(email, resetToken, name = 'Utente') {
    const resetLink = this.buildPasswordResetLink(resetToken);
    const mail = this.buildPasswordResetMail(name, resetLink);
    const isDev = process.env.NODE_ENV !== 'production';
    const allowOutbox = isDev && process.env.EMAIL_DEV_OUTBOX !== '0';

    if (!this.isConfigured()) {
      if (allowOutbox) {
        const outbox = this.writeOutboxPreview({
          email,
          actionLink: resetLink,
          mail: this.buildPasswordResetMail(name, resetLink, { embedLogo: true }),
          titleLabel: 'reset password',
          buttonLabel: 'Apri link reset password'
        });
        return outbox;
      }
      return {
        success: false,
        error: 'SMTP non configurato. Imposta SMTP_USER e SMTP_PASS nel file .env.'
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments || []
      });
      const delivery = this.resolveDeliveryMode();
      logger.info('Email reset password inviata via SMTP', {
        messageId: info.messageId,
        recipient: email,
        delivery,
        host: this.smtpHost
      });
      return {
        success: true,
        delivery,
        messageId: info.messageId,
        hint: this.getDeliveryHint(delivery)
      };
    } catch (err) {
      logger.error('Errore invio SMTP reset password', {
        error: err.message,
        recipient: email,
        host: this.smtpHost
      });
      if (allowOutbox) {
        const outbox = this.writeOutboxPreview({
          email,
          actionLink: resetLink,
          mail: this.buildPasswordResetMail(name, resetLink, { embedLogo: true }),
          titleLabel: 'reset password',
          buttonLabel: 'Apri link reset password'
        });
        outbox.smtpError = err.message;
        outbox.hint = `SMTP fallito (${err.message}). ${outbox.hint}`;
        return outbox;
      }
      return { success: false, error: err.message };
    }
  }

  buildHelpMail({ name, email, subject, message, page }) {
    const safeName = this.escapeHtml(name);
    const safeEmail = this.escapeHtml(email);
    const safeSubject = this.escapeHtml(subject);
    const safeMessage = this.escapeHtml(message).replace(/\n/g, '<br>');
    const safePage = this.escapeHtml(page || '—');
    const text = [
      `Richiesta supporto EVIL`,
      ``,
      `Da: ${name} <${email}>`,
      `Oggetto: ${subject}`,
      `Pagina: ${page || '—'}`,
      ``,
      message,
      ``,
      '— Inviato dal modulo Help EVIL'
    ].join('\n');

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#06080e;color:#e2e8f0;padding:24px;">
      <h2 style="color:#f59e0b;margin:0 0 16px;">Richiesta supporto EVIL</h2>
      <p><strong>Nome:</strong> ${safeName}<br><strong>Email:</strong> ${safeEmail}<br><strong>Oggetto:</strong> ${safeSubject}<br><strong>Pagina:</strong> ${safePage}</p>
      <div style="background:rgba(15,23,42,0.8);border:1px solid rgba(125,211,252,0.15);border-radius:12px;padding:16px;line-height:1.6;">${safeMessage}</div>
    </body></html>`;

    return { subject: `[EVIL Help] ${subject}`, text, html, attachments: [] };
  }

  buildHelpConfirmationMail(name) {
    const safeName = this.escapeHtml(name);
    const text = [
      `Ciao ${name},`,
      ``,
      `Abbiamo ricevuto la tua richiesta di supporto su EVIL Platform.`,
      `Il team la esaminerà e ti risponderà all\'indirizzo indicato entro 2–5 giorni lavorativi.`,
      ``,
      `Per urgenze su account compromessi, indicalo nell\'oggetto delle prossime comunicazioni.`,
      ``,
      '— EVIL Platform'
    ].join('\n');

    const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"></head><body style="font-family:system-ui,sans-serif;background:#06080e;color:#e2e8f0;padding:24px;">
      <h2 style="color:#7dd3fc;margin:0 0 12px;">Richiesta ricevuta</h2>
      <p>Ciao <strong>${safeName}</strong>,</p>
      <p>Abbiamo ricevuto la tua richiesta di supporto. Ti risponderemo all\'indirizzo email indicato entro <strong>2–5 giorni lavorativi</strong>.</p>
      <p style="color:#64748b;font-size:13px;">Messaggio automatico — non rispondere a questa email.</p>
    </body></html>`;

    return {
      subject: 'EVIL Platform — Richiesta di supporto ricevuta',
      text,
      html,
      attachments: []
    };
  }

  async sendMailTo({ to, mail }) {
    const isDev = process.env.NODE_ENV !== 'production';
    const allowOutbox = isDev && process.env.EMAIL_DEV_OUTBOX !== '0';

    if (!this.isConfigured()) {
      if (allowOutbox) {
        return this.writeOutboxPreview({
          email: to,
          actionLink: '#',
          mail,
          titleLabel: 'help',
          buttonLabel: 'Anteprima'
        });
      }
      return {
        success: false,
        error: 'SMTP non configurato. Imposta SMTP_USER e SMTP_PASS nel file .env.'
      };
    }

    try {
      const info = await this.withTimeout(
        this.transporter.sendMail({
          from: this.fromEmail,
          to,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          attachments: mail.attachments || []
        }),
        this.smtpSendTimeoutMs,
        'Invio email'
      );
      const delivery = this.resolveDeliveryMode();
      return {
        success: true,
        delivery,
        messageId: info.messageId,
        hint: this.getDeliveryHint(delivery)
      };
    } catch (err) {
      logger.error('Errore invio SMTP', { error: err.message, to });
      if (allowOutbox) {
        const outbox = this.writeOutboxPreview({
          email: to,
          actionLink: '#',
          mail,
          titleLabel: 'help-fallback',
          buttonLabel: 'Anteprima'
        });
        outbox.smtpError = err.message;
        return outbox;
      }
      return { success: false, error: err.message };
    }
  }

  async sendHelpRequest({ name, email, subject, message, page }) {
    const supportTo =
      (process.env.HELP_SUPPORT_EMAIL || process.env.SMTP_FROM_EMAIL || 'support@projectevil.it').trim();
    const staffMail = this.buildHelpMail({ name, email, subject, message, page });
    const confirmMail = this.buildHelpConfirmationMail(name);

    const staffResult = await this.sendMailTo({ to: supportTo, mail: staffMail });
    if (!staffResult.success) return staffResult;

    const userResult = await this.sendMailTo({ to: email, mail: confirmMail });
    return {
      success: true,
      delivery: staffResult.delivery,
      hint: staffResult.hint,
      confirmationSent: userResult.success,
      confirmationHint: userResult.hint || userResult.error
    };
  }
}

module.exports = new EmailService();
