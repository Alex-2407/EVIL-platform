'use strict';
/**
 * Primi passi, passo 2.13: una scena in tre quadri per ogni tappa (docs/evil-per-tutti/PIANO.md).
 *
 * Illustrazioni originali in SVG, composte da pochi oggetti disegnati qui sotto (telefono, fumetti,
 * lucchetti, chiavi, persone, Lù…). Nelle immagini non c'è testo: le parole stanno nelle didascalie
 * (server/lib/primi-passi-content.js, campo `scene`), così si traducono e si leggono con i lettori di
 * schermo. Le classi a-* attivano movimenti brevi in css/primi-passi.css, solo nel quadro visibile
 * e solo se il movimento non è ridotto.
 */

const C = {
  ink: '#1b2130',
  ink2: '#4a5368',
  card: '#ffffff',
  paper: '#fbf8f1',
  sunk: '#f3eee2',
  line: '#e3dccb',
  yel: '#f4e04d',
  yelD: '#c9a514',
  safe: '#0b6b4b',
  safeB: '#ddf4e9',
  safeL: '#8fd9b6',
  warn: '#8a4b00',
  warnB: '#fff0d1',
  warnL: '#f5c877',
  help: '#c2272f',
  helpB: '#fde3e3',
  info: '#1c5592',
  infoB: '#e2eefb',
  school: '#5b3796',
  schoolB: '#efe8fb',
  wing: '#dce9ff',
  wingL: '#9db4d9',
  shell: '#2e3650',
};

const SKIN = ['#f6d3b3', '#e0a87d', '#b97a50', '#8a5636'];
const HAIR = ['#3b2a20', '#1b2130', '#7a4b2a', '#c9822e'];

const S = `stroke="${C.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const s2 = `stroke="${C.ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

/**
 * Gruppo spostato in (x, y). La classe d'animazione va su un gruppo interno senza `transform`:
 * un'animazione CSS sostituirebbe il transform dell'SVG e l'oggetto salterebbe nell'angolo.
 */
function g(x, y, inner, cls = '', scale = 1) {
  const tr = `translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}`;
  return cls ? `<g transform="${tr}"><g class="${cls}">${inner}</g></g>` : `<g transform="${tr}">${inner}</g>`;
}

// ------------------------------------------------------------------ oggetti

/** Lù in piccolo; mood: idle | happy | warn */
function lu(x, y, s = 1, mood = 'idle', cls = '') {
  const tail = { idle: C.yel, happy: '#7cf2b4', warn: '#ffc14d' }[mood] || C.yel;
  const glow = { idle: 'rgba(244,224,77,.35)', happy: 'rgba(124,242,180,.35)', warn: 'rgba(255,193,77,.35)' }[mood];
  return g(x, y, `
    <circle cx="0" cy="14" r="20" fill="${glow}"/>
    <ellipse cx="-10" cy="3" rx="6.5" ry="11" fill="${C.wing}" stroke="${C.wingL}" stroke-width="1.2" transform="rotate(-38 -10 3)"/>
    <ellipse cx="10" cy="3" rx="6.5" ry="11" fill="${C.wing}" stroke="${C.wingL}" stroke-width="1.2" transform="rotate(38 10 3)"/>
    <ellipse cx="0" cy="15" rx="8.5" ry="9.5" fill="${tail}"/>
    <path d="M-6 6 C-10 10 -10 18 -8 23 C-6 19 -4 13 -2 8 Z M6 6 C10 10 10 18 8 23 C6 19 4 13 2 8 Z" fill="${C.shell}"/>
    <path d="M-3 -13 Q-6 -20 -11 -21 M3 -13 Q6 -20 11 -21" fill="none" ${s2}/>
    <circle cx="-11" cy="-21" r="2.2" fill="${C.yel}" stroke="${C.yelD}" stroke-width=".8"/>
    <circle cx="11" cy="-21" r="2.2" fill="${C.yel}" stroke="${C.yelD}" stroke-width=".8"/>
    <circle cx="0" cy="-4" r="10.5" fill="${C.ink}"/>
    <ellipse cx="-3.8" cy="-5" rx="3.1" ry="3.5" fill="#fff"/><ellipse cx="3.8" cy="-5" rx="3.1" ry="3.5" fill="#fff"/>
    <circle cx="-3.3" cy="-4.4" r="1.6" fill="${C.ink}"/><circle cx="4.3" cy="-4.4" r="1.6" fill="${C.ink}"/>
    <circle cx="-7.2" cy="0" r="1.6" fill="#ff9aa2" opacity=".7"/><circle cx="7.2" cy="0" r="1.6" fill="#ff9aa2" opacity=".7"/>
    <path d="M-3 0.5 Q0 3.5 3 0.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`, `pp-lu ${cls}`.trim(), s);
}

