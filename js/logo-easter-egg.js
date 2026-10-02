/**
 * EVIL — pagina dell'easter egg del logo (logo-easter-egg.html): avvia l'animazione
 * di matrixrain.js oppure torna alla home se non è disponibile.
 */
(function () {
  'use strict';

  function start() {
    if (typeof window.playLogoEasterEgg === 'function') {
      window.playLogoEasterEgg();
    } else {
      const home = window.EVIL_I18N && typeof window.EVIL_I18N.url === 'function' ? window.EVIL_I18N.url('/') : '/';
      window.location.href = home;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
