/**
 * Load Header Component — menu, hamburger, auth header
 */
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

  const dropdownTriggers = nav.querySelectorAll(
    ':scope > ul > li > a[href="#"], :scope > ul > li > a[href=""]'
  );

  dropdownTriggers.forEach((trigger) => {
    const li = trigger.closest('li');
    const dropdown = trigger.nextElementSibling;
    if (!dropdown || !dropdown.classList.contains('dropdown')) return;

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
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
      const menu = document.querySelector('header nav');
      closeAllDropdowns(menu, null);
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

  hamburgerBtn.addEventListener('click', () => {
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

async function initEvilNavigation() {
  initializeHeaderEvents();
  initializeHamburgerMenu();

  if (typeof bindLogoEasterEggButton === 'function') {
    bindLogoEasterEggButton();
  }

  if (typeof scheduleInitAuthHeader === 'function') {
    await scheduleInitAuthHeader();
  }
}

window.initEvilNavigation = initEvilNavigation;

function loadHeaderComponent() {
  if (!hasEmbeddedHeader()) {
    fetch('/html/components/header.html')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((headerHTML) => {
        const headerElement = document.querySelector('header');
        const mainElement = document.querySelector('main');
        if (headerElement) headerElement.outerHTML = headerHTML;
        else if (mainElement) mainElement.insertAdjacentHTML('beforebegin', headerHTML);
        else document.body.insertAdjacentHTML('afterbegin', headerHTML);
        return initEvilNavigation();
      })
      .catch((err) => console.error('[Header Component]', err));
    return;
  }
  initEvilNavigation();
}

if (!window.__evilHeaderLoaderStarted) {
  window.__evilHeaderLoaderStarted = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHeaderComponent);
  } else {
    loadHeaderComponent();
  }
}
