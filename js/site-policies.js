(function () {
  'use strict';

  const canvas = document.getElementById('policy-particles');
  const sections = document.querySelectorAll('.policy-reveal');
  const tocLinks = document.querySelectorAll('.policy-toc a[data-section]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reducedMotion && canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    const dots = [];
    const COUNT = 48;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function initDots() {
      dots.length = 0;
      for (let i = 0; i < COUNT; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.6 + Math.random() * 1.2,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          a: 0.15 + Math.random() * 0.25,
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 184, ${d.a})`;
        ctx.fill();
      }
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i];
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            ctx.strokeStyle = `rgba(52, 211, 153, ${0.06 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(tick);
    }

    resize();
    initDots();
    window.addEventListener('resize', () => {
      resize();
      initDots();
    });
    tick();
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

    function updateToc() {
      const y = window.scrollY + 120;
      let current = targets[0]?.id;
      for (const el of targets) {
        if (el.offsetTop <= y) current = el.id;
      }
      tocLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('data-section') === current);
      });
    }

    window.addEventListener('scroll', updateToc, { passive: true });
    updateToc();
  }
})();
