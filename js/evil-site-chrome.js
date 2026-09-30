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
      try {
        localStorage.setItem(
          'user',
          JSON.stringify({ id: user.id, name: user.name, email: user.email, emailVerified: Boolean(user.emailVerified) })
        );
      } catch { /* storage non disponibile */ }
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
      try {
        localStorage.removeItem('user');
      } catch { /* ignore */ }
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

  function setDropdownState(li, open) {
    li.classList.toggle('dropdown-open', open);
    const d = li.querySelector('.dropdown');
    if (d) d.style.display = open ? 'block' : 'none';
    const trigger = li.querySelector(':scope > a[aria-haspopup]');
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeAllDropdowns(nav, exceptLi) {
    if (!nav) return;
    nav.querySelectorAll(':scope > ul > li').forEach((li) => {
      if (li === exceptLi) return;
      setDropdownState(li, false);
    });
  }

  function initializeHeaderEvents() {
    const nav = document.querySelector('header nav');
    if (!nav || nav.dataset.evilNavBound === '1') return;
    nav.dataset.evilNavBound = '1';

    nav.querySelectorAll(':scope > ul > li > a[href="#"], :scope > ul > li > a[href=""]').forEach((trigger, index) => {
      const li = trigger.closest('li');
      const dropdown = trigger.nextElementSibling;
      if (!dropdown || !dropdown.classList.contains('dropdown')) return;

      // Per i lettori di schermo: è un pulsante che apre un sottomenu, non un link
      if (!dropdown.id) dropdown.id = `evil-nav-dropdown-${index + 1}`;
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', dropdown.id);
      const label = trigger.textContent.replace(/\s*▾\s*$/, '').trim();
      if (label && /▾/.test(trigger.textContent)) {
        trigger.textContent = `${label} `;
        const caret = document.createElement('span');
        caret.setAttribute('aria-hidden', 'true');
        caret.textContent = '▾';
        trigger.appendChild(caret);
      }

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Con il mouse il menu si apre già al passaggio: il clic subito dopo non deve richiuderlo
        // (e.detail === 0: clic da tastiera, Invio o spazio: vale sempre come apri/chiudi)
        const justHovered = e.detail > 0 && Date.now() - Number(li.dataset.hoverOpenedAt || 0) < 700;
        const willOpen = justHovered || !li.classList.contains('dropdown-open');
        closeAllDropdowns(nav, willOpen ? li : null);
        setDropdownState(li, willOpen);
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          trigger.click();
        }
      });

      if (!isMobileNav()) {
        li.addEventListener('mouseenter', () => {
          closeAllDropdowns(nav, li);
          if (!li.classList.contains('dropdown-open')) li.dataset.hoverOpenedAt = String(Date.now());
          setDropdownState(li, true);
        });
        li.addEventListener('mouseleave', () => {
          delete li.dataset.hoverOpenedAt;
          setDropdownState(li, false);
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

  /**
   * Stato della sessione dal server. /api/auth/session rinnova da solo l'accesso scaduto
   * se il cookie di sessione è valido: non serve più chiamare /api/auth/refresh-token
   * (per gli ospiti falliva sempre con 401, a ogni pagina, e consumava il limite).
   * @returns {Promise<{reachable: boolean, user: object|null}>}
   */
  async function fetchSession() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT);
    try {
      const response = await fetch(`${AUTH_API_URL}/auth/session`, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) return { reachable: response.status < 500 && response.status !== 429, user: null };
      const data = await response.json();
      if (data.authenticated && data.user?.id && data.user?.email) {
        const name = data.user.name || data.user.email.split('@')[0] || 'Utente';
        return {
          reachable: true,
          user: { id: data.user.id, name, email: data.user.email, emailVerified: Boolean(data.user.emailVerified) }
        };
      }
      return { reachable: true, user: null };
    } catch {
      clearTimeout(timeoutId);
      return { reachable: false, user: null };
    }
  }

  let lastSessionReachable = true;

  async function syncUserFromServer() {
    const { reachable, user } = await fetchSession();
    lastSessionReachable = reachable;
    if (user) {
      AUTH_STORAGE.setUser(user);
      return user;
    }
    // Il server dice "non collegato": la copia locale è vecchia e va tolta.
    // Se invece il server non risponde, la copia locale resta (rete assente, riavvio).
    if (reachable) AUTH_STORAGE.clearUser();
    return null;
  }

  function normalizeStoredUser(user) {
    if (!user?.id || !user?.email) return null;
    const name =
      user.name ||
      (typeof user.email === 'string' ? user.email.split('@')[0] : '') ||
      'Utente';
    return { id: user.id, name, email: user.email, emailVerified: Boolean(user.emailVerified) };
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

  function getInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'U';
    return fullName.trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase()).join('').substring(0, 3);
  }

  function navButton(className, label, ariaLabel, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `auth-btn ${className}`;
    btn.textContent = label;
    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderGuestAuthButtons(authButtons) {
    authButtons.replaceChildren(
      navButton('account', 'Accedi', 'Accedi a EVIL', () => { window.location.href = loginUrl(); }),
      navButton('login', 'Registrati', 'Crea un account EVIL', () => { window.location.href = '/account.html'; })
    );
  }

  function renderUserAuthButtons(authButtons, user) {
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    const profile = document.createElement('a');
    profile.href = '/profile.html';
    profile.className = 'user-name';
    profile.title = `Profilo di ${user.name || 'Utente'}`;
    profile.setAttribute('aria-label', `Profilo di ${user.name || 'Utente'}`);
    profile.textContent = `👤 ${getInitials(user.name)}`;
    menu.append(profile, navButton('logout', 'Esci', 'Esci dall\'account', () => window.EVIL_logout()));
    authButtons.replaceChildren(menu);
  }

  /** Link al login che riporta alla pagina corrente dopo l'accesso. */
  function loginUrl() {
    const page = window.location.pathname.split('/').pop() || '';
    if (!page || /^(login|account|home|index)\.html$/.test(page)) return '/login.html';
    return `/login.html?redirect=${encodeURIComponent(page + window.location.search)}`;
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
    // sessione scaduta: via il nome in alto; server irraggiungibile: resta la copia locale
    if (!cached || lastSessionReachable) renderGuestAuthButtons(authButtons);
  }

  async function ensureAuthenticatedOrRedirect(redirectPage) {
    if (!window.__evilSiteChromeBooting) {
      await window.__evilAuthReady;
    }
    const user = await syncUserFromServer();
    if (user) return true;
    if (!lastSessionReachable && isAuthenticated()) return true;

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

  /** Altezza reale dell'header (su mobile va su due righe) per scroll-padding-top in CSS. */
  function syncHeaderHeight() {
    const header = document.querySelector('header');
    if (header && header.offsetHeight) {
      document.documentElement.style.setProperty('--evil-header-h', `${header.offsetHeight}px`);
    }
  }

  async function initEvilNavigation() {
    initializeHeaderEvents();
    initializeHamburgerMenu();
    syncHeaderHeight();
    if (!window.__evilHeaderHeightBound) {
      window.__evilHeaderHeightBound = true;
      let raf = 0;
      window.addEventListener('resize', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(syncHeaderHeight);
      });
    }
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
  window.getInitials = getInitials;

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
