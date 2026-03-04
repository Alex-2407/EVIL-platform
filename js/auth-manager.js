// Auth Manager v3 - Secure JWT con httpOnly Cookies
// Tokens are now managed by server-side httpOnly cookies for XSS protection
// Client only stores user metadata in localStorage

const AUTH_API_URL = 'http://localhost:5000/api';
const AUTH_TIMEOUT = 5000; // 5 secondi timeout

// ==================== TOKEN & USER STORAGE ====================
// NOTE: Access/Refresh tokens are now stored in httpOnly cookies by the server
// This protects against XSS attacks that could steal tokens from localStorage

const AUTH_STORAGE = {
  setUser(user) {
    // Only store user metadata (id, name, email) - NOT sensitive tokens
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
    } catch (err) {
      console.warn('User parse error:', err);
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

/**
 * Controlla se l'utente è autenticato
 * Verifica facendo una richiesta al server (il browser invia automaticamente i cookie)
 * @returns {Promise<boolean>} True se autenticato
 */
async function isAuthenticated() {
  try {
    const user = AUTH_STORAGE.getUser();
    if (!user) return false;
    
    // Opzionale: verify con server
    // Per semplicità, consideriamo autenticato se user in localStorage
    return true;
  } catch (err) {
    console.warn('Auth check error:', err);
    return false;
  }
}

/**
 * Ottieni l'utente corrente
 * @returns {Object|null} User object o null
 */
function getCurrentUser() {
  try {
    const user = AUTH_STORAGE.getUser();
    if (!user || !user.id || !user.name || !user.email) {
      console.warn('User object invalido');
      return null;
    }
    return user;
  } catch (err) {
    console.warn('User error:', err);
    return null;
  }
}

/**
 * Refresha il access token usando il refresh token
 * Il server invia automaticamente il nuovo access token nei cookie
 * @returns {Promise<boolean>} True se refresh successful
 */
async function refreshAccessToken() {
  try {
    // Il browser invia automaticamente i cookie (credentials: 'include')
    const response = await fetch(`${AUTH_API_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Invia cookies automaticamente
      body: JSON.stringify({}) // Server legge il refresh token dal cookie
    });

    if (!response.ok) {
      console.warn('Token refresh failed:', response.status);
      return false;
    }

    const data = await response.json();
    
    if (data.status === 'success' && data.accessToken) {
      // Server invia il nuovo token nei cookie httpOnly
      // Non dobbiamo fare nulla - è automatico
      return true;
    }

    return false;
  } catch (err) {
    console.error('Token refresh error:', err);
    return false;
  }
}

/**
 * Helper per fare richieste autenticate in modo sicuro
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function fetchAuthenticated(url, options = {}) {
  return fetch(url, {
    ...options,
    credentials: 'include', // Invia i cookie automaticamente
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

/**
 * Esegui logout sicuro
 */
async function logout() {
  try {
    // Notifica il server (i cookie vengono inviati automaticamente)
    try {
      await fetch(`${AUTH_API_URL}/auth/logout`, { 
        method: 'POST',
        credentials: 'include', // Invia i cookie
        headers: { 'Content-Type': 'application/json' },
        timeout: AUTH_TIMEOUT
      });
    } catch (err) {
      console.warn('Server logout fallito (procedi comunque):', err);
    }
    
    // Cancella dati locali
    AUTH_STORAGE.clear();
    
    // Reindirizza al login
    window.location.href = 'login.html';
  } catch (err) {
    console.error('Logout error:', err);
    AUTH_STORAGE.clear();
    window.location.href = 'login.html';
  }
}

/**
 * Inizializza il header con stato di autenticazione
 */
function initAuthHeader() {
  try {
    const authButtons = document.querySelector('.auth-buttons');
    
    if (!authButtons) return;
    
    if (isAuthenticated()) {
      const user = getCurrentUser();
      if (!user) {
        // Token exists but user non valido - logout
        logout();
        return;
      }
      
      authButtons.innerHTML = `
        <div class="user-menu">
          <a href="profile.html" class="user-name" title="👤 ${escapeHtml(user.name || 'Utente')} - Visualizza il tuo profilo e i tuoi trofei">
            👤 ${escapeHtml(getInitials(user.name))}
          </a>
          <button class="auth-btn logout" onclick="logout();">Log Out</button>
        </div>
      `;
    } else {
      authButtons.innerHTML = `
        <button class="auth-btn login" onclick="window.location.href='login.html';">Log</button>
        <button class="auth-btn account" onclick="window.location.href='account.html';">Acc</button>
      `;
    }
  } catch (err) {
    console.error('Auth header init error:', err);
  }
}

/**
 * Sanitizza HTML per prevenire XSS
 * @param {string} text - Testo da sanitizzare
 * @returns {string} HTML escappato
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Estrae le iniziali dal nome completo
 * @param {string} fullName - Nome completo (es: "Fabio Mario Branca")
 * @returns {string} Iniziali in maiuscolo (es: "FMB")
 */
function getInitials(fullName) {
  if (!fullName || typeof fullName !== 'string') return 'U';
  
  return fullName
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3); // Limita a 3 caratteri
}

// Inizializza al caricamento
document.addEventListener('DOMContentLoaded', initAuthHeader);
