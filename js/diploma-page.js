(function () {
  'use strict';

  var I18N = window.EVIL_I18N || null;
  var t = function (s, vars) { return I18N && I18N.t ? I18N.t(s, vars) : s; };
  var status = document.getElementById('diplomaStatus');
  var sheet = document.getElementById('diplomaSheet');
  var banner = document.getElementById('diplomaBanner');
  var code = new URLSearchParams(window.location.search).get('c') || '';
  var codePattern = /^EVIL-[A-Z0-9]{2,8}(?:-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){3}$/;

  function setStatus(message, error) {
    status.textContent = message;
    status.dataset.state = error ? 'error' : '';
  }

  function localized(path) {
    return I18N && typeof I18N.url === 'function' ? I18N.url(path) : path;
  }

  async function loadDiploma() {
    if (!codePattern.test(code)) {
      setStatus(t('Il link al diploma è incompleto o non valido.'), true);
      return;
    }
    setStatus(t('Caricamento del diploma…'), false);
    try {
      var response = await fetch('/api/certificates/' + encodeURIComponent(code.toUpperCase()), {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-EVIL-Lang': I18N && I18N.lang || 'it' },
      });
      if (response.status === 404) throw new Error(t('Diploma non trovato.'));
      var data = await response.json();
      if (!response.ok) throw new Error(data.error || t('Non è stato possibile caricare il diploma.'));
      if (!data.valid) throw new Error(t('La firma del diploma non è valida.'));

      var cert = data.certificate;
      document.getElementById('diplomaCourse').textContent = cert.courseTitle;
      document.getElementById('diplomaName').textContent = cert.name;
      document.getElementById('diplomaDate').textContent = window.EVIL_CERTIFICATE_UI.formatDate(cert.issuedAt, I18N && I18N.lang);
      document.getElementById('diplomaScore').textContent = cert.score + ' / 100';
      document.getElementById('diplomaCode').textContent = cert.code;
      window.EVIL_CERTIFICATE_UI.drawFingerprint(document.getElementById('diplomaRosette'), data.fingerprint, t('Impronta grafica del diploma'));
      window.EVIL_CERTIFICATE_UI.drawQr(document.getElementById('diplomaQr'), data.qrSvg, t('QR per verificare il diploma'));
      var verifyPage = localized('/verify.html');
      document.getElementById('verifyLink').href = verifyPage + '?c=' + encodeURIComponent(cert.code);
      banner.hidden = false;
      sheet.hidden = false;
      status.textContent = '';
      document.getElementById('pdfBtn').addEventListener('click', function () {
        window.location.href = '/api/certificates/' + encodeURIComponent(cert.code) + '/pdf';
      });
      document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
    } catch (error) {
      setStatus(error.message || t('Connessione non riuscita. Riprova.'), true);
    }
  }

  if (code) loadDiploma();
  else setStatus(t('Apri il diploma dal tuo profilo o inserisci un codice valido.'), true);
})();