function phone(x, y, screen = '', cls = '', w = 74, h = 128) {
  return g(x, y, `
    <rect x="0" y="0" width="${w}" height="${h}" rx="13" fill="${C.ink}"/>
    <rect x="5" y="10" width="${w - 10}" height="${h - 20}" rx="6" fill="${C.card}"/>
    <rect x="${w / 2 - 9}" y="4" width="18" height="3" rx="1.5" fill="#46506b"/>
    <g transform="translate(5 10)">${screen}</g>`, cls);
}

/**
 * Fumetto con l'angolo in alto a sinistra in (x, y). o.inner: quello che c'è dentro, in coordinate
 * del fumetto, così compare insieme al fumetto quando si anima.
 */
function bubble(x, y, w, h, o = {}) {
  const { fill = C.card, stroke = C.ink, tail = 'left', cls = '', inner = '' } = o;
  const t = tail === 'left' ? `M${12} ${h} l-6 9 l14 -9` : tail === 'right' ? `M${w - 12} ${h} l6 9 l-14 -9` : '';
  return g(x, y, `<rect x="0" y="0" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>${t ? `<path d="${t}" fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/><rect x="${tail === 'left' ? 8 : w - 26}" y="${h - 3}" width="18" height="5" fill="${fill}"/>` : ''}${inner}`, cls);
}

/** Righe di testo finte */
function bars(x, y, widths, color = C.line, gap = 9, hgt = 5) {
  return widths.map((w, i) => `<rect x="${x}" y="${y + i * gap}" width="${w}" height="${hgt}" rx="2.5" fill="${color}"/>`).join('');
}

function lock(x, y, s = 1, fill = C.yel, open = false, cls = '') {
  const sh = open ? 'M-9 -2 V-12 a9 9 0 0 1 17 -4' : 'M-9 -2 V-11 a9 9 0 0 1 18 0 V-2';
  return g(x, y, `<path d="${sh}" fill="none" ${S} stroke-width="4"/>
    <rect x="-14" y="-3" width="28" height="22" rx="5" fill="${fill}" ${S}/>
    <circle cx="0" cy="6" r="3" fill="${C.ink}"/><rect x="-1.3" y="7" width="2.6" height="6" rx="1" fill="${C.ink}"/>`, cls, s);
}

function key(x, y, s = 1, fill = C.yel, rot = 0, cls = '') {
  return g(x, y, `<g transform="rotate(${rot})"><circle cx="-14" cy="0" r="9" fill="${fill}" ${S}/><circle cx="-14" cy="0" r="3" fill="${C.card}" ${s2}/>
    <path d="M-5 0 H18 M12 0 V7 M17 0 V5" fill="none" ${S}/></g>`, cls, s);
}

function shield(x, y, s = 1, fill = C.safeB, mark = 'check', cls = '') {
  const m = mark === 'check' ? `<path d="M-8 1 l6 6 l11 -12" fill="none" stroke="${C.safe}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="a-dash"/>` : '';
  return g(x, y, `<path d="M0 -24 L20 -16 V-2 C20 12 10 20 0 25 C-10 20 -20 12 -20 -2 V-16 Z" fill="${fill}" ${S}/>${m}`, cls, s);
}

function check(x, y, s = 1, color = C.safe, cls = '') {
  return g(x, y, `<circle r="13" fill="${color}"/><path d="M-6 0 l4 4.5 l8 -9" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`, cls, s);
}

function cross(x, y, s = 1, color = C.warn, cls = '') {
  return g(x, y, `<circle r="13" fill="${color}"/><path d="M-5 -5 l10 10 M5 -5 l-10 10" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`, cls, s);
}

function cloud(x, y, s = 1, fill = C.infoB, cls = '') {
  return g(x, y, `<path d="M-26 12 a12 12 0 0 1 2 -24 a16 16 0 0 1 30 -4 a12 12 0 0 1 20 14 a10 10 0 0 1 -4 18 Z" fill="${fill}" ${S}/>`, cls, s);
}

function magnifier(x, y, s = 1, cls = '') {
  return g(x, y, `<circle cx="0" cy="0" r="16" fill="rgba(226,238,251,.55)" ${S} stroke-width="4"/><path d="M12 12 L26 26" ${S} stroke-width="7"/><path d="M-7 -8 a10 10 0 0 1 8 -3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`, cls, s);
}

/**
 * Persona a mezzo busto: i protagonisti delle storie (Martina, Leo, Tommaso…) e gli adulti che aiutano.
 * o.tone: 0-3 (colore della pelle), o.mood: smile | sad | worry | talk, o.long: capelli lunghi.
 */
