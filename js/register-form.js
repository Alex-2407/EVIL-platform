/**
 * EVIL — registrazione account (account.html)
 */
(function () {
  'use strict';

  const API_URL = '/api';
  const REGISTER_TIMEOUT_MS = 25000;

  function mapRegisterError(message) {
    const map = {
      'Email already registered': 'Questa email è già registrata. Prova ad accedere.',
      'Validation failed': 'Dati non validi. Controlla i campi e riprova.',
      'Something went wrong':
        'Errore server: verifica che il deploy usi npm start (API Node attive) e che SMTP/DATA_DIR siano configurati su Render.',
      'Servizio non disponibile. Verifica che il deploy esegua npm start e non solo file statici.':
        'Il sito online non espone le API: avvia il server Node (npm start) sul hosting, non solo file statici.',
      'Errore server temporaneo. Riprova tra qualche minuto.':
        'Errore temporaneo del server. Riprova tra qualche minuto.',
      'SMTP non configurato. Imposta SMTP_USER e SMTP_PASS nel file .env (vedi SETUP_EMAIL_VERIFICATION.md).':
        'Il server non può inviare l\'email di verifica. Contatta l\'amministratore o configura SMTP su Render.',
    };
    return map[message] || message;
  }

  function validatePasswordStrength(password) {
    if (!password || password.length < 12) {
      return 'La password deve avere almeno 12 caratteri.';
    }
    if (!/[A-Z]/.test(password)) {
      return 'La password deve contenere almeno una lettera maiuscola (A-Z).';
    }
    if (!/\d/.test(password)) {
      return 'La password deve contenere almeno un numero (0-9).';
    }
    if (!/[@$!%*?&]/.test(password)) {
      return 'La password deve contenere almeno un carattere speciale (@$!%*?&).';
    }
    return null;
  }

  function validateClient(name, email, password, confirmPassword) {
    if (!name || name.length < 2) {
      return 'Inserisci il nome completo (minimo 2 caratteri).';
    }
    if (!/^[a-zA-Z\s'-]+$/.test(name)) {
      return 'Il nome contiene caratteri non consentiti (usa solo lettere, spazi, apostrofo o trattino).';
    }
    if (!email) {
      return 'Inserisci un indirizzo email.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Formato email non valido.';
    }
    const pwdErr = validatePasswordStrength(password);
    if (pwdErr) return pwdErr;
    if (password !== confirmPassword) {
      return 'Le password non coincidono.';
    }
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

    function showError(message, html) {
      if (!errorDiv) return;
      if (html) errorDiv.innerHTML = message;
      else errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      if (successDiv) successDiv.style.display = 'none';
      errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideMessages() {
      if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
      }
      if (successDiv) successDiv.style.display = 'none';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name')?.value.trim() || '';
      const email = document.getElementById('email')?.value.trim() || '';
      const password = document.getElementById('password')?.value || '';
      const confirmPassword = document.getElementById('confirm-password')?.value || '';

      hideMessages();

      const clientError = validateClient(name, email, password, confirmPassword);
      if (clientError) {
        showError(clientError, false);
        return;
      }

      if (window.location.protocol === 'file:') {
        showError(
          'Apri il sito tramite il server Node (npm start) su http://localhost:5000 — non aprire il file HTML direttamente dal disco.',
          false
        );
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

        let data;
        try {
          data = await response.json();
        } catch (_) {
          throw new Error(
            response.status === 0 || !response.ok
              ? 'Risposta non valida dal server (avvia il server con npm start e apri la pagina da http://localhost:5000).'
              : 'Risposta non valida dal server.'
          );
        }

        if (!response.ok) {
          if (data.details && Array.isArray(data.details)) {
            const detailMessages = data.details
              .map((d) => `• ${d.field || d.path || 'campo'}: ${d.message}`)
              .join('<br>');
            showError(`<strong>Errore di validazione:</strong><br>${detailMessages}`, true);
          } else {
            showError(mapRegisterError(data.error) || 'Errore di registrazione', false);
          }
          return;
        }

        succeeded = true;
        if (submitBtn) submitBtn.textContent = 'Reindirizzamento…';
        window.location.href = `verify-email.html?userId=${encodeURIComponent(data.userId)}&email=${encodeURIComponent(data.email)}&delivery=${encodeURIComponent(data.emailDelivery || '')}`;
        if (data.emailHint) {
          sessionStorage.setItem('evil_email_hint', data.emailHint);
        }
        return;
      } catch (err) {
        const msg =
          err.name === 'AbortError'
            ? 'Il server non risponde (timeout). Su Render verifica SMTP e che il servizio Node sia attivo, non solo file statici.'
            : err.message || 'impossibile contattare il server';
        showError('Errore di connessione: ' + msg, false);
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
