/**
 * Matrix rain + logo easter egg
 * Easter egg: animazione → 3s con "PROJECT EVIL" visibile → fade → home
 */
(function () {
  'use strict';

  let animationFrameId = null;
  let animationRunId = 0;
  let easterEggActive = false;
  let endTimers = [];

  const INTRO_MS = 700;
  const WORD_FORM_MS = 2800;
  const WORD_HOLD_MS = 3000;
  const SAFETY_MS = 12000;

  function clearEndTimers() {
    endTimers.forEach((id) => clearTimeout(id));
    endTimers = [];
  }

  function scheduleEnd(fn, ms) {
    endTimers.push(setTimeout(fn, ms));
  }

  function stopMatrixRain() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    easterEggActive = false;
  }

  function getElements() {
    return {
      canvas: document.getElementById('matrix-canvas'),
      overlay: document.getElementById('fade-overlay')
    };
  }

  function isOnHomePage() {
    const path = window.location.pathname.toLowerCase();
    return path === '/' || path.endsWith('/home.html') || path.endsWith('/html/home.html');
  }

  function hideMatrixVisuals() {
    const { canvas, overlay } = getElements();
    if (canvas) {
      canvas.style.display = 'none';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (overlay) {
      overlay.style.pointerEvents = 'none';
    }
  }

  function finishLogoEasterEgg() {
    if (!easterEggActive) return;

    clearEndTimers();
    stopMatrixRain();
    easterEggActive = false;

    const { canvas, overlay } = getElements();
    if (canvas) canvas.style.display = 'none';

    if (overlay) {
      overlay.style.display = 'block';
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
      overlay.style.transition = 'opacity 0.6s ease';
    }

    scheduleEnd(() => {
      if (!isOnHomePage()) {
        window.location.href = '/';
        return;
      }
      if (overlay) {
        overlay.style.opacity = '0';
        scheduleEnd(() => {
          overlay.style.display = 'none';
        }, 600);
      }
    }, 500);
  }

  function startMatrixRain(runId) {
    const { canvas } = getElements();
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const fontSize = 24;
    const columns = Math.max(1, Math.floor(canvas.width / fontSize));
    const drops = Array(columns).fill(1);

    const word = 'PROJECT EVIL';
    const wordStart = Math.max(0, Math.floor((columns - word.length) / 2));
    const wordEnd = wordStart + word.length;
    const midY = Math.floor(canvas.height / 2 / fontSize) * fontSize;
    const evilY = Array(word.length).fill(0);

    let frame = 0;

    function draw() {
      if (!easterEggActive || runId !== animationRunId) {
        animationFrameId = null;
        return;
      }

      ctx.fillStyle = 'rgba(11, 15, 26, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const isWordCol = frame >= 60 && i >= wordStart && i < wordEnd;
        const idx = i - wordStart;

        if (isWordCol && idx >= 0 && idx < word.length) {
          if (evilY[idx] < midY) {
            evilY[idx] = Math.min(midY, evilY[idx] + fontSize);
          }
          ctx.fillStyle = '#00ff9c';
          ctx.fillText(word[idx], i * fontSize, evilY[idx]);
        } else {
          ctx.fillStyle = '#00ff9c';
          ctx.fillText(
            letters[Math.floor(Math.random() * letters.length)],
            i * fontSize,
            drops[i] * fontSize
          );
          if (Math.random() > 0.975 || drops[i] * fontSize > canvas.height) {
            drops[i] = 0;
          }
          drops[i]++;
        }
      }

      frame++;
      animationFrameId = requestAnimationFrame(draw);
    }

    draw();
  }

  window.playLogoEasterEgg = function playLogoEasterEgg() {
    const { canvas, overlay } = getElements();

    if (!canvas || !overlay) {
      window.location.href = '/';
      return;
    }

    if (easterEggActive) return;

    clearEndTimers();
    stopMatrixRain();
    animationRunId += 1;
    const runId = animationRunId;
    easterEggActive = true;

    overlay.style.transition = 'opacity 0.5s ease';
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    canvas.style.display = 'none';

    scheduleEnd(() => {
      if (!easterEggActive || runId !== animationRunId) return;

      overlay.style.display = 'none';
      canvas.style.display = 'block';
      startMatrixRain(runId);

      scheduleEnd(() => {
        if (easterEggActive && runId === animationRunId) {
          finishLogoEasterEgg();
        }
      }, WORD_FORM_MS + WORD_HOLD_MS);
    }, INTRO_MS);

    scheduleEnd(() => {
      if (easterEggActive && runId === animationRunId) {
        finishLogoEasterEgg();
      }
    }, INTRO_MS + SAFETY_MS);
  };

  window.toggleMatrix = function toggleMatrix() {
    playLogoEasterEgg();
  };

  window.stopMatrixRain = function () {
    clearEndTimers();
    easterEggActive = false;
    stopMatrixRain();
    hideMatrixVisuals();
  };

  function bindLogoEasterEggButton() {
    const btn = document.getElementById('matrix-btn');
    if (!btn || btn.dataset.easterBound === '1') return;
    btn.dataset.easterBound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      playLogoEasterEgg();
    });
  }

  window.bindLogoEasterEggButton = bindLogoEasterEggButton;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindLogoEasterEggButton);
  } else {
    bindLogoEasterEggButton();
  }
})();
