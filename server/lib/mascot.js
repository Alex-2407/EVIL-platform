'use strict';
/**
 * Lù, la lucciola dell'area "Per tutti" (docs/evil-per-tutti/STILE.md).
 * SVG in linea: i colori vengono dai token CSS (--lu-glow cambia con l'umore) e le animazioni da
 * css/per-tutti.css, che le spegne con prefers-reduced-motion. Personaggio originale di EVIL.
 */

let seq = 0;

const LABEL = {
  it: 'Lù, la lucciola di EVIL. Toccala!',
  en: 'Lu, EVIL’s firefly. Give it a tap!',
};

/** Solo il disegno. `uid` rende unici gli id dei gradienti se Lù compare più volte nella pagina. */
function mascotSvg(uid) {
  const g = `lu-glow-${uid}`;
  const t = `lu-tail-${uid}`;
  return `<svg class="lu" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="${g}" cx="50%" cy="50%" r="50%">
      <stop offset="0" style="stop-color:var(--lu-glow);stop-opacity:.9"/>
      <stop offset=".55" style="stop-color:var(--lu-glow);stop-opacity:.35"/>
      <stop offset="1" style="stop-color:var(--lu-glow);stop-opacity:0"/>
    </radialGradient>
    <radialGradient id="${t}" cx="45%" cy="35%" r="70%">
      <stop offset="0" style="stop-color:#FFFFF4"/>
      <stop offset=".35" style="stop-color:#FFFBD6"/>
      <stop offset=".75" style="stop-color:var(--lu-glow)"/>
      <stop offset="1" style="stop-color:var(--lu-glow-deep)"/>
    </radialGradient>
  </defs>
  <g class="lu__float">
    <circle class="lu__halo" cx="60" cy="88" r="38" fill="url(#${g})"/>
    <path class="lu__spark lu__spark--a" d="M27 84 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6z"/>
    <path class="lu__spark lu__spark--b" d="M93 76 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3z"/>
    <path class="lu__spark lu__spark--c" d="M88 104 l1.1 2.6 2.6 1.1 -2.6 1.1 -1.1 2.6 -1.1 -2.6 -2.6 -1.1 2.6 -1.1z"/>
    <g class="lu__wings">
      <ellipse class="lu__wing lu__wing--l" cx="39" cy="62" rx="10.5" ry="20" transform="rotate(-42 39 62)"/>
      <ellipse class="lu__wing lu__wing--r" cx="81" cy="62" rx="10.5" ry="20" transform="rotate(42 81 62)"/>
    </g>
    <ellipse class="lu__tail" cx="60" cy="89" rx="15.5" ry="17.5" fill="url(#${t})"/>
    <path class="lu__elytron" d="M49 68 C40 74 36.5 87 40.5 99 C44.5 94.5 49.5 84 55 71.5 Z"/>
    <path class="lu__elytron" d="M71 68 C80 74 83.5 87 79.5 99 C75.5 94.5 70.5 84 65 71.5 Z"/>
    <ellipse class="lu__collar" cx="60" cy="69" rx="14.5" ry="6.2"/>
    <path class="lu__antenna" d="M53 33 Q49 22 41 18"/>
    <path class="lu__antenna" d="M67 33 Q71 22 79 18"/>
    <circle class="lu__tip" cx="41" cy="18" r="3.2"/>
    <circle class="lu__tip" cx="79" cy="18" r="3.2"/>
    <circle class="lu__head" cx="60" cy="49" r="21"/>
    <g class="lu__eyes">
      <ellipse class="lu__eye" cx="52" cy="48" rx="6.2" ry="7.2"/>
      <ellipse class="lu__eye" cx="68" cy="48" rx="6.2" ry="7.2"/>
      <circle class="lu__pupil" cx="53" cy="49.2" r="3.5"/>
      <circle class="lu__pupil" cx="69" cy="49.2" r="3.5"/>
      <circle class="lu__shine" cx="54.4" cy="47.6" r="1.2"/>
      <circle class="lu__shine" cx="70.4" cy="47.6" r="1.2"/>
    </g>
    <circle class="lu__cheek" cx="44.5" cy="57" r="3.3"/>
    <circle class="lu__cheek" cx="75.5" cy="57" r="3.3"/>
    <path class="lu__smile" d="M54.5 58.5 Q60 63.5 65.5 58.5"/>
  </g>
</svg>`;
}

/**
 * Lù come pulsante (per le interazioni e gli easter egg di js/per-tutti.js) o come immagine decorativa.
 * @param {string} lang
 * @param {{ interactive?: boolean, mood?: 'idle'|'happy'|'warn'|'help', size?: 'sm'|'md'|'lg' }} [opts]
 */
function renderMascot(lang, opts = {}) {
  seq += 1;
  const mood = ['idle', 'happy', 'warn', 'help'].includes(opts.mood) ? opts.mood : 'idle';
  const size = ['sm', 'md', 'lg'].includes(opts.size) ? opts.size : 'md';
  const cls = `lu-wrap lu-wrap--${size} lu--${mood}`;
  const svg = mascotSvg(seq);
  if (opts.interactive === false) return `<span class="${cls}" data-lu>${svg}</span>`;
  const label = LABEL[lang] || LABEL.it;
  return `<button class="${cls} lu-btn" type="button" data-lu aria-label="${label}">${svg}</button>`;
}

module.exports = { renderMascot, mascotSvg };