function person(x, y, o = {}) {
  const { s = 1, tone = 0, mood = 'smile', shirt = C.info, long = false, cls = '' } = o;
  const skin = SKIN[tone % SKIN.length];
  const hair = HAIR[(tone + 1) % HAIR.length];
  const mouth = {
    smile: 'M-5 7 Q0 11 5 7',
    sad: 'M-5 10 Q0 6 5 10',
    worry: 'M-4 9 H4',
    talk: 'M-3 7 Q0 12 3 7 Z',
  }[mood];
  // i capelli lunghi stanno dietro la testa e scendono sulle spalle
  const back = long
    ? `<path d="M-18 -6 C-22 -22 -8 -25 0 -25 C8 -25 22 -22 18 -6 C21 6 22 18 19 27 C14 29 9 27 7 23 H-7 C-9 27 -14 29 -19 27 C-22 18 -21 6 -18 -6 Z" fill="${hair}"/>`
    : '';
  return g(x, y, `
    <path d="M-24 46 C-24 28 -14 22 0 22 C14 22 24 28 24 46 Z" fill="${shirt}" ${S}/>
    ${back}<circle cx="0" cy="0" r="17" fill="${skin}" ${S}/>
    <path d="M-17 -2 C-18 -16 -8 -21 0 -21 C10 -21 18 -15 17 -2 C12 -9 6 -11 -2 -11 C-8 -11 -13 -8 -17 -2 Z" fill="${hair}"/>
    <circle cx="-6" cy="1" r="2.2" fill="${C.ink}"/><circle cx="6" cy="1" r="2.2" fill="${C.ink}"/>
    <path d="${mouth}" fill="${mood === 'talk' ? C.ink : 'none'}" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round"/>`, cls, s);
}

function heart(x, y, s = 1, fill = C.help, cls = '') {
  return g(x, y, `<path d="M0 10 C-14 1 -16 -9 -9 -13 C-5 -15 -1 -13 0 -9 C1 -13 5 -15 9 -13 C16 -9 14 1 0 10 Z" fill="${fill}" ${S} stroke-width="2.5"/>`, cls, s);
}

function gift(x, y, s = 1, cls = '') {
  return g(x, y, `<rect x="-14" y="-6" width="28" height="20" rx="3" fill="${C.help}" ${s2}/><rect x="-16" y="-12" width="32" height="8" rx="2" fill="#e85a62" ${s2}/>
    <path d="M0 -12 V14" stroke="${C.yel}" stroke-width="4"/><path d="M0 -12 C-8 -22 -14 -14 0 -12 C14 -14 8 -22 0 -12" fill="none" stroke="${C.yel}" stroke-width="3"/>`, cls, s);
}

/** Pacco del corriere: scatola di cartone con nastro ed etichetta */
function parcel(x, y, s = 1, cls = '') {
  return g(x, y, `<path d="M-16 -8 L0 -15 L16 -8 L0 -1 Z" fill="#ecc890" ${s2}/>
    <path d="M-16 -8 V10 L0 17 V-1 Z" fill="#d9a865" ${s2}/>
    <path d="M16 -8 V10 L0 17 V-1 Z" fill="#c38c4a" ${s2}/>
    <path d="M-8 -11.5 L8 -4.5 V13.5" fill="none" stroke="#f7ead0" stroke-width="3.5"/>
    <path d="M-13 0.5 L-5 4 V9 L-13 5.5 Z" fill="#fff"/>`, cls, s);
}

function gamepad(x, y, s = 1, cls = '') {
  return g(x, y, `<path d="M-26 -8 C-30 -8 -34 8 -30 14 C-26 19 -20 14 -16 9 H16 C20 14 26 19 30 14 C34 8 30 -8 26 -8 Z" fill="${C.school}" ${S}/>
    <path d="M-20 0 h10 M-15 -5 v10" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="-2" r="2.8" fill="${C.yel}"/><circle cx="21" cy="3" r="2.8" fill="#7cf2b4"/>`, cls, s);
}

function pin(x, y, s = 1, fill = C.help, cls = '') {
  return g(x, y, `<path d="M0 16 C-10 4 -13 -1 -13 -6 a13 13 0 0 1 26 0 C13 -1 10 4 0 16 Z" fill="${fill}" ${S} stroke-width="2.5"/><circle cx="0" cy="-6" r="4.5" fill="#fff"/>`, cls, s);
}

function photo(x, y, w = 70, h = 52, cls = '', extra = '') {
  return g(x, y, `<rect x="0" y="0" width="${w}" height="${h}" rx="5" fill="${C.card}" ${S}/>
    <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="3" fill="${C.infoB}"/>
    <circle cx="${w - 18}" cy="16" r="6" fill="${C.yel}"/>
    <path d="M5 ${h - 5} L${w * 0.35} ${h * 0.45} L${w * 0.55} ${h - 14} L${w * 0.7} ${h * 0.58} L${w - 5} ${h - 5} Z" fill="#8fd9b6"/>${extra}`, cls);
}

