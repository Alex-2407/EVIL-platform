'use strict';
/**
 * Diplomi verificabili EVIL.
 *
 * Emissione interna (nessuna rotta pubblica): firma Ed25519 su un testo
 * canonico, codice leggibile, impronta grafica deterministica e QR verso
 * la pagina di verifica. La chiave privata non esce mai dal server.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { isProduction } = require('../../utils/env');

const VERSION = 1;
const HOLDER_HEX_LEN = 32;
const KEY_ID_LEN = 16;
// Alfabeto senza 0/O/1/I/L, per un codice dettato al telefono
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const PREFIX_RE = /^[A-Z0-9]{2,8}$/;
const CODE_RE = new RegExp(`^EVIL-[A-Z0-9]{2,8}(?:-[${ALPHABET}]{4}){3}$`);
const PALETTE = ['#f59e0b', '#00ff9c', '#7dd3fc', '#c4b5fd'];
const FP_SIZE = 480;

let cachedKey = undefined; // { privateKey, publicKey, publicKeyPem, keyId } | null
let codeIndex = null; // Map<code, { userId, certificate }>
let indexUsersRef = null;
const issueQueues = new Map();

function dataDir() {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  return path.join(path.resolve(__dirname, '..', '..'), 'data');
}

function keyFilePath() {
  return path.join(dataDir(), 'cert-signing-key.pem');
}

function log(logger, level, msg, meta) {
  if (logger && typeof logger[level] === 'function') logger[level](msg, meta);
  else if (level === 'error') console.error(msg);
  else console.warn(msg);
}

function parsePrivateKey(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  s = s.replace(/\\n/g, '\n').trim();
  try {
    if (s.includes('BEGIN')) return crypto.createPrivateKey(s);
    const buf = Buffer.from(s.replace(/\s/g, ''), 'base64');
    if (!buf.length) return null;
    const asText = buf.toString('utf8');
    if (asText.includes('BEGIN')) return crypto.createPrivateKey(asText);
    return crypto.createPrivateKey({ key: buf, format: 'der', type: 'pkcs8' });
  } catch {
    return null;
  }
}

function keyIdOf(publicKey) {
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, KEY_ID_LEN);
}

function wrapKey(privateKey) {
  const publicKey = crypto.createPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    keyId: keyIdOf(publicKey),
  };
}

function generateAndSaveDevKey(logger) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const file = keyFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, pem, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* su Windows i permessi POSIX non si applicano */
  }
  log(logger, 'info', `Diplomi verificabili: generata chiave Ed25519 di sviluppo in ${file}`);
  return wrapKey(pair.privateKey);
}

/**
 * Carica (e in sviluppo genera) la coppia Ed25519.
 * In produzione, senza CERT_SIGNING_KEY, restituisce null e non emette diplomi.
 */
function loadSigningKey(opts = {}) {
  if (cachedKey !== undefined) return cachedKey;
  const logger = opts.logger;

  const fromEnv = parsePrivateKey(process.env.CERT_SIGNING_KEY);
  if (fromEnv) {
    cachedKey = wrapKey(fromEnv);
    return cachedKey;
  }

  if (isProduction()) {
    log(
      logger,
      'error',
      'Diplomi verificabili: CERT_SIGNING_KEY mancante. In produzione i diplomi non vengono emessi. ' +
        'Imposta CERT_SIGNING_KEY su Render (PEM PKCS8 Ed25519, anche in base64). ' +
        'La chiave privata non deve mai uscire dal server.'
    );
    cachedKey = null;
    return null;
  }

  const file = keyFilePath();
  if (fs.existsSync(file)) {
    const pem = fs.readFileSync(file, 'utf8');
    const key = parsePrivateKey(pem);
    if (key) {
      cachedKey = wrapKey(key);
      return cachedKey;
    }
    log(logger, 'warn', `Diplomi verificabili: ${file} non è una chiave PKCS8 valida, ne genero una nuova`);
  }

  cachedKey = generateAndSaveDevKey(logger);
  return cachedKey;
}

