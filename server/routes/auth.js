'use strict';
/**
 * Autenticazione: registrazione con verifica email, login, sessioni, reset password.
 *
 * Differenze rispetto alla versione precedente:
 * - utenti e sessioni nell'archivio persistente (niente refresh token solo in memoria)
 * - niente blocco dell'account per email: chiunque poteva bloccare l'account di un altro
 *   con 5 password sbagliate; i tentativi falliti sono limitati per email+IP e per IP
 * - il reset password chiude tutte le sessioni e invalida gli access token già emessi
 * - logout chiude davvero la sessione corrente, anche con access token scaduto
 * - rimossi /api/auth/confirm-email (accettava un access token come prova di verifica)
 *   e /api/auth/verify-email-code (codice a 6 cifre non più usato dal sito)
 * - messaggi in italiano, nessun dettaglio tecnico SMTP mostrato agli utenti
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { isDevelopment } = require('../../utils/env');

const VERIFY_EXPIRY_MS = () => parseInt(process.env.EMAIL_VERIFY_EXPIRY_MS || `${24 * 60 * 60 * 1000}`, 10);
const RESET_EXPIRY_MS = () => parseInt(process.env.PASSWORD_RESET_EXPIRY_MS || `${15 * 60 * 1000}`, 10);
const LOGIN_HISTORY_MAX = 20;

// Hash fittizio: il login di un'email inesistente costa quanto quello di un'email esistente
let dummyHashPromise = null;
function dummyHash() {
  if (!dummyHashPromise) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12, 10);
    dummyHashPromise = bcrypt.hash(crypto.randomBytes(16).toString('hex'), rounds);
  }
  return dummyHashPromise;
}

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
  };
}

module.exports = function registerAuth(app, ctx) {
  const {
    db, sessions, logger, auditLog, emailService,
    authenticateToken, optionalAuthenticate, validateRegister, validateLogin,
    verifyPassword, hashPassword, validatePasswordStrength, defaultProgress,
    registerLimiter, authLimiter, loginIpLimiter, refreshTokenLimiter, passwordResetLimiter,
    passwordResetEmailLimiter, verificationLimiter, verificationStatusLimiter,
    setAuthCookies, setAccessCookie, clearAuthCookies, getRefreshTokenFromCookie, getAccessTokenFromRequest,
  } = ctx;

  dummyHash().catch(() => {});

  async function startSession(req, res, user) {
    const created = await sessions.createSession(user, { userAgent: req.get('User-Agent') });
    setAuthCookies(res, created);
    return created;
  }

  // ------------------------------------------------------------ REGISTRAZIONE
  app.post('/api/auth/register', registerLimiter, validateRegister, async (req, res) => {
    const { name, email, password } = req.body;
    try {
      if (db.findByEmail(email)) {
        return res.status(409).json({ error: 'Questa email è già registrata. Prova ad accedere.', code: 'EMAIL_TAKEN' });
      }

      const verificationToken = emailService.generateVerificationToken();
      const now = new Date();
      const user = {
        id: crypto.randomUUID(),
        name: name.trim(),
        email,
        password: await hashPassword(password),
        createdAt: now.toISOString(),
        emailVerified: false,
        verificationTokenHash: sha256(verificationToken),
        verificationTokenExpires: new Date(now.getTime() + VERIFY_EXPIRY_MS()).toISOString(),
        tokenVersion: 0,
        sessions: [],
        loginHistory: [],
        failedLogins: 0,
        progress: defaultProgress(),
      };

      try {
        await db.insert(user);
      } catch (err) {
        if (err.code === 'EVIL_DUPLICATE_EMAIL') {
          return res.status(409).json({ error: 'Questa email è già registrata. Prova ad accedere.', code: 'EMAIL_TAKEN' });
        }
        logger.error('Registration save failed', { error: err.message, storage: db.kind });
        return res.status(500).json({
          error: 'Non è stato possibile creare l\'account. Riprova tra qualche minuto.',
          code: 'STORAGE_ERROR',
        });
      }

      let emailResult;
      try {
        emailResult = await emailService.sendRegistrationVerification(email, verificationToken, user.name);
      } catch (err) {
        emailResult = { success: false, error: err.message };
      }

      if (!emailResult?.success) {
        logger.error('Registration email send failed', { error: emailResult?.error, email });
        await db.remove(user.id).catch(() => {});
        return res.status(503).json({
          error: 'Non riusciamo a inviare l\'email di verifica in questo momento. L\'account non è stato creato: riprova tra qualche minuto.',
          code: 'EMAIL_SEND_FAILED',
        });
      }

      auditLog.security('USER_REGISTERED_PENDING', { userId: user.id, email }, 'INFO');

      const payload = {
        status: 'success',
        message: 'Controlla la tua casella email (anche lo spam) e apri il link EVIL per attivare l\'account.',
        requiresVerification: true,
        userId: user.id,
        email,
        emailDelivery: emailResult.delivery || 'smtp',
        emailHint: emailResult.hint || 'Se non vedi l\'email, controlla la cartella spam.',
      };
      if (isDevelopment() && process.env.EMAIL_EXPOSE_VERIFY_LINK === '1' && emailResult.actionLink) {
        payload.devVerificationLink = emailResult.actionLink;
      }
      return res.status(201).json(payload);
    } catch (err) {
      logger.error('Registration error', { error: err.message });
      return res.status(500).json({ error: 'Errore durante la registrazione. Riprova.' });
    }
  });

  // ------------------------------------------------------------ VERIFICA EMAIL (link)
  app.get('/api/auth/verify-email', verificationStatusLimiter, async (req, res) => {
    const fail = (reason) => res.redirect(`/html/verify-email.html?status=error&reason=${encodeURIComponent(reason)}`);
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string' || token.length > 200) return fail('missing');

      const tokenHash = sha256(token);
      const user = db.find((u) => u.verificationTokenHash && u.verificationTokenHash === tokenHash);
      if (!user) return fail('invalid');
      if (user.verificationTokenExpires && new Date() > new Date(user.verificationTokenExpires)) return fail('expired');

      user.emailVerified = true;
      user.emailVerifiedAt = new Date().toISOString();
      user.verificationTokenHash = null;
      user.verificationTokenExpires = null;
      await startSession(req, res, user); // salva anche le modifiche sopra
      auditLog.security('USER_EMAIL_VERIFIED', { userId: user.id, email: user.email }, 'INFO');
      return res.redirect('/html/verify-email.html?status=success');
    } catch (err) {
      logger.error('Email link verification error', { error: err.message });
      return fail('server');
    }
  });

  // ------------------------------------------------------------ LOGIN
  app.post('/api/auth/login', loginIpLimiter, authLimiter, validateLogin, async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = db.findByEmail(email);
      let ok = false;
      if (user) {
        ok = await verifyPassword(password, user.password);
      } else {
        await verifyPassword(password, await dummyHash());
      }

      if (!ok) {
        if (user) {
          user.failedLogins = (user.failedLogins || 0) + 1;
          user.lastFailedLoginAt = new Date().toISOString();
          await db.save(user).catch(() => {});
        }
        auditLog.loginFailed(email, req.ip, user ? `Failed attempts: ${user.failedLogins}` : 'Unknown email');
        return res.status(401).json({ error: 'Email o password non corretti.', code: 'INVALID_CREDENTIALS' });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          error: 'Devi verificare la tua email prima di accedere. Controlla la posta (anche lo spam).',
          code: 'EMAIL_NOT_VERIFIED',
          requiresVerification: true,
          userId: user.id,
          email: user.email,
        });
      }

      user.failedLogins = 0;
      delete user.lockedUntil;
      user.loginHistory = [...(user.loginHistory || []), { timestamp: new Date().toISOString(), ip: req.ip || 'unknown' }].slice(
        -LOGIN_HISTORY_MAX
      );
      await startSession(req, res, user);
      auditLog.loginSuccess(user.id, user.email, req.ip);
      return res.json({ status: 'success', user: publicUser(user) });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      return res.status(500).json({ error: 'Errore durante l\'accesso. Riprova.' });
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
        return res.status(401).json({ error: 'Sessione scaduta: accedi di nuovo.', code: 'REFRESH_FAILED' });
      }
      setAccessCookie(res, result.accessToken, result.accessMs);
      return res.json({ status: 'success', user: publicUser(result.user) });
    } catch (err) {
      logger.error('Token refresh error', { error: err.message });
      return res.status(500).json({ error: 'Errore nel rinnovo della sessione.' });
    }
  });

  // ------------------------------------------------------------ LOGOUT
  app.post('/api/auth/logout', async (req, res) => {
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
      return res.json({ status: 'success', message: 'Logout completato' });
    } catch (err) {
      logger.error('Logout error', { error: err.message });
      clearAuthCookies(res);
      return res.json({ status: 'success', message: 'Logout completato' });
    }
  });

  // ------------------------------------------------------------ PASSWORD DIMENTICATA
  app.post('/api/auth/forgot-password', passwordResetLimiter, passwordResetEmailLimiter, async (req, res) => {
    const genericResponse = {
      status: 'success',
      message: 'Se l\'indirizzo è registrato, riceverai un\'email con il link per reimpostare la password (valido 15 minuti).',
    };
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Inserisci un indirizzo email valido.' });
    }

    const user = db.findByEmail(email);
    // Risposta identica e immediata in ogni caso: né il contenuto né i tempi rivelano se l'email esiste
    res.json(genericResponse);
    if (!user) return;

    try {
      const resetToken = emailService.generateVerificationToken();
      user.passwordResetTokenHash = sha256(resetToken);
      user.passwordResetTokenExpires = new Date(Date.now() + RESET_EXPIRY_MS()).toISOString();
      await db.save(user);
      const result = await emailService.sendPasswordResetEmail(email, resetToken, user.name || 'Utente');
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
        return res.status(400).json({ error: 'Compila tutti i campi.' });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Le password non coincidono.' });
      }
      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) return res.status(400).json({ error: strength.reason });

      const tokenHash = sha256(rawToken);
      const user = db.find((u) => u.passwordResetTokenHash && u.passwordResetTokenHash === tokenHash);
      if (!user) {
        return res.status(403).json({ error: 'Link non valido o già utilizzato. Richiedi un nuovo reset.' });
      }
      if (!user.passwordResetTokenExpires || new Date(user.passwordResetTokenExpires) < new Date()) {
        user.passwordResetTokenHash = null;
        user.passwordResetTokenExpires = null;
        await db.save(user);
        return res.status(403).json({ error: 'Link scaduto. Richiedi un nuovo reset dalla pagina di recupero password.' });
      }

      user.password = await hashPassword(newPassword);
      user.passwordResetTokenHash = null;
      user.passwordResetTokenExpires = null;
      user.passwordChangedAt = new Date().toISOString();
      user.failedLogins = 0;
      delete user.lockedUntil;
      // chiude tutte le sessioni: chi aveva rubato una sessione ne resta fuori
      sessions.revokeAllInPlace(user);
      await db.save(user);
      clearAuthCookies(res);

      auditLog.security('PASSWORD_RESET_COMPLETED', { userId: user.id, email: user.email }, 'INFO');
      return res.json({ status: 'success', message: 'Password aggiornata. Accedi con la nuova password.' });
    } catch (err) {
      logger.error('Reset password error', { error: err.message });
      return res.status(500).json({ error: 'Errore durante il reset della password. Riprova.' });
    }
  });

  // ------------------------------------------------------------ STATO VERIFICA (polling dalla pagina di attesa)
  app.get('/api/auth/verification-status', verificationStatusLimiter, (req, res) => {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string' || userId.length > 64) {
      return res.status(400).json({ error: 'userId obbligatorio' });
    }
    const user = db.findById(userId);
    if (!user) return res.status(404).json({ error: 'Utente non trovato', emailVerified: false });
    return res.json({ status: user.emailVerified ? 'verified' : 'pending', emailVerified: Boolean(user.emailVerified) });
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
        return res.status(400).json({ error: 'Utente non indicato.' });
      }
      const user = db.findById(userId);
      if (!user) return res.status(404).json({ error: 'Utente non trovato.' });
      if (user.emailVerified) return res.status(400).json({ error: 'Email già verificata: puoi accedere.' });

      const verificationToken = emailService.generateVerificationToken();
      user.verificationTokenHash = sha256(verificationToken);
      user.verificationTokenExpires = new Date(Date.now() + VERIFY_EXPIRY_MS()).toISOString();
      await db.save(user);

      const result = await emailService.sendVerificationLink(user.email, verificationToken, user.name);
      if (!result?.success) {
        logger.error('Resend verification failed', { error: result?.error, userId: user.id });
        return res.status(503).json({ error: 'Non riusciamo a inviare l\'email in questo momento. Riprova tra qualche minuto.' });
      }
      const payload = {
        status: 'success',
        message: 'Link di verifica inviato di nuovo.',
        emailDelivery: result.delivery,
        emailHint: result.hint || '',
      };
      if (isDevelopment() && process.env.EMAIL_EXPOSE_VERIFY_LINK === '1' && result.actionLink) {
        payload.devVerificationLink = result.actionLink;
      }
      return res.json(payload);
    } catch (err) {
      logger.error('Resend verification code error', { error: err.message });
      return res.status(500).json({ error: 'Errore durante il reinvio. Riprova.' });
    }
  });

  // ------------------------------------------------------------ PROFILO
  app.get('/api/auth/profile', authenticateToken, (req, res) => {
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

  app.post('/api/auth/verify', authenticateToken, (req, res) => {
    const user = req.userRecord;
    return res.json({ valid: true, user: { id: user.id, name: user.name, email: user.email } });
  });
};
