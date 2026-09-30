/**
 * EVIL — modulo di supporto (help.html)
 */
(function () {
  'use strict';

  const API = '/api/help';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function init() {
    const form = document.getElementById('helpContactForm');
    if (!form || form.dataset.evilHelpBound === '1') return;
    form.dataset.evilHelpBound = '1';

    const pageField = document.getElementById('help-page');
    const msgEl = document.getElementById('helpFormMessage');
    const submitBtn = form.querySelector('button[type="submit"]');
    const defaultLabel = submitBtn ? submitBtn.textContent : 'Invia richiesta';
    const fields = {
      name: document.getElementById('help-name'),
      email: document.getElementById('help-email'),
      subject: document.getElementById('help-subject'),
      message: document.getElementById('help-message'),
      website: document.getElementById('help-website'),
    };

    function setPage() {
      if (pageField) pageField.value = window.location.pathname + window.location.search;
    }
    setPage();

    // Con l'accesso fatto, nome ed email arrivano dall'account (e la conferma può partire)
    Promise.resolve(window.__evilAuthReady)
      .then(() => {
        const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
        if (!user) return;
        if (fields.name && !fields.name.value) fields.name.value = user.name || '';
        if (fields.email && !fields.email.value) fields.email.value = user.email || '';
      })
      .catch(() => {});

    function showStatus(text, ok) {
      if (!msgEl) return;
      msgEl.hidden = false;
      msgEl.textContent = text;
      msgEl.classList.toggle('help-form__msg--ok', !!ok);
      msgEl.classList.toggle('help-form__msg--error', !ok);
    }

    function clearInvalid() {
      Object.values(fields).forEach((el) => el && el.removeAttribute('aria-invalid'));
    }

    function fail(fieldName, text) {
      const el = fields[fieldName];
      if (el) {
        el.setAttribute('aria-invalid', 'true');
        el.focus();
      }
      showStatus(text, false);
    }

    Object.values(fields).forEach((el) => {
      if (el) el.addEventListener('input', () => el.removeAttribute('aria-invalid'));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInvalid();
      if (msgEl) {
        msgEl.hidden = true;
        msgEl.classList.remove('help-form__msg--ok', 'help-form__msg--error');
      }

      const payload = {
        name: fields.name?.value.trim() || '',
        email: fields.email?.value.trim() || '',
        subject: fields.subject?.value.trim() || '',
        message: fields.message?.value.trim() || '',
        page: pageField?.value || window.location.pathname,
        website: fields.website?.value || '',
      };

      if (payload.name.length < 2) return fail('name', 'Scrivi il tuo nome (almeno 2 caratteri).');
      if (!EMAIL_RE.test(payload.email)) return fail('email', 'Controlla l\'indirizzo email: serve per risponderti.');
      if (payload.subject.length < 3) return fail('subject', 'Scrivi un oggetto (almeno 3 caratteri).');
      if (payload.message.length < 10) return fail('message', 'Il messaggio deve avere almeno 10 caratteri.');

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
          data = {};
        }

        if (res.status === 429) {
          showStatus('Hai già inviato diverse richieste. Riprova tra un\'ora oppure attendi la nostra risposta.', false);
          return;
        }
        if (!res.ok) {
          if (data.field && fields[data.field]) return fail(data.field, data.error);
          showStatus(data.error || 'Invio non riuscito. Riprova tra qualche minuto.', false);
          return;
        }

        const extra = data.confirmationSent ? ' Ti abbiamo mandato un\'email di conferma.' : '';
        showStatus((data.message || 'Richiesta inviata.') + extra, true);
        const keepName = fields.name?.value;
        const keepEmail = fields.email?.value;
        form.reset();
        // chi ha fatto l'accesso non deve riscrivere nome ed email per una seconda richiesta
        if (window.getCurrentUser?.()) {
          if (fields.name) fields.name.value = keepName || '';
          if (fields.email) fields.email.value = keepEmail || '';
        }
        setPage();
      } catch (_) {
        showStatus('Connessione non riuscita. Controlla la rete e riprova.', false);
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
