// ==================== COOKIE DI AUTENTICAZIONE ====================
// Access e refresh token viaggiano solo in cookie httpOnly (non leggibili da JavaScript).
// SameSite=Lax: il cookie non parte con richieste POST da altri siti, e le API
// accettano solo JSON, quindi un form esterno non può simulare un'azione dell'utente.

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

/** Opzioni comuni per impostare e cancellare i cookie (HTTPS in produzione + COOKIE_DOMAIN opzionale). */
function getAuthCookieOptions(maxAge) {
  const isProd = process.env.NODE_ENV === 'production';
  const opts = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  };
  if (maxAge != null) opts.maxAge = maxAge;
  const domain = process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN.trim();
  if (domain && isProd) opts.domain = domain;
  return opts;
}

function setAccessCookie(res, accessToken, accessMs) {
  res.cookie(ACCESS_COOKIE, accessToken, getAuthCookieOptions(accessMs));
}

function setAuthCookies(res, { accessToken, refreshToken, accessMs, refreshMs }) {
  setAccessCookie(res, accessToken, accessMs);
  if (refreshToken) res.cookie(REFRESH_COOKIE, refreshToken, getAuthCookieOptions(refreshMs));
}

function getAccessTokenFromRequest(req) {
  const header = String(req.headers.authorization || '');
  if (/^Bearer\s+\S+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  return req.cookies?.[ACCESS_COOKIE] || null;
}

function getRefreshTokenFromCookie(req) {
  return req.cookies?.[REFRESH_COOKIE] || null;
}

function clearAuthCookies(res) {
  const base = getAuthCookieOptions(null);
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}

module.exports = {
  getAuthCookieOptions,
  setAuthCookies,
  setAccessCookie,
  getAccessTokenFromRequest,
  getRefreshTokenFromCookie,
  clearAuthCookies,
};
