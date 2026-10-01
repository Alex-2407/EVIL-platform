/**
 * EVIL — richiesta del link per reimpostare la password (forgot-password.html)
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;
  const API_URL = '/api';

  function init() {
    const form = document.getElementById('forgotForm');
    if (!form) return;
    const errorDiv = document.getElementById('forgotError');
    const successDiv = document.getElementById('forgotSuccess');
    const deliveryNotice = document.getElementById('deliveryNotice');
    const submitBtn = document.getElementById('submitBtn');
    const field = form.querySelector('.auth-field');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.hidden = true;
      successDiv.hidden = true;
      deliveryNotice.hidden = true;

      const email = document.getElementById('email').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorDiv.textContent = t('Scrivi l\'indirizzo email del tuo account.');
        errorDiv.hidden = false;
        return;
      }
      submitBtn.disabled = true;

      try {
        const response = await fetch(`${API_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        let data = {};
        try {
          data = await response.json();
        } catch (_) { /* risposta non JSON */ }

        if (!response.ok) {
          errorDiv.textContent = data.error || t('Invio della richiesta non riuscito. Riprova tra qualche minuto.');
          errorDiv.hidden = false;
          submitBtn.disabled = false;
          return;
        }

        successDiv.textContent = data.message || t('Se l\'indirizzo è registrato, riceverai a breve un\'email con il link per reimpostare la password.');
        successDiv.hidden = false;
        if (data.emailHint) {
          deliveryNotice.textContent = data.emailHint;
          deliveryNotice.hidden = false;
        }
        if (field) field.hidden = true;
        submitBtn.hidden = true;
      } catch (_) {
        errorDiv.textContent = t('Connessione non riuscita. Controlla la rete e riprova.');
        errorDiv.hidden = false;
        submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