function publicKeyInfo(opts = {}) {
  const key = loadSigningKey(opts);
  if (!key) return null;
  return { algorithm: 'Ed25519', keyId: key.keyId, publicKeyPem: key.publicKeyPem };
}

function previousPublicKeys(opts = {}) {
  const raw = opts.previousPublicKeys === undefined
    ? process.env.CERT_PREVIOUS_PUBLIC_KEYS
    : opts.previousPublicKeys;
  if (!raw) return new Map();
  let entries;
  try {
    entries = Array.isArray(raw) ? raw : JSON.parse(String(raw));
  } catch (err) {
    log(opts.logger, 'error', 'CERT_PREVIOUS_PUBLIC_KEYS non contiene JSON valido', { error: err.message });
    return new Map();
  }
  if (!Array.isArray(entries)) {
    log(opts.logger, 'error', 'CERT_PREVIOUS_PUBLIC_KEYS deve essere un array JSON');
    return new Map();
  }

  const keys = new Map();
  for (const entry of entries) {
    try {
      if (!entry || typeof entry.keyId !== 'string' || !/^[a-f0-9]{16}$/i.test(entry.keyId) ||
          typeof entry.publicKeyPem !== 'string' || !entry.publicKeyPem.includes('BEGIN PUBLIC KEY')) {
        throw new Error('voce non valida (richiesti keyId e publicKeyPem)');
      }
      const publicKey = crypto.createPublicKey(entry.publicKeyPem);
      if (publicKey.type !== 'public' || keyIdOf(publicKey) !== entry.keyId.toLowerCase()) {
        throw new Error('keyId non corrisponde alla chiave pubblica');
      }
      keys.set(entry.keyId.toLowerCase(), publicKey);
    } catch (err) {
      log(opts.logger, 'error', 'Voce non valida in CERT_PREVIOUS_PUBLIC_KEYS', { error: err.message });
    }
  }
  return keys;
}

