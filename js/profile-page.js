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

  function goToLogin() {
    window.location.replace('/login.html?redirect=profile.html');
  }

  /**
   * Dati completi dell'account dal server (data di iscrizione, verifica email, sessioni).
   * Prima la pagina usava la copia in localStorage, che ha solo id, nome ed email:
   * un account verificato risultava "In attesa" e la data di iscrizione "—".
   */
  async function loadProfile() {
    if (window.__evilAuthReady) await window.__evilAuthReady;
    try {
      const res = await fetch(`${API_URL}/auth/profile`, { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        goToLogin();
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      return data.user || null;
    } catch {
      // server non raggiungibile: si mostra quel che c'è in cache
      const cached = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!cached) goToLogin();
      return cached;
    }
  }

  function initialsOf(name) {
    if (typeof window.getInitials === 'function') return window.getInitials(name);
    return String(name || 'U').trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).join('').slice(0, 3) || 'U';
  }

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
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
    const initials = initialsOf(name);

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
      userVerifiedDetail: user?.emailVerified === undefined ? '—' : user.emailVerified ? 'Verificata ✓' : 'Da verificare',
      userSessionsDetail: Number.isFinite(user?.activeSessions)
        ? `${user.activeSessions} ${user.activeSessions === 1 ? 'dispositivo' : 'dispositivi'}`
        : '—'
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
          <p>Non riusciamo a caricare i trofei in questo momento. Ricarica la pagina tra poco.</p>
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
        <span>${escapeHtml(typeof getActivityLabel === 'function' ? getActivityLabel(item.name) : item.name)}</span>
      </div>
    `).join('');
  }

  function bindTabs() {
    const tabs = [...document.querySelectorAll('.profile-trophy-tab[role="tab"]')];
    const panel = document.getElementById('achievementsGrid');
    function select(tab, focus) {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (panel) panel.setAttribute('aria-labelledby', tab.id);
      if (focus) tab.focus();
      trophyFilter = tab.dataset.filter || 'all';
      renderTrophies();
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      // frecce sinistra/destra come nei tab nativi
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        select(next, true);
      });
    });
  }

  function bindLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof logout === 'function') logout();
      else window.location.replace('/login.html');
    });
  }

  async function init() {
    const user = await loadProfile();
    if (!user) return;

    if (typeof loadUserProgress === 'function') await loadUserProgress();

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
