/**
 * EVIL — modulo Help (invio email staff + conferma utente)
 */
(function () {
  'use strict';

  const API = '/api/help/contact';

  function show(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('help-form__msg--error', !!isError);
    el.classList.toggle('help-form__msg--ok', !isError);
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function init() {
    const form = document.getElementById('helpContactForm');
    if (!form || form.dataset.evilHelpBound === '1') return;
    form.dataset.evilHelpBound = '1';

    const msgEl = document.getElementById('helpFormMessage');
    const submitBtn = form.querySelector('button[type="submit"]');
    const defaultLabel = submitBtn ? submitBtn.textContent : 'Invia richiesta';

    const pageField = document.getElementById('help-page');
    if (pageField) pageField.value = document.referrer || window.location.href;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (msgEl) msgEl.hidden = true;

      const payload = {
        name: document.getElementById('help-name')?.value.trim() || '',
        email: document.getElementById('help-email')?.value.trim() || '',
        subject: document.getElementById('help-subject')?.value.trim() || '',
        message: document.getElementById('help-message')?.value.trim() || '',
        page: pageField?.value || window.location.href
      };

      if (window.location.protocol === 'file:') {
        show(
          msgEl,
          'Apri il sito tramite il server (npm start) su http://localhost:5000 — non dal file HTML sul disco.',
          true
        );
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
          body: JSON.stringify(payload)
        });

        let data = {};
        try {
          data = await res.json();
        } catch (_) {
          throw new Error('Risposta non valida dal server.');
        }

        if (!res.ok) {
          show(msgEl, data.error || 'Impossibile inviare la richiesta.', true);
          return;
        }

        form.reset();
        if (pageField) pageField.value = window.location.href;
        let ok =
          'Richiesta inviata. Ti abbiamo inviato un\'email di conferma; il team risponderà entro 2–5 giorni lavorativi.';
        if (data.emailHint) ok += ' ' + data.emailHint;
        show(msgEl, ok, false);
      } catch (err) {
        show(msgEl, 'Errore di connessione: ' + (err.message || 'server non raggiungibile'), true);
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
