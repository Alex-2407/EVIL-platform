/**
 * Studio cifratura — banco di prova: HMAC, AES-GCM, forza delle password, cifrario di Cesare.
 * Tutto gira nel browser con la Web Crypto API: nessun dato lascia il computer.
 */
(function () {
  'use strict';
  const mount = document.getElementById('cs-bench-root');
  if (!mount || !window.crypto || !window.crypto.subtle) return;
  const { t } = window.EVIL_I18N;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  const TABS = [
    { id: 'hmac', label: t('HMAC'), title: t('Firma un messaggio con una chiave'), lead: t('Un hash semplice lo può ricalcolare chiunque. Un HMAC richiede la chiave: solo chi la conosce può produrlo o verificarlo.') },
    { id: 'aes', label: t('Cifra e manomette'), title: t('AES-GCM: cifra, poi prova a rovinarlo'), lead: t('La password diventa una chiave (PBKDF2), il testo viene cifrato con AES-256-GCM. Cambia anche un solo bit del cifrato: la decifratura si rifiuta, perché GCM autentica i dati.') },
    { id: 'pwd', label: t('Password'), title: t('Quanto resiste una password?'), lead: t('Stima il tempo di un attacco a tentativi contro tre tipi di archiviazione e misura quanto è veloce o lento il tuo browser con un hash semplice e con uno lento.') },
    { id: 'caesar', label: t('Cifrario di Cesare'), title: t('Un cifrario antico e perché non basta'), lead: t('Sposta ogni lettera di un numero fisso. Con sole 25 chiavi possibili, la forza bruta lo rompe in un istante: guarda la tabella.') },
  ];

  mount.innerHTML = `
    <div class="cb-tabs" role="tablist" aria-label="${esc(t('Esperimenti'))}">
      ${TABS.map((tab, i) => `<button type="button" role="tab" class="cb-tab${i ? '' : ' is-on'}" id="cb-tab-${tab.id}" aria-selected="${i === 0}" aria-controls="cb-${tab.id}" data-tab="${tab.id}"><span>${i + 1}</span>${esc(tab.label)}</button>`).join('')}
    </div>
    ${TABS.map((tab, i) => `<article class="cb-panel" id="cb-${tab.id}" role="tabpanel" aria-labelledby="cb-tab-${tab.id}"${i ? ' hidden' : ''}>
      <h3>${esc(tab.title)}</h3><p class="cb-lead">${esc(tab.lead)}</p><div class="cb-body" data-body="${tab.id}"></div></article>`).join('')}`;

  const tabs = [...mount.querySelectorAll('.cb-tab')];
  function showTab(id) {
    tabs.forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    mount.querySelectorAll('.cb-panel').forEach((p) => { p.hidden = p.id !== 'cb-' + id; });
  }
  mount.querySelector('.cb-tabs').addEventListener('click', (e) => { const b = e.target.closest('.cb-tab'); if (b) showTab(b.dataset.tab); });
  mount.querySelector('.cb-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((b) => b.classList.contains('is-on'));
    const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    showTab(n.dataset.tab); n.focus();
  });
  const body = (id) => mount.querySelector(`[data-body="${id}"]`);

  /* ───────────── 1. HMAC ───────────── */
  body('hmac').innerHTML = `
    <div class="cb-grid">
      <label>${esc(t('Messaggio'))}<textarea id="hm-msg" spellcheck="false">importo=100&amp;destinatario=IT60X0542811101000000123456</textarea></label>
      <label>${esc(t('Chiave segreta'))}<input id="hm-key" type="text" spellcheck="false" autocomplete="off" value="chiave-condivisa-di-prova"></label>
    </div>
    <div class="cb-out"><span>HMAC-SHA256</span><code id="hm-out" aria-live="polite"></code></div>
    <div class="cb-out"><span>${esc(t('Solo SHA-256'))}</span><code id="hm-plain"></code></div>
    <div class="cb-row">
      <label class="cb-grow">${esc(t('Verifica un MAC ricevuto'))}<input id="hm-recv" type="text" spellcheck="false" autocomplete="off" placeholder="${esc(t('incolla un MAC esadecimale'))}"></label>
      <button type="button" class="cb-btn" id="hm-copy">${esc(t('Copia il MAC calcolato'))}</button>
      <button type="button" class="cb-btn cb-btn--ghost" id="hm-tamper">${esc(t('Altera il messaggio'))}</button>
    </div>
    <p class="cb-verdict" id="hm-verdict" role="status"></p>
    <p class="cb-note">${esc(t('Chiunque può ricalcolare lo SHA-256 semplice di un messaggio modificato; senza la chiave nessuno può produrre l’HMAC corretto. È il meccanismo dietro i token API e i cookie firmati.'))}</p>`;
  const hmMsg = document.getElementById('hm-msg');
  const hmKey = document.getElementById('hm-key');
  const hmRecv = document.getElementById('hm-recv');
  let hmCurrent = '';
  async function hmacOf(msg, key) {
    const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
  }
  async function hmRefresh() {
    hmCurrent = await hmacOf(hmMsg.value, hmKey.value);
    document.getElementById('hm-out').textContent = hmCurrent;
    document.getElementById('hm-plain').textContent = hex(await crypto.subtle.digest('SHA-256', enc.encode(hmMsg.value)));
    const v = document.getElementById('hm-verdict');
    const got = hmRecv.value.trim().toLowerCase();
    if (!got) { v.textContent = ''; v.className = 'cb-verdict'; return; }
    let diff = got.length ^ hmCurrent.length;
    for (let i = 0; i < hmCurrent.length; i += 1) diff |= (got.charCodeAt(i) || 0) ^ hmCurrent.charCodeAt(i);
    v.className = 'cb-verdict ' + (diff === 0 ? 'is-ok' : 'is-bad');
    v.textContent = diff === 0 ? t('MAC valido: il messaggio è integro e proviene da chi conosce la chiave.') : t('MAC non valido: messaggio alterato o chiave diversa.');
  }
  [hmMsg, hmKey, hmRecv].forEach((el) => el.addEventListener('input', hmRefresh));
  document.getElementById('hm-copy').addEventListener('click', () => { hmRecv.value = hmCurrent; hmRefresh(); });
  document.getElementById('hm-tamper').addEventListener('click', () => { hmMsg.value = hmMsg.value.replace(/100/, '900'); if (!/900/.test(hmMsg.value)) hmMsg.value += ' '; hmRefresh(); });
  hmRefresh();

  /* ───────────── 2. AES-GCM ───────────── */
  body('aes').innerHTML = `
    <div class="cb-grid">
      <label>${esc(t('Testo in chiaro'))}<textarea id="ae-text" spellcheck="false">${esc(t('Appuntamento alle 18:00, porta il documento.'))}</textarea></label>
      <label>${esc(t('Password'))}<input id="ae-pass" type="text" spellcheck="false" autocomplete="off" value="correct-horse-battery"></label>
    </div>
    <div class="cb-row"><button type="button" class="cb-btn" id="ae-enc">${esc(t('Cifra'))}</button>
      <button type="button" class="cb-btn cb-btn--ghost" id="ae-flip" disabled>${esc(t('Cambia 1 bit del cifrato'))}</button>
      <button type="button" class="cb-btn cb-btn--ghost" id="ae-dec" disabled>${esc(t('Decifra'))}</button>
      <label class="cb-inline">${esc(t('Password per decifrare'))}<input id="ae-pass2" type="text" spellcheck="false" autocomplete="off" value="correct-horse-battery"></label></div>
    <div class="cb-out"><span>${esc(t('Pacchetto'))}</span><code id="ae-pack" aria-live="polite">—</code></div>
    <div class="cb-parts" id="ae-parts" hidden></div>
    <p class="cb-verdict" id="ae-verdict" role="status"></p>
    <p class="cb-note">${esc(t('Il pacchetto contiene salt (per derivare la chiave), IV (mai riutilizzarlo con la stessa chiave) e cifrato con tag di autenticazione. Con una password sbagliata o con un solo bit cambiato, GCM rifiuta di decifrare invece di restituire testo errato.'))}</p>`;
  let aePacket = null;
  const aeVerdict = (ok, msg) => { const v = document.getElementById('ae-verdict'); v.className = 'cb-verdict ' + (ok ? 'is-ok' : 'is-bad'); v.textContent = msg; };
  async function aeKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  function aeShow() {
    const { salt, iv, ct } = aePacket;
    document.getElementById('ae-pack').textContent = [b64(salt), b64(iv), b64(ct)].join('.');
    const parts = document.getElementById('ae-parts'); parts.hidden = false;
    parts.innerHTML = `<span class="p-salt"><b>salt</b> ${salt.length} B</span><span class="p-iv"><b>IV</b> ${iv.length} B</span><span class="p-ct"><b>${esc(t('cifrato'))}</b> ${ct.length - 16} B</span><span class="p-tag"><b>tag</b> 16 B</span>`;
    document.getElementById('ae-flip').disabled = false;
    document.getElementById('ae-dec').disabled = false;
  }
  document.getElementById('ae-enc').addEventListener('click', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await aeKey(document.getElementById('ae-pass').value, salt);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(document.getElementById('ae-text').value)));
    aePacket = { salt, iv, ct };
    aeShow();
    aeVerdict(true, t('Cifrato. Ora prova a decifrare, oppure cambia un bit e riprova.'));
  });
  document.getElementById('ae-flip').addEventListener('click', () => {
    if (!aePacket) return;
    aePacket.ct = aePacket.ct.slice(); aePacket.ct[0] ^= 1; aeShow();
    aeVerdict(false, t('Un bit del cifrato è stato cambiato. Prova a decifrare.'));
  });
  document.getElementById('ae-dec').addEventListener('click', async () => {
    if (!aePacket) return;
    try {
      const key = await aeKey(document.getElementById('ae-pass2').value, aePacket.salt);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: aePacket.iv }, key, aePacket.ct);
      aeVerdict(true, t('Decifrato e autenticato: {text}', { text: dec.decode(plain) }));
    } catch (_) {
      aeVerdict(false, t('Decifratura rifiutata: password sbagliata oppure dati manomessi. GCM non restituisce mai testo non autenticato.'));
    }
  });

  /* ───────────── 3. Password ───────────── */
  body('pwd').innerHTML = `
    <label class="cb-grow">${esc(t('Prova una password (resta nel tuo browser)'))}<input id="pw-in" type="text" spellcheck="false" autocomplete="off" value="Estate2024!"></label>
    <div class="cb-meter" aria-hidden="true"><i id="pw-bar"></i></div>
    <p class="cb-verdict" id="pw-sum" role="status"></p>
    <table class="cb-table"><thead><tr><th>${esc(t('Come è archiviata'))}</th><th>${esc(t('Tentativi al secondo'))}</th><th>${esc(t('Tempo medio per indovinarla'))}</th></tr></thead>
      <tbody id="pw-rows"></tbody></table>
    <div class="cb-row"><button type="button" class="cb-btn" id="pw-bench">${esc(t('Misura questo browser'))}</button>
      <p class="cb-note cb-grow" id="pw-bench-out">${esc(t('Misura quanti SHA-256 al secondo calcola il tuo browser e quanto impiega PBKDF2 con 600.000 iterazioni.'))}</p></div>
    <p class="cb-note">${esc(t('Stima semplificata: conta solo lunghezza e tipi di caratteri e segnala le password più comuni. Gli attacchi reali usano dizionari e regole, quindi una password prevedibile cede molto prima.'))}</p>`;
  const COMMON = ['123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon', 'iloveyou', 'admin', 'welcome', 'letmein', 'monkey', 'abc123', 'password1', 'ciao', 'juventus', 'milan', 'inter', 'roma', 'napoli', 'italia', 'amore', 'qwerty123', 'admin123', 'estate2024', 'password123'];
  const SPEEDS = [
    { label: t('Login online (limitato)'), rate: 10 },
    { label: t('Hash lento (bcrypt/Argon2)'), rate: 1e4 },
    { label: t('Hash veloce (SHA-256 su GPU)'), rate: 1e10 },
  ];
  function fmtTime(s) {
    if (!isFinite(s)) return t('praticamente mai');
    if (s < 1) return t('meno di un secondo');
    const u = [[31557600 * 1e9, t('miliardi di anni')], [31557600 * 1e6, t('milioni di anni')], [31557600 * 1000, t('migliaia di anni')], [31557600, t('anni')], [86400, t('giorni')], [3600, t('ore')], [60, t('minuti')], [1, t('secondi')]];
    for (const [d, name] of u) if (s >= d) return `${Math.round(s / d).toLocaleString()} ${name}`;
    return t('meno di un secondo');
  }
  function pwRefresh() {
    const p = document.getElementById('pw-in').value;
    let pool = 0;
    if (/[a-z]/.test(p)) pool += 26;
    if (/[A-Z]/.test(p)) pool += 26;
    if (/\d/.test(p)) pool += 10;
    if (/[^A-Za-z0-9]/.test(p)) pool += 33;
    const common = COMMON.includes(p.toLowerCase().replace(/[!@#$%^&*._-]+$/g, ''));
    const bits = p ? (common ? 8 : Math.log2(Math.max(pool, 1)) * p.length) : 0;
    const guesses = Math.pow(2, bits) / 2;
    document.getElementById('pw-bar').style.width = Math.min(100, (bits / 90) * 100) + '%';
    document.getElementById('pw-bar').style.background = bits < 40 ? '#f87171' : bits < 64 ? '#f59e0b' : '#34d399';
    const sum = document.getElementById('pw-sum');
    sum.className = 'cb-verdict ' + (bits < 40 ? 'is-bad' : bits < 64 ? '' : 'is-ok');
    sum.textContent = !p ? '' : common
      ? t('È tra le password più comuni: finisce in qualunque dizionario.')
      : t('Circa {bits} bit di entropia stimata ({len} caratteri, {pool} simboli possibili).', { bits: Math.round(bits), len: p.length, pool });
    document.getElementById('pw-rows').innerHTML = SPEEDS.map((s) => `<tr><td>${esc(s.label)}</td><td>${s.rate.toLocaleString()}</td><td><b>${esc(p ? fmtTime(guesses / s.rate) : '—')}</b></td></tr>`).join('');
  }
  document.getElementById('pw-in').addEventListener('input', pwRefresh);
  pwRefresh();
  document.getElementById('pw-bench').addEventListener('click', async (e) => {
    const btn = e.currentTarget; const out = document.getElementById('pw-bench-out');
    btn.disabled = true; out.textContent = t('Misura in corso…');
    const data = enc.encode('evil');
    let n = 0; const t0 = performance.now();
    while (performance.now() - t0 < 400) { await crypto.subtle.digest('SHA-256', data); n += 1; }
    const perSec = Math.round(n / ((performance.now() - t0) / 1000));
    const base = await crypto.subtle.importKey('raw', enc.encode('password'), 'PBKDF2', false, ['deriveBits']);
    const t1 = performance.now();
    await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('salt'), iterations: 600000, hash: 'SHA-256' }, base, 256);
    const ms = Math.round(performance.now() - t1);
    out.textContent = t('Questo browser calcola circa {n} SHA-256 al secondo (una singola chiamata alla volta) ma una derivazione PBKDF2 con 600.000 iterazioni richiede {ms} ms: è il costo che un attaccante paga a ogni tentativo.', { n: perSec.toLocaleString(), ms });
    btn.disabled = false;
  });

  /* ───────────── 4. Cesare ───────────── */
  body('caesar').innerHTML = `
    <div class="cb-grid">
      <label>${esc(t('Testo'))}<textarea id="cz-text" spellcheck="false">${esc(t('Ci vediamo domani alla stazione'))}</textarea></label>
      <label>${esc(t('Spostamento'))}: <b id="cz-n">3</b><input id="cz-shift" type="range" min="1" max="25" value="3"></label>
    </div>
    <div class="cb-out"><span>${esc(t('Cifrato'))}</span><code id="cz-out" aria-live="polite"></code></div>
    <h4 class="cb-sub">${esc(t('Forza bruta: tutte le 25 chiavi'))}</h4>
    <ol class="cb-brute" id="cz-brute"></ol>
    <p class="cb-note">${esc(t('Il programma evidenzia la riga con la distribuzione di lettere più simile a una lingua reale. Con 25 chiavi non serve alcuna intelligenza: è per questo che la sicurezza oggi dipende da chiavi di 128–256 bit, non dal segreto dell’algoritmo.'))}</p>`;
  const FREQ = 'eaionrtlscdupm';
  const shift = (s, n) => s.replace(/[a-z]/gi, (ch) => { const base = ch <= 'Z' ? 65 : 97; return String.fromCharCode(((ch.charCodeAt(0) - base + n + 26) % 26) + base); });
  const score = (s) => { const l = s.toLowerCase().replace(/[^a-z]/g, ''); let sc = 0; for (const ch of l) { const i = FREQ.indexOf(ch); if (i >= 0) sc += FREQ.length - i; } return l.length ? sc / l.length : 0; };
  function czRefresh() {
    const n = Number(document.getElementById('cz-shift').value);
    document.getElementById('cz-n').textContent = n;
    const cipher = shift(document.getElementById('cz-text').value, n);
    document.getElementById('cz-out').textContent = cipher;
    const rows = Array.from({ length: 25 }, (_, i) => ({ k: i + 1, txt: shift(cipher, -(i + 1)) }));
    const best = rows.reduce((a, b) => (score(b.txt) > score(a.txt) ? b : a), rows[0]).k;
    document.getElementById('cz-brute').innerHTML = rows.map((r) => `<li${r.k === best ? ' class="is-best"' : ''}><b>${r.k}</b><span>${esc(r.txt)}</span></li>`).join('');
  }
  document.getElementById('cz-shift').addEventListener('input', czRefresh);
  document.getElementById('cz-text').addEventListener('input', czRefresh);
  czRefresh();
})();
