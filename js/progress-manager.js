// Progress Manager — progressi, trofei (primo completamento), statistiche

const PROGRESS_API_URL = window.location.origin + '/api';
const API_TIMEOUT = 8000;
const CACHE_DURATION = 60000;

let achievementsCache = null;
let cacheTimestamp = 0;

let userProgress = {
  totalScans: 0,
  totalActivities: 0,
  unlockedAchievements: [],
  achievementMeta: {},
  completedActivities: [],
  activityLog: [],
  lastUnlockedAchievement: null
};

let isSaving = false;
let saveQueue = false;
let ceremonyQueue = Promise.resolve();
let trophyLoadPromise = null;

function ensureTrophySystem() {
  if (window.TrophySystem) return Promise.resolve();
  if (trophyLoadPromise) return trophyLoadPromise;

  if (!document.querySelector('link[data-evil-trophy-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/trophy-system.css?v=20260603';
    link.dataset.evilTrophyCss = '1';
    document.head.appendChild(link);
  }

  function injectScript(src, flag) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-${flag}]`)) {
        resolve();
        return;
      }
      const el = document.createElement('script');
      el.src = src;
      el.dataset[flag] = '1';
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Script load failed: ${src}`));
      document.head.appendChild(el);
    });
  }

  trophyLoadPromise = injectScript('/js/trophy-audio.js', 'evilTrophyAudio')
    .then(() => injectScript('/js/trophy-system.js', 'evilTrophySystem'))
    .catch((err) => {
      trophyLoadPromise = null;
      throw err;
    });

  return trophyLoadPromise;
}

async function loadUserProgress() {
  if (!isAuthenticated()) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(`${PROGRESS_API_URL}/progress/load`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (validateProgressData(data)) {
        userProgress = normalizeProgressShape(data);
        window.userProgress = userProgress;
        return true;
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Load progress error:', err.message);
    }
  }

  return false;
}

function normalizeProgressShape(data) {
  const base = {
    totalScans: data.totalScans || 0,
    totalActivities: data.totalActivities || 0,
    unlockedAchievements: [],
    achievementMeta: data.achievementMeta || {},
    completedActivities: Array.isArray(data.completedActivities) ? [...data.completedActivities] : [],
    activityLog: Array.isArray(data.activityLog) ? [...data.activityLog] : [],
    lastUnlockedAchievement: data.lastUnlockedAchievement || null
  };

  const raw = data.unlockedAchievements || [];
  raw.forEach((item) => {
    if (typeof item === 'string') {
      base.unlockedAchievements.push(item);
      if (!base.achievementMeta[item]) {
        base.achievementMeta[item] = { unlockedAt: new Date().toISOString() };
      }
    } else if (item && item.id) {
      base.unlockedAchievements.push(item.id);
      base.achievementMeta[item.id] = { unlockedAt: item.unlockedAt || new Date().toISOString() };
    }
  });

  return base;
}

function validateProgressData(data) {
  if (!data || typeof data !== 'object') return false;
  return (
    typeof data.totalScans === 'number' &&
    typeof data.totalActivities === 'number' &&
    Array.isArray(data.unlockedAchievements) &&
    Array.isArray(data.activityLog)
  );
}

async function saveUserProgress() {
  if (!isAuthenticated()) return false;

  if (isSaving) {
    saveQueue = true;
    return false;
  }

  isSaving = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(`${PROGRESS_API_URL}/progress/save`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userProgress),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    if (saveQueue) {
      saveQueue = false;
      isSaving = false;
      return await saveUserProgress();
    }

    return true;
  } catch (err) {
    console.error('Save progress error:', err.message);
    return false;
  } finally {
    isSaving = false;
  }
}