function normalizePrefix(raw, courseId) {
  const fromArg = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (PREFIX_RE.test(fromArg)) return fromArg;
  const fromCourse = String(courseId || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  if (PREFIX_RE.test(fromCourse)) return fromCourse;
  return 'CRS';
}

function randomGroup() {
  const bytes = crypto.randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function generateCode(prefix) {
  return `EVIL-${prefix}-${randomGroup()}-${randomGroup()}-${randomGroup()}`;
}

function holderOf(userId, code) {
  return crypto.createHash('sha256').update(String(userId) + String(code), 'utf8').digest('hex').slice(0, HOLDER_HEX_LEN);
}

function courseTitleOf(input) {
  const src = input && typeof input === 'object' ? input : {};
  const it = String(src.it || src.en || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const en = String(src.en || src.it || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!it) throw Object.assign(new Error('Titolo del corso mancante'), { code: 'CERT_BAD_INPUT' });
  return { it, en: en || it };
}

/** Testo firmato: ordine dei campi fisso, UTF-8, LF, senza newline finale. */
function canonicalText(record) {
  const titles = record.courseTitle || {};
  return [
    `v=${record.version}`,
    `code=${record.code}`,
    `course=${record.courseId}`,
    `courseTitle.it=${titles.it || ''}`,
    `courseTitle.en=${titles.en || ''}`,
    `name=${record.name}`,
    `issuedAt=${record.issuedAt}`,
    `score=${record.score}`,
    `holder=${record.holder}`,
  ].join('\n');
}

function rebuildIndex(db) {
  const map = new Map();
  const users = (db && db.users) || [];
  for (const user of users) {
    for (const certificate of user.certificates || []) {
      if (certificate && certificate.code) map.set(String(certificate.code).toUpperCase(), { userId: user.id, certificate });
    }
  }
  codeIndex = map;
  indexUsersRef = users;
  return map;
}

function ensureIndex(db) {
  if (!codeIndex || indexUsersRef !== db.users) rebuildIndex(db);
  return codeIndex;
}

function findByCode(db, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!CODE_RE.test(normalized)) return null;
  ensureIndex(db);
  let hit = codeIndex.get(normalized);
  if (!hit) {
    rebuildIndex(db);
    hit = codeIndex.get(normalized);
  }
  if (!hit) return null;
  const user = db.findById(hit.userId);
  if (!user) return null;
  const certificate = (user.certificates || []).find((c) => c.code === hit.certificate.code) || hit.certificate;
  return { user, certificate };
}

function signRecord(record, key) {
  const signedText = canonicalText(record);
  const signature = crypto.sign(null, Buffer.from(signedText, 'utf8'), key.privateKey);
  return { signedText, signature: signature.toString('base64') };
}

function verifyRecord(record, opts = {}) {
  const signedText = record ? canonicalText(record) : '';
  if (!record || !record.signature) return { valid: false, signedText, reason: 'missing' };
  const key = loadSigningKey(opts);
  const previous = previousPublicKeys(opts);
  const publicKey = key && record.keyId === key.keyId
    ? key.publicKey
    : previous.get(String(record.keyId || '').toLowerCase());
  if (!publicKey) return { valid: false, signedText, reason: key || previous.size ? 'wrong-key' : 'no-key' };
  let sig;
  try {
    sig = Buffer.from(record.signature, 'base64');
  } catch {
    return { valid: false, signedText, reason: 'bad-signature' };
  }
  if (sig.length !== 64) return { valid: false, signedText, reason: 'bad-signature' };
  try {
    const valid = crypto.verify(null, Buffer.from(signedText, 'utf8'), publicKey, sig);
    return { valid, signedText };
  } catch {
    return { valid: false, signedText, reason: 'bad-signature' };
  }
}

function xorshift(seedBuf) {
  let s0 = seedBuf.readUInt32BE(0) || 1;
  let s1 = seedBuf.readUInt32BE(4) || 2;
  let s2 = seedBuf.readUInt32BE(8) || 3;
  let s3 = seedBuf.readUInt32BE(12) || 4;
  return function next() {
    let t = (s0 + s1) >>> 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + ((s2 << 3) >>> 0)) >>> 0;
    s2 = ((s3 << 21) | (s3 >>> 11)) >>> 0;
    s3 = (t + (((s3 << 13) | (s3 >>> 19)) >>> 0)) >>> 0;
    return (s3 >>> 0) / 4294967296;
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function polyline(points, close) {
  if (!points.length) return '';
  let d = `M ${round2(points[0][0])} ${round2(points[0][1])}`;
  for (let i = 1; i < points.length; i += 1) d += ` L ${round2(points[i][0])} ${round2(points[i][1])}`;
  if (close) d += ' Z';
  return d;
}

function hypotrochoid(cx, cy, R, r, dist, turns, steps) {
  const pts = [];
  const max = Math.PI * 2 * turns;
  const k = r === 0 ? 1 : (R - r) / r;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * max;
    pts.push([
      cx + (R - r) * Math.cos(t) + dist * Math.cos(k * t),
      cy + (R - r) * Math.sin(t) - dist * Math.sin(k * t),
    ]);
  }
  return polyline(pts, false);
}

function epitrochoid(cx, cy, R, r, dist, turns, steps) {
  const pts = [];
  const max = Math.PI * 2 * turns;
  const k = r === 0 ? 1 : (R + r) / r;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * max;
    pts.push([
      cx + (R + r) * Math.cos(t) - dist * Math.cos(k * t),
      cy + (R + r) * Math.sin(t) - dist * Math.sin(k * t),
    ]);
  }
  return polyline(pts, false);
}

function edgeWaves(rng, size, inset) {
  const paths = [];
  const amp = 5 + rng() * 7;
  const freq = 5 + Math.floor(rng() * 5);
  const phase = rng() * Math.PI * 2;
  const steps = 80;
  const span = size - inset * 2;

  function wave(axis, fixed, reverse) {
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const u = i / steps;
      const along = inset + (reverse ? 1 - u : u) * span;
      const off = Math.sin(u * Math.PI * 2 * freq + phase) * amp;
      pts.push(axis === 'x' ? [along, fixed + off] : [fixed + off, along]);
    }
    return polyline(pts, false);
  }

  paths.push(wave('x', inset, false));
  paths.push(wave('y', size - inset, false));
  paths.push(wave('x', size - inset, true));
  paths.push(wave('y', inset, true));
  return paths;
}

