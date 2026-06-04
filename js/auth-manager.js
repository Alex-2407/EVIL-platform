// Auth Manager — sessione httpOnly + UI header
const AUTH_API_URL = window.location.origin + '/api';
const AUTH_TIMEOUT = 8000;

let logoutInProgress = false;
let authHeaderInitPromise = null;

const AUTH_STORAGE = {
  setUser(user) {
    localStorage.setItem('user', JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email
    }));
  },
  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },
  clearUser() {
    localStorage.removeItem('user');
  },
  clear() {
    this.clearUser();
  }
};

async function fetchSession() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT);
  try {
    const response = await fetch(`${AUTH_API_URL}/auth/session`, {
      credentials: 'include',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.authenticated && data.user?.id && data.user?.name && data.user?.email) {
      return data.user;
    }
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function syncUserFromServer() {
  let user = await fetchSession();
  if (user) {
    AUTH_STORAGE.setUser(user);
    return user;
  }
  if (await refreshAccessToken()) {
    user = await fetchSession();
    if (user) {
      AUTH_STORAGE.setUser(user);
      return user;
    }
  }
  return null;
}

function isAuthenticated() {
  const user = AUTH_STORAGE.getUser();
  return !!(user && user.id && user.name && user.email);
}

function getCurrentUser() {
  const user = AUTH_STORAGE.getUser();
  if (!user || !user.id || !user.name || !user.email) return null;
  return user;
}

async function refreshAccessToken() {
  try {
    const response = await fetch(`${AUTH_API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (data.status === 'success' && data.user) {
      AUTH_STORAGE.setUser(data.user);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function fetchAuthenticated(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
}

function getAuthHeaders() {
  return { 'Content-Type': 'application/json' };
}

async function apiFetch(url, options = {}) {
  return fetchAuthenticated(url, options);
}

async function logout() {
  if (logoutInProgress) return;
  logoutInProgress = true;
  try {
    await fetch(`${AUTH_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});
    AUTH_STORAGE.clear();
    window.location.replace('login.html');
  } catch {
    AUTH_STORAGE.clear();
    window.location.replace('login.html');
  }
}

function renderGuestAuthButtons(authButtons) {
  authButtons.innerHTML = `
    <button class="auth-btn account" type="button" onclick="window.location.href='login.html';" aria-label="Accedi a EVIL">Accedi</button>
    <button class="auth-btn login" type="button" onclick="window.location.href='account.html';" aria-label="Registrati su EVIL">Registrati</button>
  `;
}

function renderUserAuthButtons(authButtons, user) {
  authButtons.innerHTML = `
    <div class="user-menu">
      <a href="profile.html" class="user-name" title="👤 ${escapeHtml(user.name || 'Utente')}">
        👤 ${escapeHtml(getInitials(user.name))}
      </a>
      <button class="auth-btn logout" type="button" onclick="logout();">Log Out</button>
    </div>
  `;
}

async function initAuthHeader() {
  const authButtons = document.querySelector('header .auth-buttons') || document.querySelector('.auth-buttons');
  if (!authButtons) return;

  const cached = getCurrentUser();
  if (cached) renderUserAuthButtons(authButtons, cached);

  const serverUser = await syncUserFromServer();
  if (serverUser) {
    renderUserAuthButtons(authButtons, serverUser);
    return;
  }

  if (!cached) {
    renderGuestAuthButtons(authButtons);
  }
}

function scheduleInitAuthHeader() {
  if (authHeaderInitPromise) return authHeaderInitPromise;
  authHeaderInitPromise = initAuthHeader().finally(() => {
    authHeaderInitPromise = null;
  });
  return authHeaderInitPromise;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function getInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'U';
  return fullName.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).join('').substring(0, 3);
}

function notifyAuthVerified() {
  try {
    const bc = new BroadcastChannel('evil-auth');
    bc.postMessage({ type: 'email-verified' });
    bc.close();
  } catch { /* ignore */ }
}

window.AUTH_STORAGE = AUTH_STORAGE;
window.logout = logout;
window.initAuthHeader = scheduleInitAuthHeader;
window.syncUserFromServer = syncUserFromServer;
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.notifyAuthVerified = notifyAuthVerified;
window.scheduleInitAuthHeader = scheduleInitAuthHeader;

window.addEventListener('storage', (e) => {
  if (e.key === 'user') scheduleInitAuthHeader();
});

try {
  const authBc = new BroadcastChannel('evil-auth');
  authBc.onmessage = (ev) => {
    if (ev.data?.type === 'email-verified') scheduleInitAuthHeader();
  };
} catch { /* ignore */ }

// Backup se load-header non parte
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => scheduleInitAuthHeader());
} else {
  scheduleInitAuthHeader();
}
