/**
 * EVIL site chrome — menu header + stato utente (un solo init per pagina)
 */
(function () {
  'use strict';

  const AUTH_API_URL = window.location.origin + '/api';
  const AUTH_TIMEOUT = 8000;

  let logoutInProgress = false;
  let authHeaderInitPromise = null;

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

  function isAuthenticated() {
    const user = AUTH_STORAGE.getUser();
    return !!(user && user.id && user.name && user.email);
  }

  function getCurrentUser() {
    const user = AUTH_STORAGE.getUser();
    if (!user || !user.id || !user.name || !user.email) return null;
    return user;
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
      <button class="auth-btn account" type="button" onclick="window.location.href='login.html';" aria-label="Accedi a EVIL">Accedi</button>
      <button class="auth-btn login" type="button" onclick="window.location.href='account.html';" aria-label="Registrati su EVIL">Registrati</button>
    `;
  }

  function renderUserAuthButtons(authButtons, user) {
    authButtons.innerHTML = `
      <div class="user-menu">
        <a href="profile.html" class="user-name" title="👤 ${escapeHtml(user.name || 'Utente')}">
          👤 ${escapeHtml(getInitials(user.name))}
        </a>
        <button class="auth-btn logout" type="button" onclick="window.EVIL_logout();">Log Out</button>
      </div>
    `;
  }

  async function initAuthHeader() {
    const authButtons = document.querySelector('header .auth-buttons') || document.querySelector('.auth-buttons');
    if (!authButtons) return;

    const cached = getCurrentUser();
    if (cached) renderUserAuthButtons(authButtons, cached);

    const serverUser = await syncUserFromServer();
    if (serverUser) {
      renderUserAuthButtons(authButtons, serverUser);
      return;
    }
    if (!cached) renderGuestAuthButtons(authButtons);
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
      window.location.replace('login.html');
    } catch {
      AUTH_STORAGE.clear();
      window.location.replace('login.html');
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

  function loadHeaderComponent() {
    if (!hasEmbeddedHeader()) {
      fetch('/html/components/header.html')
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((html) => {
          const headerElement = document.querySelector('header');
          const mainElement = document.querySelector('main');
          if (headerElement) headerElement.outerHTML = html;
          else if (mainElement) mainElement.insertAdjacentHTML('beforebegin', html);
          else document.body.insertAdjacentHTML('afterbegin', html);
          return initEvilNavigation();
        })
        .catch((err) => console.error('[EVIL chrome]', err));
      return;
    }
    initEvilNavigation();
  }

  function bootSiteChrome() {
    if (window.__evilSiteChromeBooted) return;
    window.__evilSiteChromeBooted = true;
    loadHeaderComponent();
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

  window.addEventListener('storage', (e) => {
    if (e.key === 'user') scheduleInitAuthHeader();
  });

  try {
    const authBc = new BroadcastChannel('evil-auth');
    authBc.onmessage = (ev) => {
      if (ev.data?.type === 'email-verified') scheduleInitAuthHeader();
    };
  } catch { /* ignore */ }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSiteChrome, { once: true });
  } else {
    bootSiteChrome();
  }
})();
