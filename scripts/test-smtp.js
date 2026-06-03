#!/usr/bin/env node
/**
 * Test connessione SMTP — node scripts/test-smtp.js [email_destinatario]
 */
require('dotenv').config();
const emailService = require('../services/email-service');

async function main() {
  const to = process.argv[2] || 'test@example.com';
  console.log('Host:', process.env.SMTP_HOST);
  console.log('User:', process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 4)}…` : '(vuoto)');
  console.log('Configurato:', emailService.isConfigured());
  console.log('Modalità:', emailService.resolveDeliveryMode());

  const verify = await emailService.verifyConnection();
  console.log('Verify:', verify);

  if (!verify.ok) {
    console.log('\n→ Configura .env con credenziali reali (Mailtrap Sandbox o Gmail).');
    console.log('→ Sandbox: https://mailtrap.io/sandboxes → Integration → SMTP');
    process.exit(1);
  }

  const token = emailService.generateVerificationToken();
  const result = await emailService.sendVerificationLink(to, token, 'Test EVIL');
  console.log('\nInvio test:', result);
  if (result.delivery === 'sandbox') {
    console.log('\n✓ Email in Mailtrap Sandbox (NON nella casella reale): https://mailtrap.io/sandboxes');
  }
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
