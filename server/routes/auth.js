'use strict';
// Autenticazione (estratto da js/server.js)
const crypto = require('crypto');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = function registerAuth(app, ctx) {
  const {
    db, logger, auditLog, emailService, tokenManager,
    authenticateToken, optionalAuthenticate, validateRegister, validateLogin,
    verifyPassword, validatePasswordStrength,
    registerLimiter, authLimiter, loginIpLimiter, refreshTokenLimiter, passwordResetLimiter,
    passwordResetEmailLimiter, verificationLimiter, verificationStatusLimiter,
    setTokenCookies, clearAuthCookies, getRefreshTokenFromCookie,
    JWT_SECRET,
  } = ctx;

  /** Set httpOnly auth cookies and persist refresh token in Redis */
  async function establishAuthSession(res, user) {
    const tokens = setTokenCookies(res, user.id, user.email, user.name);
    await tokenManager.storeRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  // ========================
  // ENDPOINT AUTENTICAZIONE
  // ========================

  // REGISTRAZIONE
  app.post('/api/auth/register', registerLimiter, validateRegister, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const normalizedEmail = email.toLowerCase();

      const existingUser = db.users.find(u => u.email === normalizedEmail);
      if (existingUser) {
        return res.status(400).json({
          error: 'Questa email è già registrata. Prova ad accedere.'
        });
      }

      const verificationToken = emailService.generateVerificationToken();
      const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      const verificationExpiresMs = parseInt(process.env.EMAIL_VERIFY_EXPIRY_MS || `${24 * 60 * 60 * 1000}`, 10);

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12);
      const hashedPassword = await bcryptjs.hash(password, rounds);

      const pendingUser = {
        id: crypto.randomUUID ? crypto.randomUUID() : `uid_${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        emailVerified: false,
        verificationTokenHash,
        verificationTokenExpires: new Date(Date.now() + verificationExpiresMs).toISOString(),
        verificationCodeHash: null,
        verificationCodeExpires: null,
        loginHistory: [],
        failedLogins: 0,
        lockedUntil: null,
        progress: {
          scans: 0,
          activities: 0,
          unlockedAchievements: []
        }
      };

      db.users.push(pendingUser);
      if (!db.save()) {
        db.users = db.users.filter((u) => u.id !== pendingUser.id);
        return res.status(500).json({
          error:
            'Impossibile salvare l\'account sul server. Imposta DATA_DIR su una cartella scrivibile (es. /tmp/evil-data su Render).',
        });
      }

      let emailResult;
      try {
        emailResult = await emailService.sendRegistrationVerification(
          normalizedEmail,
          verificationToken,
          name
        );
      } catch (emailErr) {
        logger.error('Registration email send failed', {
          error: emailErr.message,
          email: normalizedEmail,
        });
        db.users = db.users.filter((u) => u.id !== pendingUser.id);
        db.save();
        return res.status(503).json({
          error:
            'Impossibile inviare l\'email di verifica. L\'account non è stato creato. Controlla SMTP su Render (vedi /api/health/smtp?verify=1).',
          details: emailErr.message,
        });
      }

      if (!emailResult.success) {
        db.users = db.users.filter((u) => u.id !== pendingUser.id);
        db.save();
        const smtpErr = emailResult.error || '';
        return res.status(503).json({
          error:
            'Impossibile inviare l\'email di verifica. L\'account non è stato creato finché la mail non parte.',
          details: smtpErr,
          smtpHint:
            'Render FREE blocca SMTP (porte 587/465). Usa MAILTRAP_API_TOKEN=token Sending + EMAIL_USE_MAILTRAP_API=1, oppure upgrade piano Render a pagamento.',
        });
      }

      auditLog.security('USER_REGISTERED_PENDING', { userId: pendingUser.id, email: normalizedEmail }, 'INFO');

      const payload = {
        status: 'success',
        message:
          'Controlla la tua casella email (anche spam) e clicca il link EVIL per attivare l\'account.',
        requiresVerification: true,
        userId: pendingUser.id,
        email: normalizedEmail,
        emailDelivery: emailResult.delivery || 'smtp',
        emailHint: emailResult.hint || 'Se non vedi l\'email, controlla la cartella spam.',
      };

      const exposeDevLink =
        process.env.NODE_ENV !== 'production' && process.env.EMAIL_EXPOSE_VERIFY_LINK === '1';
      if (exposeDevLink && emailResult.actionLink) {
        payload.devVerificationLink = emailResult.actionLink;
      }

      res.json(payload);
    } catch (err) {
      logger.error('Registration error', { error: err.message });
      res.status(500).json({ error: 'Errore registrazione' });
    }
  });

  // VERIFICA EMAIL VIA LINK (GET dal client mail)
  app.get('/api/auth/verify-email', async (req, res) => {
    const fail = (reason) => {
      res.redirect(`/html/verify-email.html?status=error&reason=${encodeURIComponent(reason)}`);
    };

    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return fail('missing');
      }

      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = db.users.find(u => u.verificationTokenHash === tokenHash);

      if (!user) {
        return fail('invalid');
      }

      if (user.emailVerified) {
        await establishAuthSession(res, user);
        return res.redirect('/html/verify-email.html?status=success');
      }

      if (user.verificationTokenExpires && new Date() > new Date(user.verificationTokenExpires)) {
        return fail('expired');
      }

      user.emailVerified = true;
      user.verificationTokenHash = null;
      user.verificationTokenExpires = null;
      user.verificationCodeHash = null;
      user.verificationCodeExpires = null;
      db.save();

      await establishAuthSession(res, user);
      auditLog.security('USER_EMAIL_VERIFIED', { userId: user.id, email: user.email }, 'INFO');

      res.redirect('/html/verify-email.html?status=success');
    } catch (err) {
      logger.error('Email link verification error', { error: err.message });
      fail('server');
    }
  });

  // VERIFICA CODICE EMAIL
  app.post('/api/auth/verify-email-code', verificationLimiter, async (req, res) => {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ error: 'User ID e codice obbligatori' });
      }

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Controlla se il codice è scaduto
      if (new Date() > new Date(user.verificationCodeExpires)) {
        return res.status(403).json({ error: 'Codice di verifica scaduto. Registrati di nuovo.' });
      }

      // Verifica il codice
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      if (codeHash !== user.verificationCodeHash) {
        return res.status(403).json({ error: 'Codice di verifica non valido' });
      }

      // Marca email come verificata
      user.emailVerified = true;
      user.verificationCodeHash = null;
      user.verificationCodeExpires = null;
      db.save();

      await establishAuthSession(res, user);

      auditLog.security('USER_EMAIL_VERIFIED', { userId: user.id, email: user.email }, 'INFO');

      res.json({
        status: 'success',
        message: 'Email verificata con successo',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: true
        }
      });
    } catch (err) {
      logger.error('Email verification error', { error: err.message });
      res.status(500).json({ error: 'Errore verifica email' });
    }
  });

  // LOGIN
  app.post('/api/auth/login', loginIpLimiter, authLimiter, validateLogin, async (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase();

      // Check if account is locked
      const isLocked = await tokenManager.isAccountLocked(normalizedEmail);
      if (isLocked) {
        auditLog.accountLocked(null, normalizedEmail, req.ip, 'Account locked (too many attempts)');
        return res.status(429).json({
          error: 'Account temporarily locked due to failed login attempts'
        });
      }

      // Find user
      const user = db.users.find(u => u.email === normalizedEmail);
      if (!user) {
        auditLog.loginFailed(normalizedEmail, req.ip, 'Invalid credentials');
        // Generic error (no email enumeration)
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const passwordMatch = await verifyPassword(password, user.password);
      if (!passwordMatch) {
        // Increment failed logins
        user.failedLogins = (user.failedLogins || 0) + 1;
        const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || 5);

        if (user.failedLogins >= maxAttempts) {
          const lockoutDuration = parseInt(process.env.LOCKOUT_DURATION || 1800000);
          await tokenManager.lockAccount(normalizedEmail, lockoutDuration);
          user.lockedUntil = new Date(Date.now() + lockoutDuration).toISOString();
          db.save();

          auditLog.accountLocked(user.id, normalizedEmail, req.ip, `Failed login attempts: ${user.failedLogins}`);
          return res.status(429).json({
            error: 'Account locked due to too many failed login attempts'
          });
        }

        db.save();
        auditLog.loginFailed(normalizedEmail, req.ip, `Failed attempts: ${user.failedLogins}/${maxAttempts}`);
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          error: 'Devi verificare la tua email prima di accedere. Controlla la inbox (e lo spam).',
          requiresVerification: true,
          userId: user.id,
          email: user.email
        });
      }

      // Reset failed logins on successful auth
      user.failedLogins = 0;
      user.lockedUntil = null;

      // Register login
      if (!user.loginHistory) user.loginHistory = [];
      user.loginHistory.push({
        timestamp: new Date().toISOString(),
        ip: req.ip || 'unknown'
      });

      db.save();
      auditLog.loginSuccess(user.id, normalizedEmail, req.ip);

      await establishAuthSession(res, user);

      res.json({
        status: 'success',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: !!user.emailVerified
        }
      });
    } catch (err) {
      logger.error('Login error', { error: err.message });
      res.status(500).json({ error: 'Errore login' });
    }
  });

  // REFRESH TOKEN
  // REFRESH TOKEN
  app.post('/api/auth/refresh-token', refreshTokenLimiter, async (req, res) => {
    try {
      const refreshToken = getRefreshTokenFromCookie(req) || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
      }

      jwt.verify(refreshToken, process.env.JWT_SECRET_REFRESH, async (err, decoded) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Refresh token expired' });
          }
          return res.status(403).json({ error: 'Invalid refresh token' });
        }

        // Check if token still exists in Redis
        const stored = await tokenManager.getRefreshToken(decoded.id);
        if (!stored || stored.token !== refreshToken) {
          return res.status(403).json({ error: 'Refresh token revoked or expired' });
        }

        const user = db.users.find(u => u.id === decoded.id);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        await establishAuthSession(res, user);

        res.json({
          status: 'success',
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: !!user.emailVerified
          }
        });
      });
    } catch (err) {
      logger.error('Token refresh error', { error: err.message });
      res.status(500).json({ error: 'Errore refresh token' });
    }
  });

  // LOGOUT
  app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
      await tokenManager.revokeRefreshToken(req.user.id);
      clearAuthCookies(res);

      auditLog.security('USER_LOGOUT', { userId: req.user.id }, 'INFO');
      res.json({ status: 'success', message: 'Logout completato' });
    } catch (err) {
      logger.error('Logout error', { error: err.message });
      res.status(500).json({ error: 'Errore logout' });
    }
  });

  // PASSWORD RESET REQUEST
  app.post('/api/auth/forgot-password', passwordResetLimiter, passwordResetEmailLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      const genericResponse = {
        status: 'success',
        message: 'Se l\'indirizzo è registrato, riceverai un\'email con il link per reimpostare la password.'
      };

      if (!email || !String(email).trim()) {
        return res.status(400).json({ error: 'Email obbligatoria' });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const user = db.users.find((u) => u.email === normalizedEmail);

      if (!user) {
        return res.json(genericResponse);
      }

      const resetToken = emailService.generateVerificationToken();
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetExpiryMs = parseInt(process.env.PASSWORD_RESET_EXPIRY_MS || `${15 * 60 * 1000}`, 10);

      user.passwordResetTokenHash = resetTokenHash;
      user.passwordResetTokenExpires = new Date(Date.now() + resetExpiryMs).toISOString();
      db.save();

      const emailResult = await emailService.sendPasswordResetEmail(
        normalizedEmail,
        resetToken,
        user.name || 'Utente'
      );

      if (!emailResult.success) {
        user.passwordResetTokenHash = null;
        user.passwordResetTokenExpires = null;
        db.save();
        return res.status(500).json({
          error: emailResult.error || 'Impossibile inviare l\'email di reset. Riprova più tardi.'
        });
      }

      auditLog.security('PASSWORD_RESET_REQUESTED', { userId: user.id, email: normalizedEmail }, 'INFO');

      res.json({
        ...genericResponse,
        emailDelivery: emailResult.delivery || 'smtp',
        emailHint: emailResult.hint || ''
      });
    } catch (err) {
      logger.error('Forgot password error', { error: err.message });
      res.status(500).json({ error: 'Errore durante la richiesta di reset' });
    }
  });

  // RESET PASSWORD
  app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
    try {
      const { token, resetToken, newPassword, confirmPassword } = req.body;
      const rawToken = token || resetToken;

      if (!rawToken || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Tutti i campi obbligatori' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Le password non corrispondono' });
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        return res.status(400).json({ error: strength.reason });
      }

      const tokenHash = crypto.createHash('sha256').update(String(rawToken)).digest('hex');
      const user = db.users.find((u) => u.passwordResetTokenHash === tokenHash);

      if (!user) {
        return res.status(403).json({ error: 'Link non valido o già utilizzato. Richiedi un nuovo reset.' });
      }

      if (!user.passwordResetTokenExpires || new Date(user.passwordResetTokenExpires) < new Date()) {
        user.passwordResetTokenHash = null;
        user.passwordResetTokenExpires = null;
        db.save();
        return res.status(403).json({ error: 'Link scaduto. Richiedi un nuovo reset dalla pagina recupero password.' });
      }

      const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12, 10);
      user.password = await bcryptjs.hash(newPassword, rounds);
      user.passwordResetTokenHash = null;
      user.passwordResetTokenExpires = null;
      user.failedLogins = 0;
      user.lockedUntil = null;
      db.save();

      auditLog.security('PASSWORD_RESET_COMPLETED', { userId: user.id, email: user.email }, 'INFO');

      res.json({
        status: 'success',
        message: 'Password aggiornata. Puoi accedere con la nuova password.'
      });
    } catch (err) {
      logger.error('Reset password error', { error: err.message });
      res.status(500).json({ error: 'Errore durante il reset della password' });
    }
  });

  app.post('/api/auth/confirm-email', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token di conferma obbligatorio' });
      }

      jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
          return res.status(403).json({ error: 'Token di conferma non valido o scaduto' });
        }

        const user = db.users.find(u => u.id === decoded.id);
        if (!user) {
          return res.status(404).json({ error: 'Utente non trovato' });
        }

        user.emailVerified = true;
        db.save();

        res.json({ status: 'success', message: 'Email confermata con successo' });
      });
    } catch (err) {
      res.status(500).json({ error: 'Errore: ' + err.message });
    }
  });

  // Stato verifica email (polling da pagina "in attesa" — anche altro dispositivo)
  app.get('/api/auth/verification-status', verificationStatusLimiter, async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId obbligatorio' });
      }

      const user = db.users.find((u) => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato', emailVerified: false });
      }

      res.json({
        status: user.emailVerified ? 'verified' : 'pending',
        emailVerified: !!user.emailVerified,
      });
    } catch (err) {
      logger.error('Verification status error', { error: err.message });
      res.status(500).json({ error: 'Errore stato verifica' });
    }
  });

  // Sessione corrente (cookie httpOnly) — per header UI senza dipendere da localStorage
  app.get('/api/auth/session', optionalAuthenticate, (req, res) => {
    try {
      if (!req.user?.id) {
        return res.json({ authenticated: false });
      }

      const dbUser = db.users.find((u) => u.id === req.user.id);
      const email = dbUser?.email || req.user.email;
      const name =
        dbUser?.name ||
        req.user.name ||
        (email ? String(email).split('@')[0] : 'Utente');

      res.json({
        authenticated: true,
        user: {
          id: req.user.id,
          name,
          email,
          emailVerified: dbUser ? !!dbUser.emailVerified : true,
        },
      });
    } catch (err) {
      res.status(500).json({ authenticated: false, error: err.message });
    }
  });

  // REINVIA CODICE DI VERIFICA EMAIL
  app.post('/api/auth/resend-verification-code', verificationLimiter, async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID obbligatorio' });
      }

      const user = db.users.find(u => u.id === userId);
      if (!user) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      if (user.emailVerified) {
        return res.status(400).json({ error: 'Email già verificata' });
      }

      const verificationToken = emailService.generateVerificationToken();
      const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      const verificationExpiresMs = parseInt(process.env.EMAIL_VERIFY_EXPIRY_MS || `${24 * 60 * 60 * 1000}`, 10);

      user.verificationTokenHash = verificationTokenHash;
      user.verificationTokenExpires = new Date(Date.now() + verificationExpiresMs).toISOString();
      db.save();

      const emailResult = await emailService.sendVerificationLink(user.email, verificationToken, user.name);

      if (!emailResult.success) {
        return res.status(500).json({ error: emailResult.error || 'Errore invio email. Riprova.' });
      }

      const payload = {
        status: 'success',
        message: 'Link di verifica reinviato',
        emailDelivery: emailResult.delivery,
        emailHint: emailResult.hint || ''
      };
      if (process.env.NODE_ENV !== 'production' && emailResult.verificationLink) {
        payload.devVerificationLink = emailResult.verificationLink;
      }
      res.json(payload);
    } catch (err) {
      logger.error('Resend verification code error', { error: err.message });
      res.status(500).json({ error: 'Errore: ' + err.message });
    }
  });

  // GET PROFILO
  app.get('/api/auth/profile', authenticateToken, (req, res) => {
    try {
      const user = db.users.find(u => u.id === req.user.id);

      if (!user) {
        return res.status(401).json({ error: 'Utente non trovato' });
      }

      res.json({
        status: 'success',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          emailVerified: !!user.emailVerified,
          progress: user.progress || defaultProgress(),
          loginHistory: (user.loginHistory || []).slice(-5)
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // VERIFICA TOKEN (sessione cookie o Bearer)
  app.post('/api/auth/verify', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.json({ valid: false });
    }

    res.json({
      valid: true,
      user: { id: user.id, name: user.name, email: user.email }
    });
  });
};
