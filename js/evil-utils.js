/**
 * Piccole funzioni comuni a tutte le pagine (prima erano ricopiate in 26 file).
 * Il server carica questo file subito dopo i18n.js, prima degli script di pagina:
 *
 *   const { escapeHtml, debounce } = window.EVIL_UTILS;
 */
(function () {
  'use strict';

  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /** Testo sicuro da inserire in HTML, anche dentro un attributo. null/undefined → '' */
  function escapeHtml(value) {
    return value == null ? '' : String(value).replace(/[&<>"']/g, function (c) {
      return MAP[c];
    });
  }

  /** Esegue fn solo quando le chiamate si fermano per `ms` millisecondi. */
  function debounce(fn, ms) {
    var timer = 0;
    return function () {
      var self = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(self, args);
      }, ms);
    };
  }

  window.EVIL_UTILS = Object.freeze({ escapeHtml: escapeHtml, debounce: debounce });
})();
