// ==================== AUTENTICAZIONE ====================
// Middleware di autenticazione (creati con le dipendenze del server) e validazione
// dei dati di registrazione e login.

const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const {
  getAccessTokenFromRequest,
  getRefreshTokenFromCookie,
  setAccessCookie,
} = require('../utils/token-utils');

// Lettere di qualunque alfabeto (accenti inclusi), spazi, apostrofi, punti e trattini: Nicolò, José, D'Alò, J. R.
const NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u;
// Qualunque simbolo che non sia lettera, cifra o spazio (prima solo @$!%*?& sul client)
const PASSWORD_SPECIALS = /[^\p{L}\p{N}\s]/u;

/** Utente ospite, solo con EVIL_TOOLS_PUBLIC=1 (test interni) */
const GUEST_USER = { id: 'guest', name: 'Ospite', email: 'guest@evil.local' };

function toolsArePublic() {
  const flag = process.env.EVIL_TOOLS_PUBLIC;
  return flag === '1' || flag === 'true';
}

/**
 * Crea i middleware di autenticazione.
 * Se l'access token è scaduto ma il refresh token è valido, la sessione viene
 * rinnovata in modo trasparente (nuovo cookie di accesso nella stessa risposta):
 * l'utente non viene rimandato al login dopo un'ora di inattività.
 */
function createAuthMiddleware({ sessions }) {
  async function resolveUser(req, res) {
    const token = getAccessTokenFromRequest(req);
    if (token) {
      const verified = sessions.verifyAccess(token);
      if (verified.payload) {
        const user = sessions.userForAccess(verified.payload);
        if (user) return { user, sid: verified.payload.sid };
        // sessione chiusa (logout/reset): non si rinnova con il refresh dello stesso utente revocato
      }
    }
    const refreshToken = getRefreshTokenFromCookie(req);
    if (refreshToken) {
      const refreshed = await sessions.refresh(refreshToken);
      if (refreshed.user) {
        setAccessCookie(res, refreshed.accessToken, refreshed.accessMs);
        return { user: refreshed.user, sid: refreshed.sid, refreshed: true };
      }
      return { error: refreshed.error === 'expired' ? 'expired' : 'revoked' };
    }
    return { error: token ? 'expired' : 'missing' };
  }

  function attach(req, found) {
    req.user = { id: found.user.id, email: found.user.email, name: found.user.name, sid: found.sid };
    req.userRecord = found.user;
  }

  const authenticateToken = (req, res, next) => {
    resolveUser(req, res)
      .then((found) => {
        if (!found.user) {
          const code = found.error === 'missing' ? 'NO_TOKEN' : found.error === 'expired' ? 'TOKEN_EXPIRED' : 'SESSION_REVOKED';
          const error =
            found.error === 'missing' ? 'Accedi per continuare.' : 'Sessione scaduta: accedi di nuovo.';
          return res.status(401).json({ error, code });
        }
        attach(req, found);
        return next();
      })
      .catch(next);
  };

  const optionalAuthenticate = (req, res, next) => {
    resolveUser(req, res)
      .then((found) => {
        if (found.user) attach(req, found);
        next();
      })
      .catch(next);
  };

  const authenticateTools = (req, res, next) => {
    if (!toolsArePublic()) return authenticateToken(req, res, next);
    return optionalAuthenticate(req, res, (err) => {
      if (err) return next(err);
      if (!req.user) req.user = { ...GUEST_USER };
      return next();
    });
  };

  return { authenticateToken, optionalAuthenticate, authenticateTools, resolveUser };
}

// ---------------------------------------------------------------- password e validazione

/**
 * Requisiti password: almeno 12 caratteri, una maiuscola, un numero e un carattere speciale.
 * Messaggi in italiano, mostrati così come sono nell'interfaccia.
 */
const validatePasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < 12) {
    return { valid: false, reason: 'La password deve avere almeno 12 caratteri.' };
  }
  if (password.length > 200) {
    return { valid: false, reason: 'La password è troppo lunga (massimo 200 caratteri).' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'La password deve contenere almeno una lettera maiuscola.' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, reason: 'La password deve contenere almeno un numero.' };
  }
  if (!PASSWORD_SPECIALS.test(password)) {
    return { valid: false, reason: 'La password deve contenere almeno un simbolo (per esempio ! ? @ # % . -).' };
  }
  return { valid: true };
};

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((e) => ({ field: e.path || e.param, message: e.msg }));
    return res.status(400).json({
      error: details[0]?.message || 'Dati non validi.',
      code: 'VALIDATION_FAILED',
      details,
    });
  }
  return next();
}

const validateRegister = [
  body('name')
    .isString().withMessage('Inserisci il nome.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Il nome deve avere tra 2 e 100 caratteri.')
    .bail()
    .matches(NAME_REGEX).withMessage('Il nome può contenere solo lettere (anche accentate), spazi, apostrofi, punti e trattini.'),
  body('email')
    .isString().withMessage('Inserisci un indirizzo email.')
    .bail()
    .trim()
    .isLength({ max: 254 }).withMessage('Indirizzo email troppo lungo.')
    .bail()
    .isEmail().withMessage('Indirizzo email non valido.')
    .bail()
    .customSanitizer((v) => String(v).toLowerCase()),
  body('password').custom((value) => {
    const check = validatePasswordStrength(value);
    if (!check.valid) throw new Error(check.reason);
    return true;
  }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Le password non coincidono.');
    return true;
  }),
  handleValidation,
];

const validateLogin = [
  body('email')
    .isString().withMessage('Inserisci un indirizzo email.')
    .bail()
    .trim()
    .isEmail().withMessage('Indirizzo email non valido.')
    .bail()
    .customSanitizer((v) => String(v).toLowerCase()),
  body('password')
    .isString().withMessage('Inserisci la password.')
    .bail()
    .isLength({ min: 1, max: 200 }).withMessage('Inserisci la password.'),
  handleValidation,
];

const hashPassword = async (password) => {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || 12, 10);
  return bcrypt.hash(password, rounds);
};

const verifyPassword = async (plainPassword, hashedPassword) => {
  if (typeof plainPassword !== 'string' || typeof hashedPassword !== 'string') return false;
  return bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = {
  createAuthMiddleware,
  toolsArePublic,
  validateRegister,
  validateLogin,
  validatePasswordStrength,
  hashPassword,
  verifyPassword,
  NAME_REGEX,
};
