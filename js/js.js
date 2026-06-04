// Carica footer centralizzato; header solo se mancante (non sovrascrivere quello già in pagina)
(async function loadShellComponents() {
  try {
    async function tryFetchText(paths) {
      for (const p of paths) {
        try {
          const r = await fetch(p, { cache: 'no-store' });
          if (r.ok) return await r.text();
        } catch (e) {
          // ignore and try next
        }
      }
      return null;
    }

    const headerCandidates = [
      './components/header.html',
      'components/header.html',
      '../html/components/header.html',
      './html/components/header.html',
      '/html/components/header.html'
    ];

    const footerCandidates = [
      './components/footer.html',
      'components/footer.html',
      '../html/components/footer.html',
      './html/components/footer.html',
      '/html/components/footer.html'
    ];

    const existingHeader = document.querySelector('header');
    const hasModernHeader =
      existingHeader &&
      existingHeader.querySelector('.hamburger-btn') &&
      existingHeader.querySelector('nav ul');

    if (!hasModernHeader) {
      try {
        const headerHTML = await tryFetchText(headerCandidates);
        if (headerHTML) {
          if (existingHeader) existingHeader.outerHTML = headerHTML;
          else document.body.insertAdjacentHTML('afterbegin', headerHTML);
        }
      } catch (e) {
        console.warn('[shell] header non disponibile:', e && e.message ? e.message : e);
      }
    }

    try {
      const existingFooter = document.querySelector('footer');
      const hasSiteFooter =
        existingFooter && existingFooter.classList.contains('evil-site-foot');

      if (!hasSiteFooter) {
        const footerHTML = await tryFetchText(footerCandidates);
        if (footerHTML) {
          if (existingFooter) existingFooter.outerHTML = footerHTML.trim();
          else document.body.insertAdjacentHTML('beforeend', footerHTML.trim());
        }
      }
    } catch (e) {
      console.warn('[shell] footer non disponibile:', e && e.message ? e.message : e);
    }

    try {
      const finalFooter = document.querySelector('footer');
      if (finalFooter) {
        finalFooter.classList.add('visible');
        finalFooter.style.opacity = '1';
      }
    } catch (e) {
      // ignore
    }
  } catch (err) {
    console.error('[shell] errore caricamento componenti:', err);
  }
})();
