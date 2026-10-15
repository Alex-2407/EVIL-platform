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

  function collect() {
    var map = Object.create(null);
    [window.QUIZ_GLOSSARY, vlabSource()].forEach(function (src) {
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

  const esc = window.EVIL_UTILS.escapeHtml;

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
