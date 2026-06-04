/**
 * EVIL — applica stile galaxy ai pulsanti CTA principali
 */
(function () {
  function enhance() {
    const selectors = [
      '.btn-login',
      '.auth-submit',
      '.galaxy-btn',
      'button[type="submit"]:not(.img-btn):not(.hamburger-btn)',
      '.auth-btn--primary'
    ];
    document.querySelectorAll(selectors.join(',')).forEach((btn) => {
      if (btn.classList.contains('hamburger-btn') || btn.classList.contains('img-btn')) return;
      if (!btn.classList.contains('galaxy-btn')) {
        btn.classList.add('galaxy-btn');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance);
  } else {
    enhance();
  }
})();
