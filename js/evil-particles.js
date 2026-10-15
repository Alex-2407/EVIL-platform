/**
 * Rete di particelle sullo sfondo (home, Centro quiz, pagine di contenuto).
 *
 *   window.EvilParticles.start(canvas, {
 *     count: 48,                      // oppure density: px² per particella (si adatta allo schermo)
 *     max: 80,                        // tetto quando si usa density
 *     speed: 0.15,                    // spostamento massimo per fotogramma (a 60 fps)
 *     radius: [0.6, 1.8],             // raggio min e max dei punti
 *     link: 140,                      // distanza massima di una linea
 *     linkAlpha: 0.06,                // opacità di una linea a distanza 0
 *     dpr: 1,                         // densità di pixel massima del canvas
 *     lineWidth: 0.5,
 *     dot: (p) => 'rgba(...)',        // colore del punto (calcolato una volta per punto)
 *     line: (a, b) => 'rgb(...)',     // colore base della linea, senza opacità (facoltativo)
 *     repel: 0,                       // raggio entro cui i punti si allontanano dal puntatore
 *     still: false,                   // true: un solo fotogramma fermo (movimento ridotto)
 *   });
 *
 * Ottimizzato rispetto alle versioni precedenti, con lo stesso aspetto:
 * distanze confrontate al quadrato (la radice solo per le coppie vicine), linee
 * raggruppate per colore e opacità (poche chiamate a stroke() invece di una per
 * linea), colori dei punti calcolati una volta, movimento proporzionale al tempo
 * trascorso, pausa quando la scheda non è visibile.
 */
(function () {
  'use strict';

  var ALPHA_STEPS = 24; // livelli di opacità delle linee: differenza invisibile, molte meno chiamate

  function start(canvas, opts) {
    if (!canvas || !canvas.getContext) return null;
    var o = opts || {};
    var ctx = canvas.getContext('2d');
    var dprMax = o.dpr || 1;
    var dpr = 1;
    var w = 0;
    var h = 0;
    var pts = [];
    var running = true;
    var raf = 0;
    var last = 0;
    var mouseX = -1e9;
    var mouseY = -1e9;
    var r0 = (o.radius && o.radius[0]) || 1;
    var r1 = (o.radius && o.radius[1]) || r0;
    var linkBase = o.link || 120;
    var linkAlpha = o.linkAlpha == null ? 0.08 : o.linkAlpha;
    var speed = o.speed || 0.2;
    var lineWidth = o.lineWidth || 1;
    var repelBase = o.repel || 0;
    var lineColor = o.line || null;
    var stroke = Object.create(null); // chiave colore|livello -> [x1,y1,x2,y2,...]

    function particleCount() {
      if (o.density) {
        var n = Math.round((window.innerWidth * window.innerHeight) / o.density);
        return Math.min(o.max || n, n);
      }
      return o.count || 48;
    }

    function makePoints() {
      var n = particleCount();
      pts = new Array(n);
      for (var i = 0; i < n; i++) {
        var p = {
          x: Math.random() * w,
          y: Math.random() * h,
          r: (r0 + Math.random() * (r1 - r0)) * dpr,
          vx: (Math.random() - 0.5) * 2 * speed * dpr,
          vy: (Math.random() - 0.5) * 2 * speed * dpr,
          seed: Math.random(),
        };
        p.fill = o.dot ? o.dot(p) : 'rgba(148,163,184,0.3)';
        pts[i] = p;
      }
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, dprMax);
      w = canvas.width = Math.round(window.innerWidth * dpr);
      h = canvas.height = Math.round(window.innerHeight * dpr);
      makePoints();
    }

    function frame(now) {
      raf = 0;
      if (!running) return;
      // passo proporzionale al tempo: stessa velocità anche se il browser rallenta
      var dt = last ? Math.min((now - last) / 16.667, 3) : 1;
      last = now;

      var link = linkBase * dpr;
      var link2 = link * link;
      var repel = repelBase * dpr;
      var repel2 = repel * repel;
      var n = pts.length;
      var i, j, p, q;

      ctx.clearRect(0, 0, w, h);

      // movimento
      for (i = 0; i < n && !o.still; i++) {
        p = pts[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > w) p.vx = -p.vx;
        if (p.y < 0 || p.y > h) p.vy = -p.vy;
        if (repel2) {
          var mx = mouseX - p.x;
          var my = mouseY - p.y;
          if (mx * mx + my * my < repel2) {
            p.x -= mx * 0.004 * dt;
            p.y -= my * 0.004 * dt;
          }
        }
      }

      // linee raggruppate per colore e livello di opacità
      for (var k in stroke) stroke[k].length = 0;
      for (i = 0; i < n; i++) {
        p = pts[i];
        for (j = i + 1; j < n; j++) {
          q = pts[j];
          var dx = p.x - q.x;
          if (dx > link || dx < -link) continue;
          var dy = p.y - q.y;
          var d2 = dx * dx + dy * dy;
          if (d2 >= link2) continue;
          var level = Math.round((1 - Math.sqrt(d2) / link) * ALPHA_STEPS);
          if (level <= 0) continue;
          var key = (lineColor ? lineColor(p, q) : 'rgb(125,211,252)') + '|' + level;
          (stroke[key] || (stroke[key] = [])).push(p.x, p.y, q.x, q.y);
        }
      }
      ctx.lineWidth = lineWidth * dpr;
      for (var key2 in stroke) {
        var seg = stroke[key2];
        if (!seg.length) continue;
        var sep = key2.lastIndexOf('|');
        var base = key2.slice(0, sep);
        var a = (Number(key2.slice(sep + 1)) / ALPHA_STEPS) * linkAlpha;
        ctx.strokeStyle = base.replace(/^rgb\(/, 'rgba(').replace(/^hsl\(/, 'hsla(').replace(/\)$/, ',' + a.toFixed(4) + ')');
        ctx.beginPath();
        for (var s = 0; s < seg.length; s += 4) {
          ctx.moveTo(seg[s], seg[s + 1]);
          ctx.lineTo(seg[s + 2], seg[s + 3]);
        }
        ctx.stroke();
      }

      // punti raggruppati per colore
      var byFill = Object.create(null);
      for (i = 0; i < n; i++) {
        p = pts[i];
        (byFill[p.fill] || (byFill[p.fill] = [])).push(p);
      }
      for (var f in byFill) {
        ctx.fillStyle = f;
        ctx.beginPath();
        var list = byFill[f];
        for (i = 0; i < list.length; i++) {
          p = list[i];
          ctx.moveTo(p.x + p.r, p.y);
          ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        }
        ctx.fill();
      }

      if (!o.still) raf = requestAnimationFrame(frame);
    }

    function play() {
      if (raf || !running) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    }

    var resizeTimer = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          resize();
          if (o.still) play();
        }, 120);
      },
      { passive: true }
    );
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) play();
    });
    if (repelBase) {
      window.addEventListener(
        'pointermove',
        function (e) {
          mouseX = e.clientX * dpr;
          mouseY = e.clientY * dpr;
        },
        { passive: true }
      );
    }

    resize();
    play();
    return {
      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }

  window.EvilParticles = { start: start };
})();