async function loadAchievements() {
  if (achievementsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return { achievements: achievementsCache };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const response = await fetch(`${PROGRESS_API_URL}/achievements`, {
      credentials: 'include',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      achievementsCache = data.achievements || [];
      cacheTimestamp = Date.now();
      return data;
    }
  } catch (err) {
    console.warn('Load achievements error:', err.message);
  }

  return { achievements: achievementsCache || [] };
}

function getUnlockedSet() {
  const ids = window.TrophySystem
    ? TrophySystem.normalizeUnlockedIds(userProgress.unlockedAchievements)
    : userProgress.unlockedAchievements.map((x) => (typeof x === 'string' ? x : x?.id)).filter(Boolean);
  return new Set(ids);
}

function queueCeremony(achievement) {
  if (!achievement) return;
  ceremonyQueue = ceremonyQueue
    .then(() => ensureTrophySystem())
    .then(() => {
      if (window.TrophySystem) return TrophySystem.playCeremony(achievement);
    })
    .catch(() => {});
}

async function unlockAchievementId(achievementId, catalog) {
  const unlocked = getUnlockedSet();
  if (unlocked.has(achievementId)) return false;

  userProgress.unlockedAchievements.push(achievementId);
  userProgress.achievementMeta[achievementId] = { unlockedAt: new Date().toISOString() };
  userProgress.lastUnlockedAchievement = achievementId;

  const achievement = catalog.find((a) => a.id === achievementId);
  if (achievement) queueCeremony(achievement);
  return true;
}

async function checkAchievements(activityName, details = {}) {
  if (!getCurrentUser()) return;

  try {
    await ensureTrophySystem();
  } catch {
    /* ceremony opzionale */
  }

  const data = await loadAchievements();
  const catalog = data.achievements || [];
  const normalized = String(activityName || '').trim();
  const unlocked = getUnlockedSet();
  const toUnlock = [];

  if (normalized && !userProgress.completedActivities.includes(normalized)) {
    userProgress.completedActivities.push(normalized);
    catalog.forEach((ach) => {
      if (ach.unlockType === 'first' && ach.activityKey === normalized && !unlocked.has(ach.id)) {
        toUnlock.push(ach.id);
      }
    });
  }

  catalog.forEach((ach) => {
    if (ach.unlockType === 'milestone' && ach.milestone) {
      const field = ach.milestone.field;
      const val = userProgress[field];
      if (typeof val === 'number' && val >= ach.milestone.value && !unlocked.has(ach.id)) {
        toUnlock.push(ach.id);
      }
    }
  });

  const totalUnlocked = userProgress.unlockedAchievements.length + toUnlock.length;
  catalog.forEach((ach) => {
    if (ach.unlockType === 'meta' && ach.meta?.minUnlocked) {
      if (totalUnlocked >= ach.meta.minUnlocked && !unlocked.has(ach.id) && !toUnlock.includes(ach.id)) {
        toUnlock.push(ach.id);
      }
    }
  });

  for (const id of toUnlock) {
    await unlockAchievementId(id, catalog);
  }
}

async function logActivity(activityName, details = {}) {
  if (!isAuthenticated() || !activityName || typeof activityName !== 'string') {
    return false;
  }

  try {
    const activity = {
      name: activityName.trim(),
      timestamp: new Date().toISOString(),
      ...details
    };

    if (userProgress.activityLog.length >= 1000) {
      userProgress.activityLog = userProgress.activityLog.slice(-999);
    }

    userProgress.activityLog.push(activity);
    userProgress.totalActivities++;

    await checkAchievements(activityName, details);
    await saveUserProgress();
    return true;
  } catch (err) {
    console.error('Log activity error:', err);
    return false;
  }
}

async function incrementScans(details = {}) {
  if (!isAuthenticated()) return false;

  userProgress.totalScans++;

  const activity = {
    name: 'scan',
    timestamp: new Date().toISOString(),
    ...details
  };

  if (userProgress.activityLog.length >= 1000) {
    userProgress.activityLog = userProgress.activityLog.slice(-999);
  }

  userProgress.activityLog.push(activity);
  userProgress.totalActivities++;

  await checkAchievements('scan', details);
  return await saveUserProgress();
}

async function showAchievementNotification(achievementId) {
  const data = await loadAchievements();
  const achievement = (data.achievements || []).find((a) => a.id === achievementId);
  if (achievement) queueCeremony(achievement);
}

function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function getUnlockedAchievements() {
  return window.TrophySystem
    ? TrophySystem.normalizeUnlockedIds(userProgress.unlockedAchievements)
    : [...userProgress.unlockedAchievements];
}

function getProgressStats() {
  const ids = getUnlockedAchievements();
  return {
    totalScans: userProgress.totalScans,
    totalActivities: userProgress.totalActivities,
    achievementsUnlocked: ids.length,
    activityLogCount: userProgress.activityLog.length,
    lastUnlocked: userProgress.lastUnlockedAchievement
  };
}

const ACTIVITY_LABELS = {
  scan: 'Scansione di sicurezza completata',
  malware_identified: 'Malware identificato nel quiz',
  phishing_quiz_completed: 'Quiz anti-phishing completato',
  social_engineering_completed: 'Simulazione social engineering completata',
  dns_enumeration: 'Enumerazione DNS eseguita',
  vulnerability_found: 'Vulnerabilità rilevata',
  ssl_analysis: 'Certificato SSL analizzato',
  osint_collection: 'Raccolta OSINT completata',
  crypto_study_completed: 'Studio Cifratura completato',
  lab_completed: 'Laboratorio virtuale completato',
  attacks_map_viewed: 'Mappa incidenti consultata',
  report_generated: 'Report di sicurezza generato',
  incident_timeline_completed: 'Timeline Incident Response completata',
  quiz_hub_milestone: 'Traguardo Centro Quiz raggiunto'
};

function getActivityLabel(name) {
  return ACTIVITY_LABELS[name] || name;
}

async function initProgressManager() {
  if (typeof isAuthenticated !== 'function' || !isAuthenticated()) return;

  try {
    await loadUserProgress();
    if (window.TrophySystem) await TrophySystem.loadCatalog();
    window.userProgress = userProgress;
  } catch (err) {
    console.error('PM init error:', err);
  }
}

document.addEventListener('DOMContentLoaded', initProgressManager);

window.logActivity = (...args) => window.progressManager?.logActivity?.(...args);

window.progressManager = {
  loadUserProgress,
  saveUserProgress,
  logActivity,
  incrementScans,
  checkAchievements,
  showAchievementNotification,
  getUnlockedAchievements,
  getProgressStats,
  loadAchievements,
  getActivityLabel,
  userProgress: () => userProgress
};
