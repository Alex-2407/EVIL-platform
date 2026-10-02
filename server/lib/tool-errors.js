'use strict';
/**
 * Messaggi di errore degli strumenti comprensibili per chi li usa.
 * Prima uscivano i messaggi tecnici della libreria di rete, in inglese
 * ("getaddrinfo ENOTFOUND", "timeout of 12000ms exceeded", "Scan failed due to internal error").
 */
const { isBlockedError, blockedMessage } = require('./safe-http');

// Segna i testi per `node scripts/i18n.js extract-server`: la route li traduce con req.t(error)
const t = (s) => s;

// Messaggi già scritti per l'utente dai servizi (validazione, dati non trovati)
const USER_MESSAGE = /(non valid|obbligator|troppo lung|non trovat|non risolt|vuot)/i;

function errorCode(err) {
  return String(err?.code || err?.cause?.code || '');
}

/**
 * @param {Error} err
 * @returns {{ status: number, error: string, internal: boolean }}
 */
function toolError(err) {
  const msg = String(err?.message || '');
  const code = errorCode(err);
  if (isBlockedError(err)) return { status: 400, error: blockedMessage(err), internal: false };
  if (USER_MESSAGE.test(msg)) return { status: 400, error: msg, internal: false };
  if (/restringi/i.test(msg)) return { status: 502, error: msg, internal: false };
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /ENOTFOUND|EAI_AGAIN/.test(msg)) {
    return { status: 400, error: t('Dominio inesistente o non raggiungibile.'), internal: false };
  }
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(msg)) {
    return { status: 502, error: t('Il server del sito ha rifiutato la connessione.'), internal: false };
  }
  if (code === 'ECONNRESET' || /ECONNRESET|socket hang up/i.test(msg)) {
    return { status: 502, error: t('La connessione è stata interrotta dal sito.'), internal: false };
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || /timeout|timed out/i.test(msg)) {
    return { status: 504, error: t('Il sito non ha risposto in tempo. Riprova tra poco.'), internal: false };
  }
  if (/CERT|SSL|TLS|self[- ]signed|unable to verify/i.test(`${msg} ${code}`)) {
    return { status: 502, error: t('Connessione sicura (TLS) non riuscita: certificato non valido o protocollo non supportato.'), internal: false };
  }
  if (err instanceof TypeError && /Invalid URL/i.test(msg)) {
    return { status: 400, error: t('URL non valido: scrivilo per intero, per esempio https://esempio.it'), internal: false };
  }
  return { status: 500, error: t('Analisi non riuscita per un errore interno. Riprova tra poco.'), internal: true };
}

module.exports = { toolError };
