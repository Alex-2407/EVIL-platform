'use strict';
/**
 * Sessioni utente.
 *
 * - Access token JWT breve (1h) con id sessione (sid) e versione token (tv).
 * - Refresh token JWT (7 giorni) legato a una sessione salvata sull'utente
 *   (solo l'hash SHA-256, mai il token): sopravvive ai riavvii perché sta
 *   nell'archivio utenti, e funziona su più dispositivi (max 5 sessioni).
 * - Rotazione (S-10): a ogni rinnovo il refresh token cambia e il vecchio smette di
 *   valere. Per le schede aperte che rinnovano insieme, il token appena sostituito resta
 *   accettato per ROTATION_GRACE_MS (30 s, senza ruotare di nuovo); usato dopo, è il segno
 *   che qualcuno ne ha una copia: la sessione viene chiusa (rilevamento del riuso).
 *   Il token è in un cookie httpOnly/SameSite e sul server c'è solo il suo hash.
 * - Logout chiude la sessione corrente; reset password le chiude tutte e
 *   incrementa tokenVersion, invalidando anche gli access token già emessi.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = 'evil-platform';
const ACCESS_AUDIENCE = 'api';
const REFRESH_AUDIENCE = 'refresh';
const MAX_SESSIONS = 5;
const ROTATION_GRACE_MS = 30 * 1000;

function parseDurationMs(value, fallbackMs) {
  const m = String(value || '').trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return fallbackMs;
  const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2].toLowerCase()];
  return parseInt(m[1], 10) * unit;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function displayName(user) {
  return (user.name && String(user.name).trim()) || String(user.email || '').split('@')[0] || 'Utente';
}

function createSessionManager({ store, accessSecret, refreshSecret, accessTtl = '1h', refreshTtl = '7d', graceMs = ROTATION_GRACE_MS }) {
  if (!accessSecret || !refreshSecret) throw new Error('Segreti JWT mancanti');
  const accessMs = parseDurationMs(accessTtl, 3600000);
  const refreshMs = parseDurationMs(refreshTtl, 7 * 86400000);

  function activeSessions(user) {
    const now = Date.now();
    return (Array.isArray(user.sessions) ? user.sessions : []).filter((s) => s && s.expiresAt > now);
  }

  function findSession(user, sid) {
    return activeSessions(user).find((s) => s.id === sid) || null;
  }

  function signAccess(user, sid) {
    return jwt.sign(
      { id: user.id, email: user.email, name: displayName(user), sid, tv: user.tokenVersion || 0, type: 'access' },
      accessSecret,
      { algorithm: 'HS256', expiresIn: Math.floor(accessMs / 1000), issuer: ISSUER, audience: ACCESS_AUDIENCE }
    );
  }

  function signRefresh(user, sid, ttlMs = refreshMs) {
    return jwt.sign(
      { id: user.id, sid, tv: user.tokenVersion || 0, n: crypto.randomBytes(12).toString('hex'), type: 'refresh' },
      refreshSecret,
      { algorithm: 'HS256', expiresIn: Math.max(1, Math.floor(ttlMs / 1000)), issuer: ISSUER, audience: REFRESH_AUDIENCE }
    );
  }

  /** Nuova sessione (login, verifica email). Salva l'utente. */
  async function createSession(user, { userAgent = '' } = {}) {
    const sid = crypto.randomUUID();
    const refreshToken = signRefresh(user, sid);
    const now = Date.now();
    const sessions = activeSessions(user);
    sessions.push({
      id: sid,
      hash: sha256(refreshToken),
      createdAt: new Date(now).toISOString(),
      lastUsedAt: new Date(now).toISOString(),
      expiresAt: now + refreshMs,
      userAgent: String(userAgent || '').slice(0, 160),
    });
    while (sessions.length > MAX_SESSIONS) sessions.shift();
    user.sessions = sessions;
    await store.save(user);
    return { accessToken: signAccess(user, sid), refreshToken, sid, accessMs, refreshMs };
  }

  /** Verifica firma, emittente, destinatario e tipo dell'access token. */
  function verifyAccess(token) {
    if (!token || typeof token !== 'string') return { error: 'missing' };
    try {
      const payload = jwt.verify(token, accessSecret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
      });
      if (payload.type !== 'access') return { error: 'invalid' };
      return { payload };
    } catch (err) {
      return { error: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
    }
  }

  /** Utente associato a un access token valido, se la sessione è ancora aperta. */
  function userForAccess(payload) {
    const user = store.findById(payload.id);
    if (!user) return null;
    if ((user.tokenVersion || 0) !== (payload.tv || 0)) return null;
    if (!payload.sid || !findSession(user, payload.sid)) return null;
    return user;
  }

  /** Nuovo access token da un refresh token valido. Ritorna { user, accessToken } oppure { error }. */
  async function refresh(refreshToken) {
    if (!refreshToken || typeof refreshToken !== 'string') return { error: 'missing' };
    let payload;
    try {
      payload = jwt.verify(refreshToken, refreshSecret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
      });
    } catch (err) {
      return { error: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
    }
    if (payload.type !== 'refresh' || !payload.sid) return { error: 'invalid' };
    const user = store.findById(payload.id);
    if (!user) return { error: 'invalid' };
    if ((user.tokenVersion || 0) !== (payload.tv || 0)) return { error: 'revoked' };
    const session = findSession(user, payload.sid);
    if (!session) return { error: 'revoked' };
    const now = Date.now();
    const tokenHash = sha256(refreshToken);

    if (!safeEqualHex(session.hash, tokenHash)) {
      // token appena sostituito da un'altra scheda: accettato per pochi secondi, senza ruotare
      const rotatedAt = session.rotatedAt ? Date.parse(session.rotatedAt) : 0;
      if (session.prevHash && safeEqualHex(session.prevHash, tokenHash)) {
        if (now - rotatedAt <= graceMs) {
          return { user, accessToken: signAccess(user, session.id), sid: session.id, accessMs, grace: true };
        }
        // riuso di un token vecchio: probabile furto, si chiude la sessione
        await revokeSession(user, session.id);
        return { error: 'reused' };
      }
      return { error: 'revoked' };
    }

    // rotazione: nuovo token con la stessa scadenza assoluta della sessione
    const remaining = session.expiresAt - now;
    const newToken = signRefresh(user, session.id, remaining);
    session.prevHash = session.hash;
    session.hash = sha256(newToken);
    session.rotatedAt = new Date(now).toISOString();
    session.lastUsedAt = new Date(now).toISOString();
    await store.save(user);
    return {
      user,
      accessToken: signAccess(user, session.id),
      refreshToken: newToken,
      sid: session.id,
      accessMs,
      refreshMs: remaining,
    };
  }

  async function revokeSession(user, sid) {
    const before = Array.isArray(user.sessions) ? user.sessions.length : 0;
    user.sessions = activeSessions(user).filter((s) => s.id !== sid);
    if (user.sessions.length !== before) await store.save(user);
  }

  /** Chiude tutte le sessioni e invalida gli access token già emessi (reset password). */
  function revokeAllInPlace(user) {
    const count = activeSessions(user).length;
    user.sessions = [];
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    return count;
  }

  /** Sessioni senza dati riservati (hash), per profilo ed esportazione dei dati. */
  function describeSessions(user, currentSid = null) {
    return activeSessions(user).map((s) => ({
      id: s.id,
      current: Boolean(currentSid && s.id === currentSid),
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: new Date(s.expiresAt).toISOString(),
      userAgent: s.userAgent || '',
    }));
  }

  /** sid e utente dal refresh token (anche scaduto), per il logout */
  function decodeRefresh(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, refreshSecret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        ignoreExpiration: true,
      });
      return payload.type === 'refresh' ? payload : null;
    } catch {
      return null;
    }
  }

  return {
    createSession,
    verifyAccess,
    userForAccess,
    refresh,
    revokeSession,
    revokeAllInPlace,
    describeSessions,
    decodeRefresh,
    findSession,
    activeSessions,
    accessMs,
    refreshMs,
  };
}

module.exports = { createSessionManager, parseDurationMs, sha256, safeEqualHex, MAX_SESSIONS, ROTATION_GRACE_MS };
