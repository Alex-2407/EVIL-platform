// ==================== THREE.JS LAZY LOADER ====================
// Load Three.js only on pages that actually need it

(function() {
  'use strict';

  // Pages that need Three.js
  const threeJsPages = [
    'virtual-lab.html',
    'web-simulator.html',
    'matrix-effect.html'
  ];

  // Check if current page needs Three.js
  const currentPage = window.location.pathname.split('/').pop() || 'home.html';

  if (threeJsPages.includes(currentPage)) {
    // Load Three.js asynchronously
    const script = document.createElement('script');
    script.src = '/js/three.min.js';
    script.async = true;
    script.onload = function() {
      console.log('Three.js loaded for', currentPage);
      // Initialize Three.js components here if needed
      if (typeof initThreeJsComponents === 'function') {
        initThreeJsComponents();
      }
    };
    script.onerror = function() {
      console.warn('Failed to load Three.js');
    };
    document.head.appendChild(script);
  } else {
    console.log('Three.js not needed for', currentPage);
  }
})();