/**
 * EVIL — messaggi di errore visibili e copiabili (accesso / registrazione)
 */
(function (global) {
  'use strict';

  const I18N = global.EVIL_I18N || { t: (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? String(v[k]) : m)) };
  const { t } = I18N;

  // Escape anche delle virgolette: il risultato finisce pure dentro attributi HTML
  const escapeHtml = window.EVIL_UTILS.escapeHtml;

  /** Testo tecnico per il supporto: resta in inglese/italiano tecnico neutro, è pensato per chi fa assistenza. */
  function buildReport(opts) {
    const lines = [
      `EVIL auth — ${new Date().toISOString()}`,
      `Page: ${global.location?.href || '—'}`,
      `Action: ${opts.action || '—'}`,
    ];
    if (opts.status != null) lines.push(`HTTP: ${opts.status}`);
    if (opts.message) lines.push(`Message: ${opts.message}`);
    if (opts.raw) lines.push(`Detail: ${typeof opts.raw === 'string' ? opts.raw : JSON.stringify(opts.raw)}`);
    if (opts.hint) lines.push(`Note: ${opts.hint}`);
    return lines.join('\n');
  }

  function hideAuthError(container) {
    if (!container) return;
    container.hidden = true;
    container.textContent = '';
    container.classList.remove('auth-error-panel', 'auth-error-panel--open');
  }

  /**
   * Errori dell'utente (password sbagliata, campo mancante, 4xx): solo una frase chiara.
   * Errori del server o di rete: frase + dettaglio tecnico copiabile per il supporto.
   */
  function isUserError(opts) {
    return typeof opts.status === 'number' && opts.status >= 400 && opts.status < 500;
  }

  function showAuthError(container, opts) {
    if (!container) return;
    const message = opts.message || t('Errore sconosciuto');
    container.setAttribute('role', 'alert');
    container.setAttribute('aria-live', 'assertive');
    if (isUserError(opts)) {
      container.className = 'auth-message auth-message--error';
      container.textContent = message;
      container.hidden = false;
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const report = buildReport(opts);
    container.className = 'auth-message auth-message--error auth-error-panel auth-error-panel--open';
    container.innerHTML = `
      <p class="auth-error-panel__title">${escapeHtml(message)}</p>
      ${opts.status != null ? `<p class="auth-error-panel__meta">${escapeHtml(t('Codice HTTP:'))} <strong>${escapeHtml(String(opts.status))}</strong></p>` : ''}
      ${opts.hint ? `<p class="auth-error-panel__hint">${escapeHtml(opts.hint)}</p>` : ''}
      <details class="auth-error-panel__details">
        <summary>${escapeHtml(t('Dettaglio tecnico (per il supporto)'))}</summary>
        <pre class="auth-error-panel__pre">${escapeHtml(report)}</pre>
      </details>
      <button type="button" class="auth-error-panel__copy">${escapeHtml(t('Copia errore'))}</button>
    `;
    container.hidden = false;
    const copyBtn = container.querySelector('.auth-error-panel__copy');
    copyBtn?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(report);
        copyBtn.textContent = t('Copiato');
        setTimeout(() => {
          copyBtn.textContent = t('Copia errore');
        }, 2200);
      } catch {
        copyBtn.textContent = t('Copia non riuscita: seleziona il testo nel riquadro');
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
