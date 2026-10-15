/**
 * EVIL site chrome — menu header + stato utente (un solo init per pagina)
 */
(function () {
  'use strict';

  const AUTH_API_URL = window.location.origin + '/api';
  const I18N = window.EVIL_I18N || { t: (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m) : s), url: (p) => p };
  const { t } = I18N;
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

  function setDropdownState(li, open) {
    li.classList.toggle('dropdown-open', open);
    const d = li.querySelector('.dropdown');
    if (d) d.style.display = open ? 'block' : 'none';
    const trigger = li.querySelector(':scope > a[aria-haspopup]');
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (d && d.classList.contains('evil-dd')) {
      if (open) placeDropdown(d);
      resetPeek(d);
    }
  }

  /* ---- menu v4: anteprima della voce sotto il puntatore + evidenziatore che scivola ---- */
  // Tiene il menu dentro lo schermo (l'ultima area è vicina al bordo destro sui desktop stretti)
  function placeDropdown(d) {
    d.style.removeProperty('--dd-shift');
    if (isMobileNav()) return;
    const r = d.getBoundingClientRect();
    const over = r.right - (document.documentElement.clientWidth - 12);
    if (over > 0) d.style.setProperty('--dd-shift', `${-Math.ceil(over)}px`);
  }

  function peekParts(d) {
    const peek = d.querySelector('.evil-dd__peek');
    if (!peek) return null;
    if (!peek.__evilDefault) {
      peek.__evilDefault = {
        big: peek.querySelector('.evil-dd__big').innerHTML,
        pk: peek.querySelector('.evil-dd__pk').innerHTML,
        pt: peek.querySelector('.evil-dd__pt').textContent,
        pd: peek.querySelector('.evil-dd__pd').textContent,
        badge: peek.querySelector('.evil-dd__badge').textContent,
      };
    }
    return peek;
  }

  function swapPeek(peek) {
    peek.classList.remove('is-swap');
    void peek.offsetWidth; // riavvia l'animazione di entrata
    peek.classList.add('is-swap');
  }

  function showPeek(d, item) {
    const peek = peekParts(d);
    if (!peek || peek.__evilItem === item) return;
    peek.__evilItem = item;
    const items = d.querySelectorAll('.evil-dd__item');
    const ico = item.querySelector('.evil-dd__ico svg');
    peek.querySelector('.evil-dd__big').innerHTML = ico ? ico.outerHTML : '';
    peek.querySelector('.evil-dd__pk').textContent = `${item.dataset.n || ''} / ${String(items.length).padStart(2, '0')}`;
    peek.querySelector('.evil-dd__pt').textContent = item.querySelector('.evil-nav__t').textContent;
    peek.querySelector('.evil-dd__pd').textContent = item.querySelector('.evil-nav__d').textContent;
    const badge = peek.querySelector('.evil-dd__badge');
    badge.textContent = item.dataset.badge || '';
    badge.classList.toggle('is-auth', item.dataset.auth === '1');
    swapPeek(peek);

    const glide = d.querySelector('.evil-dd__glide');
    if (glide) {
      glide.style.setProperty('--gy', `${item.offsetTop}px`);
      glide.style.setProperty('--gh', `${item.offsetHeight}px`);
    }
    d.classList.add('has-glide');
  }

  function resetPeek(d) {
    const peek = peekParts(d);
    d.classList.remove('has-glide');
    if (!peek || !peek.__evilItem) return;
    peek.__evilItem = null;
    const def = peek.__evilDefault;
    peek.querySelector('.evil-dd__big').innerHTML = def.big;
    peek.querySelector('.evil-dd__pk').innerHTML = def.pk;
    peek.querySelector('.evil-dd__pt').textContent = def.pt;
    peek.querySelector('.evil-dd__pd').textContent = def.pd;
    const badge = peek.querySelector('.evil-dd__badge');
    badge.textContent = def.badge;
    badge.classList.remove('is-auth');
    swapPeek(peek);
  }

  function initDropdownPeek(nav) {
    nav.querySelectorAll('.evil-dd').forEach((d) => {
      d.querySelectorAll('.evil-dd__item').forEach((item) => {
        item.addEventListener('mouseenter', () => showPeek(d, item));
        item.addEventListener('focus', () => showPeek(d, item));
      });
      const list = d.querySelector('.evil-dd__list');
      if (list) {
        list.addEventListener('mouseleave', () => {
          if (!d.contains(document.activeElement)) resetPeek(d);
        });
      }
    });
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
    initDropdownPeek(nav);

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
        // Le tendine si aprono e si chiudono solo con il clic (o Invio/Spazio): restano aperte
        // finché non scegli una voce, clicchi altrove o premi Esc.
        const willOpen = !li.classList.contains('dropdown-open');
        closeAllDropdowns(nav, willOpen ? li : null);
        setDropdownState(li, willOpen);
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
          e.preventDefault();
          trigger.click();
        }
      });

      // con una tendina già aperta, passare su un'altra area la apre al volo (come una barra dei menu)
      trigger.addEventListener('mouseenter', () => {
        if (isMobileNav()) return;
        const anyOpen = nav.querySelector(':scope > ul > li.dropdown-open');
        if (anyOpen && anyOpen !== li) {
          closeAllDropdowns(nav, li);
          setDropdownState(li, true);
        }
      });
    });

    if (!window.__evilNavEscBound) {
      window.__evilNavEscBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const menu = document.querySelector('header nav');
        const open = menu && menu.querySelector(':scope > ul > li.dropdown-open');
        if (!open) return;
        closeAllDropdowns(menu, null);
        const tr = open.querySelector(':scope > a[aria-haspopup]');
        if (tr) tr.focus();
      });
    }

    // dopo la scelta di una voce il menu si chiude
    nav.querySelectorAll('.dropdown a[href]').forEach((a) => {
      a.addEventListener('click', () => closeAllDropdowns(nav, null));
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
        const name = data.user.name || data.user.email.split('@')[0] || t('Utente');
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
      t('Utente');
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

  function navLink(className, label, ariaLabel, href) {
    const a = document.createElement('a');
    a.className = `auth-btn ${className}`;
    a.href = href;
    a.textContent = label;
    if (ariaLabel) a.setAttribute('aria-label', ariaLabel);
    return a;
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
      navLink('account', t('Accedi'), t('Accedi a EVIL'), loginUrl()),
      navLink('login', t('Registrati'), t('Crea un account EVIL'), I18N.url('/account.html'))
    );
  }

  function renderUserAuthButtons(authButtons, user) {
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    const profile = document.createElement('a');
    profile.href = I18N.url('/profile.html');
    profile.className = 'user-name';
    const label = t('Profilo di {name}', { name: user.name || t('Utente') });
    profile.title = label;
    profile.setAttribute('aria-label', label);
    profile.textContent = `👤 ${getInitials(user.name)}`;
    menu.append(profile, navButton('logout', t('Esci'), t('Esci dall’account'), () => window.EVIL_logout()));
    authButtons.replaceChildren(menu);
  }

  /** Link al login che riporta alla pagina corrente dopo l'accesso. */
  function loginUrl() {
    const page = window.location.pathname.split('/').pop() || '';
    if (!page || /^(login|account|home|index)\.html$/.test(page)) return I18N.url('/login.html');
    return I18N.url(`/login.html?redirect=${encodeURIComponent(page + window.location.search)}`);
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
    // chi prova uno strumento senza account viene portato alla registrazione (con link per accedere);
    // il profilo, che presuppone un account già esistente, resta sul login
    const dest = page === 'profile.html' ? '/login.html' : '/account.html';
    window.location.replace(I18N.url(`${dest}?redirect=${encodeURIComponent(page + window.location.search)}`));
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
      window.location.replace(I18N.url('/login.html'));
    } catch {
      AUTH_STORAGE.clear();
      window.location.replace(I18N.url('/login.html'));
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

  // L'header è sempre generato dal server (<!--evil:header-->): qui si collegano solo gli eventi.
  async function loadHeaderComponent() {
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
