/**
 * EVIL — verifica dell'indirizzo email (verify-email.html)
 * Quattro viste: in attesa (con reinvio e controllo automatico), conferma (link dell'email con
 * #token=…, l'utente preme un pulsante e la pagina chiama POST /api/auth/verify), verificata, errore.
 * La verifica attiva l'account ma non apre una sessione: si accede poi con email e password.
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;
  const API_URL = '/api';

  function storageGet(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (_) {
      return '';
    }
  }
  function storageSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (_) { /* storage non disponibile */ }
  }
  function storageRemove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) { /* storage non disponibile */ }
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const userId = params.get('userId');
    const email = params.get('email');
    const reason = params.get('reason');

    const viewPending = document.getElementById('viewPending');
    const viewSuccess = document.getElementById('viewSuccess');
    const viewError = document.getElementById('viewError');
    const viewConfirm = document.getElementById('viewConfirm');
    const resendBtn = document.getElementById('resendBtn');
    const resendMessage = document.getElementById('resendMessage');
    const deliveryNotice = document.getElementById('deliveryNotice');
    if (!viewPending || !viewSuccess || !viewError) return;

    let resendCooldown = 0;
    let verificationPollTimer = null;

    const delivery = params.get('delivery') || storageGet('evil_email_delivery');
    const emailHint = storageGet('evil_email_hint');

    function renderDeliveryNotice() {
      let text = emailHint;
      if (!text) {
        if (delivery === 'sandbox') {
          text = t('Questo server usa una casella di prova (Mailtrap Sandbox): l\'email non arriva nella tua casella personale.');
        } else if (delivery === 'outbox') {
          text = t('Invio email non configurato su questo server: il messaggio è stato salvato solo sul server.');
        } else if (delivery === 'live' || delivery === 'smtp') {
          text = t('Se non vedi nulla, controlla anche la cartella spam.');
        }
      }
      if (text && deliveryNotice) {
        deliveryNotice.textContent = text;
        deliveryNotice.hidden = false;
      }
      storageRemove('evil_verify_link');
    }

    const errorMessages = {
      missing: () => t('Il link di verifica è incompleto.'),
      invalid: () => t('Questo link non è valido o è già stato usato.'),
      expired: () => t('Il link è scaduto. Registrati di nuovo con lo stesso indirizzo per ricevere un link nuovo.'),
      server: () => t('Si è verificato un errore durante la verifica. Riprova tra poco.'),
    };

    function show(el) {
      [viewPending, viewSuccess, viewError, viewConfirm].forEach((node) => { if (node) node.hidden = true; });
      el.hidden = false;
    }

    function setResendMessage(text, ok) {
      if (!resendMessage) return;
      resendMessage.textContent = text;
      resendMessage.className = ok ? 'auth-message auth-message--success' : 'auth-message auth-message--error';
      resendMessage.hidden = false;
    }

    function applyVerifiedUi(fromOtherDevice) {
      show(viewSuccess);
      const lead = document.getElementById('successLead');
      if (lead && fromOtherDevice) {
        lead.textContent = t('Email verificata da un altro dispositivo. L\'account è attivo: accedi da qui con email e password.');
      }
      if (typeof window.notifyAuthVerified === 'function') window.notifyAuthVerified();
      if (typeof window.scheduleInitAuthHeader === 'function') window.scheduleInitAuthHeader();
      else if (typeof window.initAuthHeader === 'function') window.initAuthHeader();
    }

    async function syncSessionAfterVerify() {
      try {
        if (typeof window.syncUserFromServer === 'function') {
          await window.syncUserFromServer();
        } else {
          const r = await fetch(`${API_URL}/auth/session`, { credentials: 'include' });
          if (r.ok) {
            const data = await r.json();
            if (data?.user && window.AUTH_STORAGE?.setUser) window.AUTH_STORAGE.setUser(data.user);
          }
        }
      } catch (_) { /* ignore */ }
    }

    function startVerificationPolling() {
      if (!userId || status === 'success' || status === 'error') return;

      const check = async () => {
        try {
          const r = await fetch(`${API_URL}/auth/verification-status?userId=${encodeURIComponent(userId)}`);
          if (!r.ok) return;
          const data = await r.json();
          if (data.emailVerified) {
            if (verificationPollTimer) clearInterval(verificationPollTimer);
            applyVerifiedUi(true);
            await syncSessionAfterVerify();
          }
        } catch (_) { /* riprova al giro successivo */ }
      };

      check();
      verificationPollTimer = setInterval(check, 4000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    }

    // Token nel frammento (#token=…): non arriva al server nei log né nel Referer.
    // Lo si toglie subito dalla barra degli indirizzi e resta solo in memoria.
    const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '';
    if (hashToken) {
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (_) { /* history non disponibile */ }
    }

    function showVerifyError(text) {
      document.getElementById('errorText').textContent = text;
      show(viewError);
    }

    async function confirmToken() {
      const btn = document.getElementById('confirmBtn');
      const errorBox = document.getElementById('confirmError');
      if (errorBox) errorBox.hidden = true;
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('Conferma in corso…');
      }
      try {
        const response = await fetch(`${API_URL}/auth/verify`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: hashToken }),
        });
        let data = {};
        try {
          data = await response.json();
        } catch (_) { /* risposta non JSON */ }

        if (response.ok) {
          applyVerifiedUi(false);
          return;
        }
        if (data.code === 'TOKEN_EXPIRED') return showVerifyError(data.error || errorMessages.expired());
        if (data.code === 'TOKEN_INVALID' || data.code === 'TOKEN_MISSING') return showVerifyError(data.error || errorMessages.invalid());
        const message = response.status === 429
          ? t('Troppi tentativi. Aspetta qualche minuto e riprova.')
          : data.error || errorMessages.server();
        if (errorBox) {
          errorBox.textContent = message;
          errorBox.hidden = false;
        }
      } catch (_) {
        if (errorBox) {
          errorBox.textContent = t('Connessione non riuscita. Controlla la rete e riprova.');
          errorBox.hidden = false;
        }
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = t('Conferma l\'indirizzo');
      }
    }

    if (hashToken && viewConfirm) {
      show(viewConfirm);
      document.getElementById('confirmBtn')?.addEventListener('click', confirmToken);
    } else if (status === 'success') {
      applyVerifiedUi(false);
      syncSessionAfterVerify();
    } else if (status === 'error') {
      document.getElementById('errorText').textContent = (errorMessages[reason] || errorMessages.invalid)();
      show(viewError);
    } else {
      document.getElementById('email-display').textContent = email || t('il tuo indirizzo email');
      show(viewPending);
      renderDeliveryNotice();
      startVerificationPolling();
    }

    function updateResendButton() {
      if (resendCooldown > 0) {
        resendBtn.disabled = true;
        resendBtn.textContent = t('Reinvia tra {s} s', { s: resendCooldown });
        resendCooldown -= 1;
        setTimeout(updateResendButton, 1000);
      } else {
        resendBtn.disabled = false;
        resendBtn.textContent = t('Invia di nuovo l\'email');
      }
    }

    resendBtn?.addEventListener('click', async () => {
      if (!userId) {
        setResendMessage(t('Non troviamo la registrazione in corso. Accedi con email e password per ricevere un nuovo link.'), false);
        return;
      }

      if (resendMessage) resendMessage.hidden = true;
      resendBtn.disabled = true;

      try {
        const response = await fetch(`${API_URL}/auth/resend-verification-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        let data = {};
        try {
          data = await response.json();
        } catch (_) { /* risposta non JSON */ }

        if (!response.ok) {
          setResendMessage(data.error || t('Invio dell\'email non riuscito. Riprova tra qualche minuto.'), false);
          resendBtn.disabled = false;
          return;
        }

        if (data.emailHint) {
          storageSet('evil_email_hint', data.emailHint);
          if (deliveryNotice) {
            deliveryNotice.textContent = data.emailHint;
            deliveryNotice.hidden = false;
          }
        }

        setResendMessage(data.message || t('Ti abbiamo inviato una nuova email.'), true);
        resendCooldown = 60;
        updateResendButton();
      } catch (_) {
        setResendMessage(t('Connessione non riuscita. Controlla la rete e riprova.'), false);
        resendBtn.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
