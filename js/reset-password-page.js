/**
 * EVIL — scelta di una nuova password dal link ricevuto via email (reset-password.html)
 */
(function () {
  'use strict';

  const { t, url } = window.EVIL_I18N;
  const API_URL = '/api';

  function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const viewForm = document.getElementById('viewForm');
    const viewMissing = document.getElementById('viewMissing');
    const form = document.getElementById('resetForm');
    if (!viewForm || !viewMissing) return;

    if (token) viewForm.hidden = false;
    else viewMissing.hidden = false;

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;
      const errorDiv = document.getElementById('resetError');
      const successDiv = document.getElementById('resetSuccess');
      const submitBtn = form.querySelector('button[type="submit"]');
      errorDiv.hidden = true;
      successDiv.hidden = true;

      const fail = (text) => {
        errorDiv.textContent = text;
        errorDiv.hidden = false;
      };

      if (newPassword !== confirmPassword) {
        fail(t('Le due password non coincidono.'));
        return;
      }
      if (submitBtn) submitBtn.disabled = true;

      try {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword, confirmPassword }),
        });
        let data = {};
        try {
          data = await response.json();
        } catch (_) { /* risposta non JSON */ }

        if (!response.ok) {
          fail(data.error || t('Non è stato possibile aggiornare la password. Richiedi un nuovo link e riprova.'));
          if (submitBtn) submitBtn.disabled = false;
          return;
        }

        successDiv.textContent = data.message || t('Password aggiornata. Ora puoi accedere con la nuova password.');
        successDiv.hidden = false;
        setTimeout(() => { window.location.href = url('/login.html'); }, 2200);
      } catch (_) {
        fail(t('Connessione non riuscita. Controlla la rete e riprova.'));
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
