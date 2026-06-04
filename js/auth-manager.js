// Auth Manager v3 - Secure JWT con httpOnly Cookies
// Tokens are now managed by server-side httpOnly cookies for XSS protection
// Client only stores user metadata in localStorage

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
    try {
      window.dispatchEvent(new CustomEvent('evil-auth-changed', { detail: { user } }));
    } catch (_) { /* ignore */ }
  },
  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (err) {
      console.warn('User parse error:', err);
      return null;
    }
  },
  clearUser() {
    localStorage.removeItem('user');
    try {
      window.dispatchEvent(new CustomEvent('evil-auth-changed', { detail: null }));
    } catch (_) { /* ignore */ }
  },
  clear() {
    this.clearUser();
  }
};

function notifyAuthVerified() {
  try {
    const bc = new BroadcastChannel('evil-auth');
    bc.postMessage({ type: 'email-verified' });
    bc.close();
  } catch (_) { /* ignore */ }
}

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
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.warn('Sessione:', err.message || err);
    }
    return null;
  }
}

/**
 * Ripristina user in localStorage dalla sessione cookie (httpOnly).
 * @returns {Promise<Object|null>}
 */
async function syncUserFromServer() {
  let user = await fetchSession();
  if (user) {
    AUTH_STORAGE.setUser(user);
    return user;
  }

  const refreshed = await refreshAccessToken();
  if (refreshed) {
    user = await fetchSession();
    if (user) {
      AUTH_STORAGE.setUser(user);
      return user;
    }
  }

  return null;
}

function isAuthenticated() {
  try {
    const user = AUTH_STORAGE.getUser();
    return !!(user && user.id && user.name && user.email);
  } catch (err) {
    console.warn('Auth check error:', err);
    return false;
  }
}

function getCurrentUser() {
  try {
    const user = AUTH_STORAGE.getUser();
    if (!user || !user.id || !user.name || !user.email) {
      return null;
    }
    return user;
  } catch (err) {
    console.warn('User error:', err);
    return null;
  }
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
    if (data.status === 'success') {
      if (data.user) AUTH_STORAGE.setUser(data.user);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Token refresh error:', err);
    return false;
  }
}

async function fetchAuthenticated(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
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
    try {
      await fetch(`${AUTH_API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.warn('Server logout fallito (procedi comunque):', err);
    }

    AUTH_STORAGE.clear();
    window.location.replace('login.html');
  } catch (err) {
    console.error('Logout error:', err);
    AUTH_STORAGE.clear();
    window.location.replace('login.html');
  }
}

function renderGuestAuthButtons(authButtons) {
  authButtons.innerHTML = `
    <button class="auth-btn account" onclick="window.location.href='login.html';" aria-label="Accedi a EVIL">Accedi</button>
    <button class="auth-btn login" onclick="window.location.href='account.html';" aria-label="Registrati su EVIL">Registrati</button>
  `;
}

function renderUserAuthButtons(authButtons, user) {
  authButtons.innerHTML = `
    <div class="user-menu">
      <a href="profile.html" class="user-name" title="👤 ${escapeHtml(user.name || 'Utente')} - Visualizza il tuo profilo e i tuoi trofei">
        👤 ${escapeHtml(getInitials(user.name))}
      </a>
      <button class="auth-btn logout" onclick="logout();">Log Out</button>
    </div>
  `;
}

/**
 * Inizializza il header: cookie httpOnly + cache localStorage
 */
async function initAuthHeader() {
  const authButtons = document.querySelector('.auth-buttons');
  if (!authButtons) return;

  const cached = getCurrentUser();
  if (cached) {
    renderUserAuthButtons(authButtons, cached);
  }

  const serverUser = await syncUserFromServer();
  if (serverUser) {
    renderUserAuthButtons(authButtons, serverUser);
    return;
  }

  if (!cached) {
    renderGuestAuthButtons(authButtons);
  } else {
    AUTH_STORAGE.clearUser();
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
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function getInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'U';
  return fullName
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3);
}

window.AUTH_STORAGE = AUTH_STORAGE;
window.logout = logout;
window.initAuthHeader = scheduleInitAuthHeader;
window.syncUserFromServer = syncUserFromServer;
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.notifyAuthVerified = notifyAuthVerified;

window.addEventListener('storage', (e) => {
  if (e.key === 'user') scheduleInitAuthHeader();
});

try {
  const authBc = new BroadcastChannel('evil-auth');
  authBc.onmessage = (ev) => {
    if (ev.data?.type === 'email-verified') scheduleInitAuthHeader();
  };
} catch (_) { /* ignore */ }

window.addEventListener('evil-auth-changed', () => scheduleInitAuthHeader());

window.addEventListener('pageshow', () => scheduleInitAuthHeader());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') scheduleInitAuthHeader();
});
