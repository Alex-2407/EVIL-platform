(function () {
  'use strict';

  var I18N = window.EVIL_I18N || null;
  var t = function (s, vars) { return I18N && I18N.t ? I18N.t(s, vars) : s; };
  var form = document.getElementById('verifyForm');
  var input = document.getElementById('certCode');
  var status = document.getElementById('verifyStatus');
  var result = document.getElementById('verifyResult');
  var independent = document.getElementById('independentBox');
  var button = document.getElementById('verifyBtn');
  var codePattern = /^EVIL-[A-Z0-9]{2,8}(?:-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){3}$/;

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || '';
  }

  function reset() {
    result.hidden = true;
    independent.hidden = true;
    setStatus('', '');
  }

  function fillIndependent(data, publicKey) {
    document.getElementById('indKeyId').textContent = data.keyId || '—';
    document.getElementById('indSignature').value = data.signature || '';
    document.getElementById('indSignedText').value = data.signedText || '';
    document.getElementById('indPublicKey').value = publicKey || '';
    var nodeText = 'const crypto = require("crypto");\n' +
      'const signedText = ' + JSON.stringify(data.signedText) + ';\n' +
      'const signature = Buffer.from(' + JSON.stringify(data.signature) + ', "base64");\n' +
      'const publicKey = ' + JSON.stringify(publicKey) + ';\n' +
      'console.log(crypto.verify(null, Buffer.from(signedText, "utf8"), publicKey, signature));';
    document.getElementById('nodeVerifyCode').textContent = nodeText;
  }

  async function verify(code) {
    reset();
    var normalized = String(code || '').trim().toUpperCase();
    input.value = normalized;
    if (!codePattern.test(normalized)) {
      setStatus(t('Inserisci un codice diploma nel formato EVIL-XXX-XXXX-XXXX-XXXX.'), 'error');
      input.focus();
      return;
    }

    button.disabled = true;
    setStatus(t('Verifica della firma in corso…'), '');
    try {
      var response = await fetch('/api/certificates/' + encodeURIComponent(normalized), {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-EVIL-Lang': I18N && I18N.lang || 'it' },
      });
      if (response.status === 404) {
        setStatus(t('Nessun diploma trovato con questo codice.'), 'missing');
        return;
      }
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || t('Non è stato possibile verificare il diploma.'));

      var certificate = data.certificate;
      document.getElementById('certName').textContent = certificate.name;
      document.getElementById('certCourse').textContent = certificate.courseTitle;
      document.getElementById('certDate').textContent = window.EVIL_CERTIFICATE_UI.formatDate(certificate.issuedAt, I18N && I18N.lang);
      document.getElementById('certScore').textContent = certificate.score + ' / 100';
      document.getElementById('certCodeOut').textContent = certificate.code;
      window.EVIL_CERTIFICATE_UI.drawFingerprint(document.getElementById('fingerprintMount'), data.fingerprint, t('Impronta grafica del diploma'));
      window.EVIL_CERTIFICATE_UI.drawQr(document.getElementById('qrMount'), data.qrSvg, t('QR per verificare il diploma'));
      result.hidden = false;

      if (data.valid) setStatus(t('DIPLOMA VALIDO — firma digitale verificata.'), 'valid');
      else setStatus(t('FIRMA NON VALIDA — i dati non corrispondono al diploma emesso.'), 'invalid');

      independent.hidden = false;
      try {
        var keyResponse = await fetch('/api/certificates/public-key', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'X-EVIL-Lang': I18N && I18N.lang || 'it' },
        });
        var keyData = await keyResponse.json();
        if (!keyResponse.ok) throw new Error(keyData.error || t('Chiave pubblica non disponibile.'));
        fillIndependent(data, keyData.publicKeyPem);
        if (keyData.keyId !== data.keyId) {
          setStatus(t('La chiave pubblica attuale ha un keyId diverso: la verifica indipendente richiede la chiave corrispondente al diploma.'), 'invalid');
        }
      } catch (error) {
        fillIndependent(data, '');
        setStatus(t('Diploma consultato, ma la chiave pubblica non è disponibile: {detail}', { detail: error.message }), 'error');
      }
    } catch (error) {
      setStatus(error.message || t('Connessione non riuscita. Riprova.'), 'error');
    } finally {
      button.disabled = false;
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var params = new URLSearchParams(window.location.search);
    params.set('c', input.value.trim().toUpperCase());
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
    verify(input.value);
  });

  var initialCode = new URLSearchParams(window.location.search).get('c');
  if (initialCode) verify(initialCode);
  else input.setAttribute('aria-describedby', 'verifyStatus');
})();
