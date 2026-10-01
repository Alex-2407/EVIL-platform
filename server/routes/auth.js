'use strict';
/**
 * Autenticazione: registrazione con verifica email, login, sessioni, reset password,
 * cancellazione ed esportazione dell'account.
 *
 * Scelte di sicurezza (revisione S-02…S-17):
 * - password con scrypt nel threadpool (server/lib/passwords.js); i vecchi hash bcrypt
 *   vengono convertiti al primo login riuscito; hash fittizio per le email inesistenti
 * - la verifica email NON fa accedere: il link porta a una pagina che chiede conferma e
 *   chiama POST /api/auth/verify; poi si accede con email e password (S-05)
 * - registrarsi di nuovo su un'email non verificata sostituisce password e token; gli
 *   account non verificati scadono dopo 7 giorni (server/lib/account-cleanup.js)
 * - la registrazione risponde sempre allo stesso modo: se l'email ha già un account, al
 *   proprietario arriva un avviso "hai già un account" (S-06)
 * - tentativi falliti limitati per email+IP, per IP e per account con ritardo progressivo (S-09)
 * - refresh token ruotato a ogni rinnovo; POST /api/auth/sessions/revoke-all (S-10)
 * - DELETE /api/auth/account e GET /api/auth/account/export (GDPR, S-15)
 * - messaggi tradotti con req.t(); email nella lingua dell'account (user.lang)
 * - nei log le email sono mascherate (S-14)
 */
const crypto = require('crypto');
const { isDevelopment } = require('../../utils/env');
const { maskEmail } = require('../../utils/mask');
const passwords = require('../lib/passwords');
const { scheduleCleanup, isExpiredUnverified } = require('../lib/account-cleanup');
const { DEFAULT_LANG } = require('../i18n');

const VERIFY_EXPIRY_MS = () => parseInt(process.env.EMAIL_VERIFY_EXPIRY_MS || `${24 * 60 * 60 * 1000}`, 10);
const RESET_EXPIRY_MS = () => parseInt(process.env.PASSWORD_RESET_EXPIRY_MS || `${15 * 60 * 1000}`, 10);
const RECENT_LOGIN_MS = 10 * 60 * 1000; // cancellazione senza password solo subito dopo un login
const EXISTS_NOTICE_EVERY_MS = 15 * 60 * 1000; // al massimo un avviso "hai già un account" ogni 15 minuti
const LOGIN_HISTORY_MAX = 20;
const TOKEN_RE = /^[a-f0-9]{64}$/i;

// Campi interni mai esportati né mostrati
const SECRET_FIELD = /^(password|tokenVersion|sessions)$|hash|token/i;

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt || null,
    lang: user.lang || DEFAULT_LANG,
  };
}

function langPrefix(lang) {
  return lang && lang !== DEFAULT_LANG ? `/${lang}` : '';
}

