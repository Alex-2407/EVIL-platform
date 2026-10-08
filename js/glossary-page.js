/**
 * Glossario: unisce window.QUIZ_GLOSSARY e window.VLAB_GLOSSARY, li ordina A–Z
 * e permette la ricerca. Le definizioni arrivano già nella lingua della pagina
 * (il server serve le copie di js/i18n/en/ sulle pagine /en/).
 */
(function () {
  'use strict';

  var I = window.EVIL_I18N || { t: function (s) { return s; }, locale: 'it-IT' };
  var collator = new Intl.Collator(I.locale, { sensitivity: 'base' });

  function collect() {
    var map = Object.create(null);
    [window.QUIZ_GLOSSARY, window.VLAB_GLOSSARY].forEach(function (src) {
      if (!src) return;
      Object.keys(src).forEach(function (k) {
        var term = String(k).trim();
        var def = String(src[k]).trim();
        if (!term || !def) return;
        // la prima definizione vince (il Centro quiz è caricato per primo)
        if (!map[term.toLowerCase()]) map[term.toLowerCase()] = { term: term, def: def };
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return collator.compare(a.term, b.term); });
  }

  function firstLetter(term) {
    var c = term.replace(/^[^a-z0-9]+/i, '').charAt(0).toUpperCase();
    if (!c) c = term.charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fold(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  var ALL = collect();
  var listEl = document.getElementById('glossary-list');
  var indexEl = document.getElementById('glossary-index');
  var input = document.getElementById('glossary-q');
  var countEl = document.getElementById('glossary-count');
  if (!listEl) return;

  function render(query) {
    var q = fold((query || '').trim());
    var items = q
      ? ALL.filter(function (e) { return fold(e.term).indexOf(q) !== -1 || fold(e.def).indexOf(q) !== -1; })
      : ALL;

    if (countEl) countEl.textContent = I.t('{n} termini', { n: items.length });

    if (!items.length) {
      listEl.innerHTML = '<p class="glossary-empty">' + esc(I.t('Nessun termine trovato.')) + '</p>';
      if (indexEl) indexEl.querySelectorAll('a').forEach(function (a) { a.setAttribute('aria-disabled', 'true'); });
      return;
    }

    var groups = {};
    var order = [];
    items.forEach(function (e) {
      var L = firstLetter(e.term);
      if (!groups[L]) { groups[L] = []; order.push(L); }
      groups[L].push(e);
    });

    var html = '';
    order.forEach(function (L) {
      html += '<section class="glossary-group" id="g-' + esc(L) + '">';
      html += '<h2 class="glossary-group__letter">' + esc(L) + '</h2>';
      groups[L].forEach(function (e) {
        html += '<div class="glossary-entry"><h3 class="glossary-term">' + esc(e.term) +
          '</h3><p class="glossary-def">' + esc(e.def) + '</p></div>';
      });
      html += '</section>';
    });
    listEl.innerHTML = html;

    if (indexEl) {
      indexEl.querySelectorAll('a').forEach(function (a) {
        var L = a.getAttribute('data-letter');
        a.setAttribute('aria-disabled', groups[L] ? 'false' : 'true');
      });
    }
  }

  // indice A–Z (+ #) una sola volta
  if (indexEl) {
    var letters = ['#'].concat('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    indexEl.innerHTML = letters.map(function (L) {
      return '<a href="#g-' + L + '" data-letter="' + L + '">' + L + '</a>';
    }).join('');
    indexEl.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a || a.getAttribute('aria-disabled') === 'true') return;
      e.preventDefault();
      var target = document.getElementById('g-' + a.getAttribute('data-letter'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (input) {
    var tid;
    input.addEventListener('input', function () {
      clearTimeout(tid);
      tid = setTimeout(function () { render(input.value); }, 120);
    });
  }

  render('');
})();
