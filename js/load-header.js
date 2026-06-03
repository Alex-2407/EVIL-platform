/**
 * Load Header Component
 * Carica il header consolidato e inizializza menu / dropdown / hamburger.
 */
function isMobileNav() {
  return window.matchMedia('(max-width: 992px)').matches;
}

function hasEmbeddedHeader() {
  const header = document.querySelector('header');
  return !!(
    header &&
    header.querySelector('.hamburger-btn') &&
    header.querySelector('nav ul')
  );
}

function initializeHeaderEvents() {
  const nav = document.querySelector('header nav');
  if (!nav || nav.dataset.evilNavBound === '1') return;
  nav.dataset.evilNavBound = '1';

  const dropdownTriggers = nav.querySelectorAll(
    ':scope > ul > li > a[href="#"], :scope > ul > li > a[href=""]'
  );

  dropdownTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      const dropdown = trigger.nextElementSibling;
      if (!dropdown || !dropdown.classList.contains('dropdown')) return;

      e.preventDefault();
      const li = trigger.closest('li');

      if (isMobileNav()) {
        const willOpen = !li.classList.contains('dropdown-open');
        nav.querySelectorAll('li.dropdown-open').forEach((openLi) => {
          if (openLi !== li) {
            openLi.classList.remove('dropdown-open');
            const d = openLi.querySelector('.dropdown');
            if (d) d.style.display = 'none';
          }
        });
        li.classList.toggle('dropdown-open', willOpen);
        dropdown.style.display = willOpen ? 'block' : 'none';
      } else {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
      }
    });
  });

  if (!window.__evilNavResizeBound) {
    window.__evilNavResizeBound = true;
    window.addEventListener('resize', () => {
      if (!isMobileNav()) {
        document.querySelectorAll('header nav li.dropdown-open').forEach((li) => {
          li.classList.remove('dropdown-open');
          const d = li.querySelector('.dropdown');
          if (d) d.style.display = '';
        });
      }
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
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      const href = link.getAttribute('href');
      if (href === '#' || href === '') return;
      hamburgerBtn.classList.remove('active');
      nav.classList.remove('active');
      hamburgerBtn.setAttribute('aria-expanded', 'false');
      nav.querySelectorAll('li.dropdown-open').forEach((li) => {
        li.classList.remove('dropdown-open');
        const d = li.querySelector('.dropdown');
        if (d) d.style.display = 'none';
      });
    });
  });

  if (!window.__evilNavEscapeBound) {
    window.__evilNavEscapeBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const btn = document.querySelector('header .hamburger-btn');
      const menu = document.querySelector('header nav');
      if (!btn || !menu || !menu.classList.contains('active')) return;
      btn.classList.remove('active');
      menu.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
  }
}

function initEvilNavigation() {
  initializeHeaderEvents();
  initializeHamburgerMenu();

  if (typeof bindLogoEasterEggButton === 'function') {
    bindLogoEasterEggButton();
  }

  if (typeof initAuthHeader === 'function') {
    initAuthHeader();
  }
}

window.initEvilNavigation = initEvilNavigation;

async function loadHeaderComponent() {
  if (window.__evilHeaderReady) {
    initEvilNavigation();
    return;
  }

  try {
    if (!hasEmbeddedHeader()) {
      const headerPath = '/html/components/header.html';
      const response = await fetch(headerPath);
      if (!response.ok) throw new Error(`Failed to load header: ${response.status}`);

      const headerHTML = await response.text();
      const headerElement = document.querySelector('header');
      const mainElement = document.querySelector('main');

      if (headerElement) {
        headerElement.outerHTML = headerHTML;
      } else if (mainElement) {
        mainElement.insertAdjacentHTML('beforebegin', headerHTML);
      } else {
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
      }
    }

    initEvilNavigation();
    window.__evilHeaderReady = true;
    console.log('[Header Component] ✓ Navigation ready');
  } catch (error) {
    console.error('[Header Component] ✗ Error:', error);
    if (hasEmbeddedHeader()) {
      initEvilNavigation();
      window.__evilHeaderReady = true;
    }
  }
}

if (!window.__evilHeaderLoaderStarted) {
  window.__evilHeaderLoaderStarted = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadHeaderComponent);
  } else {
    loadHeaderComponent();
  }
}
