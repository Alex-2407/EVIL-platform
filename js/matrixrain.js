document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('matrix-btn');
    const overlay = document.getElementById('fade-overlay');
    const canvas = document.getElementById('matrix-canvas');
    let animationStarted = false;
  
    btn.addEventListener('click', () => {
      if (animationStarted) return;
      animationStarted = true;
  
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
  
      setTimeout(() => {
        overlay.style.display = 'none';
        canvas.style.display = 'block';
        startMatrixRain();
      }, 700);
    });
  
    function startMatrixRain() {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
  
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
  
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const fontSize = 24;
      const columns = Math.floor(canvas.width / fontSize);
      const drops = Array(columns).fill(1);
  
      let frame = 0;
      const word = 'PROJECT EVIL';
      const wordStart = Math.floor((columns - word.length) / 2);
      const wordEnd = wordStart + word.length;
      const midY = Math.floor(canvas.height / 2 / fontSize) * fontSize;
      const evilY = Array(word.length).fill(0);
      const redirectURL = 'home.html';
  
      function draw() {
        ctx.fillStyle = 'rgba(11, 15, 26, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${fontSize}px monospace`;
  
        for (let i = 0; i < drops.length; i++) {
          const isEvilColumn = frame >= 60 && i >= wordStart && i < wordEnd;
          const idx = i - wordStart;
  
          if (isEvilColumn) {
            if (evilY[idx] < midY) {
              evilY[idx] += fontSize;
              if (evilY[idx] > midY) evilY[idx] = midY;
            }
            ctx.fillStyle = '#00ff9c';
            ctx.fillText(word[idx], i * fontSize, evilY[idx]);
          } else {
            ctx.fillStyle = '#00ff9c';
            const text = letters[Math.floor(Math.random() * letters.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          }
  
          const reachedMid = isEvilColumn && evilY[idx] >= midY;
          if (!reachedMid) {
            if (Math.random() > 0.975 || drops[i] * fontSize > canvas.height) {
              drops[i] = 0;
            }
            drops[i]++;
          }
        }
  
        frame++;
        if (frame < 120) {
          requestAnimationFrame(draw);
        } 
        // DISABILITATO: questa linea causava un loop infinito di redirect
        // else {
        //   window.location.href = redirectURL;
        // }
      }
  
      draw();
    }
  });
  