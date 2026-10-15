/**
 * Glossario: unisce window.QUIZ_GLOSSARY e window.VLAB_GLOSSARY, li ordina A–Z
 * e permette la ricerca. Le definizioni arrivano già nella lingua della pagina
 * (il server serve le copie di js/i18n/en/ sulle pagine /en/).
 */
(function () {
  'use strict';

  var I = window.EVIL_I18N || { t: function (s) { return s; }, locale: 'it-IT' };
  var collator = new Intl.Collator(I.locale, { sensitivity: 'base' });

  // Traduzioni inglesi delle definizioni del lab virtuale (solo termini, non le
  // guide passo-passo). Usate quando la pagina è servita in inglese, perché il
  // file dati js/virtual-lab-guides.js resta in italiano.
  var VLAB_EN = {
    'jump box': 'Controlled starting machine from which you launch tests against the isolated scenarios, without touching external networks.',
    'VLAN': 'Virtual LAN: an isolated logical network segment. In EVIL scenarios the targets live in a dedicated VLAN (10.42.x.x).',
    'nmap': 'Network Mapper: a scanner to discover live hosts, open ports and the versions of listening services.',
    'port scan': "Scanning a host's TCP/UDP ports to see which services it exposes (web, SSH, SMB, etc.).",
    'ping': 'ICMP command to check whether a host responds on the network before scanning it in depth.',
    'SSH': 'Secure Shell: an encrypted protocol (port 22) for remote shell access to Linux/Unix servers.',
    'curl': 'A command-line client to send HTTP requests and inspect responses, headers and body.',
    'HTTP': 'HyperText Transfer Protocol: the protocol browsers and APIs use to exchange pages and data (ports 80/443).',
    'SQL injection': 'User input concatenated into the SQL query without filtering, allowing authentication bypass or data extraction.',
    'payload': 'A string or command crafted to exploit a vulnerability (e.g. an always-true condition in a login).',
    'XSS': "Cross-Site Scripting: a malicious script injected into a page and executed in the victim's browser.",
    'CSRF': 'Cross-Site Request Forgery: tricking the browser into performing authenticated actions (changing an email, transfers) without consent.',
    'LFI': 'Local File Inclusion: the server includes local files chosen by the attacker through an unvalidated parameter.',
    'directory traversal': 'A technique that uses ../ to climb up directories and read files outside the web root.',
    'dirb': 'A directory brute forcer: it tries thousands of common paths (/admin, /backup) on a web server.',
    'hydra': 'An online dictionary-attack tool: it tries password lists against SSH, FTP, HTTP and other login services.',
    'brute force': 'An attack that systematically tries many passwords or PINs until one works.',
    'SMB': 'Server Message Block: a Windows/Linux protocol for file and printer shares (ports 445/139).',
    'smbclient': 'A Samba client to list network shares and download files from SMB resources.',
    'privilege escalation': 'Moving from a limited user to higher privileges (e.g. root).',
    'sudo': 'A Linux command that runs programs with elevated privileges according to rules in /etc/sudoers.',
    'flag': 'A secret string in CTF format that confirms completion of a learning objective in the scenario.',
    'CTF': 'Capture The Flag: a security exercise in which you recover hidden flags by demonstrating a skill.',
    'reconnaissance': 'The initial phase of an authorised test: gathering information about the network, services and attack surface.',
    'banner': 'The opening message of a service (e.g. the OpenSSH version), useful to identify vulnerable software.',
    'wordlist': 'A list of passwords or paths used by tools such as hydra or dirb for automated attacks.',
    'token': "A secret value in a form proving the request comes from the user's legitimate session.",
    'POST': 'The HTTP method that sends data in the body (e.g. a login form) rather than only in the URL.',
    'share': 'A network folder exposed over SMB that authorised clients can access.',
    'command injection': 'User input concatenated into system commands (ping, exec), allowing arbitrary commands to run.',
    'SSRF': 'Server-Side Request Forgery: the server makes HTTP requests to URLs chosen by the attacker, even toward the internal network.',
    'IDOR': "Insecure Direct Object Reference: changing an ID in the URL/API exposes other users' records without authorisation.",
    'JWT': 'JSON Web Token: a signed token asserting identity/role; if poorly implemented it allows privilege escalation.',
    'XXE': 'XML External Entity: an XML entity that forces the parser to read local files or make network requests.',
    'entity': 'An XML <!ENTITY> declaration defining reusable content, which can be abused in XXE attacks.',
    'web shell': 'A script (e.g. PHP) uploaded to the server that gives the attacker a remote shell.',
    'FTP': 'File Transfer Protocol (port 21): file transfer; anonymous login often exposes data by mistake.',
    'anonymous': 'FTP/SMB access without real credentials: useful to legitimate owners but dangerous if misconfigured.',
    'API': 'Application Programming Interface: an endpoint read by programs (often JSON) to test for auth flaws and IDOR.',
    'authorization': 'An HTTP header (e.g. a Bearer token) proving who you are: it must be validated server-side on every request.',
    'internal network': 'A segment not exposed to the Internet (RFC1918) reachable only from internal servers: a classic SSRF target.',
    'WAF': 'Web Application Firewall: a filter that inspects HTTP requests and blocks suspicious payloads.',
    'prepared statement': "A parameterised query: the user's values are passed separately from the SQL text, never concatenated.",
    'least privilege': 'The least-privilege principle: give each user or process only the permissions strictly needed.'
  };

  function vlabSource() {
    return (I.locale && String(I.locale).toLowerCase().indexOf('en') === 0 && !window.VLAB_GLOSSARY_EN_SERVED)
      ? VLAB_EN
      : window.VLAB_GLOSSARY;
  }

  var GM = window.GLOSSARY_META || { pick: function (o) { return o; }, TOPICS: [], byTerm: {}, ALIASES: {}, GENERIC: [] };
  var QM = window.QUIZ_META || { pick: function (o) { return o; }, QUIZ_META: {} };
  var url = I.url || function (u) { return u; };

  function slug(term) {
    return String(term).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function collect() {
    var map = Object.create(null);
    [window.QUIZ_GLOSSARY, vlabSource()].forEach(function (src) {
      if (!src) return;
      Object.keys(src).forEach(function (k) {
        var term = String(k).trim();
        var def = String(src[k]).trim();
        if (!term || !def) return;
        var key = term.toLowerCase();
        // varianti dello stesso termine (sha256/sha-256, sqli/sql injection…): una voce sola
        var canon = GM.ALIASES[key];
        if (canon && (window.QUIZ_GLOSSARY && (canon in window.QUIZ_GLOSSARY || map[canon]))) return;
        // la prima definizione vince (il Centro quiz è caricato per primo)
        if (!map[key]) map[key] = { term: term, key: key, def: def, topic: GM.byTerm[key] || GM.byTerm[key.replace(/ /g, '-')] || null };
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

  var esc = window.EVIL_UTILS.escapeHtml;
  function fold(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var ALL = collect();
  var BY_KEY = {};
  ALL.forEach(function (e) { BY_KEY[e.key] = e; });
  var listEl = document.getElementById('glossary-list');
  var indexEl = document.getElementById('glossary-index');
  var topicsEl = document.getElementById('glossary-topics');
  var dailyEl = document.getElementById('glossary-daily');
  var input = document.getElementById('glossary-q');
  var countEl = document.getElementById('glossary-count');
  if (!listEl) return;

  // collegamenti incrociati: nelle definizioni, gli altri termini diventano link
  var XREF_KEYS = ALL.map(function (e) { return e.key; })
    .filter(function (k) { return k.length >= 3 && /^[a-z0-9 -]+$/.test(k) && GM.GENERIC.indexOf(k) < 0; })
    .sort(function (a, b) { return b.length - a.length; });
  var XREF_RE = XREF_KEYS.length ? new RegExp('(^|[^\\w-])(' + XREF_KEYS.map(escRe).join('|') + ')(?![\\w-])', 'gi') : null;

  function defHtml(e) {
    var text = esc(e.def);
    var related = {};
    if (XREF_RE) {
      text = text.replace(XREF_RE, function (m, pre, word) {
        var k = word.toLowerCase();
        if (k === e.key || !BY_KEY[k]) return m;
        related[k] = true;
        return pre + '<a class="gl-xref" href="#t-' + slug(k) + '" data-xref="' + esc(k) + '">' + word + '</a>';
      });
    }
    return { html: text, related: Object.keys(related) };
  }

  function linksHtml(e) {
    var tp = e.topic;
    if (!tp) return '';
    var out = [];
    (tp.quiz || []).forEach(function (id) {
      var m = QM.QUIZ_META[id];
      out.push('<a class="gl-link gl-link--quiz" href="' + esc(url('/quiz-hub.html')) + '?cat=' + esc(id) + '">' + esc(I.t('Metti alla prova')) + ': ' + esc(m ? QM.pick(m.code) : id) + '</a>');
    });
    (tp.links || []).forEach(function (l) {
      out.push('<a class="gl-link" href="' + esc(url(l.href)) + '">' + esc(GM.pick(l)) + '</a>');
    });
    return out.join('');
  }

  var state = { q: '', topic: 'all' };

  function visible() {
    var q = fold(state.q.trim());
    return ALL.filter(function (e) {
      if (state.topic !== 'all' && (!e.topic || e.topic.id !== state.topic)) return false;
      return !q || fold(e.term).indexOf(q) !== -1 || fold(e.def).indexOf(q) !== -1;
    });
  }

  function render() {
    var items = visible();
    if (countEl) countEl.textContent = I.t('{n} termini', { n: items.length });

    var present = {};
    items.forEach(function (e) { present[firstLetter(e.term)] = (present[firstLetter(e.term)] || 0) + 1; });
    if (indexEl) {
      indexEl.querySelectorAll('a').forEach(function (a) {
        var n = present[a.getAttribute('data-letter')] || 0;
        a.setAttribute('aria-disabled', n ? 'false' : 'true');
        a.title = n ? I.t('{n} termini', { n: n }) : '';
      });
    }

    if (!items.length) {
      listEl.innerHTML = '<p class="glossary-empty">' + esc(I.t('Nessun termine trovato.')) + '</p>';
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
        var d = defHtml(e);
        var tpColor = e.topic ? e.topic.color : '#64748b';
        html += '<div class="glossary-entry" id="t-' + slug(e.key) + '" style="--gl:' + tpColor + '">' +
          '<h3 class="glossary-term">' + esc(e.term) +
          (e.topic ? '<span class="gl-topic">' + esc(GM.pick(e.topic.name)) + '</span>' : '') +
          '<a class="gl-anchor" href="#t-' + slug(e.key) + '" aria-label="' + esc(I.t('Link a questo termine')) + '">#</a></h3>' +
          '<p class="glossary-def">' + d.html + '</p>';
        if (d.related.length) {
          html += '<p class="gl-related"><span>' + esc(I.t('Vedi anche')) + '</span>' + d.related.slice(0, 6).map(function (k) {
            return '<a class="gl-xref gl-xref--chip" href="#t-' + slug(k) + '" data-xref="' + esc(k) + '">' + esc(BY_KEY[k].term) + '</a>';
          }).join('') + '</p>';
        }
        var lk = linksHtml(e);
        if (lk) html += '<p class="gl-links">' + lk + '</p>';
        html += '</div>';
      });
      html += '</section>';
    });
    listEl.innerHTML = html;
  }

  function renderTopics() {
    if (!topicsEl) return;
    var counts = {};
    ALL.forEach(function (e) { if (e.topic) counts[e.topic.id] = (counts[e.topic.id] || 0) + 1; });
    var chips = [{ id: 'all', name: I.t('Tutti gli argomenti'), n: ALL.length, color: '#00ff9c' }].concat(GM.TOPICS.map(function (tp) {
      return { id: tp.id, name: GM.pick(tp.name), n: counts[tp.id] || 0, color: tp.color };
    }));
    topicsEl.innerHTML = chips.map(function (c) {
      return '<button type="button" class="gl-chip' + (state.topic === c.id ? ' is-on' : '') + '" data-topic="' + c.id + '" style="--gl:' + c.color + '" aria-pressed="' + (state.topic === c.id) + '">' + esc(c.name) + ' <small>' + c.n + '</small></button>';
    }).join('');
  }
  if (topicsEl) {
    topicsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-topic]');
      if (!b) return;
      state.topic = b.getAttribute('data-topic');
      renderTopics();
      render();
    });
  }

  // termine del giorno
  function renderDaily(offset) {
    if (!dailyEl || !ALL.length) return;
    var day = Math.floor(Date.now() / 86400000);
    var e = ALL[(day + (offset || 0) * 7) % ALL.length];
    var d = defHtml(e);
    dailyEl.innerHTML = '<div class="gl-daily__body"><span class="gl-daily__tag">' + esc(offset ? I.t('Un altro termine') : I.t('Il termine di oggi')) + '</span>' +
      '<b>' + esc(e.term) + '</b><p>' + d.html + '</p></div>' +
      '<button type="button" class="gl-daily__more" data-more>' + esc(I.t('Un altro')) + '</button>';
    dailyEl.querySelector('[data-more]').onclick = function () { dailyEl.__n = (dailyEl.__n || 0) + 1; renderDaily(dailyEl.__n + Math.floor(Math.random() * 20)); };
  }

  // saltare a un termine (anche se filtrato via)
  function goTo(key, push) {
    var node = document.getElementById('t-' + slug(key));
    if (!node) {
      state.q = ''; state.topic = 'all';
      if (input) input.value = '';
      renderTopics(); render();
      node = document.getElementById('t-' + slug(key));
    }
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.remove('is-flash'); void node.offsetWidth; node.classList.add('is-flash');
    if (push && history.replaceState) history.replaceState(null, '', '#t-' + slug(key));
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-xref]');
    if (a) { e.preventDefault(); goTo(a.getAttribute('data-xref'), true); return; }
    var anchor = e.target.closest('.gl-anchor');
    if (anchor) {
      e.preventDefault();
      var id = anchor.getAttribute('href');
      if (history.replaceState) history.replaceState(null, '', id);
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(function () {});
      anchor.classList.add('is-copied');
      setTimeout(function () { anchor.classList.remove('is-copied'); }, 1200);
    }
  });

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
      tid = setTimeout(function () { state.q = input.value; render(); }, 120);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !e.target.closest('input, textarea, select')) { e.preventDefault(); input.focus(); }
    });
  }

  renderTopics();
  renderDaily(0);
  render();
  if (location.hash.indexOf('#t-') === 0) {
    var node = document.getElementById(location.hash.slice(1));
    if (node) setTimeout(function () { node.scrollIntoView({ block: 'center' }); node.classList.add('is-flash'); }, 150);
  }
})();