module.exports = function registerAuth(app, ctx) {
  const {
    db, sessions, logger, auditLog, emailService,
    authenticateToken, optionalAuthenticate, validateRegister, validateLogin,
    validatePasswordStrength, defaultProgress,
    registerLimiter, authLimiter, accountLoginLimiter, loginDelay, loginIpLimiter, refreshTokenLimiter,
    passwordResetLimiter, passwordResetEmailLimiter, verificationLimiter, verificationStatusLimiter,
    setAuthCookies, setAccessCookie, clearAuthCookies, getRefreshTokenFromCookie, getAccessTokenFromRequest,
  } = ctx;

  // limiter facoltativi (un contesto di test può non averli)
  const pass = (req, res, next) => next();
  const accountLimiter = accountLoginLimiter || pass;
  const delay = loginDelay || { wait: async () => 0, fail() {}, reset() {} };

  passwords.dummyHash().catch(() => {});
  if (ctx.scheduleAccountCleanup !== false) scheduleCleanup(db, { logger });

  async function startSession(req, res, user) {
    const created = await sessions.createSession(user, { userAgent: req.get('User-Agent') });
    setAuthCookies(res, created);
    return created;
  }

  function busy(req, res) {
    res.setHeader('Retry-After', '2');
    return res.status(503).json({
      error: req.t('Il server è molto occupato in questo momento. Riprova tra qualche secondo.'),
      code: 'SERVER_BUSY',
    });
  }

  function devLink(payload, result) {
    if (isDevelopment() && process.env.EMAIL_EXPOSE_VERIFY_LINK === '1' && result?.actionLink) {
      payload.devVerificationLink = result.actionLink;
    }
  }

  function newVerification(user, now = Date.now()) {
    const token = emailService.generateVerificationToken();
    user.verificationTokenHash = sha256(token);
    user.verificationTokenExpires = new Date(now + VERIFY_EXPIRY_MS()).toISOString();
    return token;
  }

  // ------------------------------------------------------------ REGISTRAZIONE
  /**
   * Risposta identica (201, stessi campi) in tutti i casi:
   * - email nuova: account creato, email di verifica
   * - email con account NON verificato: password, nome e token sostituiti, nuova email di
   *   verifica (chi ha registrato per primo l'indirizzo di un altro non lo "occupa")
   * - email con account verificato: nessuna modifica, al proprietario un avviso
   */
  app.post('/api/auth/register', registerLimiter, validateRegister, async (req, res) => {
    const { name, email, password } = req.body;
    const lang = req.lang || DEFAULT_LANG;
    const now = new Date();
    const respond = (userId, result) => {
      const payload = {
        status: 'success',
        message: req.t('Controlla la tua casella email (anche lo spam) e apri il link di EVIL per attivare l\'account.'),
        requiresVerification: true,
        userId,
        email,
        emailDelivery: result?.delivery || 'smtp',
        emailHint: result?.hint || req.t('Se non vedi l\'email, controlla la cartella spam.'),
      };
      devLink(payload, result);
      return res.status(201).json(payload);
    };
    const sendFailed = () =>
      res.status(503).json({
        error: req.t('Non riusciamo a inviare l\'email di verifica in questo momento. L\'account non è stato creato: riprova tra qualche minuto.'),
        code: 'EMAIL_SEND_FAILED',
      });

    try {
      // l'hash si calcola sempre: i tempi di risposta non rivelano se l'email esiste
      const passwordHash = await passwords.hashPassword(password);
      const existing = db.findByEmail(email);

      // ---- account verificato: solo un avviso al proprietario
      if (existing && existing.emailVerified) {
        let result = null;
        const last = Date.parse(existing.accountExistsNoticeAt || '') || 0;
        if (now.getTime() - last > EXISTS_NOTICE_EVERY_MS) {
          existing.accountExistsNoticeAt = now.toISOString();
          await db.save(existing).catch(() => {});
          try {
            result = await emailService.sendAccountExistsEmail(existing.email, existing.name, existing.lang || lang);
          } catch (err) {
            result = { success: false, error: err.message };
          }
          if (!result?.success) logger.error('Account-exists notice failed', { error: result?.error, email: maskEmail(email) });
        }
        auditLog.security('REGISTER_EXISTING_EMAIL', { userId: existing.id, email }, 'INFO');
        // id casuale: non è quello dell'account e non rivela nulla a chi interroga lo stato
        return respond(crypto.randomUUID(), result?.success ? result : { delivery: emailService.getEmailTransport?.() === 'mailtrap_api' ? 'mailtrap_api' : undefined });
      }

      // ---- account non verificato: si sostituiscono i dati (chi ha la casella vince)
      if (existing && !existing.emailVerified) {
        const token = newVerification(existing, now.getTime());
        existing.name = name.trim();
        existing.password = passwordHash;
        existing.lang = lang;
        existing.registeredAt = now.toISOString();
        existing.acceptedTermsAt = now.toISOString();
        existing.sessions = [];
        existing.tokenVersion = (existing.tokenVersion || 0) + 1;
        existing.progress = defaultProgress();
        await db.save(existing);
        let result;
        try {
          result = await emailService.sendRegistrationVerification(email, token, existing.name, lang);
        } catch (err) {
          result = { success: false, error: err.message };
        }
        if (!result?.success) {
          logger.error('Registration email send failed', { error: result?.error, email: maskEmail(email) });
          return sendFailed();
        }
        auditLog.security('USER_REGISTERED_REPLACED_UNVERIFIED', { userId: existing.id, email }, 'INFO');
        return respond(existing.id, result);
      }

      // ---- email nuova
      const user = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email,
        password: passwordHash,
        createdAt: now.toISOString(),
        registeredAt: now.toISOString(),
        acceptedTermsAt: now.toISOString(),
        lang,
        emailVerified: false,
        tokenVersion: 0,
        sessions: [],
        loginHistory: [],
        failedLogins: 0,
        progress: defaultProgress(),
      };
      const token = newVerification(user, now.getTime());

      try {
        await db.insert(user);
      } catch (err) {
        if (err.code === 'EVIL_DUPLICATE_EMAIL') {
          // due registrazioni contemporanee: stessa risposta generica
          return respond(crypto.randomUUID(), null);
        }
        logger.error('Registration save failed', { error: err.message, storage: db.kind });
        return res.status(500).json({
          error: req.t('Non è stato possibile creare l\'account. Riprova tra qualche minuto.'),
          code: 'STORAGE_ERROR',
        });
      }

      let result;
      try {
        result = await emailService.sendRegistrationVerification(email, token, user.name, lang);
      } catch (err) {
        result = { success: false, error: err.message };
      }
      if (!result?.success) {
        logger.error('Registration email send failed', { error: result?.error, email: maskEmail(email) });
        await db.remove(user.id).catch(() => {});
        return sendFailed();
      }

      auditLog.security('USER_REGISTERED_PENDING', { userId: user.id, email }, 'INFO');
      return respond(user.id, result);
    } catch (err) {
      if (err.code === 'EVIL_HASH_BUSY') return busy(req, res);
      logger.error('Registration error', { error: err.message });
      return res.status(500).json({ error: req.t('Errore durante la registrazione. Riprova.') });
    }
  });

  // ------------------------------------------------------------ VERIFICA EMAIL
  // Link delle email già inviate (vecchio formato): porta alla pagina di conferma,
  // senza attivare nulla e senza far accedere. Il token passa nel frammento (#token=).
  app.get('/api/auth/verify-email', verificationStatusLimiter, (req, res) => {
    const token = typeof req.query.token === 'string' && TOKEN_RE.test(req.query.token) ? req.query.token : '';
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const page = `${langPrefix(req.lang)}/verify-email.html`;
    return res.redirect(302, token ? `${page}#token=${token}` : `${page}?status=error&reason=missing`);
  });

  /**
   * Conferma dell'indirizzo, chiamata dalla pagina verify-email.html dopo un clic
   * dell'utente. Attiva l'account ma NON apre una sessione: si accede poi con la password.
   */
  app.post('/api/auth/verify', verificationStatusLimiter, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!token) {
        return res.status(400).json({ error: req.t('Link di verifica incompleto: apri di nuovo il link dall\'email.'), code: 'TOKEN_MISSING' });
      }
      const user = TOKEN_RE.test(token) ? db.find((u) => u.verificationTokenHash && u.verificationTokenHash === sha256(token)) : null;
      if (!user || user.emailVerified) {
        return res.status(400).json({
          error: req.t('Link non valido o già usato. Se hai già confermato l\'indirizzo, accedi con email e password.'),
          code: 'TOKEN_INVALID',
        });
      }
      if (!user.verificationTokenExpires || new Date() > new Date(user.verificationTokenExpires) || isExpiredUnverified(user)) {
        return res.status(410).json({
          error: req.t('Il link è scaduto. Registrati di nuovo con lo stesso indirizzo per ricevere un link nuovo.'),
          code: 'TOKEN_EXPIRED',
          userId: user.id,
        });
      }

      user.emailVerified = true;
      user.emailVerifiedAt = new Date().toISOString();
      user.verificationTokenHash = null;
      user.verificationTokenExpires = null;
      await db.save(user);
      auditLog.security('USER_EMAIL_VERIFIED', { userId: user.id, email: user.email }, 'INFO');
      return res.json({
        status: 'success',
        code: 'EMAIL_VERIFIED',
        message: req.t('Indirizzo confermato: ora puoi accedere con email e password.'),
        email: user.email,
      });
    } catch (err) {
      logger.error('Email verification error', { error: err.message });
      return res.status(500).json({ error: req.t('Errore durante la verifica. Riprova.'), code: 'SERVER_ERROR' });
    }
  });

  // ------------------------------------------------------------ LOGIN
  app.post('/api/auth/login', loginIpLimiter, authLimiter, accountLimiter, validateLogin, async (req, res) => {
    const { email, password } = req.body;
    try {
      await delay.wait(email);
      const user = db.findByEmail(email);
      const check = user ? await passwords.verifyPassword(password, user.password) : await passwords.verifyDummy(password);

      if (!check.ok) {
        delay.fail(email);
        if (user) {
          user.failedLogins = (user.failedLogins || 0) + 1;
          user.lastFailedLoginAt = new Date().toISOString();
          await db.save(user).catch(() => {});
        }
        auditLog.loginFailed(email, req.ip, user ? `Failed attempts: ${user.failedLogins}` : 'Unknown email');
        return res.status(401).json({ error: req.t('Email o password non corretti.'), code: 'INVALID_CREDENTIALS' });
      }

      // migrazione trasparente: bcrypt (o parametri scrypt vecchi) → scrypt attuale
      if (check.needsRehash) {
        try {
          user.password = await passwords.hashPassword(password);
          user.passwordUpgradedAt = new Date().toISOString();
        } catch (err) {
          logger.warn('Password rehash skipped', { error: err.message, userId: user.id });
        }
      }

      if (!user.emailVerified) {
        if (check.needsRehash) await db.save(user).catch(() => {});
        return res.status(403).json({
          error: req.t('Devi verificare la tua email prima di accedere. Controlla la posta (anche lo spam).'),
          code: 'EMAIL_NOT_VERIFIED',
          requiresVerification: true,
          userId: user.id,
          email: user.email,
        });
      }

      delay.reset(email);
      user.failedLogins = 0;
      delete user.lockedUntil;
      if (req.lang) user.lang = req.lang;
      user.loginHistory = [...(user.loginHistory || []), { timestamp: new Date().toISOString(), ip: req.ip || 'unknown' }].slice(
        -LOGIN_HISTORY_MAX
      );
      await startSession(req, res, user); // salva anche le modifiche sopra
      auditLog.loginSuccess(user.id, user.email, req.ip);
      return res.json({ status: 'success', user: publicUser(user) });
    } catch (err) {
      if (err.code === 'EVIL_HASH_BUSY') return busy(req, res);
      logger.error('Login error', { error: err.message });
      return res.status(500).json({ error: req.t('Errore durante l\'accesso. Riprova.') });
    }
  });

  // ------------------------------------------------------------ RINNOVO ACCESSO
  // Compatibilità: il rinnovo avviene già in automatico nei middleware e in /api/auth/session.
  app.post('/api/auth/refresh-token', refreshTokenLimiter, async (req, res) => {
    try {
      const token = getRefreshTokenFromCookie(req) || (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null);
      const result = await sessions.refresh(token);
      if (!result.user) {
        if (result.error !== 'missing') clearAuthCookies(res);
        if (result.error === 'reused') {
          auditLog.security('REFRESH_TOKEN_REUSED', { ip: req.ip }, 'WARN');
        }
        return res.status(401).json({ error: req.t('Sessione scaduta: accedi di nuovo.'), code: 'REFRESH_FAILED' });
      }
      if (result.refreshToken) setAuthCookies(res, result);
      else setAccessCookie(res, result.accessToken, result.accessMs);
      return res.json({ status: 'success', user: publicUser(result.user) });
    } catch (err) {
      logger.error('Token refresh error', { error: err.message });
      return res.status(500).json({ error: req.t('Errore nel rinnovo della sessione.') });
    }
  });

  // ------------------------------------------------------------ LOGOUT
  app.post('/api/auth/logout', async (req, res) => {
    const done = () => res.json({ status: 'success', message: req.t('Logout completato') });
    try {
      let userId = null;
      let sid = null;
      const refreshPayload = sessions.decodeRefresh(getRefreshTokenFromCookie(req) || '');
      if (refreshPayload) {
        userId = refreshPayload.id;
        sid = refreshPayload.sid;
      } else {
        const access = sessions.verifyAccess(getAccessTokenFromRequest(req));
        if (access.payload) {
          userId = access.payload.id;
          sid = access.payload.sid;
        }
      }
      const user = userId ? db.findById(userId) : null;
      if (user && sid) {
        await sessions.revokeSession(user, sid);
        auditLog.security('USER_LOGOUT', { userId: user.id }, 'INFO');
      }
      clearAuthCookies(res);
      return done();
    } catch (err) {
      logger.error('Logout error', { error: err.message });
      clearAuthCookies(res);
      return done();
    }
  });

  // ------------------------------------------------------------ CHIUDI TUTTE LE SESSIONI
  /**
   * Esce da tutti i dispositivi. Con { keepCurrent: true } resta aperta (rinnovata) solo
   * la sessione di chi fa la richiesta.
   */
  app.post('/api/auth/sessions/revoke-all', refreshTokenLimiter, authenticateToken, async (req, res) => {
    try {
      const user = req.userRecord;
      const keepCurrent = req.body?.keepCurrent === true;
      const revoked = sessions.revokeAllInPlace(user);
      if (keepCurrent) {
        await startSession(req, res, user); // salva anche la revoca
      } else {
        await db.save(user);
        clearAuthCookies(res);
      }
      auditLog.security('SESSIONS_REVOKED_ALL', { userId: user.id, keepCurrent }, 'INFO');
      return res.json({
        status: 'success',
        message: keepCurrent
          ? req.t('Hai chiuso le sessioni sugli altri dispositivi.')
          : req.t('Hai chiuso tutte le sessioni, compresa questa: accedi di nuovo.'),
        revoked: keepCurrent ? Math.max(0, revoked - 1) : revoked,
        keptCurrent: keepCurrent,
      });
    } catch (err) {
      logger.error('Revoke-all error', { error: err.message });
      return res.status(500).json({ error: req.t('Non è stato possibile chiudere le sessioni. Riprova.') });
    }
  });

  // ------------------------------------------------------------ PASSWORD DIMENTICATA
  app.post('/api/auth/forgot-password', passwordResetLimiter, passwordResetEmailLimiter, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: req.t('Inserisci un indirizzo email valido.') });
    }

    const user = db.findByEmail(email);
    // Risposta identica e immediata in ogni caso: né il contenuto né i tempi rivelano se l'email esiste
    res.json({
      status: 'success',
      message: req.t('Se l\'indirizzo è registrato, riceverai un\'email con il link per reimpostare la password (valido 15 minuti).'),
    });
    if (!user) return;

    try {
      const resetToken = emailService.generateVerificationToken();
      user.passwordResetTokenHash = sha256(resetToken);
      user.passwordResetTokenExpires = new Date(Date.now() + RESET_EXPIRY_MS()).toISOString();
      await db.save(user);
      const result = await emailService.sendPasswordResetEmail(email, resetToken, user.name, user.lang || req.lang);
      if (!result?.success) {
        logger.error('Password reset email failed', { error: result?.error, userId: user.id });
      } else {
        auditLog.security('PASSWORD_RESET_REQUESTED', { userId: user.id, email }, 'INFO');
      }
    } catch (err) {
      logger.error('Forgot password error', { error: err.message });
    }
  });

  // ------------------------------------------------------------ NUOVA PASSWORD
  app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
    try {
      const { token, resetToken, newPassword, confirmPassword } = req.body || {};
      const rawToken = typeof token === 'string' ? token : typeof resetToken === 'string' ? resetToken : '';
      if (!rawToken || typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
        return res.status(400).json({ error: req.t('Compila tutti i campi.') });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: req.t('Le password non coincidono.') });
      }
      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) return res.status(400).json({ error: req.t(strength.reason) });

      const tokenHash = sha256(rawToken);
      const user = db.find((u) => u.passwordResetTokenHash && u.passwordResetTokenHash === tokenHash);
      if (!user) {
        return res.status(403).json({ error: req.t('Link non valido o già utilizzato. Richiedi un nuovo reset.') });
      }
      if (!user.passwordResetTokenExpires || new Date(user.passwordResetTokenExpires) < new Date()) {
        user.passwordResetTokenHash = null;
        user.passwordResetTokenExpires = null;
        await db.save(user);
        return res.status(403).json({ error: req.t('Link scaduto. Richiedi un nuovo reset dalla pagina di recupero password.') });
      }

      user.password = await passwords.hashPassword(newPassword);
      user.passwordResetTokenHash = null;
      user.passwordResetTokenExpires = null;
      user.passwordChangedAt = new Date().toISOString();
      user.failedLogins = 0;
      delete user.lockedUntil;
      // il link è arrivato nella casella: l'indirizzo è dimostrato (S-05)
      if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date().toISOString();
      }
      user.verificationTokenHash = null;
      user.verificationTokenExpires = null;
      // chiude tutte le sessioni: chi aveva rubato una sessione ne resta fuori
      sessions.revokeAllInPlace(user);
      await db.save(user);
      clearAuthCookies(res);
      // il proprietario rientra subito anche se qualcuno aveva esaurito i tentativi
      delay.reset(user.email);
      if (typeof accountLimiter.resetKey === 'function') {
        try {
          const { emailHash } = require('../../middleware/limiter')._internals;
          await accountLimiter.resetKey(`acct:${emailHash(user.email)}`);
        } catch (_) {
          /* non bloccante */
        }
      }

      auditLog.security('PASSWORD_RESET_COMPLETED', { userId: user.id, email: user.email }, 'INFO');
      return res.json({ status: 'success', message: req.t('Password aggiornata. Accedi con la nuova password.') });
    } catch (err) {
      if (err.code === 'EVIL_HASH_BUSY') return busy(req, res);
      logger.error('Reset password error', { error: err.message });
      return res.status(500).json({ error: req.t('Errore durante il reset della password. Riprova.') });
    }
  });

  // ------------------------------------------------------------ STATO VERIFICA (polling dalla pagina di attesa)
  // Id sconosciuti rispondono "pending" come quelli veri: niente enumerazione.
  app.get('/api/auth/verification-status', verificationStatusLimiter, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string' || userId.length > 64) {
      return res.status(400).json({ error: req.t('userId obbligatorio') });
    }
    const user = db.findById(userId);
    const verified = Boolean(user && user.emailVerified);
    return res.json({ status: verified ? 'verified' : 'pending', emailVerified: verified });
  });

  // ------------------------------------------------------------ SESSIONE CORRENTE
  // Rinnova in modo trasparente l'accesso se serve (una sola chiamata per pagina).
  app.get('/api/auth/session', optionalAuthenticate, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!req.userRecord) return res.json({ authenticated: false });
    return res.json({ authenticated: true, user: publicUser(req.userRecord) });
  });

  // ------------------------------------------------------------ REINVIO EMAIL DI VERIFICA
  app.post('/api/auth/resend-verification-code', verificationLimiter, async (req, res) => {
    try {
      const { userId } = req.body || {};
      if (!userId || typeof userId !== 'string' || userId.length > 64) {
        return res.status(400).json({ error: req.t('Utente non indicato.') });
      }
      const generic = {
        status: 'success',
        message: req.t('Se l\'account è in attesa di conferma, ti abbiamo inviato di nuovo il link.'),
        emailHint: req.t('Se non vedi l\'email, controlla la cartella spam.'),
      };
      const user = db.findById(userId);
      // id sconosciuto (o quello casuale di una registrazione su un'email già attiva): stessa risposta
      if (!user || user.emailVerified) return res.json(generic);

      const token = newVerification(user);
      await db.save(user);
      const result = await emailService.sendVerificationLink(user.email, token, user.name, user.lang || req.lang);
      if (!result?.success) {
        logger.error('Resend verification failed', { error: result?.error, userId: user.id });
        return res.status(503).json({ error: req.t('Non riusciamo a inviare l\'email in questo momento. Riprova tra qualche minuto.') });
      }
      const payload = { ...generic, emailDelivery: result.delivery, emailHint: result.hint || generic.emailHint };
      devLink(payload, result);
      return res.json(payload);
    } catch (err) {
      logger.error('Resend verification code error', { error: err.message });
      return res.status(500).json({ error: req.t('Errore durante il reinvio. Riprova.') });
    }
  });

  // ------------------------------------------------------------ PROFILO
  app.get('/api/auth/profile', authenticateToken, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const user = req.userRecord;
    return res.json({
      status: 'success',
      user: {
        ...publicUser(user),
        progress: user.progress || defaultProgress(),
        loginHistory: (user.loginHistory || []).slice(-5),
        activeSessions: sessions.activeSessions(user).length,
      },
    });
  });

  // ------------------------------------------------------------ ESPORTAZIONE DATI (GDPR art. 15 e 20)
  app.get('/api/auth/account/export', authenticateToken, (req, res) => {
    const user = req.userRecord;
    const data = {};
    for (const [k, v] of Object.entries(user)) {
      if (k === 'passwordChangedAt' || k === 'passwordUpgradedAt' || !SECRET_FIELD.test(k)) data[k] = v;
    }
    data.sessions = sessions.describeSessions(user, req.user?.sid);
    const body = {
      exportedAt: new Date().toISOString(),
      service: 'EVIL — projectevil.it',
      note: req.t('Questi sono tutti i dati personali che EVIL conserva sul tuo account. Password e codici di sicurezza sono esclusi perché salvati solo come hash.'),
      account: data,
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', 'attachment; filename="evil-account-export.json"');
    auditLog.security('ACCOUNT_EXPORTED', { userId: user.id }, 'INFO');
    return res.type('application/json').send(JSON.stringify(body, null, 2));
  });

  // ------------------------------------------------------------ CANCELLAZIONE ACCOUNT (GDPR art. 17)
  /**
   * Richiede la password attuale, oppure un accesso fatto da meno di 10 minuti (la
   * sessione è appena stata aperta con la password). Cancella utente, sessioni e progressi.
   */
  app.delete('/api/auth/account', loginIpLimiter, authenticateToken, async (req, res) => {
    try {
      const user = req.userRecord;
      const given = req.body?.password;
      if (typeof given === 'string' && given.length) {
        if (given.length > 200) {
          return res.status(400).json({ error: req.t('La password è troppo lunga (massimo 200 caratteri).'), code: 'VALIDATION_FAILED' });
        }
        const check = await passwords.verifyPassword(given, user.password);
        if (!check.ok) {
          auditLog.security('ACCOUNT_DELETE_BAD_PASSWORD', { userId: user.id }, 'WARN');
          return res.status(401).json({ error: req.t('Password non corretta.'), code: 'INVALID_PASSWORD' });
        }
      } else {
        const session = sessions.findSession(user, req.user?.sid);
        const created = session ? Date.parse(session.createdAt) : 0;
        if (!created || Date.now() - created > RECENT_LOGIN_MS) {
          return res.status(403).json({
            error: req.t('Per cancellare l\'account inserisci la password.'),
            code: 'REAUTH_REQUIRED',
          });
        }
      }

      await db.remove(user.id);
      clearAuthCookies(res);
      auditLog.security('ACCOUNT_DELETED', { userId: user.id, email: user.email }, 'INFO');
      return res.json({
        status: 'success',
        code: 'ACCOUNT_DELETED',
        message: req.t('Account cancellato. Abbiamo eliminato i tuoi dati, le sessioni e i progressi.'),
      });
    } catch (err) {
      if (err.code === 'EVIL_HASH_BUSY') return busy(req, res);
      logger.error('Account delete error', { error: err.message });
      return res.status(500).json({ error: req.t('Non è stato possibile cancellare l\'account. Riprova.') });
    }
  });
};