function glyphsOnCircle(text, cx, cy, r) {
  const chars = Array.from(text);
  const n = Math.max(chars.length, 1);
  return chars.map((ch, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      ch,
      x: round2(cx + r * Math.cos(a)),
      y: round2(cy + r * Math.sin(a)),
      deg: round2(((a + Math.PI / 2) * 180) / Math.PI),
    };
  });
}

/**
 * Impronta grafica in stile banconota. Stessa firma → stesso disegno.
 * Seme: SHA-512 della firma (base64 o bytes).
 */
function fingerprint(signature) {
  let raw;
  if (Buffer.isBuffer(signature)) raw = signature;
  else if (typeof signature === 'string') {
    raw = /^[A-Za-z0-9+/]+=*$/.test(signature.replace(/\s/g, ''))
      ? Buffer.from(signature.replace(/\s/g, ''), 'base64')
      : Buffer.from(signature, 'utf8');
  } else {
    raw = Buffer.from(String(signature || ''), 'utf8');
  }
  const seed = crypto.createHash('sha512').update(raw).digest();
  const rng = xorshift(seed);
  const cx = FP_SIZE / 2;
  const cy = FP_SIZE / 2;

  const i1 = Math.floor(rng() * PALETTE.length);
  let i2 = Math.floor(rng() * PALETTE.length);
  if (i2 === i1) i2 = (i1 + 1) % PALETTE.length;
  const primary = PALETTE[i1];
  const secondary = PALETTE[i2];

  const paths = [];
  const layers = 7 + Math.floor(rng() * 3);
  for (let n = 0; n < layers; n += 1) {
    const R = 70 + rng() * 110;
    const r = 12 + rng() * 38;
    const dist = 8 + rng() * 42;
    const turns = 3 + Math.floor(rng() * 6);
    const steps = 360 + Math.floor(rng() * 120);
    const d = rng() > 0.45
      ? hypotrochoid(cx, cy, R, r, dist, turns, steps)
      : epitrochoid(cx, cy, R, r, dist, turns, steps);
    paths.push({
      d,
      stroke: n % 2 === 0 ? primary : secondary,
      width: round2(0.35 + rng() * 0.55),
      opacity: round2(0.42 + rng() * 0.5),
    });
  }

  const waveColor = rng() > 0.5 ? primary : secondary;
  for (const d of edgeWaves(rng, FP_SIZE, 18)) {
    paths.push({ d, stroke: waveColor, width: 1.1, opacity: 0.85 });
  }

  const microR = 198;
  const circleD = `M ${cx - microR} ${cy} a ${microR} ${microR} 0 1 1 ${microR * 2} 0 a ${microR} ${microR} 0 1 1 ${-microR * 2} 0`;

  return {
    viewBox: `0 0 ${FP_SIZE} ${FP_SIZE}`,
    size: FP_SIZE,
    colors: { primary, secondary },
    paths,
    microCircle: { d: circleD, cx, cy, r: microR },
  };
}

function microtextFor(name, code) {
  const unit = `${String(name || '').trim()} · ${code} · EVIL · `;
  return unit.repeat(6).slice(0, 220);
}

async function qrSvg(url) {
  return QRCode.toString(String(url), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#05070b', light: '#00000000' },
  });
}

