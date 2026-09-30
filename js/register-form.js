/**
 * EVIL — registrazione account (account.html)
 * Le regole sono le stesse del server (middleware/auth.js): nomi con lettere accentate,
 * password di almeno 12 caratteri con maiuscola, numero e un simbolo qualsiasi.
 */
(function () {
  'use strict';

  const API_URL = '/api';
  const REGISTER_TIMEOUT_MS = 35000;
  // lettere di qualunque alfabeto (Nicolò, José, Chloé), spazi, apostrofo, punto e trattino
  const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u;
  const SYMBOL_RE = /[^\p{L}\p{N}\s]/u;
  const FIELD_IDS = { name: 'name', email: 'email', password: 'password', confirmPassword: 'confirm-password' };

  function validatePasswordStrength(password) {
    if (!password || password.length < 12) return 'La password deve avere almeno 12 caratteri.';
    if (!/[A-Z]/.test(password)) return 'La password deve contenere almeno una lettera maiuscola (A-Z).';
    if (!/\d/.test(password)) return 'La password deve contenere almeno un numero (0-9).';
    if (!SYMBOL_RE.test(password)) return 'La password deve contenere almeno un simbolo (per esempio ! ? @ # % . -).';
    return null;
  }

  function validateClient(name, email, password, confirmPassword) {
    if (!name || name.length < 2) return { field: 'name', message: 'Scrivi nome e cognome (almeno 2 caratteri).' };
    if (!NAME_RE.test(name)) {
      return { field: 'name', message: 'Il nome può contenere lettere (anche accentate), spazi, apostrofo e trattino.' };
    }
    if (!email) return { field: 'email', message: 'Scrivi il tuo indirizzo email.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { field: 'email', message: 'Controlla l\'indirizzo email.' };
    const pwdErr = validatePasswordStrength(password);
    if (pwdErr) return { field: 'password', message: pwdErr };
    if (password !== confirmPassword) return { field: 'confirmPassword', message: 'Le due password non coincidono.' };
    return null;
  }

  function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form || form.dataset.evilRegisterBound === '1') return;
    form.dataset.evilRegisterBound = '1';

    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    const submitBtn = form.querySelector('button[type="submit"]');
    const defaultLabel = submitBtn ? submitBtn.textContent : 'Registrati';

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
      if (successDiv) successDiv.style.display = 'none';
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
        errorDiv.style.display = 'block';
      }
    }

    function hideMessages() {
      if (errorDiv) {
        if (window.EvilAuthFeedback) window.EvilAuthFeedback.hideAuthError(errorDiv);
        else {
          errorDiv.style.display = 'none';
          errorDiv.textContent = '';
        }
      }
      if (successDiv) successDiv.style.display = 'none';
    }

    Object.values(FIELD_IDS).forEach((id) => {
      document.getElementById(id)?.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name')?.value.trim() || '';
      const email = document.getElementById('email')?.value.trim() || '';
      const password = document.getElementById('password')?.value || '';
      const confirmPassword = document.getElementById('confirm-password')?.value || '';

      hideMessages();

      const clientError = validateClient(name, email, password, confirmPassword);
      if (clientError) {
        showError(clientError.message, { status: 400, field: clientError.field });
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registrazione in corso…';
      }

      let succeeded = false;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);

        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, confirmPassword }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        let data = {};
        try {
          data = await response.json();
        } catch (_) {
          const invalid = new Error('Il server non ha risposto correttamente. Riprova tra qualche istante.');
          invalid.status = response.status;
          throw invalid;
        }

        if (!response.ok) {
          const first = Array.isArray(data.details) ? data.details[0] : null;
          if (response.status === 409) {
            showError(data.error || 'Questa email è già registrata. Prova ad accedere.', { status: 409, field: 'email' });
          } else if (response.status === 429) {
            showError('Troppi tentativi di registrazione da questa rete. Riprova tra un\'ora.', { status: 429 });
          } else {
            showError(data.error || 'Registrazione non riuscita.', {
              status: response.status,
              field: first?.field,
              raw: data,
              hint: response.status >= 500 ? 'Se il problema continua, scrivici dalla pagina Help.' : undefined,
            });
          }
          return;
        }

        succeeded = true;
        if (submitBtn) submitBtn.textContent = 'Reindirizzamento…';
        try {
          sessionStorage.removeItem('evil_verify_link');
          if (data.emailHint) sessionStorage.setItem('evil_email_hint', data.emailHint);
          if (data.emailDelivery) sessionStorage.setItem('evil_email_delivery', data.emailDelivery);
        } catch { /* storage non disponibile */ }
        window.location.href = `verify-email.html?userId=${encodeURIComponent(data.userId)}&email=${encodeURIComponent(data.email)}&delivery=${encodeURIComponent(data.emailDelivery || 'pending')}`;
      } catch (err) {
        const message =
          err.name === 'AbortError'
            ? 'Il server sta impiegando troppo a rispondere. Riprova tra qualche minuto.'
            : err.status
              ? err.message
              : 'Connessione non riuscita. Controlla la rete e riprova.';
        showError(message, {
          status: err.status,
          raw: err.stack || err.message,
          hint: 'Se il problema continua, scrivici dalla pagina Help.',
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
