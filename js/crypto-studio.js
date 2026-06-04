/**
 * Studio Cifratura EVIL — laboratorio, catalogo, schede modal
 */
(function () {
  const ALGORITHMS = window.CRYPTO_ALGORITHMS || [];

  const GLOSSARY = {
    hash: 'Funzione unidirezionale: da messaggio a digest fisso. Integrità, non segretezza.',
    sha256: 'SHA-256 (256 bit): standard odierno per integrità file, blockchain, certificati.',
    md5: 'MD5 (128 bit): obsoleto per sicurezza — collisioni note. Solo checksum legacy.',
    bcrypt: 'Hash adattivo per password: lento volutamente, resiste al brute force.',
    aes: 'Advanced Encryption Standard: cifratura simmetrica a blocchi (128/192/256 bit).',
    rsa: 'Cifratura asimmetrica basata su fattorizzazione: chiave pubblica/privata.',
    tls: 'Transport Layer Security: HTTPS — negozia cipher suite e autentica il server.',
    pki: 'Public Key Infrastructure: CA, certificati X.509, catena di fiducia.',
    hmac: 'Hash + chiave segreta: integrità con autenticazione (API, JWT firmati).',
    salt: 'Valore random aggiunto prima dell\'hash password — impedisce rainbow table.',
    nonce: 'Number used once: evita replay in protocolli crittografici.',
    'end-to-end': 'Solo mittente e destinatario leggono il plaintext — nemmeno il server.',
  };

  const grid = document.getElementById('crypto-algo-grid');
  const rail = document.getElementById('crypto-rail');
  const hashInput = document.getElementById('crypto-hash-input');
  const hashAlgo = document.getElementById('crypto-hash-algo');
  const hashOut = document.getElementById('crypto-hash-output');
  const hashDiff = document.getElementById('cr-hash-diff');
  const digestGrid = document.getElementById('cs-digest-grid');
  const digestAlgoLabel = document.getElementById('cs-digest-algo-label');
  const avalancheA = document.getElementById('cs-avalanche-a');
  const avalancheB = document.getElementById('cs-avalanche-b');
  const flipBtn = document.getElementById('cs-flip-bit');
  const tooltip = document.getElementById('crypto-term-tooltip');
  const meshWrap = document.getElementById('cs-mesh-wrap');
  const hero = document.getElementById('cs-hero');
  const handshake = document.getElementById('cs-handshake');
  const familyBtns = document.querySelectorAll('.cs-family');
  const modal = document.getElementById('cs-algo-modal');
  const modalClose = document.getElementById('cs-modal-close');
  const modalBody = document.getElementById('cs-modal-body');
  const modalTitle = document.getElementById('cs-modal-title');
  const modalCat = document.getElementById('cs-modal-cat');
  const modalRank = document.getElementById('cs-modal-rank');
  const modalRankNum = document.getElementById('cs-modal-rank-num');

  let prevHash = '';
  let forgeUsed = false;
  let modalOpened = false;
  let digestCells = [];
  let lastFocus = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const algoMap = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a]));

  function escapeHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function term(key, label) {
    const def = GLOSSARY[key];
    if (!def) return escapeHtml(label || key);
    return `<span class="crypto-term" tabindex="0" data-def="${escapeHtml(def)}">${escapeHtml(label || key)}</span>`;
  }

  function catLabel(cat) {
    if (cat === 'hash') return 'Hash / KDF';
    if (cat === 'sym') return 'Simmetrica';
    if (cat === 'asym') return 'Asimmetrica';
    return 'TLS / PKI';
  }

  function rankClass(n) {
    if (n <= 3) return 'cs-rank--low';
    if (n <= 6) return 'cs-rank--mid';
    if (n <= 8) return 'cs-rank--good';
    return 'cs-rank--top';
  }

  function setFilter(filter) {
    rail?.querySelectorAll('.cs-rail__btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.filter === filter);
    });
    familyBtns.forEach((f) => {
      f.classList.toggle('is-selected', f.dataset.filter === filter);
    });
    renderCards(filter);
  }

  function matchFilter(a, filter) {
    if (filter === 'all') return true;
    if (filter === 'asym-tls') return a.cat === 'asym' || a.cat === 'tls';
    return a.cat === filter;
  }

  function renderCards(filter) {
    if (!grid) return;
    const items = ALGORITHMS.filter((a) => matchFilter(a, filter));
    grid.innerHTML = items
      .map(
        (a, i) => `
      <button type="button" class="cs-card" data-cat="${a.cat}" data-algo-id="${a.id}" style="--i:${i}" aria-label="Apri scheda ${escapeHtml(a.name)}">
        <span class="cs-card__rank ${rankClass(a.securityRank)}" aria-hidden="true">${a.securityRank}</span>
        <p class="cs-card__tag">${catLabel(a.cat)}</p>
        <h3>${escapeHtml(a.name)}</h3>
        <p>${escapeHtml(a.desc)}</p>
        <div class="cs-card__meta">${a.pills.map((p) => `<span class="cs-card__pill">${escapeHtml(p)}</span>`).join('')}</div>
        <span class="cs-card__open">Scheda completa →</span>
      </button>`
      )
      .join('');
  }

  function buildModalHtml(a) {
    const pros = a.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join('');
    const cons = a.cons.map((c) => `<li>${escapeHtml(c)}</li>`).join('');
    return `
      <section class="cs-modal-section">
        <h3>Cos'è</h3>
        <p>${escapeHtml(a.what)}</p>
      </section>
      <section class="cs-modal-section">
        <h3>Come funziona</h3>
        <pre class="cs-modal-eq" aria-label="Formulazione">${escapeHtml(a.equation)}</pre>
      </section>
      <section class="cs-modal-section cs-modal-section--history">
        <h3>Storia e origine</h3>
        <dl class="cs-modal-dl">
          <div><dt>Origine</dt><dd>${escapeHtml(a.history.origin)}</dd></div>
          <div><dt>Perché serviva</dt><dd>${escapeHtml(a.history.need)}</dd></div>
          <div><dt>Cosa risolveva</dt><dd>${escapeHtml(a.history.satisfied)}</dd></div>
        </dl>
      </section>
      <div class="cs-modal-procon">
        <section class="cs-modal-section cs-modal-section--pro">
          <h3>Pro</h3>
          <ul>${pros}</ul>
        </section>
        <section class="cs-modal-section cs-modal-section--con">
          <h3>Contro</h3>
          <ul>${cons}</ul>
        </section>
      </div>
      <section class="cs-modal-section cs-modal-section--ranknote">
        <h3>Rank sicurezza (2026)</h3>
        <div class="cs-modal-rank-bar" role="img" aria-label="Livello ${a.securityRank} su 10">
          ${Array.from({ length: 10 }, (_, i) => `<span class="${i < a.securityRank ? 'is-on' : ''}"></span>`).join('')}
        </div>
        <p class="cs-modal-rank-note">${escapeHtml(a.securityNote)}</p>
      </section>`;
  }

  function openModal(id) {
    const a = algoMap[id];
    if (!a || !modal) return;

    lastFocus = document.activeElement;
    modalCat.textContent = catLabel(a.cat);
    modalTitle.textContent = a.name;
    modalRankNum.textContent = String(a.securityRank);
    modalRank.className = `cs-modal__rank ${rankClass(a.securityRank)}`;
    modalBody.innerHTML = buildModalHtml(a);

    modal.hidden = false;
    document.body.classList.add('cs-modal-open');
    requestAnimationFrame(() => modal.classList.add('is-open'));
    modalClose?.focus();

    if (!modalOpened) {
      modalOpened = true;
      window.progressManager?.logActivity?.('crypto_study_completed', { section: 'catalog_detail' });
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('cs-modal-open');
    setTimeout(() => {
      modal.hidden = true;
      modalBody.innerHTML = '';
    }, 280);
    lastFocus?.focus?.();
  }

  function initModal() {
    grid?.addEventListener('click', (e) => {
      const card = e.target.closest('.cs-card[data-algo-id]');
      if (card) openModal(card.dataset.algoId);
    });

    modalClose?.addEventListener('click', closeModal);
    modal?.querySelector('[data-cs-close]')?.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
    });
  }

  function initRail() {
    rail?.querySelectorAll('.cs-rail__btn').forEach((btn) => {
      btn.addEventListener('click', () => setFilter(btn.dataset.filter || 'all'));
    });
    familyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        setFilter(btn.dataset.filter || 'all');
        document.getElementById('cs-catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function byteToColor(byte) {
    const h = (byte * 1.41) % 360;
    const s = 55 + (byte % 30);
    const l = 38 + (byte % 22);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  function initDigestGrid() {
    if (!digestGrid) return;
    digestGrid.innerHTML = '';
    digestCells = [];
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement('div');
      cell.className = 'cs-digest-cell';
      digestGrid.appendChild(cell);
      digestCells.push(cell);
    }
  }

  function updateDigestGrid(hex) {
    if (!digestCells.length || !hex) return;
    for (let i = 0; i < 64; i++) {
      const pair = hex.slice(i * 2, i * 2 + 2);
      if (pair.length < 2) break;
      const byte = parseInt(pair, 16);
      const cell = digestCells[i];
      const color = byteToColor(byte);
      cell.style.background = color;
      cell.style.color = color;
      if (!reducedMotion) {
        cell.classList.add('is-updating');
        setTimeout(() => cell.classList.remove('is-updating'), 350);
      }
    }
  }

  function renderHashHtml(hex, prev) {
    if (!hashOut) return;
    if (!prev) {
      hashOut.textContent = hex;
      return;
    }
    hashOut.innerHTML = [...hex]
      .map((ch, i) => `<span class="cs-hash-char${prev[i] !== ch ? ' is-diff' : ''}">${ch}</span>`)
      .join('');
  }

  function renderAvalanche(prev, next) {
    if (!avalancheA || !avalancheB || !prev || !next || prev === next) return;
    const fmt = (str, other) =>
      [...str]
        .map((ch, i) => (other[i] !== ch ? `<span class="diff">${ch}</span>` : ch))
        .join('');
    avalancheA.innerHTML = fmt(prev, next);
    avalancheB.innerHTML = fmt(next, prev);
  }

  function showDiffStat(prev, next) {
    if (!hashDiff || !prev || !next || prev === next) {
      if (hashDiff) hashDiff.hidden = true;
      return;
    }
    let changed = 0;
    for (let i = 0; i < Math.max(prev.length, next.length); i++) {
      if (prev[i] !== next[i]) changed++;
    }
    hashDiff.hidden = false;
    hashDiff.innerHTML = `Valanga: <strong>${changed}</strong> caratteri su ${next.length} diversi (${Math.round((changed / next.length) * 100)}%)`;
  }

  async function computeHash() {
    if (!hashInput || !hashOut || !hashAlgo) return;
    const text = hashInput.value;
    hashOut.classList.add('is-computing');
    hashOut.textContent = 'Calcolo…';

    if (!forgeUsed && text.trim()) {
      forgeUsed = true;
      window.progressManager?.logActivity?.('crypto_study_completed', { section: 'forge' });
    }

    try {
      if (!text && hashAlgo.value !== 'demo') {
        hashOut.textContent = 'Inserisci testo da hashare.';
        hashOut.classList.remove('is-computing');
        return;
      }
      if (hashAlgo.value === 'demo') {
        hashOut.textContent = 'Cambia una lettera o usa «Flip bit» per vedere l\'effetto valanga.';
        hashOut.classList.remove('is-computing');
        return;
      }

      if (digestAlgoLabel) digestAlgoLabel.textContent = hashAlgo.value.replace('SHA-', 'SHA-');

      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest(hashAlgo.value, enc.encode(text));
      const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

      showDiffStat(prevHash, hex);
      renderAvalanche(prevHash, hex);
      renderHashHtml(hex, prevHash);
      updateDigestGrid(hex);
      prevHash = hex;
    } catch (e) {
      hashOut.textContent = 'Errore: ' + e.message;
    }
    hashOut.classList.remove('is-computing');
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function initForge() {
    hashInput?.addEventListener('input', debounce(computeHash, 240));
    hashAlgo?.addEventListener('change', computeHash);
    flipBtn?.addEventListener('click', () => {
      if (!hashInput?.value) return;
      const chars = hashInput.value.split('');
      const i = chars.length - 1;
      const c = chars[i];
      chars[i] = c === 'z' ? 'y' : c === 'Z' ? 'Y' : String.fromCharCode(c.charCodeAt(0) + 1);
      hashInput.value = chars.join('');
      hashInput.dispatchEvent(new Event('input'));
    });
    computeHash();
  }

  function initHero() {
    requestAnimationFrame(() => hero?.classList.add('hero-ready'));
  }

  function initParallax() {
    if (reducedMotion || !meshWrap) return;
    window.addEventListener(
      'mousemove',
      (e) => {
        const px = (e.clientX / window.innerWidth - 0.5) * 24;
        const py = (e.clientY / window.innerHeight - 0.5) * 16;
        meshWrap.style.setProperty('--cs-mx', `${px}px`);
        meshWrap.style.setProperty('--cs-my', `${py}px`);
      },
      { passive: true }
    );
  }

  function initHandshake() {
    if (!handshake || reducedMotion) return;
    const steps = handshake.querySelectorAll('li');
    let idx = 0;
    setInterval(() => {
      steps.forEach((s, i) => {
        s.classList.remove('is-active', 'is-done');
        if (i < idx) s.classList.add('is-done');
        if (i === idx) s.classList.add('is-active');
      });
      idx = (idx + 1) % steps.length;
    }, 2200);
  }

  function initReveal() {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.cs-reveal').forEach((el) => obs.observe(el));
  }

  function positionTooltip(el) {
    if (!tooltip || !el?.dataset.def) return;
    tooltip.textContent = el.dataset.def;
    tooltip.hidden = false;
    tooltip.style.left = '-9999px';
    tooltip.classList.add('is-visible');
    const rect = el.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tw / 2;
    if (top + th > window.innerHeight - 12) top = rect.top - th - 8;
    left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltip?.classList.remove('is-visible');
    if (tooltip) tooltip.hidden = true;
  }

  function initTerms() {
    document.body.addEventListener('mouseover', (e) => {
      const t = e.target.closest('.crypto-term');
      if (t) positionTooltip(t);
    });
    document.body.addEventListener('mouseout', (e) => {
      const t = e.target.closest('.crypto-term');
      if (t && !t.contains(e.relatedTarget)) hideTooltip();
    });
    document.body.addEventListener('focusin', (e) => {
      const t = e.target.closest('.crypto-term');
      if (t) positionTooltip(t);
    });
    document.body.addEventListener('focusout', (e) => {
      const t = e.target.closest('.crypto-term');
      if (t && !t.contains(e.relatedTarget)) hideTooltip();
    });
  }

  function enrichStaticTerms() {
    const intro = document.getElementById('crypto-intro-text');
    if (intro) {
      intro.innerHTML = [
        term('hash', 'Hash'),
        ', simmetrica, asimmetrica e ',
        term('tls', 'TLS'),
        ': la ',
        term('pki', 'PKI'),
        ' regola la fiducia digitale. Calcola digest reali, apri le schede tecniche nel catalogo.',
      ].join('');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDigestGrid();
    renderCards('all');
    initRail();
    initForge();
    initModal();
    initHero();
    initParallax();
    initHandshake();
    initReveal();
    initTerms();
    enrichStaticTerms();
  });
})();
