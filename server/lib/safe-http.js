'use strict';
/**
 * Richieste in uscita verso destinazioni scelte dagli utenti (anti-SSRF).
 *
 * Il controllo avviene nel momento in cui si apre la connessione (lookup DNS
 * dell'agent), quindi vale anche per ogni redirect e non è aggirabile con il
 * DNS rebinding. Gli host scritti come IP letterale non passano dal lookup:
 * per quelli, e per i redirect, c'è un controllo esplicito sull'URL.
 */
const dns = require('dns');
const net = require('net');
const http = require('http');
const https = require('https');
const tls = require('tls');
const axios = require('axios');
const ipaddr = require('ipaddr.js');

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.intranet', '.corp'];
const DEFAULT_ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

class BlockedDestinationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BlockedDestinationError';
    this.code = 'EVIL_BLOCKED_DESTINATION';
    this.status = 400;
  }
}

/** Solo indirizzi unicast pubblici: niente reti private, loopback, link-local, CGNAT, riservati, multicast. */
function defaultIsPublicAddress(address) {
  if (!net.isIP(address)) return false;
  let parsed;
  try {
    parsed = ipaddr.process(address); // converte ::ffff:a.b.c.d in IPv4
  } catch {
    return false;
  }
  if (parsed.range() !== 'unicast') return false;
  if (parsed.kind() === 'ipv6') {
    // solo global unicast 2000::/3 (esclude ULA, link-local, 6to4, NAT64, Teredo… già filtrati da range())
    return parsed.match(ipaddr.parse('2000::'), 3);
  }
  return true;
}

const policy = {
  isPublicAddress: defaultIsPublicAddress,
  allowedPorts: DEFAULT_ALLOWED_PORTS,
  lookup: dns.lookup,
};

function isPublicAddress(address) {
  return policy.isPublicAddress(address);
}

function normalizeHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function assertHostnameAllowed(hostname) {
  const host = normalizeHost(hostname);
  if (!host) throw new BlockedDestinationError('Host mancante');
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new BlockedDestinationError('Host non consentito');
  }
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) {
      throw new BlockedDestinationError('Indirizzo di destinazione non consentito (rete privata o riservata)');
    }
    return host;
  }
  // Forme numeriche non canoniche (es. 2130706433, 0x7f.1): getaddrinfo le tradurrebbe in IP
  if (/^[0-9a-fx.]+$/i.test(host) && /^[0-9]/.test(host)) {
    throw new BlockedDestinationError('Host numerico non consentito');
  }
  return host;
}

function assertUrlAllowed(rawUrl) {
  let url;
  try {
    url = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl));
  } catch {
    throw new BlockedDestinationError('URL non valido');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BlockedDestinationError('Protocollo non consentito (solo http e https)');
  }
  if (url.username || url.password) {
    throw new BlockedDestinationError("Credenziali nell'URL non consentite");
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (policy.allowedPorts && !policy.allowedPorts.has(port)) {
    throw new BlockedDestinationError(`Porta ${port} non consentita (ammesse: 80, 443, 8080, 8443)`);
  }
  assertHostnameAllowed(url.hostname);
  return url;
}

