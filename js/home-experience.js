/**
 * EVIL Home v6 — effetti cinematic (backup v5: backups/home-version-5/)
 */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PALETTE = [
    [0, 255, 156],
    [56, 189, 248],
    [167, 139, 250],
    [245, 158, 11]
  ];

  function initSplash() {
    const key = 'evil-home-visited';
    const el = document.getElementById('splash-screen');
    if (!el) return;

    if (new URLSearchParams(location.search).get('reset-splash') === 'true') {
      localStorage.removeItem(key);
    }
    if (localStorage.getItem(key)) {
      el.style.display = 'none';
      return;
    }

    localStorage.setItem(key, 'true');
    el.innerHTML = `
      <div class="splash-matrix" id="splash-matrix"></div>
      <div class="scan-lines"></div>
      <div id="splash-content">
        <div class="glitch-text">EVIL</div>
        <div class="splash-text" id="splash-status">Caricamento...</div>
        <div class="splash-progress"><div class="splash-progress-bar"></div></div>
      </div>`;

    const matrix = document.getElementById('splash-matrix');
    if (matrix) {
      const chars = '01ｱｲｳｴｵアイウエオ';
      for (let i = 0; i < 40; i++) {
        const s = document.createElement('div');
        s.className = 'splash-matrix-char';
        s.textContent = chars[Math.floor(Math.random() * chars.length)];
        s.style.left = Math.random() * 100 + '%';
        s.style.animationDuration = 2 + Math.random() * 2 + 's';
        s.style.animationDelay = Math.random() * 1.2 + 's';
        matrix.appendChild(s);
      }
    }

    const status = document.getElementById('splash-status');
    ['Avvio piattaforma...', 'Pronto.'].forEach((t, i) => {
      setTimeout(() => {
        if (status) status.textContent = t;
      }, i * 900);
    });

    setTimeout(() => {
      el.classList.add('hidden');
      setTimeout(() => {
        el.style.display = 'none';
      }, 900);
    }, 2200);
  }

  function initHeroCanvas() {
    const canvas = document.getElementById('home-hero-canvas');
    if (!canvas || reduced) return;

    const ctx = canvas.getContext('2d');
    const nodes = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
      const n = w < 500 ? 14 : 24;
      nodes.length = 0;
      for (let i = 0; i < n; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach((a) => {
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(0, 255, 156, ${0.12 * (1 - d / 130)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else draw();
    });
  }

  function initHeroFocus() {
    const hero = document.getElementById('home-hero');
    if (!hero) return;

    const start = () => hero.classList.add('hero-ready');

    if (reduced) {
      start();
      return;
    }

    const splash = document.getElementById('splash-screen');
    const splashVisible =
      splash &&
      splash.style.display !== 'none' &&
      !splash.classList.contains('hidden');

    setTimeout(start, splashVisible ? 2300 : 100);
  }

  function initBgCanvas() {
    const canvas = document.getElementById('home-bg-canvas');
    if (!canvas || reduced) return;

    const ctx = canvas.getContext('2d');
    const particles = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let mx = 0.5;
    let my = 0.5;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const n = Math.min(72, Math.floor((w * h) / 24000));
      particles.length = 0;
      for (let i = 0; i < n; i++) {
        const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          r: 0.6 + Math.random() * 1.4,
          rgb: c,
          a: 0.06 + Math.random() * 0.1
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const pullX = (mx - 0.5) * 12;
      const pullY = (my - 0.5) * 12;

      particles.forEach((p) => {
        p.x += p.vx + pullX * 0.02;
        p.y += p.vy + pullY * 0.02;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 100) {
            const t = 1 - d / 100;
            ctx.strokeStyle = `rgba(${a.rgb[0]}, ${a.rgb[1]}, ${a.rgb[2]}, ${0.06 * t})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        ctx.fillStyle = `rgba(${p.rgb[0]}, ${p.rgb[1]}, ${p.rgb[2]}, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX / window.innerWidth;
      my = e.clientY / window.innerHeight;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else draw();
    });
  }

  function initAmbientParallax() {
    if (reduced) return;
    const ambient = document.querySelector('.home-ambient');
    const meshWrap = document.getElementById('home-backdrop-mesh-wrap');
    if (!ambient) return;

    document.addEventListener('mousemove', (e) => {
      const tx = (e.clientX / window.innerWidth - 0.5) * 18;
      const ty = (e.clientY / window.innerHeight - 0.5) * 18;
      ambient.style.transform = `translate(${tx}px, ${ty}px)`;
      if (meshWrap) {
        const mx = (e.clientX / window.innerWidth - 0.5) * 24;
        const my = (e.clientY / window.innerHeight - 0.5) * 24;
        meshWrap.style.setProperty('--mesh-pan-x', mx + 'px');
        meshWrap.style.setProperty('--mesh-pan-y', my + 'px');
      }
    });
  }

  function initSpotlightGlow() {
    if (reduced) return;
    document.querySelectorAll('.spotlight-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        card.style.setProperty('--spot-x', x + '%');
        card.style.setProperty('--spot-y', y + '%');
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--spot-x', '50%');
        card.style.setProperty('--spot-y', '50%');
      });
    });
  }

  function initPortalGlow() {
    if (reduced) return;
    document.querySelectorAll('.portal-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        card.style.setProperty('--pg-x', x + '%');
        card.style.setProperty('--pg-y', y + '%');
      });
    });
  }

  function initPortalTilt() {
    if (reduced) return;
    document.querySelectorAll('.portal-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--portal-tilt-y', x * 7 + 'deg');
        card.style.setProperty('--portal-tilt-x', -y * 7 + 'deg');
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--portal-tilt-x', '0deg');
        card.style.setProperty('--portal-tilt-y', '0deg');
      });
    });
  }

  function initPortalsLive() {
    const section = document.getElementById('home-portals');
    if (!section || reduced) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            section.classList.add('portals-live');
            obs.unobserve(section);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(section);
  }

  function initReveal() {
    document.body.classList.add('motion-on');

    document.querySelectorAll('.home-reveal').forEach((el) => {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('is-visible');
              obs.unobserve(e.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
      );
      obs.observe(el);
    });
  }

  function initPortalActive() {
    if (reduced) return;
    document.querySelectorAll('.portal-card').forEach((card) => {
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            card.classList.toggle('is-active', e.isIntersecting);
          });
        },
        { threshold: 0.35 }
      );
      obs.observe(card);
    });
  }

  function initJumpNav() {
    const links = document.querySelectorAll('.home-jump-link');
    if (!links.length) return;

    const sections = [
      document.getElementById('home-showcase'),
      document.getElementById('home-portals'),
      document.getElementById('starters-title')?.closest('.home-starters')
    ].filter(Boolean);

    const setActive = () => {
      const y = window.scrollY + window.innerHeight * 0.35;
      let idx = 0;
      sections.forEach((sec, i) => {
        if (sec.offsetTop <= y) idx = i;
      });
      links.forEach((link, i) => {
        link.classList.toggle('is-current', i === idx);
      });
    };

    setActive();
    window.addEventListener('scroll', setActive, { passive: true });
  }

  function initFooter() {
    const footer = document.getElementById('site-footer') || document.getElementById('home-footer');
    if (!footer) return;
    footer.classList.add('visible', 'is-visible');
    footer.style.opacity = '1';
  }

  function initBackdropScroll() {
    if (reduced) return;
    const wrap = document.getElementById('home-backdrop-mesh-wrap');
    if (!wrap) return;

    let ticking = false;
    window.addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          wrap.style.setProperty('--mesh-scroll', window.scrollY * 0.08 + 'px');
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  function ensureFooterVisible() {
    const footer = document.getElementById('site-footer') || document.getElementById('home-footer');
    if (footer) {
      footer.classList.add('visible', 'is-visible');
      footer.style.opacity = '1';
    }
  }

  function initShowcaseLive() {
    const section = document.getElementById('home-showcase');
    if (!section || reduced) return;

    const narrow = window.matchMedia('(max-width: 992px)').matches;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            section.classList.add('showcase-live');
            obs.unobserve(section);
          }
        });
      },
      {
        threshold: narrow ? 0.06 : 0.15,
        rootMargin: narrow ? '0px 0px -8px 0px' : '0px 0px -40px 0px',
      }
    );
    obs.observe(section);
  }

  function initSpotlightTilt() {
    if (reduced) return;
    document.querySelectorAll('.spotlight-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        card.style.setProperty('--spot-x', `${x}%`);
        card.style.setProperty('--spot-y', `${y}%`);
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--spot-tilt-y', `${px * 7}deg`);
        card.style.setProperty('--spot-tilt-x', `${-py * 5}deg`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--spot-x', '50%');
        card.style.setProperty('--spot-y', '50%');
        card.style.setProperty('--spot-tilt-x', '0deg');
        card.style.setProperty('--spot-tilt-y', '0deg');
      });
    });
  }

  function initStartersLive() {
    const section = document.getElementById('home-starters');
    if (!section || reduced) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            section.classList.add('starters-live');
            obs.unobserve(section);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    obs.observe(section);
  }

  function initStarterGlow() {
    if (reduced) return;
    document.querySelectorAll('.home-starter-card').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 100;
        const y = ((e.clientY - r.top) / r.height) * 100;
        card.style.setProperty('--starter-x', `${x}%`);
        card.style.setProperty('--starter-y', `${y}%`);
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--starter-tilt-y', `${px * 8}deg`);
        card.style.setProperty('--starter-tilt-x', `${-py * 6}deg`);
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--starter-x', '50%');
        card.style.setProperty('--starter-y', '50%');
        card.style.setProperty('--starter-tilt-x', '0deg');
        card.style.setProperty('--starter-tilt-y', '0deg');
      });
    });
  }

  function boot() {
    ensureFooterVisible();
    initSplash();
    initHeroCanvas();
    initHeroFocus();
    initBgCanvas();
    initBackdropScroll();
    initAmbientParallax();
    initSpotlightGlow();
    initSpotlightTilt();
    initShowcaseLive();
    initPortalGlow();
    initPortalTilt();
    initPortalsLive();
    initStartersLive();
    initStarterGlow();
    initReveal();
    initPortalActive();
    initJumpNav();
    initFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
