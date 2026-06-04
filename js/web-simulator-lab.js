/**
 * UI didattica — Simulatore Attacchi Web (contenuti e fasi)
 */
(function () {
  'use strict';

  /** ID pannello DOM (evita collisioni globali es. id="xss" → window.xss) */
  const PANEL_IDS = {
    'sql-injection': 'panel-sql-injection',
    xss: 'panel-xss',
    'brute-force': 'panel-brute-force',
    'file-upload': 'panel-file-upload',
    csrf: 'panel-csrf'
  };

  const ATTACK_LAB = {
    'sql-injection': {
      title: 'SQL Injection',
      owasp: 'OWASP A03:2021 — Injection',
      risk: 'Critico',
      plain:
        'Un sito spesso chiede al database: «esiste un utente con questo nome e questa password?». Se il programma incolla nel messaggio SQL il testo che hai scritto nel form, senza trattarlo come dato separato, puoi modificare la domanda stessa — non stai «hackando il database con magia», stai sfruttando un errore di programmazione.',
      phases: [
        {
          title: 'Contesto reale',
          text: 'Login, ricerca prodotti, filtri: il server costruisce una query SQL con i tuoi input.'
        },
        {
          title: 'Errore di design',
          text: 'Stringhe concatenate invece di query parametrizzate (prepared statements).'
        },
        {
          title: 'Cosa cambia',
          text: "Payload come admin' OR '1'='1 altera la logica: la query torna «vero» senza password corretta."
        },
        {
          title: 'Difesa',
          text: 'Parametri bindati, least privilege sul DB, validazione input, logging anomalie.'
        }
      ]
    },
    xss: {
      title: 'Cross-Site Scripting (XSS)',
      owasp: 'OWASP A03:2021 — Injection',
      risk: 'Alto',
      plain:
        'Il sito mostra nel browser contenuto che altri utenti hanno scritto (commenti, nickname). Se non tratta quel testo come testo e non come codice, il browser può eseguire JavaScript a nome della vittima — rubare cookie di sessione, modificare la pagina, inviare azioni.',
      phases: [
        {
          title: 'Contesto reale',
          text: 'Forum, chat, profili, campi ricerca riflessi nella pagina.'
        },
        {
          title: 'Errore di design',
          text: 'innerHTML o output non codificato; assenza di Content Security Policy.'
        },
        {
          title: 'Cosa cambia',
          text: 'Tag e eventi HTML/JS nel commento diventano codice eseguito nel browser della vittima.'
        },
        {
          title: 'Difesa',
          text: 'Encoding in output, CSP, sanitizzazione, cookie HttpOnly e SameSite.'
        }
      ]
    },
    'brute-force': {
      title: 'Brute Force sul login',
      owasp: 'OWASP A07:2021 — Identification & Authentication Failures',
      risk: 'Alto',
      plain:
        "Non è un «trucco»: è provare migliaia di password finché una combinazione funziona. Funziona solo dove le password sono deboli e il sistema non limita i tentativi, non blocca l'account e non chiede un secondo fattore.",
      phases: [
        {
          title: 'Contesto reale',
          text: 'Portali admin, VPN, webmail, API di autenticazione esposte.'
        },
        {
          title: 'Errore di design',
          text: 'Nessun rate limit, nessun CAPTCHA, password corte o riutilizzate.'
        },
        {
          title: 'Cosa cambia',
          text: 'Automazione prova credenziali fino a risposta HTTP 200 / token valido.'
        },
        {
          title: 'Difesa',
          text: '2FA, lockout, delay, password policy, monitoraggio IP e alert.'
        }
      ]
    },
    'file-upload': {
      title: 'Upload file non sicuro',
      owasp: 'OWASP A04:2021 — Insecure Design',
      risk: 'Critico',
      plain:
        "Caricare un avatar o un documento significa che il server salva un file. Se controlla solo l'estensione o il MIME dichiarato dal client, un attaccante può inviare uno script (es. PHP) mascherato da immagine e, se la cartella è eseguibile, ottenere comandi sul server.",
      phases: [
        {
          title: 'Contesto reale',
          text: 'CV, ticket, allegati e-commerce, CMS con media library.'
        },
        {
          title: 'Errore di design',
          text: 'Fiducia nel Content-Type, cartella upload sotto web root, permessi esecuzione.'
        },
        {
          title: 'Cosa cambia',
          text: 'File malevolo salvato e richiamabile via URL → remote code execution.'
        },
        {
          title: 'Difesa',
          text: 'Whitelist estensioni, magic bytes, storage fuori web root, scan AV, rename.'
        }
      ]
    },
    csrf: {
      title: 'CSRF (Cross-Site Request Forgery)',
      owasp: 'OWASP A01:2021 — Broken Access Control',
      risk: 'Alto',
      plain:
        "Se sei loggato su un sito, il browser invia automaticamente i cookie di sessione. Un'altra scheda malevola può far partire una richiesta (form, immagine) verso il sito legittimo: il server crede sia tu a fare il bonifico o il cambio email.",
      phases: [
        {
          title: 'Contesto reale',
          text: 'Azioni sensibili via GET o POST senza token anti-CSRF.'
        },
        {
          title: 'Errore di design',
          text: 'Solo cookie per autenticare; nessun controllo Origin/Referer/token.'
        },
        {
          title: 'Cosa cambia',
          text: 'La vittima visita pagina attacker → parte richiesta autenticata nascosta.'
        },
        {
          title: 'Difesa',
          text: 'Token sincronizzatore, SameSite cookie, POST per mutazioni, re-auth su operazioni critiche.'
        }
      ]
    }
  };

  function renderPhaseRail(attackId) {
    const meta = ATTACK_LAB[attackId];
    const rail = document.getElementById('phase-rail');
    if (!rail || !meta) return;

    rail.innerHTML = meta.phases
      .map(
        (p, i) => `
      <article class="phase-card" data-phase="${i}">
        <div class="phase-num">Fase ${i + 1}</div>
        <h3>${p.title}</h3>
        <p>${p.text}</p>
      </article>`
      )
      .join('');
  }

  function renderAttackContext(attackId) {
    const meta = ATTACK_LAB[attackId];
    const ctx = document.getElementById('attack-context');
    if (!ctx || !meta) return;

    ctx.innerHTML = `
      <h2>${meta.title}</h2>
      <div class="plain-box"><strong>In parole semplici:</strong> ${meta.plain}</div>
      <div class="attack-meta-row">
        <span class="sim-chip blue">${meta.owasp}</span>
        <span class="sim-chip amber">Rischio ${meta.risk}</span>
        <span class="sim-chip">Solo simulazione locale</span>
      </div>`;
  }

  function highlightSimPhase(index) {
    document.querySelectorAll('.phase-card').forEach((card, i) => {
      card.classList.toggle('active-phase', i === index);
    });
  }

  window.switchAttack = function switchAttack(attackType, button) {
    if (!ATTACK_LAB[attackType]) return;

    document.querySelectorAll('.tab-content').forEach((tab) => {
      tab.classList.remove('active');
    });

    const panelId = PANEL_IDS[attackType];
    const targetTab = panelId ? document.getElementById(panelId) : null;
    if (targetTab) {
      targetTab.classList.add('active');
    }

    document.querySelectorAll('.attack-btn').forEach((btn) => {
      const isActive = btn === button || btn.dataset.attack === attackType;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    renderPhaseRail(attackType);
    renderAttackContext(attackType);
    highlightSimPhase(0);

    const statusEl = document.getElementById('lab-status-topic');
    if (statusEl) {
      statusEl.textContent = ATTACK_LAB[attackType].title;
    }
  };

  window.highlightLabPhase = highlightSimPhase;

  function bindAttackButtons() {
    const selector = document.querySelector('.attack-selector');
    if (!selector || selector.dataset.bound === '1') return;
    selector.dataset.bound = '1';

    selector.addEventListener('click', (e) => {
      const btn = e.target.closest('.attack-btn[data-attack]');
      if (!btn) return;
      e.preventDefault();
      window.switchAttack(btn.dataset.attack, btn);
    });
  }

  function updateLabClock() {
    const el = document.getElementById('lab-last-run');
    if (!el) return;
    el.textContent = new Date().toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'medium'
    });
  }

  function bootLabUi() {
    bindAttackButtons();
    window.switchAttack('sql-injection', document.querySelector('.attack-btn[data-attack="sql-injection"]'));
    updateLabClock();
    wrapLogPhases();
  }

  function wrapLogPhases() {
    if (window.__evilLabLogWrapped || typeof window.addLogWithDelay !== 'function') return;
    const origAddLog = window.addLogWithDelay;
    window.addLogWithDelay = function (message, type, element, delayMs) {
      const phaseMatch = message.match(/\[FASE\s*(\d)\]/i) || message.match(/\[STEP\s*(\d)\]/i);
      if (phaseMatch) {
        const idx = Math.min(3, Math.max(0, parseInt(phaseMatch[1], 10) - 1));
        highlightSimPhase(idx);
      }
      return origAddLog(message, type, element, delayMs);
    };
    window.__evilLabLogWrapped = true;
  }

  function wrapSimulateFunctions() {
    ['simulateSQLInjection', 'simulateXSS', 'simulateBruteForce', 'simulateFileUpload', 'simulateCSRF'].forEach(
      (fnName) => {
        if (window[`__wrapped_${fnName}`]) return;
        const original = window[fnName];
        if (typeof original !== 'function') return;
        window[fnName] = function wrappedSim() {
          updateLabClock();
          return original.apply(this, arguments);
        };
        window[`__wrapped_${fnName}`] = true;
      }
    );
  }

  document.addEventListener('DOMContentLoaded', bootLabUi);
  window.addEventListener('load', () => {
    wrapLogPhases();
    wrapSimulateFunctions();
  });
})();
