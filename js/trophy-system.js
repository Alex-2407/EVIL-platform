/**
 * EVIL Trophy System — arte SVG, cerimonia sblocco, vetrina profilo
 */
(function (global) {
  const RARITY_COLORS = {
    bronze: { ring: '#cd7f32', glow: 'rgba(205, 127, 50, 0.45)', label: 'Bronzo' },
    silver: { ring: '#94a3b8', glow: 'rgba(148, 163, 184, 0.5)', label: 'Argento' },
    gold: { ring: '#f59e0b', glow: 'rgba(245, 158, 11, 0.55)', label: 'Oro' },
    legendary: { ring: '#a78bfa', glow: 'rgba(167, 139, 250, 0.6)', label: 'Leggendario' }
  };

  const VISUAL_SVG = {
    radar: `<svg viewBox="0 0 64 64" class="trophy-svg" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2" opacity="0.35"/><circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><path d="M32 32 L32 8 A24 24 0 0 1 52 20 Z" fill="currentColor" opacity="0.85" class="trophy-svg__sweep"/><circle cx="32" cy="32" r="4" fill="#f59e0b"/></svg>`,
    biohazard: `<svg viewBox="0 0 64 64" class="trophy-svg"><circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="14" r="8" fill="currentColor"/><circle cx="18" cy="42" r="8" fill="currentColor"/><circle cx="46" cy="42" r="8" fill="currentColor"/><circle cx="32" cy="32" r="6" fill="#06080e"/></svg>`,
    hook: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M20 48 C20 28 44 28 44 18 C44 10 36 6 32 6 C28 6 20 10 20 18" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="52" r="6" fill="#f59e0b"/></svg>`,
    mask: `<svg viewBox="0 0 64 64" class="trophy-svg"><ellipse cx="32" cy="34" rx="22" ry="18" fill="currentColor" opacity="0.9"/><ellipse cx="24" cy="32" rx="5" ry="7" fill="#06080e"/><ellipse cx="40" cy="32" rx="5" ry="7" fill="#06080e"/><path d="M26 44 Q32 48 38 44" fill="none" stroke="#06080e" stroke-width="2"/></svg>`,
    globe: `<svg viewBox="0 0 64 64" class="trophy-svg"><circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="32" cy="32" rx="12" ry="26" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 32 H58" stroke="currentColor" stroke-width="1.5"/><path d="M10 20 H54 M10 44 H54" stroke="currentColor" stroke-width="1" opacity="0.6"/></svg>`,
    crack: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M32 6 L38 28 L58 32 L38 36 L32 58 L26 36 L6 32 L26 28 Z" fill="currentColor" opacity="0.25"/><path d="M32 14 L34 30 L48 32 L34 34 L32 50 L30 34 L16 32 L30 30 Z" fill="currentColor"/></svg>`,
    lock: `<svg viewBox="0 0 64 64" class="trophy-svg"><rect x="18" y="28" width="28" height="26" rx="4" fill="currentColor"/><path d="M22 28 V20 C22 12 28 8 32 8 C36 8 42 12 42 20 V28" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="40" r="4" fill="#f59e0b"/></svg>`,
    eye: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M6 32 C14 16 50 16 58 32 C50 48 14 48 6 32 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="32" cy="32" r="10" fill="currentColor"/><circle cx="32" cy="32" r="4" fill="#7dd3fc"/></svg>`,
    cipher: `<svg viewBox="0 0 64 64" class="trophy-svg"><rect x="12" y="20" width="40" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><text x="32" y="42" text-anchor="middle" font-size="14" font-family="monospace" fill="currentColor">#</text><path d="M20 12 H44" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/></svg>`,
    flask: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M26 8 H38 V22 L48 48 C50 54 44 58 32 58 C20 58 14 54 16 48 L26 22 Z" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M22 46 H42" stroke="#34d399" stroke-width="3" opacity="0.8" class="trophy-svg__bubble"/></svg>`,
    map: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M8 20 L24 14 L40 22 L56 16 V48 L40 40 L24 48 L8 42 Z" fill="currentColor" opacity="0.35" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="30" r="4" fill="#f59e0b" class="trophy-svg__pulse-dot"/></svg>`,
    scroll: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M16 14 C16 10 48 10 48 14 V50 C48 54 16 54 16 50 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M22 22 H42 M22 30 H38 M22 38 H42" stroke="currentColor" stroke-width="2" opacity="0.7"/></svg>`,
    clock: `<svg viewBox="0 0 64 64" class="trophy-svg"><circle cx="32" cy="34" r="22" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M32 34 V20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M32 34 L42 40" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/><path d="M28 8 H36 V14 H28 Z" fill="currentColor"/></svg>`,
    brain: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M32 10 C20 10 12 22 14 34 C10 38 12 48 22 50 C24 56 40 56 42 50 C52 48 54 38 50 34 C52 22 44 10 32 10 Z" fill="currentColor" opacity="0.85"/><path d="M32 18 V46" stroke="#06080e" stroke-width="2" opacity="0.4"/></svg>`,
    crown: `<svg viewBox="0 0 64 64" class="trophy-svg"><path d="M10 44 H54 L48 22 L38 34 L32 18 L26 34 L16 22 Z" fill="currentColor"/><rect x="12" y="44" width="40" height="8" rx="2" fill="#f59e0b"/></svg>`
  };

  let catalogCache = null;
  let catalogTs = 0;

  function escapeHtml(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function normalizeUnlockedIds(list) {
    if (!Array.isArray(list)) return [];
    return list.map((item) => (typeof item === 'string' ? item : item?.id)).filter(Boolean);
  }

  async function loadCatalog() {
    if (catalogCache && catalogCache.length && Date.now() - catalogTs < 60000) return catalogCache;

    const sources = [
      '/html/achievements.json',
      '/achievements.json',
      '/api/achievements'
    ];

    for (const url of sources) {
      try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) continue;
        const data = await res.json();
        const list = data.achievements || data;
        if (Array.isArray(list) && list.length) {
          catalogCache = list;
          catalogTs = Date.now();
          return catalogCache;
        }
      } catch {
        /* prova URL successivo */
      }
    }

    console.warn('[Trophy] catalog load failed — verifica che il server sia avviato');
    return catalogCache || [];
  }

  function getById(id) {
    return (catalogCache || []).find((a) => a.id === id) || null;
  }

  function renderTrophyArt(achievement, { size = 'md', locked = false } = {}) {
    const visual = achievement?.visual || 'radar';
    const rarity = achievement?.rarity || 'bronze';
    const colors = RARITY_COLORS[rarity] || RARITY_COLORS.bronze;
    const svg = VISUAL_SVG[visual] || VISUAL_SVG.radar;
    return `
      <div class="trophy-art trophy-art--${size} ${locked ? 'trophy-art--locked' : ''}" style="--trophy-ring:${colors.ring};--trophy-glow:${colors.glow}">
        <div class="trophy-art__ring"></div>
        <div class="trophy-art__icon">${svg}</div>
        ${locked ? '<span class="trophy-art__lock" aria-hidden="true">🔒</span>' : ''}
      </div>`;
  }

  function renderTrophyCard(achievement, unlocked, unlockedAt) {
    const rarity = RARITY_COLORS[achievement.rarity] || RARITY_COLORS.bronze;
    return `
      <article class="trophy-card ${unlocked ? 'trophy-card--unlocked' : 'trophy-card--locked'}" data-id="${escapeHtml(achievement.id)}">
        ${renderTrophyArt(achievement, { locked: !unlocked })}
        <div class="trophy-card__body">
          <span class="trophy-card__rarity" style="color:${rarity.ring}">${rarity.label}</span>
          <h3 class="trophy-card__name">${escapeHtml(achievement.name)}</h3>
          <p class="trophy-card__tagline">${escapeHtml(achievement.tagline || '')}</p>
          <p class="trophy-card__desc">${escapeHtml(achievement.description)}</p>
          ${unlocked && unlockedAt ? `<time class="trophy-card__date">${new Date(unlockedAt).toLocaleDateString('it-IT')}</time>` : '<span class="trophy-card__locked-label">Non sbloccato</span>'}
        </div>
      </article>`;
  }

  function ensureCeremonyRoot() {
    let root = document.getElementById('evil-trophy-ceremony');
    if (!root) {
      root = document.createElement('div');
      root.id = 'evil-trophy-ceremony';
      root.className = 'evil-trophy-ceremony';
      root.setAttribute('aria-hidden', 'true');
      document.body.appendChild(root);
    }
    return root;
  }

  const CEREMONY_KICKERS = {
    bronze: 'Trofeo sbloccato',
    silver: '◆ Traguardo d\'argento ◆',
    gold: '★ Traguardo d\'oro ★',
    supreme: '♛ COLLEZIONISTA SUPREMO — LEGGENDARIO ♛'
  };

  function playCeremony(achievement) {
    return new Promise((resolve) => {
      if (global.TrophyAudio) {
        global.TrophyAudio.prime?.();
        global.TrophyAudio.playForAchievement(achievement);
      }

      const root = ensureCeremonyRoot();
      const isSupreme = achievement.id === 'master_collector';
      const rarityKey = isSupreme ? 'legendary' : (achievement.rarity || 'bronze');
      const rarity = RARITY_COLORS[rarityKey] || RARITY_COLORS.bronze;
      const panelClass = [
        'evil-trophy-ceremony__panel',
        isSupreme ? 'evil-trophy-ceremony__panel--supreme' : `evil-trophy-ceremony__panel--rarity-${rarityKey}`
      ].filter(Boolean).join(' ');
      const kicker = isSupreme
        ? CEREMONY_KICKERS.supreme
        : (CEREMONY_KICKERS[rarityKey] || CEREMONY_KICKERS.bronze);
      const durationMs = global.TrophyAudio?.getCeremonyDurationMs?.(achievement) ?? (isSupreme ? 16200 : 6500);

      root.innerHTML = `
        <div class="evil-trophy-ceremony__backdrop"></div>
        <div class="${panelClass}" role="dialog" aria-labelledby="trophy-ceremony-title">
          <div class="evil-trophy-ceremony__burst"></div>
          <p class="evil-trophy-ceremony__kicker">${kicker}</p>
          <div class="evil-trophy-ceremony__art">${renderTrophyArt(achievement, { size: 'xl' })}</div>
          <h2 id="trophy-ceremony-title" class="evil-trophy-ceremony__title">${escapeHtml(achievement.name)}</h2>
          <p class="evil-trophy-ceremony__tagline">${escapeHtml(achievement.tagline || '')}</p>
          <p class="evil-trophy-ceremony__desc">${escapeHtml(achievement.description)}</p>
          <span class="evil-trophy-ceremony__rarity" style="--rarity-color:${rarity.ring}">${rarity.label}</span>
          <button type="button" class="evil-trophy-ceremony__close auth-submit">Continua</button>
        </div>
        <canvas class="evil-trophy-ceremony__particles" aria-hidden="true"></canvas>
      `;
      root.classList.add('is-active');
      root.setAttribute('aria-hidden', 'false');
      const particleCount = isSupreme ? 88 : achievement.rarity === 'gold' ? 40 : 32;
      spawnParticles(
        root.querySelector('.evil-trophy-ceremony__particles'),
        rarity.ring,
        particleCount,
        isSupreme ? 280 : 120
      );

      const close = () => {
        root.classList.remove('is-active');
        root.setAttribute('aria-hidden', 'true');
        setTimeout(() => { root.innerHTML = ''; resolve(); }, 500);
      };
      root.querySelector('.evil-trophy-ceremony__close')?.addEventListener('click', close);
      root.querySelector('.evil-trophy-ceremony__backdrop')?.addEventListener('click', close);
      setTimeout(close, durationMs);
    });
  }

  function spawnParticles(canvas, color, count = 48, maxFrames = 120) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;
    const parts = Array.from({ length: count }, () => ({
      x: w / 2, y: h / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 2,
      life: 1,
      size: 2 + Math.random() * 4
    }));
    let frame = 0;
    function tick() {
      ctx.clearRect(0, 0, w, h);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.012;
        if (p.life <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      frame++;
      if (frame < maxFrames) requestAnimationFrame(tick);
    }
    tick();
  }

  const TrophySystem = {
    loadCatalog,
    getById,
    normalizeUnlockedIds,
    renderTrophyArt,
    renderTrophyCard,
    playCeremony,
    RARITY_COLORS,
    VISUAL_SVG
  };

  global.TrophySystem = TrophySystem;
})(typeof window !== 'undefined' ? window : global);
