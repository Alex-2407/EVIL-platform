/**
 * Simulatore attacchi web — motore delle simulazioni passo-passo.
 *
 * Tutto è una narrazione didattica generata in locale: nessuna richiesta di rete,
 * nessun database, nessun comando eseguito. Serve a mostrare, fase per fase, come
 * nasce una vulnerabilità e come la si chiude — in ottica difensiva.
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;

  // --------------------------------------------------------------- utilità log
  function addLogWithDelay(message, type, element, delayMs) {
    setTimeout(() => {
      if (!element) return;
      const line = document.createElement('div');
      line.className = `log-line log-${type}`;
      line.textContent = message;
      element.appendChild(line);
      element.scrollTop = element.scrollHeight;
    }, delayMs);
  }
  // esposta anche come globale: web-simulator-lab.js la avvolge per la timeline fasi
  window.addLogWithDelay = addLogWithDelay;

  // la fase si accende insieme alla prima riga di log che la racconta
  function phase(index, delayMs) {
    setTimeout(() => {
      if (typeof window.highlightLabPhase === 'function') window.highlightLabPhase(index);
    }, delayMs || 0);
  }

  const sep = '—————————————————————————————————————————————';

  function val(id, fallback) {
    const el = document.getElementById(id);
    return (el && el.value) || fallback || '';
  }

  // --------------------------------------------------------------- SQL injection
  function hasSqlInjection(input) {
    return /('\s*or\s*')|(--)|(;)|(union)|(drop|delete|insert|update)/i.test(input);
  }

  function simulateSQLInjection() {
    const input = val('sql-input', '');
    const password = val('sql-password', '');
    const log = document.getElementById('sql-log');
    if (!log) return;
    log.innerHTML = '';
    let d = 0;

    phase(0, d);
    addLogWithDelay(sep, 'info', log, d);
    addLogWithDelay(t('[FASE 1] Il form di login invia le credenziali al server'), 'warning', log, d);
    d += 250;
    addLogWithDelay('[HTTP] POST /api/authenticate', 'info', log, d);
    addLogWithDelay(`[HTTP] username=${encodeURIComponent(input)}&password=***`, 'info', log, d);
    d += 400;

    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    phase(1, d);
    addLogWithDelay(t('[FASE 2] Il backend costruisce la query concatenando le stringhe'), 'warning', log, d);
    d += 250;
    addLogWithDelay('[SQL] ' + t('Codice vulnerabile (input non parametrizzato):'), 'error', log, d);
    d += 150;
    addLogWithDelay('[SQL] "SELECT * FROM users WHERE user=\'" + input + "\' AND pass=\'" + pass + "\'"', 'error', log, d);
    d += 300;

    if (hasSqlInjection(input)) {
      phase(2, d);
      addLogWithDelay(sep, 'error', log, d);
      d += 150;
      addLogWithDelay(t('[FASE 3] Il database legge il payload come parte del comando, non come dato'), 'error', log, d);
      d += 250;
      addLogWithDelay(`[SQL] SELECT * FROM users WHERE user='${input}' AND pass='***'`, 'error', log, d);
      d += 300;
      addLogWithDelay('[DB] ' + t("La condizione OR '1'='1' è sempre vera: la WHERE seleziona il primo utente"), 'error', log, d);
      d += 250;
      addLogWithDelay('[DB] ' + t('Riga restituita: utente amministratore'), 'error', log, d);
      d += 250;
      addLogWithDelay('[AUTH] ' + t('Autenticazione aggirata senza conoscere la password reale'), 'error', log, d);
    } else {
      phase(2, d);
      addLogWithDelay('[SQL] ' + t('Nessun metacarattere SQL nel payload: la query resta una ricerca semplice'), 'success', log, d);
      d += 300;
      addLogWithDelay('[DB] ' + t('Risultato: 0 righe (credenziali non valide)'), 'info', log, d);
      d += 250;
      addLogWithDelay('[HTTP] 401 Unauthorized', 'warning', log, d);
    }

    d += 450;
    phase(3, d);
    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    addLogWithDelay(t('[DIFESA] Prepared statement: il database tratta l\'input solo come dato'), 'success', log, d);
    d += 200;
    addLogWithDelay('[DIFESA] db.prepare("SELECT * FROM users WHERE user = ? AND pass = ?")', 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Account DB con privilegi minimi, validazione input, log delle query anomale'), 'success', log, d);
    return d;
  }

  // --------------------------------------------------------------- XSS
  function analyzeXss(input) {
    const flags = [];
    if (/[<>]/.test(input)) flags.push(t('Contiene i caratteri < e >: possibili tag HTML'));
    if (/script/i.test(input)) flags.push(t('Contiene un tag <script>: esecuzione di JavaScript'));
    if (/on\w+\s*=/i.test(input)) flags.push(t('Contiene un gestore di eventi (onerror, onload…): esecuzione automatica'));
    if (/javascript:/i.test(input)) flags.push(t('Contiene uno schema javascript: vettore alternativo'));
    return flags;
  }

  function simulateXSS() {
    const input = val('xss-input', '');
    const user = val('xss-user', '');
    const log = document.getElementById('xss-log');
    if (!log) return;
    log.innerHTML = '';
    let d = 0;

    phase(0, d);
    addLogWithDelay(sep, 'info', log, d);
    addLogWithDelay(t('[FASE 1] {user} pubblica un commento sul forum (scenario di XSS memorizzato)', { user }), 'warning', log, d);
    d += 250;
    addLogWithDelay('[HTTP] POST /comments/create', 'info', log, d);
    addLogWithDelay('[DB] ' + t('Il commento viene salvato così com\'è: salvarlo non è ancora l\'errore'), 'info', log, d);
    d += 400;

    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    phase(1, d);
    addLogWithDelay(t('[FASE 2] Un altro utente apre la pagina: il commento finisce nell\'HTML senza codifica in output'), 'warning', log, d);
    d += 250;
    addLogWithDelay(t('[SERVER] Lato server: il template stampa il commento senza escape'), 'error', log, d);
    addLogWithDelay('[SERVER] res.send(`<p>${comment}</p>`)  // ' + t('pericoloso'), 'error', log, d);
    d += 200;
    addLogWithDelay(t('[JS] Oppure lato client: il JavaScript lo inserisce con innerHTML invece che con textContent'), 'error', log, d);
    addLogWithDelay('[JS] element.innerHTML = comment;  // ' + t('pericoloso'), 'error', log, d);
    d += 350;

    const flags = analyzeXss(input);
    if (flags.length) {
      phase(2, d);
      addLogWithDelay(sep, 'error', log, d);
      d += 150;
      addLogWithDelay(t('[FASE 3] Il browser della vittima interpreta il commento come codice'), 'error', log, d);
      d += 250;
      flags.forEach((f) => {
        addLogWithDelay(t('[ANALISI] {flag}', { flag: f }), 'error', log, d);
        d += 150;
      });
      d += 150;
      addLogWithDelay(t('[EFFETTO] Effetti possibili: furto del cookie di sessione, azioni a nome della vittima, redirect, falsi form di login'), 'error', log, d);
    } else {
      phase(2, d);
      addLogWithDelay(t('[SICURO] Testo privo di marcatori HTML: verrebbe mostrato come testo semplice'), 'success', log, d);
    }

    d += 450;
    phase(3, d);
    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    addLogWithDelay(t('[NOTA] Memorizzato: il payload resta nel database e colpisce chiunque apra la pagina'), 'info', log, d);
    d += 200;
    addLogWithDelay(t('[NOTA] Riflesso: il payload torna nella risposta a chi segue un link preparato, una volta sola'), 'info', log, d);
    d += 200;
    addLogWithDelay(t('[NOTA] Basato sul DOM: nessun passaggio dal server, è il JavaScript della pagina a inserire l\'input nel DOM'), 'info', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Encoding in output, textContent al posto di innerHTML, Content-Security-Policy, cookie HttpOnly e SameSite'), 'success', log, d);
    return d;
  }

  // --------------------------------------------------------------- Brute force
  function simulateBruteForce() {
    const username = val('bf-username', 'admin');
    const wordlist = val('bf-wordlist', '').split('\n').map((w) => w.trim()).filter(Boolean);
    const log = document.getElementById('bf-log');
    if (!log) return;
    log.innerHTML = '';
    let d = 0;

    phase(0, d);
    addLogWithDelay(sep, 'info', log, d);
    addLogWithDelay(t('[FASE 1] Un automatismo prova in sequenza le password di una lista'), 'warning', log, d);
    d += 250;
    addLogWithDelay('[TARGET] ' + t('Utente: {username} · wordlist: {n} password', { username, n: wordlist.length }), 'info', log, d);
    d += 300;

    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    phase(1, d);
    addLogWithDelay(t('[FASE 2] Il server non limita i tentativi: ogni prova riceve risposta immediata'), 'error', log, d);
    d += 300;

    phase(2, d);
    const known = ['password123', 'admin123', 'letmein'];
    const hitIndex = wordlist.findIndex((w) => known.includes(w.toLowerCase()));
    const shown = Math.min(hitIndex >= 0 ? hitIndex + 1 : 8, wordlist.length);
    for (let i = 0; i < shown; i++) {
      const isHit = i === hitIndex;
      addLogWithDelay(
        `[${String(i + 1).padStart(3, '0')}] ${username}:${wordlist[i]} → ` + (isHit ? t('ACCETTATA') : t('respinta')),
        isHit ? 'error' : 'warning',
        log,
        d
      );
      d += 200;
    }
    if (hitIndex >= 0) {
      d += 200;
      addLogWithDelay(t('[FASE 3] Password debole trovata dopo {n} tentativi: accesso ottenuto', { n: hitIndex + 1 }), 'error', log, d);
    } else {
      d += 200;
      addLogWithDelay(t('[INFO] Nessuna password della lista corrisponde: l\'attacco proseguirebbe con le altre'), 'info', log, d);
    }

    d += 450;
    phase(3, d);
    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    addLogWithDelay(t('[DIFESA] Rate limiting per IP e per account, blocco temporaneo dopo N fallimenti'), 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Secondo fattore (TOTP, WebAuthn): la sola password rubata non basta'), 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Password lunghe e uniche, confronto con liste di password compromesse'), 'success', log, d);
    return d;
  }

  // --------------------------------------------------------------- File upload
  function simulateFileUpload() {
    const filename = val('fu-filename', 'avatar.jpg');
    const mimetype = val('fu-mimetype', 'image/jpeg');
    const log = document.getElementById('fu-log');
    if (!log) return;
    log.innerHTML = '';
    let d = 0;

    const ext = filename.split('.').pop().toLowerCase();
    const whitelist = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
    const executable = ['php', 'phtml', 'php5', 'jsp', 'asp', 'aspx', 'sh', 'exe', 'py', 'pl', 'cgi'];

    phase(0, d);
    addLogWithDelay(sep, 'info', log, d);
    addLogWithDelay(t('[FASE 1] L\'utente carica un file; il server lo salva e ne pubblica un URL'), 'warning', log, d);
    d += 250;
    addLogWithDelay(`[HTTP] filename="${filename}" · Content-Type: ${mimetype}`, 'info', log, d);
    d += 350;

    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    phase(1, d);
    addLogWithDelay(t('[FASE 2] Il controllo si basa solo su estensione o Content-Type, entrambi falsificabili'), 'warning', log, d);
    d += 250;
    addLogWithDelay(t('[CHECK] Estensione rilevata: .{ext}', { ext }), executable.includes(ext) ? 'error' : 'success', log, d);
    d += 300;

    phase(2, d);
    if (executable.includes(ext)) {
      addLogWithDelay(t('[FASE 3] Se la cartella di upload esegue script, aprire l\'URL del file esegue codice sul server'), 'error', log, d);
      d += 250;
      addLogWithDelay(t('[EFFETTO] Esecuzione di codice remoto con i privilegi del processo web'), 'error', log, d);
    } else if (whitelist.includes(ext)) {
      addLogWithDelay(t('[SICURO] Estensione nella whitelist; manca comunque la verifica dei magic bytes reali'), 'success', log, d);
    } else {
      addLogWithDelay(t('[BLOCCO] Estensione fuori whitelist: il file viene rifiutato'), 'warning', log, d);
    }

    d += 450;
    phase(3, d);
    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    addLogWithDelay(t('[DIFESA] Whitelist di estensioni e verifica dei magic bytes reali del contenuto'), 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Storage fuori dalla web root, senza interprete; rinomina casuale del file'), 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Limiti di dimensione, scansione antivirus, Content-Disposition: attachment'), 'success', log, d);
    return d;
  }

  // --------------------------------------------------------------- CSRF
  function simulateCSRF() {
    const site = val('csrf-site', 'https://bank.example.com');
    const malicious = val('csrf-malicious', 'https://attacker.example');
    const action = val('csrf-action', 'transfer?to=attacker&amount=10000');
    const log = document.getElementById('csrf-log');
    if (!log) return;
    log.innerHTML = '';
    let d = 0;

    phase(0, d);
    addLogWithDelay(sep, 'info', log, d);
    addLogWithDelay(t('[FASE 1] La vittima ha una sessione valida su {site}', { site }), 'warning', log, d);
    d += 250;
    addLogWithDelay('[BROWSER] ' + t('Il browser conserva il cookie di sessione del sito legittimo'), 'info', log, d);
    d += 350;

    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    phase(1, d);
    addLogWithDelay(t('[FASE 2] La vittima apre una pagina ospitata su {malicious}', { malicious }), 'warning', log, d);
    d += 250;
    addLogWithDelay(`[HTML] <img src="${site}/${action}" style="display:none">`, 'error', log, d);
    d += 350;

    phase(2, d);
    addLogWithDelay(t('[FASE 3] Il browser allega automaticamente il cookie di sessione alla richiesta'), 'error', log, d);
    d += 250;
    addLogWithDelay('[SERVER] ' + t('Il server vede una sessione valida e nessun token anti-CSRF: esegue l\'azione'), 'error', log, d);
    d += 250;
    addLogWithDelay(t('[EFFETTO] Un\'operazione sensibile parte senza che la vittima l\'abbia confermata'), 'error', log, d);

    d += 450;
    phase(3, d);
    addLogWithDelay(sep, 'info', log, d);
    d += 150;
    addLogWithDelay(t('[DIFESA] Token anti-CSRF univoco per sessione e per form'), 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Cookie SameSite=Lax o Strict, verifica dell\'header Origin'), 'success', log, d);
    d += 200;
    addLogWithDelay(t('[DIFESA] Conferma esplicita (password o 2FA) per le operazioni irreversibili'), 'success', log, d);
    return d;
  }

  // esposte come globali: web-simulator-lab.js le avvolge per aggiornare l'orologio
  window.simulateSQLInjection = simulateSQLInjection;
  window.simulateXSS = simulateXSS;
  window.simulateBruteForce = simulateBruteForce;
  window.simulateFileUpload = simulateFileUpload;
  window.simulateCSRF = simulateCSRF;

  // il nome della funzione globale (eventualmente avvolta da web-simulator-lab.js)
  const RUNNER_NAMES = {
    'sql-injection': 'simulateSQLInjection',
    xss: 'simulateXSS',
    'brute-force': 'simulateBruteForce',
    'file-upload': 'simulateFileUpload',
    csrf: 'simulateCSRF',
  };

  function bindSimButtons() {
    document.querySelectorAll('.simulate-btn[data-sim]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fn = window[RUNNER_NAMES[btn.dataset.sim]];
        if (typeof fn !== 'function' || btn.disabled) return;
        const panel = btn.closest('.tab-content');
        if (panel) panel.classList.add('is-running');
        btn.disabled = true;
        btn.textContent = t('Simulazione in corso…');
        const total = Number(fn()) || 0;
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = t('Ripeti la simulazione');
          if (panel) panel.classList.remove('is-running');
          if (typeof window.completeLabRun === 'function') window.completeLabRun();
        }, total + 400);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', bindSimButtons);
})();
