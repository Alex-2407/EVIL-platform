/**
 * Email Service - Gestione invio email di verifica
 * Supporta configurazione Mailtrap (testing) o SMTP generico
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { logger } = require('../middleware/logger');

class EmailService {
  constructor() {
    // Configurazione SMTP - usa variabili d'ambiente
    const config = {
      host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
      port: parseInt(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true', // true per 465, false per altri port
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };

    this.transporter = nodemailer.createTransport(config);
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@evil-platform.com';
    this.smtpUser = process.env.SMTP_USER || '';
    this.smtpPass = process.env.SMTP_PASS || '';
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  }

  /**
   * Genera un codice di verifica di 6 cifre
   */
  generateVerificationCode() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Escape minimo per contenuto HTML dinamico
   */
  escapeHtml(value) {
    const str = String(value ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Verifica configurazione SMTP minima
   */
  validateSmtpConfig() {
    if (!this.smtpUser || !this.smtpPass) {
      const error = 'SMTP_USER o SMTP_PASS non configurati';
      logger.error(error);
      return { success: false, error };
    }
    return { success: true };
  }

  /**
   * Invia email di verifica con codice
   * @param {string} email - Email destinatario
   * @param {string} code - Codice di verifica
   * @param {string} name - Nome utente
   */
  async sendVerificationCode(email, code, name = 'Utente') {
    const configCheck = this.validateSmtpConfig();
    if (!configCheck.success) {
      return configCheck;
    }

    const safeName = this.escapeHtml(name);
    const safeCode = this.escapeHtml(code);

    try {
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'EVIL Platform - Codice di Verifica Email',
        text: [
          `Ciao ${name},`,
          '',
          'Grazie per esserti registrato su EVIL Platform.',
          `Il tuo codice di verifica e: ${code}`,
          '',
          'Questo codice scade tra 10 minuti.',
          'Se non hai richiesto questo codice, ignora questo messaggio.'
        ].join('\n'),
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; background-color: #0a0e27; color: #ffffff; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1f3a; border: 1px solid rgba(0,255,156,0.2); border-radius: 8px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { font-size: 28px; font-weight: bold; color: #00ff9c; }
              .code-box { background-color: rgba(0,255,156,0.1); border: 2px solid #00ff9c; padding: 20px; text-align: center; border-radius: 6px; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; color: #00ff9c; letter-spacing: 5px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: rgba(255,255,255,0.6); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">EVIL</div>
                <p>Cybersecurity Learning Platform</p>
              </div>
              <h2>Verifica la tua Email</h2>
              <p>Ciao <strong>${safeName}</strong>,</p>
              <p>Grazie per esserti registrato su EVIL Platform. Per confermare il possesso della tua email, usa il seguente codice di verifica:</p>
              <div class="code-box">
                <div class="code">${safeCode}</div>
              </div>
              <p>Questo codice scade tra 10 minuti.</p>
              <p>Se non hai richiesto questo codice, ignora questo messaggio.</p>
              <div class="footer">
                <p>© 2026 EVIL Cybersecurity Platform. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email di verifica inviata', {
        messageId: info.messageId,
        response: info.response,
        recipient: email
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error('Errore invio email di verifica', {
        error: err.message,
        recipient: email
      });
      return { success: false, error: err.message };
    }
  }

  /**
   * Invia email di reset password
   */
  async sendPasswordResetEmail(email, resetToken, name = 'Utente') {
    const configCheck = this.validateSmtpConfig();
    if (!configCheck.success) {
      return configCheck;
    }

    const safeName = this.escapeHtml(name);

    try {
      const safeToken = encodeURIComponent(resetToken);
      const resetLink = `${this.baseUrl}/reset-password.html?token=${safeToken}`;
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'EVIL Platform - Reset Password',
        text: [
          `Ciao ${name},`,
          '',
          'Hai richiesto il reset della password.',
          `Apri questo link per continuare: ${resetLink}`,
          '',
          'Il link scade in 15 minuti.'
        ].join('\n'),
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family:Arial;background-color:#0a0e27;color:#fff;">
            <div style="max-width:600px;margin:0 auto;padding:20px;background-color:#1a1f3a;border:1px solid rgba(0,255,156,0.2);border-radius:8px;">
              <h2 style="color:#00ff9c;">Reset Password</h2>
              <p>Ciao ${safeName},</p>
              <p>Hai richiesto il reset della password. Clicca il link sottostante:</p>
              <p><a href="${resetLink}" style="background-color:#00ff9c;color:#000;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold;">Reset Password</a></p>
              <p>Il link scade in 15 minuti.</p>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email reset password inviata', {
        messageId: info.messageId,
        response: info.response,
        recipient: email
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error('Errore invio reset password email', {
        error: err.message,
        recipient: email
      });
      return { success: false, error: err.message };
    }
  }
}

module.exports = new EmailService();
