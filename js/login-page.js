/**
 * EVIL — pagina di accesso (login.html)
 * Spiega perché si è arrivati al login (pagina protetta), salta il form se la sessione è già attiva
 * e invia le credenziali a /api/auth/login.
 */
(function () {
  'use strict';

  const { t, url } = window.EVIL_I18N;
  const API_URL = '/api';

  // Pagine che richiedono l'accesso: il login spiega perché l'utente è arrivato qui
  const PROTECTED_PAGES = {
    'security-check.html': () => t('Check URL'),
    'vulnerability-scanner.html': () => t('Audit header HTTP'),
    'http-header-audit.html': () => t('Audit header HTTP'),
    'dns-enumerator.html': () => t('Ricognizione dominio'),
    'subdomain-finder.html': () => t('Ricognizione dominio'),
    'domain-recon.html': () => t('Ricognizione dominio'),
    'ssl-analyzer.html': () => t('Certificato TLS'),
    'file-analysis.html': () => t('Analisi file'),
    'social-profiling.html': () => t('Profilazione social'),
    'public-info.html': () => t('Esposizione online'),
  };

  /** Solo pagine del sito (nome.html con eventuale query): niente redirect verso altri domini. */
  function getRedirectTarget() {
    const redirect = new URLSearchParams(window.location.search).get('redirect') || '';
    if (!/^[a-z0-9][a-z0-9._-]*\.html(\?[a-z0-9=&%._+-]*)?$/i.test(redirect)) return url('/home.html');
    return url('/' + redirect);
  }

  function explainRedirect() {
    const redirect = new URLSearchParams(window.location.search).get('redirect') || '';
    const page = redirect.split('?')[0];
    const note = document.getElementById('loginReason');
    if (!note) return;
    if (page === 'profile.html') {
      note.textContent = t('Accedi per vedere il tuo profilo, i progressi e i trofei.');
    } else if (PROTECTED_PAGES[page]) {
      note.textContent = t('Per usare {tool} serve un account EVIL (è gratuito). Accedi oppure registrati: dopo l\'accesso torni direttamente allo strumento.', { tool: PROTECTED_PAGES[page]() });
    } else {
      return;
    }
    note.hidden = false;
  }

  async function skipLoginIfSessionActive() {
    if (!new URLSearchParams(window.location.search).get('redirect')) return;
    try {
      if (window.__evilAuthReady) await window.__evilAuthReady;
      if (typeof window.syncUserFromServer === 'function') {
        const user = await window.syncUserFromServer();
        if (user) window.location.replace(getRedirectTarget());
      }
    } catch (_) { /* resta sul login */ }
  }

  function init() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    explainRedirect();
    skipLoginIfSessionActive();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('loginError');
      const submitBtn = form.querySelector('button[type="submit"]');
      const showErr = (opts) => {
        if (window.EvilAuthFeedback) {
          window.EvilAuthFeedback.showAuthError(errorDiv, { action: 'login', ...opts });
        } else {
          errorDiv.textContent = opts.message || t('Errore');
          errorDiv.hidden = false;
        }
      };
      const hideErr = () => {
        if (window.EvilAuthFeedback) window.EvilAuthFeedback.hideAuthError(errorDiv);
        else errorDiv.hidden = true;
      };

      hideErr();
      if (!email || !password) {
        showErr({ message: t('Scrivi email e password.'), status: 400 });
        return;
      }
      if (submitBtn) submitBtn.disabled = true;

      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        let data = {};
        try {
          data = await response.json();
        } catch (_) {
          const invalid = new Error(t('Il server non ha risposto correttamente. Riprova tra qualche istante.'));
          invalid.status = response.status;
          throw invalid;
        }

        if (!response.ok) {
          if (data.requiresVerification && data.userId && data.email) {
            window.location.href = url(`/verify-email.html?userId=${encodeURIComponent(data.userId)}&email=${encodeURIComponent(data.email)}`);
            return;
          }
          const message = response.status === 429
            ? t('Troppi tentativi di accesso. Aspetta qualche minuto e riprova, oppure reimposta la password.')
            : data.error || t('Accesso non riuscito.');
          showErr({
            message,
            status: response.status,
            raw: data,
            hint: response.status >= 500 ? t('Se il problema continua, scrivici dalla pagina Aiuto.') : undefined,
          });
          return;
        }

        if (window.AUTH_STORAGE && typeof window.AUTH_STORAGE.setUser === 'function') {
          window.AUTH_STORAGE.setUser(data.user);
        }
        if (typeof window.notifyAuthVerified === 'function') window.notifyAuthVerified();

        window.location.href = getRedirectTarget();
      } catch (err) {
        const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
        showErr({
          message: err.status ? err.message : t('Connessione non riuscita. Controlla la rete e riprova.'),
          status: err.status,
          raw: err.stack || err.message,
          hint: local ? t('In locale il server deve essere avviato con npm start.') : t('Se il problema continua, scrivici dalla pagina Aiuto.'),
        });
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
