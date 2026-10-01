'use strict';
/**
 * Account mai verificati: scadono dopo UNVERIFIED_ACCOUNT_TTL_DAYS giorni (default 7) dalla
 * registrazione e vengono cancellati (S-05). Così un indirizzo occupato da altri senza
 * conferma torna libero e l'archivio non accumula dati di chi non ha mai attivato l'account.
 */

const DAY = 24 * 60 * 60 * 1000;

function unverifiedTtlMs() {
  const days = parseFloat(process.env.UNVERIFIED_ACCOUNT_TTL_DAYS || '7');
  return (Number.isFinite(days) && days > 0 ? days : 7) * DAY;
}

function isExpiredUnverified(user, now = Date.now(), ttlMs = unverifiedTtlMs()) {
  if (!user || user.emailVerified) return false;
  const created = Date.parse(user.registeredAt || user.createdAt || '');
  return Number.isFinite(created) && now - created > ttlMs;
}

/** Cancella gli account non verificati scaduti. Restituisce quanti ne ha tolti. */
async function purgeExpiredUnverified(db, { now = Date.now(), ttlMs = unverifiedTtlMs(), logger = null } = {}) {
  const expired = db.users.filter((u) => isExpiredUnverified(u, now, ttlMs));
  let removed = 0;
  for (const user of expired) {
    try {
      if (await db.remove(user.id)) removed += 1;
    } catch (err) {
      if (logger) logger.error('Pulizia account non verificati: errore', { error: err.message, userId: user.id });
    }
  }
  if (removed && logger) logger.info('Account non verificati scaduti cancellati', { event: 'UNVERIFIED_PURGED', removed });
  return removed;
}

/** Pulizia all'avvio e poi ogni ora (timer che non tiene vivo il processo). */
function scheduleCleanup(db, { logger = null, everyMs = 60 * 60 * 1000 } = {}) {
  const run = () => purgeExpiredUnverified(db, { logger }).catch(() => {});
  const first = setTimeout(run, 5000);
  first.unref?.();
  const timer = setInterval(run, everyMs);
  timer.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

module.exports = { unverifiedTtlMs, isExpiredUnverified, purgeExpiredUnverified, scheduleCleanup };
