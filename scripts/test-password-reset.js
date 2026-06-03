#!/usr/bin/env node
/**
 * Test flusso reset password — node scripts/test-password-reset.js <email> [nuova_password]
 */
require('dotenv').config();

const email = process.argv[2];
const newPassword = process.argv[3] || 'TestReset@2026Secure';

if (!email) {
  console.error('Uso: node scripts/test-password-reset.js <email> [nuova_password]');
  process.exit(1);
}

const base = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function main() {
  console.log('1. Richiesta reset per', email);
  const forgotRes = await fetch(`${base}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() })
  });
  const forgotData = await forgotRes.json();
  console.log('   Status:', forgotRes.status, forgotData);
  if (!forgotRes.ok) process.exit(1);

  const fs = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const usersFile = path.resolve(process.env.DB_FILE || './users.json');
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  const user = users.find((u) => u.email === email.trim().toLowerCase());
  if (!user || !user.passwordResetTokenHash) {
    console.error('   Utente non trovato o token reset non salvato.');
    process.exit(1);
  }

  console.log('2. Token reset presente (hash in DB). Per test completo serve il token in chiaro dall\'email.');
  console.log('   Se hai appena ricevuto l\'email, incolla il token dalla URL ?token=...');
  console.log('   Oppure esegui reset manuale con token da outbox/data/email-outbox');

  const outboxDir = path.join(process.cwd(), 'data', 'email-outbox');
  if (fs.existsSync(outboxDir)) {
    const files = fs.readdirSync(outboxDir).filter((f) => f.endsWith('.html')).sort().reverse();
    for (const file of files.slice(0, 5)) {
      const html = fs.readFileSync(path.join(outboxDir, file), 'utf8');
      const match = html.match(/reset-password\.html\?token=([a-f0-9]+)/i);
      if (match) {
        const token = match[1];
        console.log('3. Token trovato in outbox:', file);
        const resetRes = await fetch(`${base}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword, confirmPassword: newPassword })
        });
        const resetData = await resetRes.json();
        console.log('   Reset status:', resetRes.status, resetData);
        process.exit(resetRes.ok ? 0 : 1);
      }
    }
  }

  console.log('   Nessun token in outbox. Controlla la email e riprova con token manuale.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
