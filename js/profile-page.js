/**
 * Profilo operatore EVIL — caricamento dati, UI animata, azioni
 */
(function () {
  const API_URL = '/api';

  const QUOTES = [
    'Ogni scan è un pixel in più sulla tua <strong>visione tattica</strong>.',
    'Non collezioni trofei: collezioni <strong>competenze</strong>.',
    'Il threat non dorme. <strong>Nemmeno tu</strong> — un lab alla volta.',
    'Da analista a operatore: la differenza è <strong>pratica ripetuta</strong>.',
    'La curiosità è il primo firewall. <strong>EVIL</strong> è il secondo.'
  ];

  const RANKS = [
    { min: 0, title: 'Recluta digitale', icon: '◇' },
    { min: 1, title: 'Analista in addestramento', icon: '◆' },
    { min: 3, title: 'Operatore tattico', icon: '▣' },
    { min: 6, title: 'Specialista threat', icon: '◈' },
    { min: 10, title: 'Veterano EVIL', icon: '★' },
    { min: 14, title: 'Leggenda della piattaforma', icon: '✦' }
  ];

  let quoteIndex = 0;
  let quoteTimer = null;
  let trophyFilter = 'all';
  let catalogCache = [];

  function getProgress() {
    return window.userProgress || window.progressManager?.userProgress?.() || {
      totalScans: 0,
      totalActivities: 0,
      unlockedAchievements: [],
      achievementMeta: {},
      completedActivities: [],
      activityLog: []
    };
  }

  function getRank(trophyCount) {
    let rank = RANKS[0];
    for (const r of RANKS) {
      if (trophyCount >= r.min) rank = r;
    }
    return rank;
  }

  async function ensureSession() {
    if (typeof isAuthenticated !== 'function' || !isAuthenticated()) {
      window.location.href = 'login.html?redirect=profile.html';
      return false;
    }
    try {
      const res = await fetch(`${API_URL}/auth/profile`, { credentials: 'include' });
      if (!res.ok) {
        window.location.href = 'login.html?redirect=profile.html';
        return false;
      }
      const data = await res.json();
      if (data.user && window.AUTH_STORAGE) AUTH_STORAGE.setUser(data.user);
      return data.user || null;
    } catch {
      window.location.href = 'login.html?redirect=profile.html';
      return false;
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return '—';
    }
  }

  function animateCounter(el, target) {
    if (!el) return;
    const end = Number(target) || 0;
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(end * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function startQuoteRotation() {
    const el = document.getElementById('profileQuote');
    if (!el) return;

    function showNext() {
      el.classList.add('is-fading');
      setTimeout(() => {
        quoteIndex = (quoteIndex + 1) % QUOTES.length;
        el.innerHTML = QUOTES[quoteIndex];
        el.classList.remove('is-fading');
      }, 400);
    }

    quoteTimer = setInterval(showNext, 5200);
  }

  function updateBanner(user, stats) {
    const name = user?.name || 'Operatore';
    const initials = typeof getInitials === 'function' ? getInitials(name) : name.slice(0, 2).toUpperCase();

    const titleEl = document.getElementById('profileDisplayName');
    const emailEl = document.getElementById('profileDisplayEmail');
    const avatarEl = document.getElementById('profileAvatarInitials');
    const rankEl = document.getElementById('profileRankBadge');

    if (titleEl) titleEl.textContent = name;
    if (emailEl) emailEl.textContent = user?.email || '—';
    if (avatarEl) avatarEl.textContent = initials;

    const rank = getRank(stats.achievementsUnlocked);
    if (rankEl) {
      rankEl.innerHTML = `<span aria-hidden="true">${rank.icon}</span> ${rank.title}`;
    }

    const catalogLen = catalogCache.length || 16;
    const pct = Math.min(100, Math.round((stats.achievementsUnlocked / catalogLen) * 100));
    const fill = document.getElementById('profileGoalFill');
    const label = document.getElementById('profileGoalLabel');
    if (fill) fill.style.width = `${pct}%`;
    if (label) {
      label.textContent = `${stats.achievementsUnlocked} / ${catalogLen} trofei nella vetrina`;
    }

    animateCounter(document.getElementById('totalScans'), stats.totalScans);
    animateCounter(document.getElementById('totalActivities'), stats.totalActivities);
    animateCounter(document.getElementById('totalAchievements'), stats.achievementsUnlocked);
  }

  function updateDetails(user) {
    const map = {
      userNameDetail: user?.name,
      userEmailDetail: user?.email,
      userCreatedDetail: formatDate(user?.createdAt),
      userVerifiedDetail: user?.emailVerified ? 'Verificata ✓' : 'In attesa'
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '—';
    });
  }

  async function renderTrophies() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;

    try {
      await (window.TrophySystem ? TrophySystem.loadCatalog() : Promise.resolve([]));
      catalogCache = window.TrophySystem ? await TrophySystem.loadCatalog() : [];
    } catch {
      catalogCache = [];
    }

    if (!catalogCache.length) {
      grid.innerHTML = `
        <div class="profile-trophies__empty">
          <p>Catalogo trofei non disponibile. Avvia il server e ricarica.</p>
          <a href="security-check.html" class="auth-submit auth-submit--link" style="display:inline-block;margin-top:16px;">Inizia con Check URL</a>
        </div>`;
      return;
    }

    const progress = getProgress();
    const unlocked = new Set(
      typeof getUnlockedAchievements === 'function'
        ? getUnlockedAchievements()
        : TrophySystem.normalizeUnlockedIds(progress.unlockedAchievements)
    );
    const meta = progress.achievementMeta || {};

    const filtered = catalogCache.filter((ach) => {
      const isUnlocked = unlocked.has(ach.id);
      if (trophyFilter === 'unlocked') return isUnlocked;
      if (trophyFilter === 'locked') return !isUnlocked;
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = `<div class="profile-trophies__empty">Nessun trofeo in questa categoria. Cambia filtro o completa un'attività.</div>`;
      return;
    }

    grid.innerHTML = filtered
      .map((ach) => {
        const isUnlocked = unlocked.has(ach.id);
        return TrophySystem.renderTrophyCard(ach, isUnlocked, meta[ach.id]?.unlockedAt);
      })
      .join('');
  }

  function renderActivityLog() {
    const list = document.getElementById('activityList');
    if (!list) return;

    const log = getProgress().activityLog || [];

    if (!log.length) {
      list.innerHTML = `
        <div class="activity-feed__item profile-reveal">
          <span class="activity-feed__time">Ora</span>
          <span>Nessuna attività ancora — <a href="virtual-lab.html" style="color:#7dd3fc">apri il Lab</a> o <a href="security-check.html" style="color:#7dd3fc">lancia uno scan</a> per il primo trofeo.</span>
        </div>`;
      return;
    }

    list.innerHTML = [...log].reverse().slice(0, 12).map((item, i) => `
      <div class="activity-feed__item" style="animation: profileReveal 0.5s ease ${i * 0.05}s forwards; opacity:0">
        <time class="activity-feed__time">${new Date(item.timestamp).toLocaleString('it-IT')}</time>
        <span>${typeof getActivityLabel === 'function' ? getActivityLabel(item.name) : item.name}</span>
      </div>
    `).join('');
  }

  function bindTabs() {
    document.querySelectorAll('.profile-trophy-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.profile-trophy-tab').forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        trophyFilter = tab.dataset.filter || 'all';
        renderTrophies();
      });
    });
  }

  function bindLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof logout === 'function') logout();
      else window.location.replace('login.html');
    });
  }

  async function init() {
    const user = await ensureSession();
    if (!user) return;

    if (typeof loadUserProgress === 'function') await loadUserProgress();
    if (typeof initAuthHeader === 'function') initAuthHeader();

    const stats = typeof getProgressStats === 'function'
      ? getProgressStats()
      : { totalScans: 0, totalActivities: 0, achievementsUnlocked: 0 };

    const quoteEl = document.getElementById('profileQuote');
    if (quoteEl) quoteEl.innerHTML = QUOTES[0];

    updateBanner(user, stats);
    updateDetails(user);
    bindTabs();
    bindLogout();
    startQuoteRotation();
    await renderTrophies();
    renderActivityLog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