function megaphone(x, y, s = 1, cls = '') {
  return g(x, y, `<path d="M-16 -6 L10 -18 V18 L-16 6 Z" fill="${C.yel}" ${S}/><rect x="-24" y="-7" width="9" height="14" rx="3" fill="${C.info}" ${S}/>
    <path d="M-14 6 L-10 18 H-4 L-7 7" fill="${C.info}" ${s2}/><path d="M16 -8 Q22 0 16 8 M20 -14 Q30 0 20 14" fill="none" stroke="${C.yelD}" stroke-width="2.5" stroke-linecap="round"/>`, cls, s);
}

/** Orologio analogico sulle 11 (di notte, nelle storie): niente cifre da tradurre */
function clock(x, y, r = 14, cls = '') {
  return g(x, y, `<circle r="${r}" fill="${C.card}" ${S}/><path d="M0 0 V${-r * 0.62} M0 0 L${-r * 0.32} ${-r * 0.32}" ${S}/><circle r="2" fill="${C.ink}"/>`, cls);
}

function moon(x, y, s = 1, cls = '') {
  return g(x, y, `<path d="M6 -12 A13 13 0 1 0 12 8 A10 10 0 1 1 6 -12 Z" fill="${C.yel}" stroke="${C.yelD}" stroke-width="1.5"/>`, cls, s);
}

function face(x, y, s = 1, kind = 'laugh', cls = '') {
  const inner = kind === 'laugh'
    ? `<path d="M-6 -3 q2 -3 4 0 M2 -3 q2 -3 4 0" fill="none" ${s2}/><path d="M-6 3 Q0 11 6 3 Z" fill="${C.ink}"/>`
    : `<circle cx="-4" cy="-2" r="1.6" fill="${C.ink}"/><circle cx="4" cy="-2" r="1.6" fill="${C.ink}"/><path d="M-4 6 Q0 2 4 6" fill="none" ${s2}/>`;
  return g(x, y, `<circle r="11" fill="${kind === 'laugh' ? C.yel : C.sunk}" ${s2}/>${inner}`, cls, s);
}

function codeDots(x, y, n = 6, cls = '') {
  return g(x, y, Array.from({ length: n }, (_, i) => `<circle cx="${i * 9}" cy="0" r="3" fill="${C.ink}"/>`).join(''), cls);
}

function sparkle(x, y, s = 1, fill = C.yel, cls = '') {
  return g(x, y, `<path d="M0 -10 L2.5 -2.5 L10 0 L2.5 2.5 L0 10 L-2.5 2.5 L-10 0 L-2.5 -2.5 Z" fill="${fill}"/>`, `a-twinkle ${cls}`.trim(), s);
}

function door(x, y, fill = C.sunk, cls = '') {
  return g(x, y, `<rect x="0" y="0" width="56" height="90" rx="4" fill="${fill}" ${S}/><rect x="7" y="8" width="42" height="30" rx="2" fill="none" stroke="${C.line}" stroke-width="2.5"/><circle cx="46" cy="50" r="3.5" fill="${C.ink}"/>`, cls);
}

function laptop(x, y, screen = '', cls = '') {
  return g(x, y, `<rect x="0" y="0" width="96" height="62" rx="6" fill="${C.ink}"/><rect x="5" y="5" width="86" height="52" rx="3" fill="${C.card}"/>
    <path d="M-10 66 H106 L98 74 H-2 Z" fill="#46506b" ${s2}/><g transform="translate(5 5)">${screen}</g>`, cls);
}

