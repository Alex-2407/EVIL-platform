/**
 * EVIL site chrome — menu header + stato utente (un solo init per pagina)
 */
(function () {
  'use strict';

  const AUTH_API_URL = window.location.origin + '/api';
  const AUTH_TIMEOUT = 8000;

  const AUTH_REQUIRED_PAGES = new Set([
    'security-check.html',
    'vulnerability-scanner.html',
    'dns-enumerator.html',
    'subdomain-finder.html',
    'ssl-analyzer.html',
    'file-analysis.html',
    'social-profiling.html',
    'public-info.html',
    'profile.html'
  ]);

  let logoutInProgress = false;
  let authHeaderInitPromise = null;
  let authReadyResolve;

  window.__evilAuthReady = new Promise((resolve) => {
    authReadyResolve = resolve;
  });

  const AUTH_STORAGE = {
    setUser(user) {
      localStorage.setItem(
        'user',
        JSON.stringify({ id: user.id, name: user.name, email: user.email })
      );
    },
    getUser() {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    clearUser() {
      localStorage.removeItem('user');
    },
    clear() {
      this.clearUser();
    }
  };

  function isMobileNav() {
    return window.matchMedia('(max-width: 992px)').matches;
  }

  function hasEmbeddedHeader() {
    const header = document.querySelector('header');
    return !!(header && header.querySelector('.hamburger-btn') && header.querySelector('nav ul'));
  }

  function closeAllDropdowns(nav, exceptLi) {
    if (!nav) return;
    nav.querySelectorAll(':scope > ul > li').forEach((li) => {
      if (li === exceptLi) return;
      li.classList.remove('dropdown-open');
      const d = li.querySelector('.dropdown');
      if (d) d.style.display = 'none';
    });
  }

  function initializeHeaderEvents() {
    const nav = document.querySelector('header nav');
    if (!nav || nav.dataset.evilNavBound === '1') return;
    nav.dataset.evilNavBound = '1';

    nav.querySelectorAll(':scope > ul > li > a[href="#"], :scope > ul > li > a[href=""]').forEach((trigger) => {
      const li = trigger.closest('li');
      const dropdown = trigger.nextElementSibling;
      if (!dropdown || !dropdown.classList.contains('dropdown')) return;

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const willOpen = !li.classList.contains('dropdown-open');
        closeAllDropdowns(nav, willOpen ? li : null);
        li.classList.toggle('dropdown-open', willOpen);
        dropdown.style.display = willOpen ? 'block' : 'none';
      });

      if (!isMobileNav()) {
        li.addEventListener('mouseenter', () => {
          closeAllDropdowns(nav, li);
          li.classList.add('dropdown-open');
          dropdown.style.display = 'block';
        });
        li.addEventListener('mouseleave', () => {
          li.classList.remove('dropdown-open');
          dropdown.style.display = 'none';
        });
      }
    });

    if (!window.__evilNavResizeBound) {
      window.__evilNavResizeBound = true;
      window.addEventListener('resize', () => {
        closeAllDropdowns(document.querySelector('header nav'), null);
      });
    }

    if (!window.__evilNavDocumentClickBound) {
      window.__evilNavDocumentClickBound = true;
      document.addEventListener('click', (e) => {
        const menu = document.querySelector('header nav');
        if (menu && !menu.contains(e.target)) closeAllDropdowns(menu, null);
      });
    }
  }

  function initializeHamburgerMenu() {
    const hamburgerBtn = document.querySelector('header .hamburger-btn');
    const nav = document.querySelector('header nav');
    if (!hamburgerBtn || !nav || hamburgerBtn.dataset.evilHamburgerBound === '1') return;
    hamburgerBtn.dataset.evilHamburgerBound = '1';

    hamburgerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !nav.classList.contains('active');
      hamburgerBtn.classList.toggle('active', open);
      nav.classList.toggle('active', open);
      hamburgerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) closeAllDropdowns(nav, null);
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        const href = link.getAttribute('href');
        if (href === '#' || href === '') return;
        hamburgerBtn.classList.remove('active');
        nav.classList.remove('active');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        closeAllDropdowns(nav, null);
      });
    });

    if (!window.__evilNavEscapeBound) {
      window.__evilNavEscapeBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (typeof window.isLogoEasterEggActive === 'function' && window.isLogoEasterEggActive()) return;
        const btn = document.querySelector('header .hamburger-btn');
        const menu = document.querySelector('header nav');
        closeAllDropdowns(menu, null);
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        if (!btn || !menu) return;
        btn.classList.remove('active');
        menu.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
      });
    }
  }

  async function fetchSession() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT);
    try {
      const response = await fetch(`${AUTH_API_URL}/auth/session`, {
        credentials: 'include',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.authenticated && data.user?.id && data.user?.email) {
        const name = data.user.name || data.user.email.split('@')[0] || 'Utente';
        return { id: data.user.id, name, email: data.user.email };
      }
      return null;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  async function refreshAccessToken() {
    try {
      const response = await fetch(`${AUTH_API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({})
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (data.status === 'success' && data.user) {
        AUTH_STORAGE.setUser(data.user);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function syncUserFromServer() {
    let user = await fetchSession();
    if (user) {
      AUTH_STORAGE.setUser(user);
      return user;
    }
    if (await refreshAccessToken()) {
      user = await fetchSession();
      if (user) {
        AUTH_STORAGE.setUser(user);
        return user;
      }
    }
    return null;
  }

  function normalizeStoredUser(user) {
    if (!user?.id || !user?.email) return null;
    const name =
      user.name ||
      (typeof user.email === 'string' ? user.email.split('@')[0] : '') ||
      'Utente';
    return { id: user.id, name, email: user.email };
  }

  function isAuthenticated() {
    return !!normalizeStoredUser(AUTH_STORAGE.getUser());
  }

  function getCurrentUser() {
    return normalizeStoredUser(AUTH_STORAGE.getUser());
  }

  function pageRequiresAuth() {
    if (document.body?.dataset?.evilAuth === 'required') return true;
    const page = window.location.pathname.split('/').pop() || '';
    return AUTH_REQUIRED_PAGES.has(page);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  function getInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'U';
    return fullName.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).join('').substring(0, 3);
  }

  function renderGuestAuthButtons(authButtons) {
    authButtons.innerHTML = `
      <button class="auth-btn account" type="button" onclick="window.location.href='/login.html';" aria-label="Accedi a EVIL">Accedi</button>
      <button class="auth-btn login" type="button" onclick="window.location.href='/account.html';" aria-label="Registrati su EVIL">Registrati</button>
    `;
  }

  function renderUserAuthButtons(authButtons, user) {
    authButtons.innerHTML = `
      <div class="user-menu">
        <a href="/profile.html" class="user-name" title="👤 ${escapeHtml(user.name || 'Utente')}">
          👤 ${escapeHtml(getInitials(user.name))}
        </a>
        <button class="auth-btn logout" type="button" onclick="window.EVIL_logout();">Log Out</button>
      </div>
    `;
  }

  function markAuthUiReady() {
    document.documentElement.classList.remove('evil-auth-pending');
    document.documentElement.classList.add('evil-auth-ready');
  }

  async function initAuthHeader() {
    const authButtons = document.querySelector('header .auth-buttons') || document.querySelector('.auth-buttons');
    if (!authButtons) return;

    const cached = getCurrentUser();
    if (cached) {
      renderUserAuthButtons(authButtons, cached);
    } else {
      authButtons.innerHTML = '';
    }

    const serverUser = await syncUserFromServer();
    if (serverUser) {
      renderUserAuthButtons(authButtons, serverUser);
      return;
    }
    if (!cached) renderGuestAuthButtons(authButtons);
  }

  async function ensureAuthenticatedOrRedirect(redirectPage) {
    if (!window.__evilSiteChromeBooting) {
      await window.__evilAuthReady;
    }
    const user = await syncUserFromServer();
    if (user) return true;
    if (isAuthenticated()) return true;

    const page = redirectPage || window.location.pathname.split('/').pop() || 'home.html';
    window.location.replace(`/login.html?redirect=${encodeURIComponent(page)}`);
    return false;
  }

  function scheduleInitAuthHeader() {
    if (authHeaderInitPromise) return authHeaderInitPromise;
    authHeaderInitPromise = initAuthHeader().finally(() => {
      authHeaderInitPromise = null;
    });
    return authHeaderInitPromise;
  }

  async function logout() {
    if (logoutInProgress) return;
    logoutInProgress = true;
    try {
      await fetch(`${AUTH_API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
      AUTH_STORAGE.clear();
      window.location.replace('/login.html');
    } catch {
      AUTH_STORAGE.clear();
      window.location.replace('/login.html');
    }
  }

  function notifyAuthVerified() {
    try {
      const bc = new BroadcastChannel('evil-auth');
      bc.postMessage({ type: 'email-verified' });
      bc.close();
    } catch { /* ignore */ }
  }

  async function initEvilNavigation() {
    initializeHeaderEvents();
    initializeHamburgerMenu();
    if (typeof bindLogoEasterEggButton === 'function') bindLogoEasterEggButton();
    await scheduleInitAuthHeader();
  }

  async function loadHeaderComponent() {
    if (!hasEmbeddedHeader()) {
      const r = await fetch('/html/components/header.html');
      if (!r.ok) throw new Error(String(r.status));
      const html = await r.text();
      const headerElement = document.querySelector('header');
      const mainElement = document.querySelector('main');
      if (headerElement) headerElement.outerHTML = html;
      else if (mainElement) mainElement.insertAdjacentHTML('beforebegin', html);
      else document.body.insertAdjacentHTML('afterbegin', html);
    }
    await initEvilNavigation();
  }

  async function bootSiteChrome() {
    if (window.__evilSiteChromeBooting) {
      await window.__evilAuthReady;
      return;
    }
    if (window.__evilSiteChromeBooted) return;

    window.__evilSiteChromeBooting = true;
    document.documentElement.classList.add('evil-auth-pending');

    let showAuthUi = true;
    try {
      await loadHeaderComponent();
      if (pageRequiresAuth()) {
        const ok = await ensureAuthenticatedOrRedirect();
        if (!ok) showAuthUi = false;
      }
    } catch (err) {
      console.error('[EVIL chrome]', err);
      try {
        await initEvilNavigation();
        if (pageRequiresAuth()) {
          const ok = await ensureAuthenticatedOrRedirect();
          if (!ok) showAuthUi = false;
        }
      } catch (_) { /* ignore */ }
    } finally {
      if (showAuthUi) markAuthUiReady();
      window.__evilSiteChromeBooted = true;
      window.__evilSiteChromeBooting = false;
      if (authReadyResolve) authReadyResolve();
    }
  }

  function scheduleSiteChromeBoot() {
    if (window.__evilSiteChromeBootScheduled) return;
    window.__evilSiteChromeBootScheduled = true;
    const run = () => {
      void bootSiteChrome();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true, capture: true });
    } else {
      run();
    }
  }

  // API globale (compatibilità)
  window.AUTH_STORAGE = AUTH_STORAGE;
  window.EVIL_logout = logout;
  window.logout = logout;
  window.initAuthHeader = scheduleInitAuthHeader;
  window.syncUserFromServer = syncUserFromServer;
  window.isAuthenticated = isAuthenticated;
  window.getCurrentUser = getCurrentUser;
  window.notifyAuthVerified = notifyAuthVerified;
  window.scheduleInitAuthHeader = scheduleInitAuthHeader;
  window.initEvilNavigation = initEvilNavigation;
  window.ensureAuthenticatedOrRedirect = ensureAuthenticatedOrRedirect;

  window.addEventListener('storage', (e) => {
    if (e.key === 'user') scheduleInitAuthHeader();
  });

  try {
    const authBc = new BroadcastChannel('evil-auth');
    authBc.onmessage = (ev) => {
      if (ev.data?.type === 'email-verified') scheduleInitAuthHeader();
    };
  } catch { /* ignore */ }

  scheduleSiteChromeBoot();
})();
