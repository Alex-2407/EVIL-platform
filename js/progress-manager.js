// Progress Manager - Gestisce progressi, trofei e statistiche utente
// Versione ottimizzata con caching e error handling robusto

const PROGRESS_API_URL = 'http://localhost:5000/api';
const API_TIMEOUT = 8000; // 8 secondi timeout
const CACHE_DURATION = 60000; // 1 minuto cache

// Cache per achievements
let achievementsCache = null;
let cacheTimestamp = 0;

// Struttura dati per i trofei con valori di default
let userProgress = {
  totalScans: 0,
  totalActivities: 0,
  unlockedAchievements: [],
  activityLog: [],
  lastUnlockedAchievement: null
};

// Flag per evitare race conditions
let isSaving = false;
let saveQueue = false;

/**
 * Carica i progressi dal server con timeout
 * Tokens are sent via httpOnly cookies - no need for auth header
 */
async function loadUserProgress() {
  if (!isAuthenticated()) return false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(`${PROGRESS_API_URL}/progress/load`, {
      method: 'GET',
      credentials: 'include', // Invia i cookie httpOnly automaticamente
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      
      // Validazione dati
      if (validateProgressData(data)) {
        userProgress = data;
        return true;
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn('Progress load timeout');
    } else {
      console.warn('Load progress error:', err.message);
    }
  }
  
  return false;
}

/**
 * Valida la struttura dei dati di progresso
 */
function validateProgressData(data) {
  if (!data || typeof data !== 'object') return false;
  
  return (
    typeof data.totalScans === 'number' &&
    typeof data.totalActivities === 'number' &&
    Array.isArray(data.unlockedAchievements) &&
    Array.isArray(data.activityLog)
  );
}

/**
 * Salva i progressi sul server con debouncing
 * Tokens are sent via httpOnly cookies - no need for auth header
 */
async function saveUserProgress() {
  if (!isAuthenticated()) return false;
  
  // Se già in salvataggio, segna coda per salvare dopo
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
      credentials: 'include', // Invia i cookie httpOnly automaticamente
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userProgress),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('Save failed:', response.status);
      return false;
    }
    
    // Se c'è una coda di salvataggio, salva di nuovo
    if (saveQueue) {
      saveQueue = false;
      isSaving = false;
      return await saveUserProgress();
    }
    
    return true;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Save timeout');
    } else {
      console.error('Save error:', err.message);
    }
    return false;
  } finally {
    isSaving = false;
  }
}

/**
 * Registra un'attività con validazione
 */
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
    
    // Limita il log a 1000 entries per evitare memoria eccessiva
    if (userProgress.activityLog.length >= 1000) {
      userProgress.activityLog = userProgress.activityLog.slice(-999);
    }
    
    userProgress.activityLog.push(activity);
    userProgress.totalActivities++;
    
    // Controlla se sblocca trofei
    await checkAchievements(activityName, details);
    await saveUserProgress();
    
    return true;
  } catch (err) {
    console.error('Log activity error:', err);
    return false;
  }
}

/**
 * Incrementa il contatore di scansioni
 */
async function incrementScans() {
  if (!isAuthenticated()) return false;
  
  userProgress.totalScans++;
  return await logActivity('scan', { scanType: 'generic' });
}

/**
 * Verifica se un trofeo è stato sbloccato con logica robusta
 */
