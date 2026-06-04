/**
 * EVIL Tools API — fetch uniforme per gli strumenti
 * Login obbligatorio: cookie httpOnly + cache localStorage
 */
(function () {
  const TOOLS_PUBLIC = false;
  const page = window.location.pathname.split('/').pop() || 'home.html';
  const LOGIN_URL = 'login.html?redirect=' + encodeURIComponent(page);

  function loadAuthManager() {
    if (typeof syncUserFromServer === 'function') return Promise.resolve();
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = '/js/auth-manager.js?v=20260607';
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  async function ensureToolAuth(silent) {
    if (TOOLS_PUBLIC) return true;
    await loadAuthManager();
    if (typeof isAuthenticated === 'function' && isAuthenticated()) return true;
    if (typeof syncUserFromServer === 'function') {
      const user = await syncUserFromServer();
      if (user) return true;
    }
    if (!silent) {
      window.location.href = LOGIN_URL;
    }
    return false;
  }

  async function handleAuthResponse(response) {
    if (response.status === 401 && !TOOLS_PUBLIC) {
      if (typeof AUTH_STORAGE !== 'undefined') AUTH_STORAGE.clearUser();
      window.location.href = LOGIN_URL;
      throw new Error('Autenticazione richiesta');
    }
    return response;
  }

  async function postToolJson(path, body) {
    if (!(await ensureToolAuth())) throw new Error('Non autenticato');
    const response = await handleAuthResponse(
      await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Errore server (${response.status})`);
    return data;
  }

  async function uploadToolFile(path, file) {
    if (!(await ensureToolAuth())) throw new Error('Non autenticato');
    const fd = new FormData();
    fd.append('file', file);
    const response = await handleAuthResponse(
      await fetch(path, { method: 'POST', credentials: 'include', body: fd })
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Errore upload (${response.status})`);
    return data;
  }

  async function downloadToolPdf(path, body, filename) {
    if (!(await ensureToolAuth())) throw new Error('Non autenticato');
    const response = await handleAuthResponse(
      await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      })
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Errore PDF (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'report.pdf';
    link.click();
    URL.revokeObjectURL(url);
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (TOOLS_PUBLIC) return;
    await loadAuthManager();
    if (typeof isAuthenticated === 'function' && isAuthenticated()) return;
    if (typeof syncUserFromServer === 'function') {
      const user = await syncUserFromServer();
      if (user) return;
    }
    window.location.replace(LOGIN_URL);
  });

  window.EvilTools = {
    ensureToolAuth,
    postToolJson,
    uploadToolFile,
    downloadToolPdf,
    TOOLS_PUBLIC
  };
})();
