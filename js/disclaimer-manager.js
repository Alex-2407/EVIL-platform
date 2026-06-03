/**
 * Disclaimer Manager
 * Gestisce la visualizzazione dei disclaimer badge per dati fake/simulati
 */
class DisclaimerManager {
  constructor() {
    this.disclaimers = {
      'simulated': {
        label: 'Simulato',
        class: 'simulated',
        tooltip: 'Questo è un dato simulato per scopi educativi'
      },
      'mock': {
        label: 'Mock Data',
        class: 'mock',
        tooltip: 'Dati di esempio per dimostrazione'
      },
      'demo': {
        label: 'Demo',
        class: 'simulated',
        tooltip: 'Questo è un ambiente di demo'
      },
      'fake': {
        label: 'Dati Fake',
        class: 'mock',
        tooltip: 'I dati mostrati non sono reali'
      }
    };
  }

  /**
   * Crea un disclaimer badge
   */
  createBadge(type = 'simulated') {
    const config = this.disclaimers[type] || this.disclaimers['simulated'];
    
    const badge = document.createElement('span');
    badge.className = `disclaimer-badge disclaimer-tooltip ${config.class}`;
    badge.innerHTML = `
      ${config.label}
      <span class="tooltip-text">${config.tooltip}</span>
    `;
    
    return badge;
  }

  /**
   * Aggiunge disclaimer badge ad un elemento
   */
  addBadge(elementId, type = 'simulated') {
    const element = document.getElementById(elementId);
    if (element) {
      element.appendChild(this.createBadge(type));
    }
  }

  /**
   * Aggiunge disclaimer section ad uno strumento
   */
  addToolDisclaimer(elementId, toolName) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const disclaimer = document.createElement('div');
    disclaimer.className = 'tool-disclaimer';
    disclaimer.innerHTML = `
      <strong>⚠️ Nota:</strong> ${toolName} è un ambiente di simulazione educativa.
      <p>I dati e i risultati presentati sono dati di esempio per scopi didattici e non rappresentano minacce reali.</p>
    `;
    
    element.insertBefore(disclaimer, element.firstChild);
  }

  /**
   * Inizializza automaticamente i disclaimer per pagine conosciute
   */
  autoInit() {
    // Determina la pagina corrente
    const pathname = window.location.pathname;
    
    const toolConfig = {
      'web-simulator': { name: 'Simulatore Attacchi Web', type: 'simulated' },
      'attacks-map': { name: 'Mappa Incidenti', type: 'live' },
      'hacked-timeline': { name: 'Timeline Incident Response', type: 'simulated' },
      'malware-db': { name: 'Database Malware', type: 'mock' },
      'virtual-lab': { name: 'Lab Virtuale', type: 'simulated' },
      'crypto-studio': { name: 'Studio Cifratura', type: 'educational' },
      'site-policies': { name: 'Policy del sito', type: 'educational' },
      'help': { name: 'Help e supporto', type: 'educational' },
      'quiz-hub': { name: 'Centro Quiz', type: 'simulated' },
      'phishing-quiz': { name: 'Centro Quiz', type: 'simulated' }
    };

    // Cerca quale tool corrisponde
    for (const [key, config] of Object.entries(toolConfig)) {
      if (pathname.includes(key)) {
        // Aggiungi disclaimer sul main
        const main = document.querySelector('main');
        if (main) {
          this.addToolDisclaimer(main.id || 'disclaimer-placeholder', config.name);
        }
        break;
      }
    }
  }
}

// Istanza globale
const disclaimerManager = new DisclaimerManager();

// Auto-inizializza al caricamento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => disclaimerManager.autoInit());
} else {
  disclaimerManager.autoInit();
}
