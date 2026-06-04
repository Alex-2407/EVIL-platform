/**
 * EVIL — schermo intero all'apertura (ESC per uscire)
 * I browser possono bloccare fullscreen senza gesto utente: ritentiamo al primo click.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'evil_fullscreen_done';

  function canFullscreen() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  }

  function requestSiteFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      return el.requestFullscreen();
    }
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return Promise.resolve();
    }
    return Promise.reject(new Error('Fullscreen non supportato'));
  }

  function tryEnter(reason) {
    if (!canFullscreen() || document.fullscreenElement) return;
    requestSiteFullscreen()
      .then(() => {
        sessionStorage.setItem(STORAGE_KEY, '1');
      })
      .catch(() => {
        if (reason === 'splash-end') {
          /* ritenta al primo click */
        }
      });
  }

  function onFirstUserGesture() {
    if (sessionStorage.getItem(STORAGE_KEY) === '1' && document.fullscreenElement) {
      document.removeEventListener('click', onFirstUserGesture, true);
      return;
    }
    tryEnter('gesture');
    document.removeEventListener('click', onFirstUserGesture, true);
    document.removeEventListener('keydown', onFirstUserGesture, true);
  }

  function bindEscapeExit() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      }
    });
  }

  function init() {
    bindEscapeExit();

    const splash = document.getElementById('splash-screen');
    const isHome = document.body.classList.contains('home-page');

    if (!isHome) {
      tryEnter('page-load');
      document.addEventListener('click', onFirstUserGesture, true);
      return;
    }

    const afterSplash = () => {
      tryEnter('splash-end');
      document.addEventListener('click', onFirstUserGesture, true);
      document.addEventListener('keydown', onFirstUserGesture, true);
    };

    if (!splash || splash.classList.contains('hidden')) {
      setTimeout(afterSplash, 400);
      return;
    }

    const observer = new MutationObserver(() => {
      if (splash.classList.contains('hidden') || splash.style.display === 'none') {
        observer.disconnect();
        setTimeout(afterSplash, 300);
      }
    });
    observer.observe(splash, { attributes: true, attributeFilter: ['class', 'style'] });
    setTimeout(afterSplash, 3500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
