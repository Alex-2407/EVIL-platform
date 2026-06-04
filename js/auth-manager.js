/** @deprecated Usa evil-site-chrome.js — shim compatibilità */
(function () {
  if (window.__evilSiteChromeBooted || window.scheduleInitAuthHeader) return;
  const s = document.createElement('script');
  s.src = '/js/evil-site-chrome.js?v=20260608';
  s.defer = true;
  document.head.appendChild(s);
})();
