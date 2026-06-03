/**
 * EVIL Tools API — fetch uniforme per gli strumenti
 * TEMP: EVIL_TOOLS_PUBLIC=true → nessun login richiesto (allineato al backend)
 */
(function () {
  const TOOLS_PUBLIC = true;
  const page = window.location.pathname.split('/').pop() || 'home.html';
  const LOGIN_URL = 'login.html?redirect=' + encodeURIComponent(page);

  function ensureToolAuth(silent) {
    if (TOOLS_PUBLIC) return true;
    if (typeof isAuthenticated === 'function' && isAuthenticated()) return true;
    if (!silent && confirm('Accedi per usare questo strumento.\n\nVai al login?')) {
      window.location.href = LOGIN_URL;
    }
    return false;
  }

  async function handleAuthResponse(response) {
    if (response.status === 401 && !TOOLS_PUBLIC) {
      if (confirm('Sessione scaduta o non autenticato. Vai al login?')) {
        window.location.href = LOGIN_URL;
      }
      throw new Error('Autenticazione richiesta');
    }
    return response;
  }

  async function postToolJson(path, body) {
    if (!ensureToolAuth()) throw new Error('Non autenticato');
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
    if (!ensureToolAuth()) throw new Error('Non autenticato');
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
    if (!ensureToolAuth()) throw new Error('Non autenticato');
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

  window.EvilTools = {
    ensureToolAuth,
    postToolJson,
    uploadToolFile,
    downloadToolPdf,
    TOOLS_PUBLIC
  };
})();
