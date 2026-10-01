'use strict';
/**
 * Dati personali nei log: basta riconoscere un account, non serve l'indirizzo completo.
 *   maskEmail('giulia.neri@example.com') → 'gi***@example.com'
 */
function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

const SECRET_PARAMS = /([?&#](?:token|resetToken|refreshToken|key|code)=)[^&#\s]*/gi;

/** Toglie token e chiavi dalla query di un URL prima di scriverlo nei log. */
function maskUrlSecrets(url) {
  return String(url || '').replace(SECRET_PARAMS, '$1***');
}

/** Copia di un oggetto di dettagli con le email mascherate (campi email/to/recipient). */
function maskDetails(details) {
  if (!details || typeof details !== 'object') return details;
  const out = Array.isArray(details) ? [...details] : { ...details };
  for (const k of Object.keys(out)) {
    if (/^(email|to|recipient|newEmail|oldEmail)$/i.test(k) && typeof out[k] === 'string') out[k] = maskEmail(out[k]);
  }
  return out;
}

module.exports = { maskEmail, maskUrlSecrets, maskDetails };