function qrMatrix(url) {
  const qr = QRCode.create(String(url), { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const cells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(y, x)) cells.push([x, y]);
    }
  }
  return { size, cells };
}

async function issueCertificateNow({ db, user, courseId, courseTitle, name, score, prefix, logger } = {}) {
  if (!db || !user || !user.id) {
    throw Object.assign(new Error('Utente mancante per il diploma'), { code: 'CERT_BAD_INPUT' });
  }
  user = typeof db.findById === 'function' ? db.findById(user.id) || user : user;
  const cid = String(courseId || '').trim().slice(0, 80);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(cid)) {
    throw Object.assign(new Error('Codice corso non valido per il diploma'), { code: 'CERT_BAD_INPUT' });
  }

  const existing = (user.certificates || []).find((c) => c.courseId === cid);
  if (existing) return existing;

  const key = loadSigningKey({ logger });
  if (!key) {
    throw Object.assign(
      new Error('Impossibile emettere il diploma: chiave di firma assente in produzione (CERT_SIGNING_KEY).'),
      { code: 'CERT_UNAVAILABLE' }
    );
  }

  const titles = courseTitleOf(courseTitle);
  const holderName = String(name || user.name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (holderName.length < 2) {
    throw Object.assign(new Error('Nome mancante per il diploma'), { code: 'CERT_BAD_INPUT' });
  }
  const scoreN = Math.round(Number(score));
  if (!Number.isFinite(scoreN) || scoreN < 0 || scoreN > 100) {
    throw Object.assign(new Error('Punteggio non valido per il diploma'), { code: 'CERT_BAD_INPUT' });
  }

  const pre = normalizePrefix(prefix, cid);
  ensureIndex(db);
  let code = generateCode(pre);
  let guard = 0;
  while (codeIndex.has(code) && guard < 12) {
    code = generateCode(pre);
    guard += 1;
  }
  if (codeIndex.has(code)) {
    throw Object.assign(new Error('Impossibile generare un codice diploma univoco'), { code: 'CERT_CODE_GENERATION_FAILED' });
  }

  const issuedAt = new Date().toISOString();
  const record = {
    version: VERSION,
    code,
    courseId: cid,
    courseTitle: titles,
    name: holderName,
    issuedAt,
    score: scoreN,
    holder: holderOf(user.id, code),
    keyId: key.keyId,
  };
  const signed = signRecord(record, key);
  record.signature = signed.signature;

  user.certificates = Array.isArray(user.certificates) ? user.certificates : [];
  user.certificates.push(record);
  await db.save(user);
  ensureIndex(db);
  codeIndex.set(code, { userId: user.id, certificate: record });
  return record;
}

function issueCertificate(args = {}) {
  const userId = args.user && args.user.id;
  if (!userId) return issueCertificateNow(args);
  const lockKey = `${userId}:${String(args.courseId || '')}`;
  const previous = issueQueues.get(lockKey) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => issueCertificateNow(args));
  issueQueues.set(lockKey, current);
  return current.finally(() => {
    if (issueQueues.get(lockKey) === current) issueQueues.delete(lockKey);
  });
}

function titleInLang(certificate, lang) {
  const t = (certificate && certificate.courseTitle) || {};
  return lang === 'en' ? t.en || t.it || '' : t.it || t.en || '';
}

function publicCertificate(certificate, lang) {
  return {
    code: certificate.code,
    courseId: certificate.courseId,
    courseTitle: titleInLang(certificate, lang),
    name: certificate.name,
    issuedAt: certificate.issuedAt,
    score: certificate.score,
  };
}

module.exports = {
  VERSION,
  CODE_RE,
  ALPHABET,
  loadSigningKey,
  publicKeyInfo,
  issueCertificate,
  findByCode,
  verifyRecord,
  fingerprint,
  qrSvg,
  qrMatrix,
  canonicalText,
  microtextFor,
  glyphsOnCircle,
  publicCertificate,
  titleInLang,
};
