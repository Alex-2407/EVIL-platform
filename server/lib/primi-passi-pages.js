'use strict';
/**
 * Pagine di Primi passi, costruite da server/lib/primi-passi-content.js.
 *
 * scripts/build-primi-passi.js chiama renderOverview() e renderStage() due volte, in italiano e in
 * inglese: l'italiano diventa html/<file>, l'inglese serve a ricavare il dizionario della pagina
 * blocco per blocco. Per questo le due versioni devono avere esattamente la stessa struttura:
 * cambia solo il testo dentro i blocchi (vedi server/i18n, listUnits).
 *
 * Senza JavaScript tutto resta leggibile: i livelli di spiegazione sono tutti visibili e i giochi
 * mostrano le risposte in <details>. js/primi-passi.js trasforma i giochi in giochi veri.
 */

const { svgIcon } = require('../icons');
const C = require('./primi-passi-content');
const { sceneSvg } = require('./primi-passi-scenes');

const QUOTE = { it: ['«', '»'], en: ['“', '”'] };

/** Testo semplice dentro un elemento */
function x(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Valore di un attributo */
function a(s) {
  return x(s).replace(/"/g, '&quot;');
}

function fmt(s, vars) {
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

/** Coppie {it, en} → testo della lingua; controlla che ci sia davvero */
function L(o, lang) {
  if (!o || typeof o !== 'object' || !(lang in o)) throw new Error(`Testo mancante (${lang}): ${JSON.stringify(o)}`);
  return o[lang];
}

function stageUrl(t) {
  return `/${t.file}`;
}

function badgeMedal(icon) {
  return `<span class="pp-medal" aria-hidden="true"><span class="pp-medal__ring"></span>${svgIcon(icon)}</span>`;
}

function head(lang, title, desc) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${x(title)}</title>
  <meta name="description" content="${a(desc)}">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/per-tutti.css">
  <link rel="stylesheet" href="/css/primi-passi.css">
  <script src="/js/per-tutti.js" defer></script>
  <script src="/js/primi-passi.js" defer></script>
</head>`;
}

const GENERATED = '<!-- Generato da scripts/build-primi-passi.js: i testi stanno in server/lib/primi-passi-content.js -->';

function strings(lang, keys) {
  const items = keys.map(([k, v]) => `      <li data-pp-str="${k}">${x(L(v, lang))}</li>`).join('\n');
  return `    <ul class="pp-strings" hidden>
${items}
    </ul>`;
}

function trail(lang, current) {
  const dots = C.TAPPE.map((t) => {
    const label = fmt(L(C.UI.trailItem, lang), { n: t.n, title: L(t.title, lang) });
    const cur = current && current.slug === t.slug;
    // il nome della tappa sta nel link (nascosto alla vista) e non in aria-label: così si traduce
    // insieme al blocco, mentre un attributo dentro un blocco senza parole resterebbe in italiano
    return `          <li><a class="pp-trail__dot" href="${stageUrl(t)}" data-pp-dot="${t.slug}" title="${a(label)}"${cur ? ' aria-current="step"' : ''}><span aria-hidden="true">${t.n}</span><span class="pt-sr">${x(label)}</span></a></li>`;
  }).join('\n');
  return `      <nav class="pp-trail" aria-label="${a(L(C.UI.trailLabel, lang))}">
        <a class="pp-trail__home" href="/${C.OVERVIEW.file}">${x(L(C.OVERVIEW.navTitle, lang))}</a>
        <ol class="pp-trail__list">
${dots}
        </ol>
      </nav>`;
}

// ------------------------------------------------------------------ giochi

/** Permutazione fissa (stessa a ogni generazione) in cui nessun elemento resta al suo posto. */
function derangement(n, seedText) {
  let seed = 0;
  for (const ch of seedText) seed = (seed * 31 + ch.codePointAt(0)) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let attempt = 0; attempt < 1000; attempt++) {
    const p = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    if (p.every((v, i) => v !== i)) return p;
  }
  throw new Error(`Nessuna permutazione valida per ${seedText}`);
}

function gameClassify(g, lang) {
  const cats = g.categories.map((c) => `            <li data-cat="${c.id}">${x(L(c.label, lang))}</li>`).join('\n');
  const label = Object.fromEntries(g.categories.map((c) => [c.id, L(c.label, lang)]));
  const items = g.items.map((it) => `            <li class="pp-item" data-cat="${it.cat}">
              <p class="pp-item__text">${x(L(it.text, lang))}</p>
              <details class="pp-item__answer">
                <summary>${x(L(C.UI.showAnswer, lang))}</summary>
                <p class="pp-item__why"><strong>${x(label[it.cat])}.</strong> ${x(L(it.why, lang))}</p>
              </details>
            </li>`).join('\n');
  return `          <ul class="pp-cats" data-pp-cats>
${cats}
          </ul>
          <ol class="pp-items" data-pp-items>
${items}
          </ol>`;
}

function gameOrder(g, lang, slug) {
  const perm = derangement(g.items.length, slug);
  const mono = g.mono ? ' pp-mono' : '';
  const shown = perm.map((pos) => `            <li class="pp-order__item" data-pos="${pos}"><span class="pp-order__text${mono}">${x(L(g.items[pos].text, lang))}</span></li>`).join('\n');
  const solution = g.items.map((it, pos) => `              <li data-pos="${pos}"><strong class="pp-order__text${mono}">${x(L(it.text, lang))}</strong> ${x(L(it.why, lang))}</li>`).join('\n');
  return `          <ol class="pp-order" data-pp-order>
${shown}
          </ol>
          <details class="pp-solution" data-pp-solution>
            <summary>${x(L(C.UI.showSolution, lang))}</summary>
            <ol class="pp-solution__list">
${solution}
            </ol>
          </details>`;
}

function gameSelect(g, lang) {
  const opts = g.options.map((o) => `            <li class="pp-option"${o.trap ? ' data-trap="1"' : ''}>
              <p class="pp-option__text">${x(L(o.text, lang))}</p>
              <details class="pp-option__answer">
                <summary>${x(L(C.UI.showAnswer, lang))}</summary>
                <p class="pp-option__why"><strong>${x(L(o.trap ? C.STRINGS.labelTrap : C.STRINGS.labelSafe, lang))}.</strong> ${x(L(o.why, lang))}</p>
              </details>
            </li>`).join('\n');
  return `          <ul class="pp-options" data-pp-options>
${opts}
          </ul>`;
}

const PARCEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>';

function gameSpot(g, lang) {
  const [qo, qc] = QUOTE[lang];
  const segs = g.segments
    .map((s, i) => `<span class="pp-seg${s.mono ? ' pp-mono' : ''}" data-seg="${i}"${s.trap ? ' data-trap="1"' : ''}>${x(L(s.text, lang))}</span>`)
    .join(' ');
  const whys = g.segments.map((s, i) => `              <li data-seg="${i}"${s.trap ? ' data-trap="1"' : ''}><strong>${qo}${x(L(s.text, lang))}${qc}</strong> ${x(L(s.why, lang))}</li>`).join('\n');
  return `          <div class="pp-sms" role="group" aria-label="${a(L(C.UI.spotLabel, lang))}">
            <p class="pp-sms__from"><span class="pp-sms__avatar" aria-hidden="true">${PARCEL}</span> ${x(L(g.from, lang))}</p>
            <p class="pp-sms__body" data-pp-spot>${segs}</p>
            <p class="pp-sms__time" aria-hidden="true">23:04</p>
            <p class="pp-stamp" data-pp-stamp hidden>${x(L(C.STRINGS.stamp, lang))}</p>
          </div>
          <details class="pp-solution" data-pp-solution>
            <summary>${x(L(C.UI.showSolution, lang))}</summary>
            <ul class="pp-spot__whys">
${whys}
            </ul>
          </details>`;
}

function game(t, lang) {
  const g = t.game;
  const body = { classify: gameClassify, order: gameOrder, select: gameSelect, spot: gameSpot }[g.kind];
  if (!body) throw new Error(`Gioco sconosciuto: ${g.kind}`);
  const checkBtn = g.kind === 'order' || g.kind === 'select'
    ? `\n            <button class="pt-btn pt-btn--primary" type="button" data-pp-check>${x(L(C.UI.check, lang))}</button>`
    : '';
  const hintBtn = g.kind === 'select' || g.kind === 'spot'
    ? `\n            <button class="pt-btn pt-btn--ghost" type="button" data-pp-hint hidden>${x(L(C.UI.hint, lang))}</button>`
    : '';
  return `        <div class="pp-game pp-game--${g.kind}" data-pp-game="${g.kind}">
          <h3 class="pp-game__title">${x(L(g.title, lang))}</h3>
          <p class="pp-game__intro">${x(L(g.intro, lang))}</p>
${body(g, lang, t.slug)}
          <div class="pp-game__bar">${checkBtn}${hintBtn}
            <button class="pt-btn pt-btn--ghost" type="button" data-pp-replay hidden>${x(L(C.UI.replay, lang))}</button>
          </div>
          <p class="pp-game__status" data-pp-status role="status" aria-live="polite"></p>
        </div>`;
}

// ------------------------------------------------------------------ la scena animata (passo 2.13)

/**
 * Tre quadri con didascalia. Senza JavaScript, o con il movimento ridotto, è una striscia a fumetti;
 * con JavaScript js/primi-passi.js la trasforma in una breve animazione con pausa e frecce.
 */
function scene(t, lang) {
  const U = C.UI;
  const frames = L(t.scene, lang).map((cap, i) => `            <li class="pp-anim__frame" data-frame="${i}">
              ${sceneSvg(t.slug, i).replace(/\n\s*/g, '')}
              <p class="pp-anim__cap"><span class="pp-anim__n" aria-hidden="true">${i + 1}</span> ${x(cap)}</p>
            </li>`).join('\n');
  return `        <figure class="pp-anim" data-pp-anim aria-label="${a(L(U.sceneLabel, lang))}">
          <ol class="pp-anim__frames" data-pp-anim-frames>
${frames}
          </ol>
          <div class="pp-anim__bar" data-pp-anim-bar hidden>
            <button class="pp-anim__btn" type="button" data-pp-anim-prev aria-label="${a(L(U.scenePrev, lang))}">‹</button>
            <button class="pp-anim__btn pp-anim__btn--play" type="button" data-pp-anim-play aria-label="${a(L(C.STRINGS.scenePause, lang))}"></button>
            <button class="pp-anim__btn" type="button" data-pp-anim-next aria-label="${a(L(U.sceneNext, lang))}">›</button>
            <span class="pp-anim__dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </div>
        </figure>`;
}

// ------------------------------------------------------------------ pagina di una tappa

function renderStage(t, lang) {
  const U = C.UI;
  const deepLabel = L(C.DEPTH[t.deepKind === 'deep' ? 'deep' : 'tech'], lang);
  const next = C.TAPPE[t.n] || null;
  const title = L(t.title, lang);
  const metaTitle = fmt(L(U.metaTitle, lang), { title, n: t.n });

  const storyText = L(t.story.text, lang).map((p) => `          <p>${x(p)}</p>`).join('\n');
  const choices = t.story.choices.map((ch) => `          <details class="pp-choice"${ch.good ? ' data-good="1"' : ''}>
            <summary>${x(L(ch.text, lang))}</summary>
            <div class="pp-choice__out">
              <p class="pp-verdict pp-verdict--${ch.good ? 'good' : 'bad'}">${x(L(ch.good ? U.verdictGood : U.verdictBad, lang))}</p>
              <p>${x(L(ch.outcome, lang))}</p>
            </div>
          </details>`).join('\n');

  const help = t.help
    ? `
        <div class="pt-callout pt-callout--help pp-help" role="note">
          <span class="pt-callout__icon" aria-hidden="true">!</span>
          <p class="pt-callout__title">${x(L(U.helpTitle, lang))}</p>
          <div class="pt-callout__body">
            <p>${L(U.helpText, lang)}</p>
            <!--evil:fragment:help-numbers-->
          </div>
        </div>`
    : '';

  const why = L(t.why, lang).map((w) => `              <li>${x(w)}</li>`).join('\n');
  const steps = L(t.doNow.steps, lang).map((s) => `            <li>${s}</li>`).join('\n');

  const nextBlock = next
    ? `<a class="pt-btn pt-btn--primary" href="${stageUrl(next)}" data-pp-next>${x(fmt(L(U.nextGo, lang), { n: next.n }))}</a> <a class="pt-btn pt-btn--ghost" href="/${C.OVERVIEW.file}">${x(L(U.backAll, lang))}</a>`
    : `<a class="pt-btn pt-btn--primary" href="/${C.OVERVIEW.file}#patentino" data-pp-next>${x(L(U.certGo, lang))}</a> <a class="pt-btn pt-btn--ghost" href="/${C.OVERVIEW.file}">${x(L(U.backAll, lang))}</a>`;

  const links = t.links.map((l) => `            <li><a href="${a(l.href)}">${x(L(l.label, lang))}</a></li>`).join('\n');
  const sources = t.sources.length
    ? `
        <div class="pp-more__col">
          <h2 id="sources-title">${x(L(U.sourcesTitle, lang))}</h2>
          <ul class="pp-sources">
${t.sources.map((s) => `            <li><a href="${a(s.url)}" target="_blank" rel="noopener noreferrer">${x(L(s.label, lang))}</a></li>`).join('\n')}
          </ul>
          <p class="pp-sources__note">${x(L(U.sourcesNote, lang))}</p>
        </div>`
    : '';

  const deepClass = t.deepKind === 'deep' ? 'pp-deep pp-deep--info' : 'pt-depth--tech pp-deep';

  return `${head(lang, metaTitle, L(t.desc, lang))}
<body class="evil-theme pt-page pp-page" data-pp-page="stage" data-pp-stage="${t.slug}" data-pp-n="${t.n}">
  ${GENERATED}
  <div id="fade-overlay"></div>
  <canvas id="matrix-canvas"></canvas>

  <!--evil:header-->

  <main id="primi-passi" class="pt pp">
    <div class="pt__wrap">
${trail(lang, t)}

      <section class="pt-hero pp-hero" aria-labelledby="pp-title">
        <div>
          <p class="pt-kicker">${x(fmt(L(U.kicker, lang), { n: t.n }))}</p>
          <h1 id="pp-title">${x(title)}</h1>
          <p class="pt-hero__lead">${x(L(t.hook, lang))}</p>
          <p class="pp-time">${x(fmt(L(U.minutes, lang), { n: t.minutes }))}</p>
          <nav class="pp-jump" aria-label="${a(L(U.inThisStage, lang))}">
            <ul>
              <li><a href="#story">${x(L(U.storyTitle, lang))}</a></li>
              <li><a href="#do-now">${x(L(U.doNowTitle, lang))}</a></li>
              <li><a href="#game">${x(L(U.gameTitle, lang))}</a></li>
            </ul>
          </nav>
        </div>
        <div class="pt-hero__art"><!--evil:fragment:mascot--></div>
      </section>
    </div>

    <aside class="pp-side" data-pp-side aria-labelledby="side-title">
      <p class="pp-side__k" id="side-title">${x(L(U.sideTitle, lang))}</p>
      <ol class="pp-side__list">
        <li data-pp-step="story"><a href="#story">${x(L(U.storyTitle, lang))}</a></li>
        <li data-pp-step="explain"><a href="#explain">${x(L(U.whyTitle, lang))}</a></li>
        <li data-pp-step="do"><a href="#do-now">${x(L(U.doNowTitle, lang))}</a></li>
        <li data-pp-step="game"><a href="#game">${x(L(U.gameTitle, lang))}</a></li>
      </ol>
      <p class="pp-side__badge">${badgeMedal(t.icon)}<span>${x(L(t.badge, lang))}</span></p>
    </aside>

    <section class="pt-section pp-story" id="story" aria-labelledby="story-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="story-title"><span class="pp-n" aria-hidden="true">1</span> ${x(L(U.storyTitle, lang))}</h2>
${scene(t, lang)}
        <div class="pp-scene">
${storyText}
        </div>
        <p class="pp-question">${x(L(t.story.question, lang))}</p>
        <p class="pp-hint">${x(L(U.storyHint, lang))}</p>
        <div class="pp-choices" data-pp-choices>
${choices}
        </div>${help}
      </div>
    </section>

    <section class="pt-section pp-explain" id="explain" aria-labelledby="explain-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="explain-title"><span class="pp-n" aria-hidden="true">2</span> ${x(L(U.whyTitle, lang))}</h2>
        <p class="pt-section__lead">${x(L(U.whyLead, lang))}</p>
        <div class="pt-switch pp-depth pp-depth--${t.deepKind === 'deep' ? 'deep' : 'tech'}" data-pt-switch="pp-depth">
          <div class="pt-switch__list" role="tablist" aria-label="${a(L(U.depthLabel, lang))}">
            <button class="pt-switch__tab pp-tab--kids" type="button" role="tab" id="tab-pp-kids" aria-controls="pp-kids" aria-selected="false">${x(L(C.DEPTH.kids, lang))}</button>
            <button class="pt-switch__tab pp-tab--all" type="button" role="tab" id="tab-pp-all" aria-controls="pp-all" aria-selected="true">${x(L(C.DEPTH.all, lang))}</button>
            <button class="pt-switch__tab pp-tab--deep" type="button" role="tab" id="tab-pp-deep" aria-controls="pp-deep" aria-selected="false">${x(deepLabel)}</button>
          </div>
          <section class="pt-panel" id="pp-kids" role="tabpanel" aria-labelledby="tab-pp-kids" data-pt-panel="kids">
            <h3 class="pt-panel__title pt-sr-when-js">${x(L(C.DEPTH.kids, lang))}</h3>
            <div class="pt-depth--kids pp-kids">
              <div class="pp-kids__lu"><!--evil:fragment:mascot-small--></div>
              <div class="pp-kids__text">${L(t.kids, lang)}</div>
            </div>
          </section>
          <section class="pt-panel" id="pp-all" role="tabpanel" aria-labelledby="tab-pp-all" data-pt-panel="all">
            <h3 class="pt-panel__title pt-sr-when-js">${x(L(C.DEPTH.all, lang))}</h3>
            <ol class="pp-why">
${why}
            </ol>
          </section>
          <section class="pt-panel" id="pp-deep" role="tabpanel" aria-labelledby="tab-pp-deep" data-pt-panel="deep">
            <h3 class="pt-panel__title pt-sr-when-js">${x(deepLabel)}</h3>
            <div class="${deepClass}">${L(t.deep, lang)}</div>
          </section>
        </div>
      </div>
    </section>

    <section class="pt-section pp-do" id="do-now" aria-labelledby="do-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="do-title"><span class="pp-n" aria-hidden="true">3</span> ${x(L(U.doNowTitle, lang))}</h2>
        <p class="pt-section__lead">${x(L(U.doNowLead, lang))}</p>
        <div class="pp-do__card">
          <h3>${x(L(t.doNow.title, lang))}</h3>
          <ol class="pt-steps">
${steps}
          </ol>
          <div class="pp-do__done">
            <button class="pt-btn pt-btn--safe pp-done-btn" type="button" aria-pressed="false" data-pp-done>${x(L(U.doneBtn, lang))}</button>
            <p class="pp-done-msg" data-pp-done-msg hidden>${x(L(U.doneMsg, lang))}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="pt-section pp-play" id="game" aria-labelledby="game-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="game-title"><span class="pp-n" aria-hidden="true">4</span> ${x(L(U.gameTitle, lang))}</h2>
${game(t, lang)}
        <div class="pp-badge" data-pp-badge>
          ${badgeMedal(t.icon)}
          <div class="pp-badge__txt">
            <p class="pp-badge__k">${x(L(U.badgeTitle, lang))}</p>
            <p class="pp-badge__name">${x(L(t.badge, lang))}</p>
            <p class="pp-badge__state pp-badge__state--locked">${x(L(U.badgeLocked, lang))}</p>
            <p class="pp-badge__state pp-badge__state--won">${x(L(U.badgeUnlocked, lang))}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="pt-section pp-next" id="next" aria-labelledby="next-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="next-title">${x(L(U.nextTitle, lang))}</h2>
        <p class="pp-next__teaser">${x(L(t.next, lang))}</p>
        <p class="pp-next__actions">${nextBlock}</p>
        <p class="pp-next__enough">${x(L(U.enough, lang))}</p>
      </div>
    </section>

    <section class="pt-section pp-more" aria-labelledby="more-title">
      <div class="pt__wrap pp-more__grid">
        <div class="pp-more__col">
          <h2 id="more-title">${x(L(U.learnMore, lang))}</h2>
          <ul class="pp-links">
${links}
          </ul>
        </div>${sources}
      </div>
    </section>

${strings(lang, Object.entries(C.STRINGS))}
  </main>

  <!--evil:footer-->
  <script src="/js/matrixrain.js" defer></script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ pagina del percorso

function renderOverview(lang) {
  const O = C.OVERVIEW;
  const first = C.TAPPE[0];
  const how = L(O.how, lang).map((h, i) => `          <li class="pp-how__item"><span class="pp-how__n" aria-hidden="true">${i + 1}</span><p>${h}</p></li>`).join('\n');
  const who = L(O.forWhom, lang).map((w) => `          <li class="pt-card"><p>${w}</p></li>`).join('\n');
  const lights = C.TAPPE.map((t) => `            <li data-pp-light="${t.slug}"></li>`).join('\n');
  const cards = C.TAPPE.map((t) => `          <li class="pp-tile" data-pp-tile="${t.slug}">
            <span class="pp-tile__n" aria-hidden="true">${t.n}</span>
            <span class="pp-tile__ico" aria-hidden="true">${svgIcon(t.icon)}</span>
            <p class="pp-tile__k">${x(fmt(L(O.stageN, lang), { n: t.n }))} · ${x(fmt(L(O.minutes, lang), { n: t.minutes }))}</p>
            <h3 class="pp-tile__t"><a href="${stageUrl(t)}">${x(L(t.title, lang))}</a></h3>
            <p class="pp-tile__d">${x(L(t.hook, lang))}</p>
            <p class="pp-tile__status"><span class="pp-status pp-status--todo">${x(L(O.statusTodo, lang))}</span><span class="pp-status pp-status--done">${x(L(O.statusDone, lang))}</span></p>
          </li>`).join('\n');
  const certBadges = C.TAPPE.map((t) => `            <li data-pp-cert-badge="${t.slug}"><span class="pp-cert__ico" aria-hidden="true">${svgIcon(t.icon)}</span><span class="pp-cert__bname">${x(L(t.badge, lang))}</span></li>`).join('\n');

  return `${head(lang, L(O.metaTitle, lang), L(O.metaDesc, lang))}
<body class="evil-theme pt-page pp-page pp-home" data-pp-page="overview">
  ${GENERATED}
  <div id="fade-overlay"></div>
  <canvas id="matrix-canvas"></canvas>

  <!--evil:header-->

  <main id="primi-passi" class="pt pp">
    <div class="pt__wrap">
      <section class="pt-hero pp-hero" aria-labelledby="pp-title">
        <div>
          <p class="pt-kicker">${x(L(O.kicker, lang))}</p>
          <h1 id="pp-title">${x(L(O.h1, lang))}</h1>
          <p class="pt-hero__lead">${x(L(O.lead, lang))}</p>
          <div class="pt-hero__actions">
            <a class="pt-btn pt-btn--primary" href="${stageUrl(first)}" data-pp-start>${x(L(O.start, lang))}</a>
          </div>
          <div class="pp-lights" data-pp-lights>
            <p class="pp-lights__count">${L(O.progress, lang)}</p>
            <ol class="pp-lights__row" aria-hidden="true">
${lights}
            </ol>
            <p class="pp-lights__note">${x(L(O.lightsNote, lang))}</p>
          </div>
        </div>
        <div class="pt-hero__art"><!--evil:fragment:mascot--></div>
      </section>
    </div>

    <section class="pt-section pp-how" aria-labelledby="how-title">
      <div class="pt__wrap">
        <h2 id="how-title">${x(L(O.howTitle, lang))}</h2>
        <ol class="pp-how__list">
${how}
        </ol>
      </div>
    </section>

    <section class="pt-section pp-list" id="tappe" aria-labelledby="list-title">
      <div class="pt__wrap">
        <h2 id="list-title">${x(L(O.listTitle, lang))}</h2>
        <p class="pt-section__lead">${x(L(O.listLead, lang))}</p>
        <ol class="pp-tiles">
${cards}
        </ol>
      </div>
    </section>

    <section class="pt-section pp-who" aria-labelledby="who-title">
      <div class="pt__wrap">
        <h2 id="who-title">${x(L(O.forWhomTitle, lang))}</h2>
        <ul class="pt-grid">
${who}
        </ul>
        <div class="pt-callout pt-callout--school">
          <span class="pt-callout__icon" aria-hidden="true">${svgIcon('book')}</span>
          <p class="pt-callout__title">${x(L(O.teachersTitle, lang))}</p>
          <div class="pt-callout__body">
            <p>${L(O.teachers, lang)}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="pt-section pp-cert-sec" id="patentino" aria-labelledby="cert-title">
      <div class="pt__wrap">
        <h2 id="cert-title">${x(L(O.certTitle, lang))}</h2>
        <p class="pt-section__lead">${x(L(O.certLead, lang))}</p>
        <div class="pp-gold" data-pp-gold hidden>
          <p class="pp-gold__title">${x(L(O.goldTitle, lang))}</p>
          <p>${x(L(O.goldText, lang))}</p>
        </div>
        <p class="pp-cert__locked" data-pp-cert-locked>${x(L(O.certLocked, lang))}</p>
        <div class="pp-cert__tools" data-pp-cert-tools hidden>
          <label for="pp-cert-name">${x(L(O.certName, lang))}</label>
          <input id="pp-cert-name" type="text" maxlength="40" autocomplete="off" spellcheck="false" data-pp-cert-input>
          <button class="pt-btn pt-btn--primary" type="button" data-pp-print>${x(L(O.certPrint, lang))}</button>
        </div>
        <article class="pp-cert" data-pp-cert>
          <div class="pp-cert__lu"><!--evil:fragment:mascot-small--></div>
          <p class="pp-cert__k">EVIL · ${x(L(O.navTitle, lang))}</p>
          <h3 class="pp-cert__h">${x(L(O.certHeading, lang))}</h3>
          <p class="pp-cert__name" data-pp-cert-name></p>
          <p class="pp-cert__body">${x(L(O.certBody, lang))}</p>
          <ul class="pp-cert__badges">
${certBadges}
          </ul>
          <p class="pp-cert__date" data-pp-cert-date></p>
          <p class="pp-cert__site" translate="no">projectevil.it</p>
        </article>
      </div>
    </section>

    <section class="pt-section pp-secrets" aria-labelledby="secrets-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="secrets-title">${x(L(O.secretsTitle, lang))}</h2>
        <p class="pt-section__lead">${x(L(O.secretsLead, lang))}</p>
        <ul class="pp-secrets__list">
          <li class="pp-badge pp-secret" data-pp-secret="gold">
            ${badgeMedal('sun')}
            <div class="pp-badge__txt">
              <p class="pp-badge__name">${x(L(O.goldTitle, lang).replace(/!$/, ''))}</p>
              <p class="pp-badge__state">${x(L(O.goldHow, lang))}</p>
            </div>
          </li>
          <li class="pp-badge pp-secret" data-pp-secret="explorer">
            ${badgeMedal('globe')}
            <div class="pp-badge__txt">
              <p class="pp-badge__name">${x(L(O.explorerName, lang))}</p>
              <p class="pp-badge__state">${x(L(O.explorerHow, lang))}</p>
              <p class="pp-badge__state pp-secret__count">${L(O.eggsCount, lang)}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <section class="pt-section pp-privacy" aria-labelledby="privacy-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="privacy-title">${x(L(O.privacyTitle, lang))}</h2>
        <p>${x(L(O.privacy, lang))}</p>
        <p class="pp-reset"><button class="pt-btn pt-btn--ghost" type="button" data-pp-reset>${x(L(O.resetBtn, lang))}</button></p>
        <p class="pp-reset__msg" data-pp-reset-msg role="status" aria-live="polite"></p>
      </div>
    </section>

${strings(lang, [
    ['continue', O.continueTpl],
    ['start', O.start],
    ['certGo', C.UI.certGo],
    ['certIssued', O.certIssued],
    ['resetBtn', O.resetBtn],
    ['resetConfirm', O.resetConfirm],
    ['resetDone', O.resetDone],
    ['doneDot', C.STRINGS.doneDot],
  ])}
  </main>

  <!--evil:footer-->
  <script src="/js/matrixrain.js" defer></script>
</body>
</html>
`;
}

module.exports = { renderStage, renderOverview, derangement, fmt };
