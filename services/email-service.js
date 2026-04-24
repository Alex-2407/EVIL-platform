/**
 * Email Service - Gestione invio email di verifica
 * Supporta configurazione Mailtrap (testing) o SMTP generico
 */

const nodemailer = require('nodemailer');
const crypto = require('crypto');

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
  }

  /**
   * Genera un codice di verifica di 6 cifre
   */
  generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Invia email di verifica con codice
   * @param {string} email - Email destinatario
   * @param {string} code - Codice di verifica
   * @param {string} name - Nome utente
   */
  async sendVerificationCode(email, code, name = 'Utente') {
    try {
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'EVIL Platform - Codice di Verifica Email',
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
              <p>Ciao <strong>${name}</strong>,</p>
              <p>Grazie per esserti registrato su EVIL Platform. Per confermare il possesso della tua email, usa il seguente codice di verifica:</p>
              <div class="code-box">
                <div class="code">${code}</div>
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
      console.log('Email inviata:', info.response);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('Errore invio email:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Invia email di reset password
   */
  async sendPasswordResetEmail(email, resetToken, name = 'Utente') {
    try {
      const resetLink = `${process.env.BASE_URL || 'http://localhost:5000'}/reset-password.html?token=${resetToken}`;
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'EVIL Platform - Reset Password',
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family:Arial;background-color:#0a0e27;color:#fff;">
            <div style="max-width:600px;margin:0 auto;padding:20px;background-color:#1a1f3a;border:1px solid rgba(0,255,156,0.2);border-radius:8px;">
              <h2 style="color:#00ff9c;">Reset Password</h2>
              <p>Ciao ${name},</p>
              <p>Hai richiesto il reset della password. Clicca il link sottostante:</p>
              <p><a href="${resetLink}" style="background-color:#00ff9c;color:#000;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;font-weight:bold;">Reset Password</a></p>
              <p>Link expire in 15 minuti.</p>
            </div>
          </body>
          </html>
        `
      };

      return await this.transporter.sendMail(mailOptions);
    } catch (err) {
      console.error('Errore invio reset password email:', err);
      throw err;
    }
  }
}

module.exports = new EmailService();
