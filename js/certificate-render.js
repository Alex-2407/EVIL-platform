/* Utility condivise per rappresentare le impronte dei diplomi nel browser. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var instance = 0;

  function svgElement(name, attrs) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function drawFingerprint(mount, fingerprint, label) {
    if (!mount || !fingerprint || !Array.isArray(fingerprint.paths)) throw new Error('Impronta grafica non valida.');
    var svg = svgElement('svg', {
      viewBox: fingerprint.viewBox || '0 0 480 480',
      role: 'img',
      'aria-label': label,
      focusable: 'false',
    });
    var title = svgElement('title');
    title.textContent = label;
    svg.appendChild(title);
    var defs = svgElement('defs');
    var circle = fingerprint.microCircle || { d: '', r: 198 };
    var circleId = 'cert-micro-' + (++instance);
    defs.appendChild(svgElement('path', { id: circleId, d: circle.d }));
    svg.appendChild(defs);

    fingerprint.paths.forEach(function (item) {
      if (typeof item.d !== 'string' || !/^M[\d .-]/.test(item.d)) return;
      svg.appendChild(svgElement('path', {
        d: item.d,
        fill: 'none',
        stroke: item.stroke,
        'stroke-width': String(item.width),
        opacity: String(item.opacity),
        'vector-effect': 'non-scaling-stroke',
      }));
    });

    if (fingerprint.microtext) {
      var text = svgElement('text', {
        fill: fingerprint.colors && fingerprint.colors.secondary || '#00ff9c',
        'font-family': 'monospace',
        'font-size': '5.5',
        'letter-spacing': '0.55',
        'aria-hidden': 'true',
      });
      var textPath = svgElement('textPath', { href: '#' + circleId, startOffset: '50%', 'text-anchor': 'middle' });
      textPath.textContent = fingerprint.microtext;
      text.appendChild(textPath);
      svg.appendChild(text);
    }
    mount.replaceChildren(svg);
  }

  function drawQr(mount, svg, label) {
    if (!mount || typeof svg !== 'string' || !svg.startsWith('<svg')) throw new Error('QR del diploma non valido.');
    var image = document.createElement('img');
    image.alt = label;
    image.width = 180;
    image.height = 180;
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    mount.replaceChildren(image);
  }

  function formatDate(value, lang) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || '—');
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  window.EVIL_CERTIFICATE_UI = { drawFingerprint: drawFingerprint, drawQr: drawQr, formatDate: formatDate };
})();
