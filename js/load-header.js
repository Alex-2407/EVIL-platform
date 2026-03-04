/**
 * Load Header Component
 * Carica il header consolidato in tutti i file HTML
 */
async function loadHeaderComponent() {
  try {
    // I file HTML della cartella 'html' sono serviti direttamente dalla root
    // quindi components/header.html è accessibile a /components/header.html
    const headerPath = '/components/header.html';
    
    // Fetch il file header
    const response = await fetch(headerPath);
    if (!response.ok) throw new Error(`Failed to load header: ${response.status}`);
    
    const headerHTML = await response.text();
    
    // Trova il tag <header> se esiste (older HTML files)
    let headerElement = document.querySelector('header');
    
    if (headerElement) {
      // Sostituisci l'header esistente
      headerElement.outerHTML = headerHTML;
    } else {
      // Se non esiste, inserisci prima del primo <main>
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.insertAdjacentHTML('beforebegin', headerHTML);
      }
    }
    
    // Inizializza gli event listener per il matrix button e dropdown menu
    initializeHeaderEvents();
    initializeHamburgerMenu();
    
    console.log('[Header Component] ✓ Loaded successfully');
  } catch (error) {
    console.error('[Header Component] ✗ Error:', error);
  }
}

/**
 * Inizializza gli event listener per l'header
 */
function initializeHeaderEvents() {
  // Matrix button
  const matrixBtn = document.getElementById('matrix-btn');
  if (matrixBtn && typeof toggleMatrix === 'function') {
    matrixBtn.addEventListener('click', toggleMatrix);
  }
  
  // Dropdown menu
  const dropdownTriggers = document.querySelectorAll('nav > ul > li > a[href="#"]');
  dropdownTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = trigger.nextElementSibling;
      if (dropdown && dropdown.classList.contains('dropdown')) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
}

/**
 * Inizializza il mobile hamburger menu
 */
function initializeHamburgerMenu() {
  // Seleziona il hamburger button e nav dal header caricato
  const hamburgerBtn = document.querySelector('.hamburger-btn');
  const nav = document.querySelector('nav');
  
  if (!hamburgerBtn || !nav) return;
  
  // Add click event al hamburger
  hamburgerBtn.addEventListener('click', () => {
    hamburgerBtn.classList.toggle('active');
    nav.classList.toggle('active');
  });
  
  // Chiudi menu quando clicchi su un link
  const navLinks = nav.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      hamburgerBtn.classList.remove('active');
      nav.classList.remove('active');
    });
  });
}

// Carica l'header quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadHeaderComponent);
} else {
  loadHeaderComponent();
}

// DISABILITATO: Carica il disclaimer manager (potrebbe causare redirect infinito)
// const disclaimerScript = document.createElement('script');
// disclaimerScript.src = './disclaimer-manager.js';
// document.head.appendChild(disclaimerScript);
