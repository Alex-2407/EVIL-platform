'use strict';
/**
 * Messaggi degli strumenti nella lingua della richiesta.
 *
 * - ToolInputError: errore di input già scritto per l'utente (e già tradotto) dai servizi.
 * - normalizeToolDomain: normalizza un nome di dominio e rifiuta i nomi interni
 *   (*.internal, *.corp, localhost…, S-12) con la stessa guardia anti-SSRF di safe-http.
 * - localizeToolMessage: traduce i messaggi italiani prodotti da server/lib/tool-errors.js
 *   e server/lib/safe-http.js (file comuni che non conoscono la lingua della richiesta).
 */
const { t } = require('../../server/i18n');
const { assertHostnameAllowed, isPublicAddress } = require('../../server/lib/safe-http');

class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolInputError';
    this.code = 'EVIL_TOOL_INPUT';
    this.status = 400;
    this.userFacing = true;
  }
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Dominio pulito (minuscolo, senza schema, porta e percorso) e consentito, oppure ToolInputError. */
function normalizeToolDomain(input, lang) {
  let d = String(input || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split('#')[0];
  d = d.replace(/^\[|\]$/g, '').split(':')[0].replace(/\.$/, '');
  if (!d || d.length > 253 || !DOMAIN_RE.test(d)) {
    throw new ToolInputError(t(lang, 'Dominio non valido: scrivi solo il nome, per esempio esempio.it'));
  }
  try {
    assertHostnameAllowed(d);
  } catch (_) {
    throw new ToolInputError(t(lang, 'Questo nome non è consentito: gli strumenti analizzano solo domini pubblici, non reti interne (localhost, .internal, .corp, .lan…).'));
  }
  return d;
}

/** Indirizzi da mostrare: quelli non pubblici (reti private, loopback…) non vengono esposti. */
function splitPublicAddresses(list) {
  const shown = [];
  let hidden = 0;
  for (const ip of list || []) {
    if (isPublicAddress(ip)) shown.push(ip);
    else hidden++;
  }
  return { shown, hidden };
}

/** Traduce i messaggi noti di tool-errors.js / safe-http.js; gli altri passano da t() così come sono. */
function localizeToolMessage(lang, msg) {
  const m = String(msg || '');
  switch (m) {
    case 'Dominio inesistente o non raggiungibile.': return t(lang, 'Dominio inesistente o non raggiungibile.');
    case 'Il server del sito ha rifiutato la connessione.': return t(lang, 'Il server del sito ha rifiutato la connessione.');
    case 'La connessione è stata interrotta dal sito.': return t(lang, 'La connessione è stata interrotta dal sito.');
    case 'Il sito non ha risposto in tempo. Riprova tra poco.': return t(lang, 'Il sito non ha risposto in tempo. Riprova tra poco.');
    case 'Connessione sicura (TLS) non riuscita: certificato non valido o protocollo non supportato.':
      return t(lang, 'Connessione sicura (TLS) non riuscita: certificato non valido o protocollo non supportato.');
    case 'URL non valido: scrivilo per intero, per esempio https://esempio.it':
      return t(lang, 'URL non valido: scrivilo per intero, per esempio https://esempio.it');
    case 'Analisi non riuscita per un errore interno. Riprova tra poco.':
      return t(lang, 'Analisi non riuscita per un errore interno. Riprova tra poco.');
    case 'Host mancante': return t(lang, 'Host mancante');
    case 'Host non consentito': return t(lang, 'Host non consentito');
    case 'Host numerico non consentito': return t(lang, 'Host numerico non consentito');
    case 'Indirizzo di destinazione non consentito (rete privata o riservata)':
      return t(lang, 'Indirizzo di destinazione non consentito (rete privata o riservata)');
    case 'URL non valido': return t(lang, 'URL non valido');
    case 'Protocollo non consentito (solo http e https)': return t(lang, 'Protocollo non consentito (solo http e https)');
    case "Credenziali nell'URL non consentite": return t(lang, "Credenziali nell'URL non consentite");
    case 'Destinazione non consentita': return t(lang, 'Destinazione non consentita');
    case 'File vuoto o non ricevuto': return t(lang, 'File vuoto o non ricevuto');
    default: break;
  }
  let r = /^Porta (\d+) non consentita \(ammesse: 80, 443, 8080, 8443\)$/.exec(m);
  if (r) return t(lang, 'Porta {port} non consentita (ammesse: 80, 443, 8080, 8443)', { port: r[1] });
  r = /^Il dominio (\S+) risolve a un indirizzo privato o riservato$/.exec(m);
  if (r) return t(lang, 'Il dominio {host} risolve a un indirizzo privato o riservato', { host: r[1] });
  return t(lang, m);
}

module.exports = { ToolInputError, normalizeToolDomain, splitPublicAddresses, localizeToolMessage };
