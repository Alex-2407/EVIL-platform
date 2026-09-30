'use strict';
/**
 * ESLint (flat config).
 * - server, middleware, servizi, script e test: Node CommonJS
 * - js/: script classici del browser che condividono funzioni globali tra loro
 *   (isAuthenticated, progressManager, ...): elencate qui sotto, così un nome
 *   scritto male viene segnalato come variabile inesistente.
 */
const js = require('@eslint/js');
const globals = require('globals');

const SITE_GLOBALS = {
  // evil-site-chrome.js
  AUTH_STORAGE: 'readonly',
  isAuthenticated: 'readonly',
  getCurrentUser: 'readonly',
  syncUserFromServer: 'readonly',
  ensureAuthenticatedOrRedirect: 'readonly',
  notifyAuthVerified: 'readonly',
  initAuthHeader: 'readonly',
  scheduleInitAuthHeader: 'readonly',
  initEvilNavigation: 'readonly',
  getInitials: 'readonly',
  logout: 'readonly',
  EVIL_logout: 'readonly',
  // progress-manager.js e trofei
  progressManager: 'readonly',
  userProgress: 'writable',
  loadUserProgress: 'readonly',
  saveUserProgress: 'readonly',
  logActivity: 'readonly',
  incrementScans: 'readonly',
  getUnlockedAchievements: 'readonly',
  getProgressStats: 'readonly',
  getActivityLabel: 'readonly',
  TrophySystem: 'readonly',
  TrophyAudio: 'readonly',
  TrophyJingles: 'readonly',
  // altri script condivisi
  EvilTools: 'readonly',
  EvilAuthFeedback: 'readonly',
  fetchAuthenticated: 'readonly',
  bindLogoEasterEggButton: 'readonly',
  isLogoEasterEggActive: 'readonly',
  L: 'readonly', // Leaflet (mappa incidenti)
  global: 'readonly', // fallback UMD "typeof window !== 'undefined' ? window : global"
};

module.exports = [
  {
    ignores: ['node_modules/**', 'logs/**', 'uploads/**', 'data/**', 'coverage/**', '**/*.min.js', 'css/**'],
  },
  js.configs.recommended,
  {
    files: ['server/**/*.js', 'middleware/**/*.js', 'services/**/*.js', 'utils/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', 'js/server.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['js/**/*.js'],
    ignores: ['js/server.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, ...SITE_GLOBALS },
    },
    rules: {
      // negli script classici le funzioni dichiarate servono ad altri file o all'HTML
      'no-unused-vars': 'off',
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
];
