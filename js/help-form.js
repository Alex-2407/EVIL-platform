/**
 * EVIL — modulo help (help.html)
 */
(function () {
  'use strict';

  const API = '/api/help';

  function init() {
    const form = document.getElementById('helpContactForm');
    if (!form || form.dataset.evilHelpBound === '1') return;
    form.dataset.evilHelpBound = '1';

    const pageField = document.getElementById('help-page');
    const msgEl = document.getElementById('helpFormMessage');
    const submitBtn = form.querySelector('button[type="submit"]');
    const defaultLabel = submitBtn ? submitBtn.textContent : 'Invia richiesta';

    if (pageField) {
      pageField.value = window.location.pathname + window.location.search;
    }

    function showStatus(text, ok) {
      if (!msgEl) return;
      msgEl.hidden = false;
      msgEl.textContent = text;
      msgEl.classList.toggle('help-form__msg--ok', !!ok);
      msgEl.classList.toggle('help-form__msg--error', !ok);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (msgEl) {
        msgEl.hidden = true;
        msgEl.classList.remove('help-form__msg--ok', 'help-form__msg--err');
      }

      const payload = {
        name: document.getElementById('help-name')?.value.trim() || '',
        email: document.getElementById('help-email')?.value.trim() || '',
        subject: document.getElementById('help-subject')?.value.trim() || '',
        message: document.getElementById('help-message')?.value.trim() || '',
        page: pageField?.value || window.location.pathname,
      };

      if (!payload.name || payload.name.length < 2) {
        showStatus('Inserisci il nome (minimo 2 caratteri).', false);
        return;
      }
      if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        showStatus('Inserisci un indirizzo email valido.', false);
        return;
      }
      if (!payload.subject || payload.subject.length < 3) {
        showStatus('Inserisci un oggetto (minimo 3 caratteri).', false);
        return;
      }
      if (!payload.message || payload.message.length < 10) {
        showStatus('Il messaggio deve avere almeno 10 caratteri.', false);
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio in corso…';
      }

      try {
        const res = await fetch(API, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let data = {};
        try {
          data = await res.json();
        } catch (_) {
          throw new Error('Risposta non valida dal server.');
        }

        if (!res.ok) {
          showStatus(data.error || data.hint || 'Invio non riuscito. Riprova più tardi.', false);
          return;
        }

        const extra = data.confirmationSent
          ? ' Abbiamo inviato un\'email di conferma al tuo indirizzo.'
          : ' (La conferma email non è stata inviata: controlla SMTP sul server.)';
        showStatus((data.message || 'Richiesta inviata.') + extra, true);
        form.reset();
        if (pageField) pageField.value = window.location.pathname + window.location.search;
      } catch (err) {
        showStatus(
          'Errore di connessione: ' +
            (err.message || 'server non raggiungibile') +
            '. Verifica che il sito sia avviato con npm start.',
          false
        );
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = defaultLabel;
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
