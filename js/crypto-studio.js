/**
 * Studio Cifratura EVIL — canvas scenico, hash lab, filtri, glossario
 */
(function () {
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

  const ALGORITHMS = [
    { cat: 'hash', name: 'SHA-256', desc: 'Integrità file, Git, Bitcoin. Output 64 hex chars.', pills: ['256 bit', 'NIST'] },
    { cat: 'hash', name: 'SHA-512', desc: 'Variante più ampia di SHA-2 per hash ad alta sicurezza.', pills: ['512 bit', 'SHA-2'] },
    { cat: 'hash', name: 'SHA-1', desc: 'Deprecato: collisioni SHAttered (2017). Evitare in nuovi sistemi.', pills: ['160 bit', 'Legacy'] },
    { cat: 'hash', name: 'MD5', desc: 'Rotto per sicurezza critica. Ancora visto in checksum non critici.', pills: ['128 bit', 'Weak'] },
    { cat: 'hash', name: 'bcrypt / Argon2', desc: 'Password hashing: cost factor e salt integrati. Argon2 vince PHC.', pills: ['KDF', 'Password'] },
    { cat: 'hash', name: 'HMAC-SHA256', desc: 'MAC simmetrico: integrità + autenticità con chiave condivisa.', pills: ['MAC', 'API'] },
    { cat: 'sym', name: 'AES-GCM', desc: 'Cifratura autenticata: riservatezza + rilevamento manomissioni.', pills: ['AEAD', 'TLS 1.3'] },
    { cat: 'sym', name: 'ChaCha20-Poly1305', desc: 'Alternativa moderna ad AES, usata in TLS e Signal.', pills: ['Stream', 'Mobile'] },
    { cat: 'sym', name: 'DES / 3DES', desc: 'Obsoleti: chiavi troppo corte. Solo legacy banking.', pills: ['56 bit', 'Deprecated'] },
    { cat: 'asym', name: 'RSA', desc: 'Scambio chiavi, firme digitali. Chiavi 2048+ bit minimo.', pills: ['PKCS', 'Certificati'] },
    { cat: 'asym', name: 'ECDSA / Ed25519', desc: 'Curve ellittiche: chiavi corte, veloci. Ed25519 in SSH moderno.', pills: ['ECC', 'EdDSA'] },
    { cat: 'asym', name: 'Diffie-Hellman', desc: 'Scambio chiavi su canale pubblico — base di TLS e VPN.', pills: ['ECDHE', 'PFS'] },
    { cat: 'tls', name: 'TLS 1.3', desc: 'Solo cipher sicuri, 0-RTT opzionale, depreca RSA key exchange.', pills: ['HTTPS', '2024+'] },
    { cat: 'tls', name: 'Certificati X.509', desc: 'Legano dominio a chiave pubblica — firmati da CA trusted.', pills: ['PKI', 'EVIL ssl-analyzer'] },
    { cat: 'tls', name: 'Perfect Forward Secrecy', desc: 'Compromissione chiave long-term non decifra sessioni passate (ECDHE).', pills: ['PFS', 'DHE'] },
  ];

  const canvas = document.getElementById('crypto-cipher-canvas');
  const grid = document.getElementById('crypto-algo-grid');
  const rail = document.getElementById('crypto-rail');
  const hashInput = document.getElementById('crypto-hash-input');
  const hashAlgo = document.getElementById('crypto-hash-algo');
  const hashOut = document.getElementById('crypto-hash-output');
  const tooltip = document.getElementById('crypto-term-tooltip');
  let activeTerm = null;
  let forgeUsed = false;

  function escapeHtml(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function term(key, label) {
    const def = GLOSSARY[key];
    if (!def) return escapeHtml(label || key);
    return `<span class="crypto-term" tabindex="0" data-def="${escapeHtml(def)}">${escapeHtml(label || key)}</span>`;
  }

  function renderCards(filter) {
    if (!grid) return;
    grid.innerHTML = ALGORITHMS.map(
      (a) => `
      <article class="crypto-card${filter !== 'all' && filter !== a.cat ? ' is-hidden' : ''}" data-cat="${a.cat}">
        <p class="crypto-card__tag">${a.cat === 'hash' ? 'Hash' : a.cat === 'sym' ? 'Simmetrica' : a.cat === 'asym' ? 'Asimmetrica' : 'TLS / PKI'}</p>
        <h3>${escapeHtml(a.name)}</h3>
        <p>${escapeHtml(a.desc)}</p>
        <div class="crypto-card__meta">${a.pills.map((p) => `<span class="crypto-card__pill">${escapeHtml(p)}</span>`).join('')}</div>
      </article>`
    ).join('');
  }

  function initRail() {
    if (!rail) return;
    rail.querySelectorAll('.crypto-rail__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        rail.querySelectorAll('.crypto-rail__btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderCards(btn.dataset.filter || 'all');
      });
    });
  }

  async function computeHash() {
    if (!hashInput || !hashOut || !hashAlgo) return;
    const text = hashInput.value;
    hashOut.classList.add('is-computing');
    hashOut.textContent = 'Calcolo in corso…';

    if (!forgeUsed && text.trim()) {
      forgeUsed = true;
      if (window.progressManager?.logActivity) {
        window.progressManager.logActivity('crypto_study_completed', { section: 'forge' });
      }
    }

    try {
      if (!text && hashAlgo.value !== 'demo') {
        hashOut.textContent = 'Inserisci testo da hashare.';
        hashOut.classList.remove('is-computing');
        return;
      }
      if (hashAlgo.value === 'demo') {
        hashOut.textContent = 'Demo avalanche: cambia una lettera e osserva come cambia tutto l\'hash.';
        hashOut.classList.remove('is-computing');
        return;
      }
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest(hashAlgo.value, enc.encode(text));
      const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      hashOut.textContent = hex;
    } catch (e) {
      hashOut.textContent = 'Errore: ' + e.message;
    }
    hashOut.classList.remove('is-computing');
  }

  function initForge() {
    hashInput?.addEventListener('input', debounce(computeHash, 280));
    hashAlgo?.addEventListener('change', computeHash);
    computeHash();
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function initCipherCanvas() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chars = '0123456789ABCDEFabcdef§λ∑⊕⊗';
    let cols;
    let drops;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.floor(canvas.width / 18);
      drops = Array(cols).fill(0).map(() => Math.random() * canvas.height);
    }

    function draw() {
      ctx.fillStyle = 'rgba(4, 8, 16, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px ui-monospace, Consolas, monospace';
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * 18;
        const y = drops[i] * 18;
        const hue = 260 + (i % 3) * 40;
        ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${0.15 + Math.random() * 0.25})`;
        ctx.fillText(ch, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    draw();
  }

  function initReveal() {
    const sections = document.querySelectorAll('.crypto-section');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    sections.forEach((s) => obs.observe(s));
  }

  function positionTooltip(el) {
    if (!tooltip || !el?.dataset.def) return;
    activeTerm = el;
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
    activeTerm = null;
    if (tooltip) {
      tooltip.classList.remove('is-visible');
      tooltip.hidden = true;
    }
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
        'Hash, simmetrica, asimmetrica e ',
        term('tls', 'TLS'),
        ': la ',
        term('pki', 'PKI'),
        ' tiene insieme la fiducia digitale. Qui esplori algoritmi reali e provi gli ',
        term('hash', 'hash'),
        ' nel browser.',
      ].join('');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCards('all');
    initRail();
    initForge();
    initCipherCanvas();
    initReveal();
    initTerms();
    enrichStaticTerms();
  });
})();
