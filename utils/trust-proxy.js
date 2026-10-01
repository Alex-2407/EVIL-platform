'use strict';
/**
 * Di quali proxy fidarsi per leggere l'IP reale del visitatore (X-Forwarded-For).
 *
 * Prima, in produzione, il server si fidava del primo proxy per default: senza un proxy
 * davanti chiunque poteva scrivere X-Forwarded-For e cambiare IP a piacere (aggirando i
 * limiti di richieste). Ora la fiducia va dichiarata con TRUST_PROXY:
 *
 *   TRUST_PROXY non impostata, 0, false  nessun proxy: conta l'IP della connessione
 *   TRUST_PROXY=1 (o 2, 3...)            numero di proxy davanti al server (Render: 1)
 *   TRUST_PROXY=10.0.0.0/8,192.168.1.10  elenco di IP/CIDR dei proxy fidati
 *                                        (anche i nomi di Express: loopback, linklocal, uniquelocal)
 *   TRUST_PROXY=true                      trattato come 1 (fidarsi di qualunque proxy non è ammesso)
 *
 * La stessa regola vale per Express (app.set('trust proxy')) e per le richieste "grezze"
 * del WebSocket (clientIpFromRequest).
 */
const proxyAddr = require('proxy-addr');

const NAMED = new Set(['loopback', 'linklocal', 'uniquelocal']);

/**
 * @returns {{ value: false|number|string[], error: string|null, raw: string }}
 *   value è il valore da passare a app.set('trust proxy', …)
 */
function parseTrustProxy(raw = process.env.TRUST_PROXY) {
  const s = String(raw ?? '').trim();
  const lower = s.toLowerCase();
  if (!s || lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') {
    return { value: false, error: null, raw: s };
  }
  if (lower === 'true' || lower === 'yes' || lower === 'on') return { value: 1, error: null, raw: s };
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 10) return { value: n, error: null, raw: s };
    return { value: false, error: `TRUST_PROXY=${s}: il numero di proxy deve essere tra 1 e 10`, raw: s };
  }
  const list = s.split(',').map((x) => x.trim()).filter(Boolean);
  for (const item of list) {
    if (NAMED.has(item.toLowerCase())) continue;
    try {
      proxyAddr.compile(item);
    } catch (err) {
      return { value: false, error: `TRUST_PROXY: "${item}" non è un IP o una rete CIDR valida`, raw: s };
    }
  }
  return { value: list.map((x) => (NAMED.has(x.toLowerCase()) ? x.toLowerCase() : x)), error: null, raw: s };
}

function trustProxySetting() {
  return parseTrustProxy().value;
}

function trustProxyEnabled() {
  return trustProxySetting() !== false;
}

/** Descrizione per il log di avvio e per check-deployment. */
function describeTrustProxy() {
  const { value, error } = parseTrustProxy();
  if (error) return `disattivato (${error})`;
  if (value === false) return 'disattivato: conta l\'IP della connessione (X-Forwarded-For ignorato)';
  if (typeof value === 'number') return `${value} proxy fidat${value === 1 ? 'o' : 'i'} davanti al server`;
  return `proxy fidati: ${value.join(', ')}`;
}

let compiled = { raw: null, fn: null };
function trustFn() {
  const raw = String(process.env.TRUST_PROXY ?? '');
  if (compiled.raw !== raw) {
    const { value } = parseTrustProxy(raw);
    let fn;
    if (value === false) fn = () => false;
    else if (typeof value === 'number') fn = (addr, i) => i < value;
    else fn = proxyAddr.compile(value);
    compiled = { raw, fn };
  }
  return compiled.fn;
}

/**
 * IP del client per una richiesta Node "grezza" (per esempio l'upgrade del WebSocket),
 * con le stesse regole di fiducia di Express.
 * @param {import('http').IncomingMessage} request
 */
function clientIpFromRequest(request) {
  try {
    if (!request?.socket) return 'unknown';
    // proxy-addr legge req.connection (alias storico di req.socket)
    const req = request.connection ? request : { headers: request.headers || {}, connection: request.socket };
    return proxyAddr(req, trustFn()) || 'unknown';
  } catch (_) {
    return request?.socket?.remoteAddress || 'unknown';
  }
}

module.exports = {
  parseTrustProxy,
  trustProxySetting,
  trustProxyEnabled,
  describeTrustProxy,
  clientIpFromRequest,
};
