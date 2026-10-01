'use strict';
/**
 * Origini ammesse per le chiamate da browser (CORS) e per il WebSocket del feed incidenti.
 * Stessa logica in un solo posto: elenco CORS_ORIGINS + BASE_URL + RENDER_EXTERNAL_URL,
 * più la stessa origine della richiesta.
 */

const { isProduction, isDevelopment } = require('../../utils/env');

const DEFAULT_ORIGINS = 'https://www.projectevil.it,https://projectevil.it';
// Solo in sviluppo: in produzione un'origine localhost con i cookie di sessione
// permetterebbe a qualunque server in ascolto sul PC dell'utente di leggere le API (S-07).
const DEV_ORIGINS = 'http://localhost:5000,http://127.0.0.1:5000';

function isLocalOrigin(origin) {
  try {
    const host = new URL(origin).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host) || host === '0.0.0.0';
  } catch (_) {
    return false;
  }
}

function toOrigin(raw) {
  if (!raw || !String(raw).trim()) return null;
  try {
    const normalized = String(raw).trim().replace(/\/$/, '');
    const withScheme = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
    return new URL(withScheme).origin;
  } catch (_) {
    return null;
  }
}

function allowedOrigins() {
  const configured = process.env.CORS_ORIGINS || (isDevelopment() ? `${DEFAULT_ORIGINS},${DEV_ORIGINS}` : DEFAULT_ORIGINS);
  const origins = new Set(
    configured
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      // "*" con i cookie di sessione equivarrebbe a fidarsi di qualunque sito: ignorato
      .filter((o) => o && o !== '*')
  );
  for (const raw of [process.env.BASE_URL, process.env.RENDER_EXTERNAL_URL]) {
    const origin = toOrigin(raw);
    if (origin) origins.add(origin);
  }
  // in produzione le origini locali sono ignorate anche se scritte in CORS_ORIGINS o BASE_URL
  if (isProduction()) {
    for (const o of [...origins]) if (isLocalOrigin(o)) origins.delete(o);
  }
  return origins;
}

function wildcardConfigured() {
  return (process.env.CORS_ORIGINS || '').split(',').some((o) => o.trim() === '*');
}

/**
 * @param {string|undefined} origin header Origin della richiesta
 * @param {string|undefined} requestHost header Host della richiesta
 */
function isOriginAllowed(origin, requestHost) {
  if (!origin) return true; // richieste non da browser o stessa origine senza header
  if (allowedOrigins().has(origin)) return true;
  try {
    const originHost = new URL(origin).host;
    return Boolean(originHost && requestHost && originHost === requestHost);
  } catch (_) {
    return false;
  }
}

module.exports = { allowedOrigins, isOriginAllowed, wildcardConfigured, isLocalOrigin };
