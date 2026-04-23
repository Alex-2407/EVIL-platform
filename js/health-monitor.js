/**
 * Health Monitor - Monitora la salute del sistema EVIL
 * Esegui periodicamente per verificare che tutto funzioni
 */

const MONITOR_CONFIG = {
  checkInterval: 30000, // 30 secondi
  logFile: 'monitor.log',
  alertThreshold: {
    apiLatency: 2000, // 2 secondi
    errorRate: 0.1, // 10%
    memoryUsage: 50 // 50MB
  }
};

class HealthMonitor {
  constructor() {
    this.stats = {
      totalRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errors: [],
      startTime: Date.now()
    };
    
    this.setupInterceptors();
  }

  /**
   * Monitora health del sistema
   */
  async check() {
    const health = {
      timestamp: new Date().toISOString(),
      api: await this.checkAPI(),
      auth: this.checkAuth(),
      storage: this.checkStorage(),
      performance: this.checkPerformance(),
      memory: this.getMemoryUsage()
    };

    this.logHealth(health);
    return health;
  }

  /**
   * Controlla salute API
   */
  async checkAPI() {
    const endpoints = [
      window.location.origin + '/api/achievements',
      window.location.origin + '/api/progress/load'
    ];

    const results = await Promise.all(
      endpoints.map(url => this.testEndpoint(url))
    );

    return {
      online: results.every(r => r.ok),
      latency: results.map(r => r.latency),
      errors: results.filter(r => !r.ok)
    };
  }

  /**
   * Test singolo endpoint
   */
  async testEndpoint(url) {
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const latency = performance.now() - startTime;
      
      this.stats.totalRequests++;
      this.stats.totalLatency += latency;
      this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
      this.stats.minLatency = Math.min(this.stats.minLatency, latency);

      return {
        url,
        ok: response.ok,
        status: response.status,
        latency
      };
    } catch (err) {
      this.stats.failedRequests++;
      this.stats.errors.push({
        endpoint: url,
        error: err.message,
        timestamp: new Date().toISOString()
      });

      return {
        url,
        ok: false,
        error: err.message,
        latency: performance.now() - startTime
      };
    }
  }

  /**
   * Controlla autenticazione
   */
  checkAuth() {
    try {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('user');

      return {
        authenticated: !!token && !!user,
        tokenLength: token ? token.length : 0,
        userValid: user ? this.isValidUser(JSON.parse(user)) : false
      };
    } catch (err) {
      return {
        authenticated: false,
        error: err.message
      };
    }
  }

  /**
   * Valida struttura user
   */
  isValidUser(user) {
    return user && 
           typeof user === 'object' &&
           user.id && 
           user.name && 
           user.email;
  }

  /**
   * Controlla storage
   */
  checkStorage() {
    try {
      const used = Object.entries(localStorage)
        .reduce((sum, [k, v]) => sum + k.length + v.length, 0);

      return {
        available: true,
        used: `${(used / 1024).toFixed(2)} KB`,
        itemCount: localStorage.length,
        available_mb: (5 * 1024 * 1024 - used) / 1024 / 1024
      };
    } catch (err) {
      return {
        available: false,
        error: err.message
      };
    }
  }

  /**
   * Controlla performance
   */
  checkPerformance() {
    const perf = performance.timing;
    
    return {
      domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
      pageLoadTime: perf.loadEventEnd - perf.navigationStart,
      avgLatency: (this.stats.totalLatency / Math.max(this.stats.totalRequests, 1)).toFixed(2),
      maxLatency: this.stats.maxLatency.toFixed(2),
      errorRate: ((this.stats.failedRequests / Math.max(this.stats.totalRequests, 1)) * 100).toFixed(2)
    };
  }

  /**
   * Stima memoria (browser limit)
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
        total: `${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
        limit: `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`
      };
    }
    return { note: 'Memory API not available' };
  }

  /**
   * Log salute
   */
  logHealth(health) {
    const log = {
      ...health,
      uptime: `${((Date.now() - this.stats.startTime) / 1000).toFixed(0)}s`
    };

    console.table(log);
    return log;
  }

  /**
   * Controlla se ci sono alert
   */
  getAlerts() {
    const alerts = [];

    const errorRate = this.stats.failedRequests / Math.max(this.stats.totalRequests, 1);
    if (errorRate > MONITOR_CONFIG.alertThreshold.errorRate) {
      alerts.push({
        level: 'warning',
        message: `Error rate alto: ${(errorRate * 100).toFixed(2)}%`,
        threshold: `${(MONITOR_CONFIG.alertThreshold.errorRate * 100).toFixed(2)}%`
      });
    }

    const avgLatency = this.stats.totalLatency / Math.max(this.stats.totalRequests, 1);
    if (avgLatency > MONITOR_CONFIG.alertThreshold.apiLatency) {
      alerts.push({
        level: 'warning',
        message: `Latenza API alta: ${avgLatency.toFixed(0)}ms`,
        threshold: `${MONITOR_CONFIG.alertThreshold.apiLatency}ms`
      });
    }

    return alerts;
  }

  /**
   * Reset statistiche
   */
  reset() {
    this.stats = {
      totalRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      errors: [],
      startTime: Date.now()
    };
  }

  /**
   * Setup interceptors (se disponibili)
   */
  setupInterceptors() {
    // Nota: In production, usare service worker o proxy
    console.log('Health Monitor initialized');
  }
}

// Istanza globale
const healthMonitor = new HealthMonitor();

// API pubblica
window.EVIL = window.EVIL || {};
window.EVIL.health = {
  /**
   * Esegui health check
   */
  check: () => healthMonitor.check(),
  
  /**
   * Mostra alerts
   */
  alerts: () => healthMonitor.getAlerts(),
  
  /**
   * Mostra statistiche
   */
  stats: () => healthMonitor.stats,
  
  /**
   * Reset monitor
   */
  reset: () => healthMonitor.reset(),
  
  /**
   * Auto-monitor ogni 30 secondi
   */
  autoMonitor: (interval = 30000) => {
    console.log(`Starting auto-monitor (${interval}ms)`);
    setInterval(() => healthMonitor.check(), interval);
  }
};

// Auto-run al caricamento se in debug
if (typeof DEBUG !== 'undefined' && DEBUG) {
  document.addEventListener('DOMContentLoaded', () => {
    window.EVIL.health.check();
    window.EVIL.health.autoMonitor(30000);
  });
}

// Export per Node.js (se usato)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HealthMonitor;
}