function database(x, y, s = 1, cracked = false, cls = '') {
  return g(x, y, `<path d="M-22 -16 V16 C-22 24 22 24 22 16 V-16" fill="${C.sunk}" ${S}/><ellipse cx="0" cy="-16" rx="22" ry="7" fill="${C.card}" ${S}/>
    <path d="M-22 0 C-22 8 22 8 22 0" fill="none" ${s2}/>${cracked ? `<path d="M4 -10 L-2 0 L5 6 L-1 18" fill="none" stroke="${C.help}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`, cls, s);
}

function arrow(x1, y1, x2, y2, color = C.ink2, cls = '') {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - 18;
  const ang = Math.atan2(y2 - my, x2 - mx);
  const a1 = ang + Math.PI * 0.82;
  const a2 = ang - Math.PI * 0.82;
  const h = 9;
  return `<g${cls ? ` class="${cls}"` : ''}><path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 7"/>
    <path d="M${(x2 + h * Math.cos(a1)).toFixed(1)} ${(y2 + h * Math.sin(a1)).toFixed(1)} L${x2} ${y2} L${(x2 + h * Math.cos(a2)).toFixed(1)} ${(y2 + h * Math.sin(a2)).toFixed(1)}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/** Icone di app sullo schermo del telefono */
function appIcons(w, colors) {
  return colors.map((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const size = (w - 16) / 3 - 4;
    return `<rect x="${6 + col * (size + 6)}" y="${8 + row * (size + 6)}" width="${size}" height="${size}" rx="5" fill="${c}"/>`;
  }).join('');
}

/**
 * Un profilo online di cui non si sa chi c'è dietro: sagoma grigia con il punto di domanda.
 * Chi fa del male nelle storie non ha mai un volto (né un colore di pelle): è un profilo, una chiave, un messaggio.
 */
function avatar(x, y, s = 1, cls = '') {
  return g(x, y, `<circle r="20" fill="${C.sunk}" ${S}/><circle cx="0" cy="-5" r="7" fill="#9aa3b5"/><path d="M-12 13 C-11 4 -6 2 0 2 C6 2 11 4 12 13" fill="#9aa3b5"/>
    <circle cx="15" cy="-14" r="8" fill="${C.warn}"/><text x="15" y="-10" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#fff">?</text>`, cls, s);
}

/** Il gruppo della classe: tre cerchi colorati, senza volti */
function group(x, y, s = 1, cls = '') {
  return g(x, y, `<circle cx="-14" cy="0" r="11" fill="${C.infoB}" ${s2}/><circle cx="14" cy="0" r="11" fill="${C.warnB}" ${s2}/><circle cx="0" cy="-8" r="11" fill="${C.safeB}" ${s2}/>`, cls, s);
}

function toggle(x, y, on = true, cls = '') {
  return g(x, y, `<rect x="0" y="0" width="30" height="16" rx="8" fill="${on ? C.safe : C.line}"/><circle cx="${on ? 22 : 8}" cy="8" r="6" fill="#fff"/>`, cls);
}

/** Simbolo dell'aggiornamento: freccia circolare che gira due volte quando il quadro compare */
function updateIcon(x, y) {
  // il cerchio invisibile tiene il centro della rotazione sul centro della freccia
  return g(x, y, `<circle r="15" fill="none"/>
    <path d="M-9.4 -3.4 A10 10 0 1 1 -7.7 6.4" fill="none" stroke="${C.safe}" stroke-width="4" stroke-linecap="round"/>
    <path d="M-10.3 3.3 L-3 5 L-9.8 10.8 Z" fill="${C.safe}" stroke="${C.safe}" stroke-width="1.5" stroke-linejoin="round"/>`, 'a-spin');
}

/** La preside nel video della tappa 9: è la vittima del falso, non chi l'ha fatto */
const HEAD_TEACHER = person(43, 22, { s: 0.55, tone: 1, mood: 'talk', shirt: C.school, long: true });

function frame(inner, bg) {
  return `<svg class="pp-scene-svg" viewBox="0 0 320 200" aria-hidden="true" focusable="false">
  <rect x="0" y="0" width="320" height="200" rx="18" fill="${bg || C.paper}"/>
  <path d="M0 168 H320 V182 a18 18 0 0 1 -18 18 H18 a18 18 0 0 1 -18 -18 Z" fill="${C.sunk}"/>
  ${inner}
</svg>`;
}

// ------------------------------------------------------------------ le scene (tre quadri per tappa)

const SCENES = {
  'cosa-proteggere': [
    () => frame(`
      ${phone(123, 30, appIcons(64, [C.yel, C.info, C.help, '#7cf2b4', C.school, C.warnL, C.safe, '#ff9aa2', C.infoB]))}
      ${sparkle(102, 46, 0.9)}${sparkle(214, 64, 1.1)}${sparkle(208, 132, 0.8)}
      ${heart(92, 110, 0.9, '#ff9aa2', 'a-pop')}${key(224, 104, 0.8, C.yel, -20, 'a-pop a-d1')}
      ${lu(262, 62, 1, 'idle', 'a-float')}`),
    () => frame(`
      ${person(66, 100, { s: 1.05, tone: 1, mood: 'worry', long: true })}
      ${phone(134, 48, `${bars(6, 14, [32, 38, 24], C.line)}${bubble(4, 42, 40, 26, { fill: C.helpB, stroke: C.help, tail: 'right', cls: 'a-pop a-d1' })}`, 'a-slide', 58, 100)}
      ${group(258, 82, 1.1, 'a-pop a-d3')}
      ${arrow(196, 92, 238, 80, C.help)}
      ${arrow(92, 72, 128, 60, C.ink2)}`),
    () => frame(`
      ${phone(114, 34, `${lock(32, 58, 1.2, C.yel, false, 'a-pop')}`)}
      ${shield(222, 92, 1.3, C.safeB, 'check', 'a-pop a-d1')}
      ${lu(66, 70, 1.05, 'happy', 'a-float')}`),
  ],
  password: [
    () => frame(`
      ${door(28, 64, C.infoB)}${door(132, 64, C.safeB)}${door(236, 64, C.warnB)}
      ${key(104, 42, 1.1, C.yel, 0, 'a-float')}
      ${arrow(118, 48, 60, 80)}${arrow(124, 54, 160, 84)}${arrow(130, 48, 262, 80)}`),
    () => frame(`
      ${database(92, 98, 1.5, true, 'a-shake')}
      ${key(170, 70, 0.8, C.yel, 20, 'a-fly')}${key(196, 104, 0.8, C.yel, -10, 'a-fly a-d1')}${key(228, 76, 0.8, C.yel, 35, 'a-fly a-d2')}
      ${face(260, 128, 1.1, 'sad', 'a-pop a-d4')}`),
    () => frame(`
      ${door(30, 64, C.infoB)}${door(132, 64, C.safeB)}${door(234, 64, C.warnB)}
      ${key(58, 40, 0.8, C.info, 0, 'a-pop')}${key(160, 40, 0.8, C.safe, 0, 'a-pop a-d1')}${key(262, 40, 0.8, C.help, 0, 'a-pop a-d2')}
      ${lu(110, 128, 0.7, 'happy', 'a-float')}`),
  ],
  'due-passaggi': [
    () => frame(`
      ${door(132, 52, C.sunk)}
      ${lock(160, 98, 1, C.yel, false)}
      ${key(84, 96, 1.1, C.yel, 0, 'a-slide')}
      ${moon(270, 38, 1)}`),
    () => frame(`
      ${door(70, 52, C.sunk)}
      ${lock(98, 92, 0.9, C.yel, true)}${lock(98, 128, 0.9, C.info, false, 'a-pop a-d3')}
      ${phone(190, 42, `${codeDots(10, 54, 5, 'a-pop')}${bars(8, 72, [46, 30], C.line)}`, '', 66, 112)}
      ${arrow(185, 96, 128, 122)}`),
    () => frame(`
      ${door(80, 52, C.sunk)}
      ${lock(108, 92, 0.9, C.yel, true)}${lock(108, 128, 0.9, C.info, false)}
      ${key(222, 120, 1.15, '#9aa3b5', 0, 'a-shake')}
      ${cross(222, 80, 1, C.warn, 'a-pop')}
      ${arrow(200, 126, 132, 132, '#9aa3b5')}
      ${lu(36, 70, 1, 'happy', 'a-float')}`),
  ],
  'aggiornamenti-backup': [
    () => frame(`
      ${phone(122, 34, `<circle cx="32" cy="50" r="18" fill="${C.safeB}"/>${updateIcon(32, 50)}${bars(10, 82, [44, 30], C.line)}`)}
      ${shield(230, 96, 1.1, C.safeB, 'check', 'a-pop a-d4')}
      ${lu(60, 76, 1, 'idle', 'a-float')}`),
    () => frame(`
      ${phone(40, 40, `${photo(6, 10, 52, 38)}${photo(6, 54, 52, 38)}`, '', 74, 124)}
      ${cloud(232, 74, 1.3, C.infoB)}
      ${photo(186, 100, 40, 30, 'a-fly-up')}
      ${arrow(124, 96, 200, 70)}`),
    () => frame(`
      ${phone(40, 46, `<path d="M8 10 L30 50 L18 62 L46 102" fill="none" stroke="${C.help}" stroke-width="3" stroke-linecap="round"/>`, '', 74, 124)}
      ${cloud(160, 60, 0.9, C.infoB)}
      ${phone(220, 40, `${photo(6, 10, 52, 38, 'a-pop a-d1')}${photo(6, 54, 52, 38, 'a-pop a-d2')}`, 'a-slide', 74, 124)}
      ${arrow(178, 78, 214, 96)}${lu(160, 130, 0.8, 'happy', 'a-float')}`),
  ],
  truffe: [
    () => frame(`
      ${phone(120, 26, `${bubble(6, 12, 56, 46, { fill: C.warnB, stroke: C.warnL, cls: 'a-pop', inner: bars(6, 10, [40, 30, 36], C.warnL, 9) })}${bars(6, 74, [52, 40], C.line)}`, '', 74, 132)}
      ${moon(54, 46, 1.3)}${clock(250, 52, 18)}
      ${parcel(256, 126, 1.45, 'a-pop a-d2')}`),
    () => frame(`
      ${phone(70, 26, bubble(6, 12, 56, 46, { fill: C.warnB, stroke: C.warnL, inner: `${bars(6, 10, [40, 30], C.warnL, 9)}<rect x="6" y="32" width="40" height="6" rx="3" fill="${C.help}"/>` }), '', 74, 132)}
      ${magnifier(132, 76, 1.35, 'a-search')}
      ${lu(250, 70, 1.1, 'warn', 'a-float')}
      ${cross(250, 136, 0.9, C.warn, 'a-pop a-d4')}`),
    () => frame(`
      ${phone(52, 26, bubble(6, 12, 56, 46, { fill: C.warnB, stroke: C.warnL, cls: 'a-crumble', inner: bars(6, 10, [40, 30], C.warnL, 9) }), '', 74, 132)}
      ${laptop(170, 56, `<rect x="6" y="6" width="74" height="10" rx="3" fill="${C.safeB}"/>${bars(8, 24, [60, 44, 52], C.line)}`)}
      ${check(262, 50, 1, C.safe, 'a-pop a-d4')}
      ${lu(150, 150, 0.7, 'happy', 'a-float')}`),
  ],
  condividere: [
    () => frame(`
      ${photo(70, 34, 180, 120, '', `
        <rect x="18" y="58" width="40" height="44" fill="${C.sunk}" stroke="${C.ink}" stroke-width="2"/>
        <path d="M18 58 L38 44 L58 58" fill="${C.help}" stroke="${C.ink}" stroke-width="2"/>
        ${person(118, 66, { s: 0.9, tone: 2, shirt: C.safe, long: true })}`)}
      ${pin(262, 54, 1, C.help, 'a-pop a-d1')}`),
    () => frame(`
      <rect x="60" y="30" width="200" height="128" rx="10" fill="${C.safeB}" ${S}/>
      <path d="M60 92 H260 M150 30 V158 M60 60 C120 70 180 50 260 64" fill="none" stroke="#fff" stroke-width="6"/>
      ${pin(100, 70, 0.9, C.help, 'a-pop')}${pin(228, 56, 0.9, C.school, 'a-pop a-d1')}${pin(190, 104, 0.9, C.info, 'a-pop a-d3')}
      ${arrow(104, 84, 184, 112, C.ink2)}${arrow(224, 70, 196, 108, C.ink2)}
      ${magnifier(270, 150, 0.8)}`),
    () => frame(`
      ${phone(120, 30, `${toggle(8, 14, false, 'a-pop')}${bars(44, 19, [16], C.line)}${toggle(8, 40, true, 'a-pop a-d1')}${bars(44, 45, [16], C.line)}<circle cx="18" cy="76" r="8" fill="${C.safeB}"/><circle cx="34" cy="76" r="8" fill="${C.infoB}"/><circle cx="50" cy="76" r="8" fill="${C.warnB}"/>`, '', 74, 128)}
      ${pin(250, 70, 1, C.line)}${cross(250, 70, 0.7, C.warn, 'a-pop a-d2')}
      ${lu(62, 80, 1, 'happy', 'a-float')}`),
  ],
  'persone-online': [
    () => frame(`
      ${gamepad(84, 116, 1.4)}
      ${bubble(140, 34, 104, 44, { cls: 'a-pop a-d1', inner: `${gift(32, 22, 0.8)}${bars(52, 14, [38, 26], C.line)}` })}
      ${avatar(272, 112, 1.1, 'a-pop')}`),
    () => frame(`
      ${avatar(52, 52, 0.9)}
      ${bubble(84, 28, 112, 46, { cls: 'a-pop', inner: `${lock(28, 24, 0.62, C.warnL)}${codeDots(48, 23, 4)}` })}
      ${person(118, 124, { s: 0.85, tone: 3, mood: 'worry' })}
      ${gift(232, 70, 0.8, 'a-fade-out')}
      ${lu(262, 138, 0.9, 'warn', 'a-float')}`),
    () => frame(`
      ${person(110, 100, { s: 1.1, tone: 3, mood: 'talk' })}
      ${person(214, 92, { s: 1.3, tone: 0, shirt: C.safe, long: true })}
      ${heart(162, 58, 1, '#ff9aa2', 'a-pop a-d1')}
      ${lu(270, 52, 0.8, 'happy', 'a-float')}`),
  ],
  cyberbullismo: [
    () => frame(`
      ${phone(122, 24, `${photo(6, 8, 52, 40)}${face(14, 64, 0.7, 'laugh', 'a-pop')}${face(32, 64, 0.7, 'laugh', 'a-pop a-d1')}${face(50, 64, 0.7, 'laugh', 'a-pop a-d2')}${face(23, 84, 0.7, 'laugh', 'a-pop a-d3')}${face(41, 84, 0.7, 'laugh', 'a-pop a-d4')}`, '', 74, 132)}
      ${bubble(34, 46, 64, 30, { tail: 'right', cls: 'a-pop a-d2', inner: face(32, 15, 0.7, 'laugh') })}
      ${bubble(222, 92, 64, 30, { cls: 'a-pop a-d4', inner: face(32, 15, 0.7, 'laugh') })}
      ${group(62, 128, 0.9)}${group(260, 52, 0.9)}`),
    () => frame(`
      ${person(160, 104, { s: 1.25, tone: 0, mood: 'sad' })}
      <circle cx="160" cy="104" r="62" fill="none" stroke="${C.line}" stroke-width="3" stroke-dasharray="4 8"/>
      ${face(76, 52, 0.8, 'laugh', 'a-pop')}${face(244, 52, 0.8, 'laugh', 'a-pop a-d1')}${face(70, 140, 0.8, 'laugh', 'a-pop a-d2')}${face(250, 140, 0.8, 'laugh', 'a-pop a-d3')}`),
    () => frame(`
      ${person(96, 104, { s: 1.1, tone: 0 })}
      ${phone(146, 54, bubble(4, 10, 38, 24, { fill: C.safeB, stroke: C.safeL, tail: 'right', cls: 'a-pop', inner: heart(19, 11, 0.45, C.help) }), '', 56, 96)}
      ${person(250, 96, { s: 1.2, tone: 2, shirt: C.safe })}
      ${lu(292, 44, 0.75, 'happy', 'a-float')}`),
  ],
  'vero-falso': [
    () => frame(`
      ${laptop(110, 40, `<rect x="0" y="0" width="86" height="52" fill="${C.ink}"/>${HEAD_TEACHER}<path d="M38 40 l10 6 l-10 6 Z" fill="#fff" class="a-pop"/>`)}
      ${face(64, 68, 0.9, 'laugh', 'a-pop a-d1')}${face(256, 72, 0.9, 'laugh', 'a-pop a-d2')}
      ${sparkle(90, 130, 0.8, C.help)}${sparkle(240, 130, 0.8, C.help)}`),
    () => frame(`
      ${laptop(40, 48, `<rect x="0" y="0" width="86" height="52" fill="${C.ink}"/>${HEAD_TEACHER}`)}
      ${magnifier(150, 80, 1.1, 'a-search')}
      ${laptop(196, 48, `<rect x="4" y="4" width="78" height="10" rx="3" fill="${C.schoolB}"/>${bars(6, 22, [60, 70, 40], C.line)}`)}`),
    () => frame(`
      ${laptop(40, 48, `<rect x="0" y="0" width="86" height="52" fill="${C.ink}" opacity=".55"/>`)}${cross(88, 64, 1, C.warn, 'a-pop')}
      ${laptop(186, 48, `<rect x="4" y="4" width="78" height="10" rx="3" fill="${C.schoolB}"/>${bars(6, 22, [60, 70, 40], C.line)}`)}${check(278, 52, 1, C.safe, 'a-pop a-d2')}
      ${lu(160, 150, 0.75, 'happy', 'a-float')}`),
  ],
  'se-succede': [
    () => frame(`
      ${laptop(112, 46, `${lock(43, 30, 0.9, C.helpB, false)}${cross(62, 18, 0.55, C.help, 'a-pop')}`)}
      ${person(60, 112, { tone: 2, mood: 'worry' })}
      ${moon(270, 40, 1)}`),
    () => frame(`
      ${laptop(40, 52, `${key(43, 26, 0.75, C.yel, 0, 'a-pop')}`)}
      ${lock(188, 82, 1, C.yel, false, 'a-pop a-d2')}${lock(232, 82, 1, C.info, false, 'a-pop a-d3')}
      ${arrow(140, 70, 176, 70)}
      ${lu(272, 140, 0.8, 'idle', 'a-float')}`),
    () => frame(`
      ${megaphone(90, 90, 1.5, 'a-pop')}
      ${bubble(150, 40, 70, 32, { cls: 'a-pop a-d1', inner: bars(12, 10, [46, 30], C.line) })}
      ${bubble(196, 96, 70, 32, { cls: 'a-pop a-d2', inner: bars(12, 10, [46, 30], C.line) })}
      ${check(286, 52, 0.8, C.safe, 'a-pop a-d4')}
      ${lu(150, 150, 0.75, 'happy', 'a-float')}`),
  ],
};

/** SVG del quadro `i` (0, 1, 2) della scena di una tappa */
function sceneSvg(slug, i) {
  const list = SCENES[slug];
  if (!list || !list[i]) throw new Error(`Scena mancante: ${slug} ${i}`);
  return list[i]();
}

module.exports = { sceneSvg, SCENES };
