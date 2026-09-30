'use strict';
/**
 * Unico punto che decide in che ambiente gira il server.
 *
 * Le funzioni di comodo per lo sviluppo (CORS aperto, /__debug/files, stack trace,
 * email salvate su file, diagnostica SMTP senza chiave) si accendono SOLO con
 * NODE_ENV=development esplicito. Qualunque altro valore, compresa la variabile
 * assente o scritta male, vale come produzione: una configurazione dimenticata
 * chiude invece di aprire.
 */

function nodeEnv() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase();
}

function isDevelopment() {
  return nodeEnv() === 'development';
}

function isTest() {
  return nodeEnv() === 'test';
}

function isProduction() {
  return !isDevelopment() && !isTest();
}

/** Etichetta leggibile per log e /api/health. */
function describeEnv() {
  const raw = nodeEnv();
  if (!raw) return 'production (NODE_ENV non impostato)';
  if (raw === 'development' || raw === 'test' || raw === 'production') return raw;
  return `production (NODE_ENV=${raw} non riconosciuto)`;
}

module.exports = { nodeEnv, isDevelopment, isTest, isProduction, describeEnv };
