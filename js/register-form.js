/**
 * EVIL — registrazione account (account.html)
 * Le regole sono le stesse del server (middleware/auth.js): nomi con lettere accentate,
 * password di almeno 12 caratteri con maiuscola, numero e un simbolo qualsiasi,
 * accettazione esplicita di codice di condotta e informativa privacy (acceptedTerms).
 */
(function () {
  'use strict';

  const { t, url } = window.EVIL_I18N;
  const API_URL = '/api';
  const REGISTER_TIMEOUT_MS = 35000;
  // lettere di qualunque alfabeto (Nicolò, José, Chloé), spazi, apostrofo, punto e trattino
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u;
  const SYMBOL_RE = /[^\p{L}\p{N}\s]/u;
  const FIELD_IDS = {
    name: 'name',
    email: 'email',
    password: 'password',
    confirmPassword: 'confirm-password',
    acceptedTerms: 'accept-terms',
    ageConfirmed: 'accept-age',
  };

  // Strumenti che richiedono un account: se si arriva da uno di questi, la pagina spiega perché
  const TOOL_NAMES = {
    'security-check.html': () => t('Check URL'),
    'vulnerability-scanner.html': () => t('Audit header HTTP'),
    'dns-enumerator.html': () => t('Ricognizione dominio'),
    'subdomain-finder.html': () => t('Ricognizione dominio'),
    'domain-recon.html': () => t('Ricognizione dominio'),
    'ssl-analyzer.html': () => t('Certificato TLS'),
    'file-analysis.html': () => t('Analisi file'),
    'social-profiling.html': () => t('Profilazione social'),
    'public-info.html': () => t('Esposizione online'),
    'osint-hub.html': () => t('OSINT'),
    'report-generator.html': () => t('Generatore di report'),
  };

  function explainRedirect() {
    const redirect = new URLSearchParams(window.location.search).get('redirect') || '';
    if (!/^[a-z0-9][a-z0-9._-]*\.html(\?[a-z0-9=&%._+-]*)?$/i.test(redirect)) return;
    const page = redirect.split('?')[0];
    const note = document.getElementById('registerReason');
    if (note && TOOL_NAMES[page]) {
      note.textContent = t('Per usare {tool} serve un account EVIL gratuito. Registrati: bastano un’email da confermare e un minuto.', { tool: TOOL_NAMES[page]() });
      note.hidden = false;
    }
    const link = document.getElementById('loginSwitch');
    if (link) link.href = url(`/login.html?redirect=${encodeURIComponent(redirect)}`);
  }

  function validatePasswordStrength(password) {
    if (!password || password.length < 12) return t('La password deve avere almeno 12 caratteri.');
    if (!/[A-Z]/.test(password)) return t('La password deve contenere almeno una lettera maiuscola (A-Z).');
    if (!/\d/.test(password)) return t('La password deve contenere almeno un numero (0-9).');
    if (!SYMBOL_RE.test(password)) return t('La password deve contenere almeno un simbolo (per esempio ! ? @ # % . -).');
    return null;
  }

  function validateClient(v) {
    if (!v.name || v.name.length < 2) return { field: 'name', message: t('Scrivi nome e cognome (almeno 2 caratteri).') };
    if (!NAME_RE.test(v.name)) {
      return { field: 'name', message: t('Il nome può contenere lettere (anche accentate), spazi, apostrofo e trattino.') };
    }
    if (!v.email) return { field: 'email', message: t('Scrivi il tuo indirizzo email.') };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return { field: 'email', message: t('Controlla l\'indirizzo email.') };
    const pwdErr = validatePasswordStrength(v.password);
    if (pwdErr) return { field: 'password', message: pwdErr };
    if (v.password !== v.confirmPassword) return { field: 'confirmPassword', message: t('Le due password non coincidono.') };
    if (!v.acceptedTerms) {
      return { field: 'acceptedTerms', message: t('Per registrarti devi accettare il codice di condotta e l\'informativa privacy.') };
    }
    if (!v.ageConfirmed) {
      return { field: 'ageConfirmed', message: t('Per registrarti devi avere almeno 14 anni.') };
    }
    return null;
  }

  function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form || form.dataset.evilRegisterBound === '1') return;
    form.dataset.evilRegisterBound = '1';
    explainRedirect();

    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    const submitBtn = form.querySelector('button[type="submit"]');
    const defaultLabel = submitBtn ? submitBtn.textContent : t('Registrati');

    function markField(field) {
      Object.values(FIELD_IDS).forEach((id) => document.getElementById(id)?.removeAttribute('aria-invalid'));
      const el = field && document.getElementById(FIELD_IDS[field] || field);
      if (el) {
        el.setAttribute('aria-invalid', 'true');
        el.focus();
      }
    }

    function showError(message, extra = {}) {
      if (!errorDiv) return;
      if (successDiv) successDiv.hidden = true;
      markField(extra.field);
      if (window.EvilAuthFeedback) {
        window.EvilAuthFeedback.showAuthError(errorDiv, {
          action: 'register',
          message,
          status: extra.status,
          raw: extra.raw,
          hint: extra.hint,
        });
      } else {
        errorDiv.textContent = message;
        errorDiv.hidden = false;
      }
    }

    function hideMessages() {
      if (errorDiv) {
        if (window.EvilAuthFeedback) window.EvilAuthFeedback.hideAuthError(errorDiv);
        else {
          errorDiv.hidden = true;
          errorDiv.textContent = '';
        }
      }
      if (successDiv) successDiv.hidden = true;
    }

    Object.values(FIELD_IDS).forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener(el.type === 'checkbox' ? 'change' : 'input', (e) => e.target.removeAttribute('aria-invalid'));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const values = {
        name: document.getElementById('name')?.value.trim() || '',
        email: document.getElementById('email')?.value.trim() || '',
        password: document.getElementById('password')?.value || '',
        confirmPassword: document.getElementById('confirm-password')?.value || '',
        acceptedTerms: Boolean(document.getElementById('accept-terms')?.checked),
        ageConfirmed: Boolean(document.getElementById('accept-age')?.checked),
      };

      hideMessages();

      const clientError = validateClient(values);
      if (clientError) {
        showError(clientError.message, { status: 400, field: clientError.field });
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = t('Registrazione in corso…');
      }

      let succeeded = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);

        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            email: values.email,
            password: values.password,
            confirmPassword: values.confirmPassword,
            acceptedTerms: true,
            ageConfirmed: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let data = {};
        try {
          data = await response.json();
        } catch (_) {
          const invalid = new Error(t('Il server non ha risposto correttamente. Riprova tra qualche istante.'));
          invalid.status = response.status;
          throw invalid;
        }

        if (!response.ok) {
          const first = Array.isArray(data.details) ? data.details[0] : null;
          if (response.status === 409) {
            showError(data.error || t('Questa email è già registrata. Prova ad accedere.'), { status: 409, field: 'email' });
          } else if (response.status === 429) {
            showError(t('Troppi tentativi di registrazione da questa rete. Riprova tra un\'ora.'), { status: 429 });
          } else {
            showError(data.error || t('Registrazione non riuscita.'), {
              status: response.status,
              field: first?.field,
              raw: data,
              hint: response.status >= 500 ? t('Se il problema continua, scrivici dalla pagina Aiuto.') : undefined,
            });
          }
          return;
        }

        succeeded = true;
        if (submitBtn) submitBtn.textContent = t('Reindirizzamento…');
        try {
          sessionStorage.removeItem('evil_verify_link');
          if (data.emailHint) sessionStorage.setItem('evil_email_hint', data.emailHint);
          if (data.emailDelivery) sessionStorage.setItem('evil_email_delivery', data.emailDelivery);
        } catch { /* storage non disponibile */ }
        window.location.href = url(
          `/verify-email.html?userId=${encodeURIComponent(data.userId)}&email=${encodeURIComponent(data.email)}&delivery=${encodeURIComponent(data.emailDelivery || 'pending')}`
        );
      } catch (err) {
        const message =
          err.name === 'AbortError'
            ? t('Il server sta impiegando troppo a rispondere. Riprova tra qualche minuto.')
            : err.status
              ? err.message
              : t('Connessione non riuscita. Controlla la rete e riprova.');
        showError(message, {
          status: err.status,
          raw: err.stack || err.message,
          hint: t('Se il problema continua, scrivici dalla pagina Aiuto.'),
        });
      } finally {
        if (!succeeded && submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = defaultLabel;
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRegisterForm);
  } else {
    initRegisterForm();
  }
})();
