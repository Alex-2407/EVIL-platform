/**
 * UI didattica — Simulatore attacchi web (catalogo, contesto e timeline delle fasi).
 * Il motore delle simulazioni è in js/web-simulator-page.js.
 */
(function () {
  'use strict';

  const { t, fmtDate } = window.EVIL_I18N;

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
      risk: t('Critico'),
      plain: t('Un sito spesso chiede al database: «esiste un utente con questo nome e questa password?». Se il programma inserisce nella query SQL il testo che hai scritto, senza trattarlo come dato separato, puoi modificare la domanda stessa. Non è magia: è lo sfruttamento di un errore di programmazione.'),
      phases: [
        { title: t('Contesto reale'), text: t('Login, ricerca prodotti, filtri: il server costruisce una query SQL con i tuoi input.') },
        { title: t('Errore di design'), text: t('Stringhe concatenate invece di query parametrizzate (prepared statement).') },
        { title: t('Cosa cambia'), text: t("Un payload come admin' OR '1'='1 altera la logica: la query torna «vero» senza la password corretta.") },
        { title: t('Difesa'), text: t('Parametri bindati, privilegi minimi sul DB, validazione input, log delle anomalie.') }
      ]
    },
    xss: {
      title: 'Cross-Site Scripting (XSS)',
      owasp: 'OWASP A03:2021 — Injection',
      risk: t('Alto'),
      plain: t('Il sito mostra nel browser contenuto scritto da altri utenti (commenti, nickname). Se non tratta quel testo come testo ma come codice, il browser può eseguire JavaScript nel contesto della vittima: furto di sessione, azioni a nome della vittima, redirect, falsi form di login.'),
      phases: [
        { title: t('Contesto reale'), text: t('Forum, chat, profili, campi di ricerca riflessi nella pagina.') },
        { title: t('Errore di design'), text: t('Output non codificato o innerHTML; assenza di Content-Security-Policy.') },
        { title: t('Cosa cambia'), text: t('Tag ed eventi HTML/JS nel commento diventano codice eseguito nel browser della vittima.') },
        { title: t('Difesa'), text: t('Codifica in output, CSP, textContent al posto di innerHTML, cookie HttpOnly e SameSite.') }
      ]
    },
    'brute-force': {
      title: t('Brute force sul login'),
      owasp: 'OWASP A07:2021 — Identification & Authentication Failures',
      risk: t('Alto'),
      plain: t("Non è un «trucco»: è provare molte password finché una funziona. Riesce solo dove le password sono deboli e il sistema non limita i tentativi, non blocca l'account e non chiede un secondo fattore."),
      phases: [
        { title: t('Contesto reale'), text: t('Portali admin, VPN, webmail, API di autenticazione esposte.') },
        { title: t('Errore di design'), text: t('Nessun rate limit, nessun CAPTCHA, password corte o riutilizzate.') },
        { title: t('Cosa cambia'), text: t('Un automatismo prova credenziali fino a una risposta di successo o a un token valido.') },
        { title: t('Difesa'), text: t('Secondo fattore, blocco temporaneo, ritardi, policy password, monitoraggio e alert.') }
      ]
    },
    'file-upload': {
      title: t('Upload di file non sicuro'),
      owasp: 'OWASP A04:2021 — Insecure Design',
      risk: t('Critico'),
      plain: t("Caricare un avatar o un documento significa che il server salva un file. Se controlla solo l'estensione o il Content-Type dichiarato dal client, un file eseguibile (per esempio uno script) mascherato da immagine può, se la cartella esegue script, portare all'esecuzione di codice sul server."),
      phases: [
        { title: t('Contesto reale'), text: t('CV, ticket, allegati e-commerce, CMS con libreria media.') },
        { title: t('Errore di design'), text: t('Fiducia nel Content-Type, cartella di upload sotto la web root, permessi di esecuzione.') },
        { title: t('Cosa cambia'), text: t('File malevolo salvato e richiamabile via URL → esecuzione di codice remoto.') },
        { title: t('Difesa'), text: t('Whitelist di estensioni, magic bytes, storage fuori web root, scansione AV, rinomina.') }
      ]
    },
    csrf: {
      title: 'CSRF (Cross-Site Request Forgery)',
      owasp: 'OWASP A01:2021 — Broken Access Control',
      risk: t('Alto'),
      plain: t("Se sei autenticato su un sito, il browser invia da solo il cookie di sessione. Una pagina malevola può far partire una richiesta (form, immagine) verso il sito legittimo: il server crede sia tu a eseguire il bonifico o il cambio email."),
      phases: [
        { title: t('Contesto reale'), text: t('Azioni sensibili via GET o POST senza token anti-CSRF.') },
        { title: t('Errore di design'), text: t('Solo i cookie autenticano; nessun controllo di Origin, Referer o token.') },
        { title: t('Cosa cambia'), text: t('La vittima apre la pagina dell\'attaccante → parte una richiesta autenticata e nascosta.') },
        { title: t('Difesa'), text: t('Token sincronizzatore, cookie SameSite, POST per le mutazioni, ri-autenticazione sulle operazioni critiche.') }
      ]
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderPhaseRail(attackId) {
    const meta = ATTACK_LAB[attackId];
    const rail = document.getElementById('phase-rail');
    if (!rail || !meta) return;

    rail.innerHTML = meta.phases
      .map(
        (p, i) => `
      <li class="phase-card" data-phase="${i}">
        <button type="button" class="phase-card__btn" aria-label="${escapeHtml(t('Fase {n}', { n: i + 1 }))}: ${escapeHtml(p.title)}">
          <span class="phase-num" aria-hidden="true">${i + 1}</span>
          <span class="phase-card__body">
            <span class="phase-card__k">${escapeHtml(t('Fase {n}', { n: i + 1 }))}</span>
            <span class="phase-card__t">${escapeHtml(p.title)}</span>
            <span class="phase-card__p">${escapeHtml(p.text)}</span>
          </span>
        </button>
      </li>`
      )
      .join('');
    rail.style.setProperty('--progress', '0');
  }

  /** Porta in vista e accende il blocco del percorso didattico della fase scelta */
  function focusLearnBlock(index) {
    const panel = document.querySelector('.tab-content.active');
    const block = panel && panel.querySelectorAll('.learn-block')[index];
    if (!block) return;
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function bindPhaseRail() {
    const rail = document.getElementById('phase-rail');
    if (!rail || rail.dataset.bound === '1') return;
    rail.dataset.bound = '1';
    rail.addEventListener('click', (e) => {
      const card = e.target.closest('.phase-card');
      if (!card) return;
      const index = Number(card.dataset.phase);
      highlightSimPhase(index);
      focusLearnBlock(index);
    });
  }

  function renderAttackContext(attackId) {
    const meta = ATTACK_LAB[attackId];
    const ctx = document.getElementById('attack-context');
    if (!ctx || !meta) return;

    ctx.innerHTML = `
      <h2>${escapeHtml(meta.title)}</h2>
      <div class="plain-box"><strong>${escapeHtml(t('In parole semplici:'))}</strong> ${escapeHtml(meta.plain)}</div>
      <div class="attack-meta-row">
        <span class="sim-chip blue">${escapeHtml(meta.owasp)}</span>
        <span class="sim-chip amber">${escapeHtml(t('Rischio {risk}', { risk: meta.risk }))}</span>
        <span class="sim-chip">${escapeHtml(t('Solo simulazione locale'))}</span>
      </div>`;
  }

  // index: fase accesa (0-3); -1 nessuna; 4 simulazione completata (tutte fatte)
  function highlightSimPhase(index) {
    const cards = document.querySelectorAll('.phase-card');
    cards.forEach((card, i) => {
      card.classList.toggle('active-phase', i === index);
      card.classList.toggle('is-done', i < index);
      const btn = card.querySelector('button');
      if (btn) btn.setAttribute('aria-current', i === index ? 'step' : 'false');
    });
    const rail = document.getElementById('phase-rail');
    if (rail && cards.length) {
      const progress = Math.max(0, Math.min(index, cards.length - 1)) / (cards.length - 1);
      rail.style.setProperty('--progress', String(progress));
    }
    const panel = document.querySelector('.tab-content.active');
    if (panel) {
      panel.querySelectorAll('.learn-block').forEach((block, i) => {
        block.classList.toggle('is-active', i === index);
        block.classList.toggle('is-done', i < index);
      });
    }
  }

  window.completeLabRun = function completeLabRun() {
    highlightSimPhase(4);
  };

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
      btn.tabIndex = isActive ? 0 : -1;
    });

    renderPhaseRail(attackType);
    renderAttackContext(attackType);
    highlightSimPhase(-1);

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

    // frecce sinistra/destra tra le schede, come in ogni tablist
    selector.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = Array.from(selector.querySelectorAll('.attack-btn[data-attack]'));
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      window.switchAttack(next.dataset.attack, next);
    });
  }

  function updateLabClock() {
    const el = document.getElementById('lab-last-run');
    if (!el) return;
    el.textContent = fmtDate(new Date(), { dateStyle: 'short', timeStyle: 'medium' });
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

  function bootLabUi() {
    bindAttackButtons();
    bindPhaseRail();
    window.switchAttack('sql-injection', document.querySelector('.attack-btn[data-attack="sql-injection"]'));
    updateLabClock();
  }

  document.addEventListener('DOMContentLoaded', bootLabUi);
  window.addEventListener('load', wrapSimulateFunctions);
})();
