'use strict';
/**
 * Hash delle password con scrypt nativo di Node (S-03, S-11).
 *
 * Prima: bcryptjs con cost 12, cioè ~350 ms di CPU sul thread principale per ogni login
 * (JavaScript puro): pochi login in parallelo bloccavano tutto il sito. In più bcrypt
 * considera solo i primi 72 byte della password.
 *
 * Ora:
 * - crypto.scrypt gira nel threadpool di libuv, il thread principale resta libero;
 * - al massimo PASSWORD_HASH_CONCURRENCY calcoli insieme (default 2), gli altri in coda;
 *   se la coda è piena la richiesta riceve un errore "occupato" invece di accumularsi;
 * - parametri salvati nell'hash (scrypt$N$r$p$salt$hash): si possono alzare in futuro e gli
 *   hash vecchi vengono aggiornati al primo login riuscito;
 * - gli hash bcrypt esistenti restano validi: verificati con bcryptjs una volta e
 *   sostituiti subito con scrypt (migrazione trasparente);
 * - nessun limite di 72 byte (la lunghezza massima è 200 caratteri, controllata prima).
 *
 * Parametri di default: N=2^15, r=8, p=3 (32 MiB per calcolo), uno dei profili equivalenti
 * consigliati da OWASP (Password Storage Cheat Sheet). Variabili: SCRYPT_N, SCRYPT_R, SCRYPT_P.
 */
const crypto = require('crypto');
const { isTest } = require('../../utils/env');

const PREFIX = 'scrypt';
const KEYLEN = 64;
const SALT_BYTES = 16;
const BCRYPT_RE = /^\$2[abxy]?\$\d{2}\$/;

function envInt(name, fallback) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function isPowerOfTwo(n) {
  return n > 1 && (n & (n - 1)) === 0;
}

/** Parametri correnti (letti a ogni chiamata: i test possono cambiarli). */
function currentParams() {
  // nei test automatici un costo basso, salvo valori espliciti
  const fallbackN = isTest() ? 2 ** 10 : 2 ** 15;
  let N = envInt('SCRYPT_N', fallbackN);
  if (!isPowerOfTwo(N)) N = fallbackN;
  return { N, r: envInt('SCRYPT_R', 8), p: envInt('SCRYPT_P', isTest() ? 1 : 3) };
}

function maxmemFor({ N, r }) {
  // memoria richiesta ~128*N*r byte: margine doppio
  return 256 * N * r + 1024 * 1024;
}

// ---------------------------------------------------------------- coda di calcolo
class HashBusyError extends Error {
  constructor() {
    super('Troppe verifiche di password in corso');
    this.code = 'EVIL_HASH_BUSY';
  }
}

let running = 0;
const waiting = [];

function limits() {
  return {
    concurrency: envInt('PASSWORD_HASH_CONCURRENCY', 2),
    queue: envInt('PASSWORD_HASH_QUEUE', 64),
  };
}

function acquire() {
  const { concurrency, queue } = limits();
  if (running < concurrency) {
    running += 1;
    return Promise.resolve();
  }
  if (waiting.length >= queue) return Promise.reject(new HashBusyError());
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next(); // il posto passa direttamente al prossimo in coda
  else running = Math.max(0, running - 1);
}

async function limited(task) {
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
}

function scryptAsync(password, salt, params) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      String(password).normalize('NFC'),
      salt,
      KEYLEN,
      { N: params.N, r: params.r, p: params.p, maxmem: maxmemFor(params) },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
}

// ---------------------------------------------------------------- API
function parseScrypt(stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return null;
  const [, n, r, p, salt, hash] = parts;
  const params = { N: parseInt(n, 10), r: parseInt(r, 10), p: parseInt(p, 10) };
  if (!isPowerOfTwo(params.N) || !(params.r > 0) || !(params.p > 0)) return null;
  if (params.N > 2 ** 20 || params.r > 32 || params.p > 16) return null; // hash manomesso: niente DoS
  return { params, salt: Buffer.from(salt, 'base64'), hash: Buffer.from(hash, 'base64') };
}

function sameParams(a, b) {
  return a.N === b.N && a.r === b.r && a.p === b.p;
}

/** Nuovo hash scrypt della password. */
async function hashPassword(password) {
  const params = currentParams();
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await limited(() => scryptAsync(password, salt, params));
  return [PREFIX, params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Verifica una password.
 * @returns {Promise<{ ok: boolean, needsRehash: boolean, legacy: boolean }>}
 *   needsRehash: l'hash è bcrypt o ha parametri vecchi → va ricalcolato (solo se ok)
 */
async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || !stored) {
    return { ok: false, needsRehash: false, legacy: false };
  }
  const parsed = parseScrypt(stored);
  if (parsed) {
    const key = await limited(() => scryptAsync(password, parsed.salt, parsed.params));
    const ok = key.length === parsed.hash.length && crypto.timingSafeEqual(key, parsed.hash);
    return { ok, needsRehash: ok && !sameParams(parsed.params, currentParams()), legacy: false };
  }
  if (BCRYPT_RE.test(stored)) {
    // vecchi account: bcryptjs solo per verificare, poi l'hash diventa scrypt
    const bcrypt = require('bcryptjs');
    const ok = await limited(() => bcrypt.compare(password, stored));
    return { ok, needsRehash: ok, legacy: true };
  }
  return { ok: false, needsRehash: false, legacy: false };
}

// Hash fittizio: chi prova un'email inesistente aspetta quanto chi prova un'email esistente
let dummy = null;
function dummyHash() {
  const params = currentParams();
  if (!dummy || !sameParams(dummy.params, params)) {
    dummy = { params, promise: hashPassword(crypto.randomBytes(16).toString('hex')) };
  }
  return dummy.promise;
}

/** Stesso costo di una verifica vera, risultato sempre negativo. */
async function verifyDummy(password) {
  await verifyPassword(String(password || ''), await dummyHash());
  return { ok: false, needsRehash: false, legacy: false };
}

function isScryptHash(stored) {
  return Boolean(parseScrypt(stored));
}

function stats() {
  return { running, waiting: waiting.length, ...limits() };
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyDummy,
  dummyHash,
  isScryptHash,
  currentParams,
  HashBusyError,
  stats,
};
