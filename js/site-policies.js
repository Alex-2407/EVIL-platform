(function () {
  'use strict';

  const canvas = document.getElementById('policy-particles');
  const sections = document.querySelectorAll('.policy-reveal');
  const tocLinks = document.querySelectorAll('.policy-toc a[data-section]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reducedMotion && canvas && window.EvilParticles) {
    window.EvilParticles.start(canvas, {
      count: 48,
      speed: 0.075,
      radius: [0.6, 1.8],
      link: 140,
      linkAlpha: 0.06,
      lineWidth: 0.5,
      dot: (p) => `rgba(148, 163, 184, ${(0.15 + p.seed * 0.25).toFixed(3)})`,
      line: () => 'rgb(52, 211, 153)',
    });
  }

  if (sections.length && !reducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible');
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    sections.forEach((el) => io.observe(el));
  } else {
    sections.forEach((el) => el.classList.add('is-visible'));
  }

  if (tocLinks.length) {
    const ids = Array.from(tocLinks).map((a) => a.getAttribute('data-section'));
    const targets = ids.map((id) => document.getElementById(id)).filter(Boolean);

    // posizioni lette una volta (e quando cambia la pagina), non a ogni evento di scroll
    let tops = [];
    let ticking = false;
    let active = null;
    const measure = () => {
      tops = targets.map((el) => [el.id, el.getBoundingClientRect().top + window.scrollY]);
    };

    function updateToc() {
      ticking = false;
      const y = window.scrollY + 120;
      let current = tops[0]?.[0];
      for (const [id, top] of tops) {
        if (top <= y) current = id;
      }
      if (current === active) return;
      active = current;
      tocLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('data-section') === current);
      });
    }

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateToc);
        }
      },
      { passive: true }
    );
    window.addEventListener('resize', () => {
      measure();
      updateToc();
    });
    window.addEventListener('load', () => {
      measure();
      updateToc();
    });
    measure();
    updateToc();
  }
})();
