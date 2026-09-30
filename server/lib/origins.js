'use strict';
/**
 * Origini ammesse per le chiamate da browser (CORS) e per il WebSocket del feed incidenti.
 * Stessa logica in un solo posto: elenco CORS_ORIGINS + BASE_URL + RENDER_EXTERNAL_URL,
 * più la stessa origine della richiesta.
 */

const DEFAULT_ORIGINS =
  'https://www.projectevil.it,https://projectevil.it,http://localhost:5000,http://127.0.0.1:5000';

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
  const origins = new Set(
    (process.env.CORS_ORIGINS || DEFAULT_ORIGINS)
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      // "*" con i cookie di sessione equivarrebbe a fidarsi di qualunque sito: ignorato
      .filter((o) => o && o !== '*')
  );
  for (const raw of [process.env.BASE_URL, process.env.RENDER_EXTERNAL_URL]) {
    const origin = toOrigin(raw);
    if (origin) origins.add(origin);
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

module.exports = { allowedOrigins, isOriginAllowed, wildcardConfigured };
