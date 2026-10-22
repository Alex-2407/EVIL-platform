/**
 * EVIL Scuola: pulsanti "Stampa la guida" e "Stampa le carte" nella pagina di un kit.
 * Senza JavaScript i pulsanti restano nascosti e la stampa del browser esce con tutto.
 */
(function () {
  'use strict';

  function init() {
    const bar = document.querySelector('[data-sk-print-bar]');
    if (!bar || typeof window.print !== 'function') return;
    bar.hidden = false;
    bar.querySelectorAll('[data-sk-print]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.body.setAttribute('data-sk-print', btn.getAttribute('data-sk-print'));
        window.print();
      });
    });
    window.addEventListener('afterprint', () => document.body.removeAttribute('data-sk-print'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