/** lookup compatibile con net/http/tls: rifiuta se anche uno solo degli indirizzi non è pubblico. */
function safeLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const opts = typeof options === 'number' ? { family: options } : { ...(options || {}) };
  let host;
  try {
    host = assertHostnameAllowed(hostname);
  } catch (err) {
    process.nextTick(() => callback(err));
    return;
  }
  policy.lookup(host, { family: opts.family || 0, hints: opts.hints, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [];
    if (!list.length) {
      const e = new Error(`Nessun indirizzo per ${host}`);
      e.code = 'ENOTFOUND';
      return callback(e);
    }
    if (list.some((a) => !isPublicAddress(a.address))) {
      return callback(new BlockedDestinationError(`Il dominio ${host} risolve a un indirizzo privato o riservato`));
    }
    if (opts.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

/** Risolve e verifica subito la destinazione (errore chiaro prima di iniziare la scansione). */
function assertPublicDestination(rawUrl) {
  const url = assertUrlAllowed(rawUrl);
  return new Promise((resolve, reject) => {
    safeLookup(url.hostname, { all: true }, (err) => (err ? reject(err) : resolve(url)));
  });
}

const httpAgent = new http.Agent({ lookup: safeLookup, keepAlive: false });
const httpsAgent = new https.Agent({ lookup: safeLookup, keepAlive: false });

function checkRedirect(options) {
  const protocol = options.protocol || 'http:';
  const host = options.hostname || options.host || '';
  const port = options.port ? `:${options.port}` : '';
  const bracketed = net.isIPv6(normalizeHost(host)) ? `[${normalizeHost(host)}]` : host;
  assertUrlAllowed(`${protocol}//${bracketed}${port}/`);
}

const client = axios.create({
  httpAgent,
  httpsAgent,
  proxy: false, // con un proxy la connessione andrebbe al proxy e il controllo non avrebbe effetto
  timeout: 12000,
  maxRedirects: 5,
  maxContentLength: 2 * 1024 * 1024,
  maxBodyLength: 64 * 1024,
  beforeRedirect: checkRedirect,
});

// URL relativi non devono mai arrivare qui: ogni chiamata deve avere un URL assoluto verificabile
client.interceptors.request.use((config) => {
  assertUrlAllowed(config.url);
  return config;
});

/** tls.connect verso host scelti dall'utente */
function connectTls(host, port, options = {}) {
  assertHostnameAllowed(host);
  return tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, lookup: safeLookup, ...options });
}

/** net.connect verso host esterni (es. WHOIS porta 43) */
function connectTcp(host, port, onConnect) {
  assertHostnameAllowed(host);
  return net.createConnection({ host, port, lookup: safeLookup }, onConnect);
}

/** true se l'errore (o una sua causa, per esempio dentro un redirect) è un blocco anti-SSRF */
function isBlockedError(err) {
  let cur = err;
  for (let depth = 0; cur && depth < 6; depth++) {
    if (cur.code === 'EVIL_BLOCKED_DESTINATION' || cur instanceof BlockedDestinationError) return true;
    cur = cur.cause;
  }
  return false;
}

/** Messaggio leggibile per l'utente, anche quando il blocco avviene in un redirect */
function blockedMessage(err) {
  let cur = err;
  for (let depth = 0; cur && depth < 6; depth++) {
    if (cur.code === 'EVIL_BLOCKED_DESTINATION') return cur.message;
    cur = cur.cause;
  }
  return 'Destinazione non consentita';
}

/** Solo per i test automatici (NODE_ENV=test): permette di usare server locali. */
function configureForTests(overrides = {}) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('configureForTests è disponibile solo con NODE_ENV=test');
  }
  if ('isPublicAddress' in overrides) policy.isPublicAddress = overrides.isPublicAddress || defaultIsPublicAddress;
  if ('allowedPorts' in overrides) policy.allowedPorts = overrides.allowedPorts;
  if ('lookup' in overrides) policy.lookup = overrides.lookup || dns.lookup;
}

function resetForTests() {
  policy.isPublicAddress = defaultIsPublicAddress;
  policy.allowedPorts = DEFAULT_ALLOWED_PORTS;
  policy.lookup = dns.lookup;
}

module.exports = {
  axios: client,
  httpAgent,
  httpsAgent,
  safeLookup,
  connectTls,
  connectTcp,
  assertUrlAllowed,
  assertHostnameAllowed,
  assertPublicDestination,
  isPublicAddress,
  defaultIsPublicAddress,
  isBlockedError,
  blockedMessage,
  BlockedDestinationError,
  configureForTests,
  resetForTests,
};