async function checkAchievements(activityName, details = {}) {
  if (!getCurrentUser()) return;
  
  const achievementsToUnlock = [];
  
  // Normalizza il nome attività
  const normalized = String(activityName || '').toLowerCase().trim();
  
  // Logica per sblocco trofei
  switch(normalized) {
    case 'scan':
      if (userProgress.totalScans === 1) achievementsToUnlock.push('first_scan');
      if (userProgress.totalScans === 10) achievementsToUnlock.push('ten_scans');
      if (userProgress.totalScans === 50) achievementsToUnlock.push('fifty_scans');
      break;
      
    case 'malware_identified':
      if (details.count >= 5) achievementsToUnlock.push('malware_expert');
      if (details.count >= 15) achievementsToUnlock.push('malware_master');
      break;
      
    case 'phishing_quiz_completed':
      if (details.accuracy === 100) achievementsToUnlock.push('phishing_defender');
      break;
      
    case 'social_engineering_completed':
      achievementsToUnlock.push('social_engineer');
      break;
      
    case 'dns_enumeration':
      if (details.count >= 10) achievementsToUnlock.push('dns_master');
      break;
      
    case 'vulnerability_found':
      if (details.count >= 5) achievementsToUnlock.push('vuln_finder');
      if (details.count >= 20) achievementsToUnlock.push('vuln_master');
      break;
      
    case 'ssl_analysis':
      if (details.count >= 5) achievementsToUnlock.push('ssl_analyst');
      break;
      
    case 'osint_collection':
      if (details.count >= 3) achievementsToUnlock.push('osint_pro');
      break;
      
    case 'ethical_hacking_completed':
      achievementsToUnlock.push('ethical_hacker');
      break;
      
    case 'lab_completed':
      achievementsToUnlock.push('lab_master');
      break;
  }
  
  // Sblocca i trofei
  for (const achievementId of achievementsToUnlock) {
    if (!userProgress.unlockedAchievements.includes(achievementId)) {
      userProgress.unlockedAchievements.push(achievementId);
      userProgress.lastUnlockedAchievement = achievementId;
      showAchievementNotification(achievementId);
    }
  }
  
  // Controlla collezionista supremo (10 trofei)
  if (userProgress.unlockedAchievements.length >= 10 && 
      !userProgress.unlockedAchievements.includes('master_collector')) {
    userProgress.unlockedAchievements.push('master_collector');
    showAchievementNotification('master_collector');
  }
}

/**
 * Carica achievements con caching
 */
async function loadAchievements() {
  // Controlla cache
  if (achievementsCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return achievementsCache;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    const response = await fetch(`${PROGRESS_API_URL}/achievements`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      achievementsCache = data;
      cacheTimestamp = Date.now();
      return data;
    }
  } catch (err) {
    console.warn('Load achievements error:', err.message);
  }
  
  return null;
}

/**
 * Mostra l'animazione Xbox-style del trofeo sbloccato
 */
async function showAchievementNotification(achievementId) {
  try {
    const data = await loadAchievements();
    if (!data || !data.achievements) return;
    
    const achievement = data.achievements.find(a => a.id === achievementId);
    if (!achievement) return;
    
    const notification = document.createElement('div');
    notification.className = 'achievement-unlock-notification';
    notification.innerHTML = `
      <div class="achievement-popup">
        <div class="achievement-header">
          <div class="evil-logo-text">EVIL</div>
        </div>
        <div class="achievement-content">
          <div class="achievement-icon">${achievement.icon}</div>
          <div class="achievement-info">
            <div class="achievement-title">${escapeHtml(achievement.name)}</div>
            <div class="achievement-description">${escapeHtml(achievement.description)}</div>
          </div>
        </div>
        <div class="achievement-unlock-label">TROFEO SBLOCCATO</div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  } catch (err) {
    console.error('Notification error:', err);
  }
}

/**
 * Sanitizza HTML per XSS prevention
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  const map = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Ottieni trofei sbloccati
 */
function getUnlockedAchievements() {
  return [...userProgress.unlockedAchievements];
}

/**
 * Ottieni statistiche con copia per evitare mutazioni
 */
function getProgressStats() {
  return {
    totalScans: userProgress.totalScans,
    totalActivities: userProgress.totalActivities,
    achievementsUnlocked: userProgress.unlockedAchievements.length,
    activityLogCount: userProgress.activityLog.length,
    lastUnlocked: userProgress.lastUnlockedAchievement
  };
}

/**
 * Inizializza il progress manager
 */
async function initProgressManager() {
  if (!isAuthenticated()) return;
  
  try {
    await loadUserProgress();
    updateProgressUI();
  } catch (err) {
    console.error('PM init error:', err);
  }
}

document.addEventListener('DOMContentLoaded', initProgressManager);

/**
 * Aggiorna l'interfaccia con i progressi
 */
function updateProgressUI() {
  const stats = getProgressStats();
  const progressDisplay = document.getElementById('progress-display');
  
  if (!progressDisplay) return;
  
  progressDisplay.innerHTML = `
    <div class="progress-stats">
      <div class="stat-item">
        <span class="stat-label">Scansioni:</span>
        <span class="stat-value">${stats.totalScans}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Attività:</span>
        <span class="stat-value">${stats.totalActivities}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Trofei:</span>
        <span class="stat-value">${stats.achievementsUnlocked}</span>
      </div>
    </div>
  `;
}

// API globale
window.progressManager = {
  loadUserProgress,
  saveUserProgress,
  logActivity,
  incrementScans,
  checkAchievements,
  showAchievementNotification,
  getUnlockedAchievements,
  getProgressStats,
  updateProgressUI,
  loadAchievements
};
