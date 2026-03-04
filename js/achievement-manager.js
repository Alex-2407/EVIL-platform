/**
 * Achievement Manager
 * Gestisce il caricamento, visualizzazione e tracking degli achievements
 */
class AchievementManager {
  constructor() {
    this.achievements = [];
    this.userAchievements = [];
    this.isLoaded = false;
  }

  /**
   * Carica la lista degli achievements dal backend
   */
  async loadAchievements() {
    try {
      const response = await fetch('/api/achievements');
      if (!response.ok) throw new Error(`Failed to load achievements: ${response.status}`);
      
      this.achievements = await response.json();
      this.isLoaded = true;
      console.log(`[Achievements] ✓ Loaded ${this.achievements.length} achievements`);
      return this.achievements;
    } catch (error) {
      console.error('[Achievements] ✗ Error loading:', error);
      return [];
    }
  }

  /**
   * Carica gli achievements sbloccati dell'utente
   */
  async loadUserAchievements() {
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        console.log('[Achievements] User not authenticated');
        return [];
      }

      const response = await fetch('/api/auth/profile', { headers });
      if (!response.ok) throw new Error(`Failed to load user profile: ${response.status}`);
      
      const user = await response.json();
      this.userAchievements = user.progress?.unlockedAchievements || [];
      console.log(`[Achievements] ✓ User has ${this.userAchievements.length} achievements`);
      return this.userAchievements;
    } catch (error) {
      console.error('[Achievements] ✗ Error loading user achievements:', error);
      return [];
    }
  }

  /**
   * Ottiene gli achievement object dell'utente
   */
  getUserAchievementObjects() {
    return this.achievements.filter(achievement => 
      this.userAchievements.some(ua => ua.id === achievement.id)
    );
  }

  /**
   * Ottiene gli achievement locked
   */
  getLockedAchievements() {
    return this.achievements.filter(achievement => 
      !this.userAchievements.some(ua => ua.id === achievement.id)
    );
  }

  /**
   * Visualizza un achievement popup
   */
  showAchievementPopup(achievement) {
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `
      <div class="achievement-content">
        <div class="achievement-icon">${achievement.icon || '⭐'}</div>
        <div class="achievement-info">
          <div class="achievement-title">${achievement.name}</div>
          <div class="achievement-description">${achievement.description}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(popup);
    
    // Auto-remove dopo 5 secondi
    setTimeout(() => {
      popup.remove();
    }, 5000);
  }

  /**
   * Renderizza la lista degli achievements in un elemento
   */
  renderAchievements(containerId, filter = 'all') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let achievementsToRender = [];
    
    if (filter === 'unlocked') {
      achievementsToRender = this.getUserAchievementObjects();
    } else if (filter === 'locked') {
      achievementsToRender = this.getLockedAchievements();
    } else {
      achievementsToRender = this.achievements;
    }

    container.innerHTML = achievementsToRender.map(achievement => `
      <div class="achievement-card ${this.isUnlocked(achievement.id) ? 'unlocked' : 'locked'}">
        <div class="achievement-badge">${achievement.icon || '⭐'}</div>
        <div class="achievement-name">${achievement.name}</div>
        <div class="achievement-desc">${achievement.description}</div>
        ${this.isUnlocked(achievement.id) ? `
          <div class="achievement-date">
            Sbloccato: ${this.getUnlockDate(achievement.id)}
          </div>
        ` : '<div class="achievement-locked">🔒 Non Sbloccato</div>'}
      </div>
    `).join('');

    // Stili per gli achievement card
    this.injectStyles();
  }

  /**
   * Verifica se un achievement è sbloccato
   */
  isUnlocked(achievementId) {
    return this.userAchievements.some(ua => ua.id === achievementId);
  }

  /**
   * Ottiene la data di sblocco
   */
  getUnlockDate(achievementId) {
    const ua = this.userAchievements.find(a => a.id === achievementId);
    return ua ? new Date(ua.unlockedAt).toLocaleDateString('it-IT') : 'N/A';
  }

  /**
   * Inietta gli stili CSS per gli achievement card
   */
  injectStyles() {
    if (document.getElementById('achievement-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'achievement-styles';
    style.textContent = `
      .achievement-card {
        background: rgba(0, 212, 255, 0.05);
        border: 1px solid rgba(0, 212, 255, 0.2);
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        margin: 10px;
        display: inline-block;
        min-width: 180px;
        transition: all 0.3s ease;
      }

      .achievement-card.unlocked {
        background: rgba(6, 214, 160, 0.1);
        border-color: rgba(6, 214, 160, 0.4);
      }

      .achievement-card.locked {
        opacity: 0.6;
      }

      .achievement-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 20px rgba(0, 212, 255, 0.2);
      }

      .achievement-badge {
        font-size: 48px;
        margin-bottom: 10px;
      }

      .achievement-name {
        font-weight: 700;
        color: #00d4ff;
        margin-bottom: 5px;
        font-size: 14px;
      }

      .achievement-desc {
        color: #b0b0b0;
        font-size: 12px;
        margin-bottom: 10px;
      }

      .achievement-date {
        color: #06d6a0;
        font-size: 11px;
        font-weight: 600;
      }

      .achievement-locked {
        color: #ff6b6b;
        font-size: 12px;
        font-weight: 600;
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Istanza globale
const achievementManager = new AchievementManager();

// Carica gli achievements al load della pagina
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    achievementManager.loadAchievements();
    achievementManager.loadUserAchievements();
  });
} else {
  achievementManager.loadAchievements();
  achievementManager.loadUserAchievements();
}
