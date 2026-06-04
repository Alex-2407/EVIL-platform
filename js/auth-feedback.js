/**
 * EVIL — messaggi errore auth visibili e copiabili (login / registrazione)
 */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  function buildReport(opts) {
    const lines = [
      `EVIL auth — ${new Date().toISOString()}`,
      `Pagina: ${global.location?.href || '—'}`,
      `Azione: ${opts.action || '—'}`,
    ];
    if (opts.status != null) lines.push(`HTTP: ${opts.status}`);
    if (opts.message) lines.push(`Messaggio: ${opts.message}`);
    if (opts.raw) lines.push(`Dettaglio: ${typeof opts.raw === 'string' ? opts.raw : JSON.stringify(opts.raw)}`);
    if (opts.hint) lines.push(`Nota: ${opts.hint}`);
    return lines.join('\n');
  }

  function hideAuthError(container) {
    if (!container) return;
    container.style.display = 'none';
    container.innerHTML = '';
    container.classList.remove('auth-error-panel--open');
  }

  function showAuthError(container, opts) {
    if (!container) return;
    const message = opts.message || 'Errore sconosciuto';
    const report = buildReport(opts);
    container.className = 'auth-message auth-message--error auth-error-panel auth-error-panel--open';
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'assertive');
    container.innerHTML = `
      <p class="auth-error-panel__title">${escapeHtml(message)}</p>
      ${opts.status != null ? `<p class="auth-error-panel__meta">Codice HTTP: <strong>${escapeHtml(String(opts.status))}</strong></p>` : ''}
      ${opts.hint ? `<p class="auth-error-panel__hint">${escapeHtml(opts.hint)}</p>` : ''}
      <details class="auth-error-panel__details">
        <summary>Dettaglio tecnico (per supporto)</summary>
        <pre class="auth-error-panel__pre">${escapeHtml(report)}</pre>
      </details>
      <button type="button" class="auth-error-panel__copy">Copia errore</button>
    `;
    container.style.display = 'block';
    const copyBtn = container.querySelector('.auth-error-panel__copy');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(report);
        copyBtn.textContent = 'Copiato!';
        setTimeout(() => {
          copyBtn.textContent = 'Copia errore';
        }, 2200);
      } catch {
        copyBtn.textContent = 'Selezione manuale dal riquadro sopra';
      }
    });
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  global.EvilAuthFeedback = {
    showAuthError,
    hideAuthError,
    buildReport,
  };
})(typeof window !== 'undefined' ? window : global);
