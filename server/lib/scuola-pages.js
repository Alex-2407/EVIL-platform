'use strict';
/**
 * Pagine di EVIL Scuola, costruite da server/lib/scuola-content.js (vedi scripts/build-scuola.js).
 * Come per Primi passi, le versioni italiana e inglese devono avere la stessa struttura: cambia solo
 * il testo dentro i blocchi.
 *
 * Una pagina di kit è insieme la guida per il docente (sullo schermo e stampata) e i fogli da
 * stampare (carte del gioco e biglietti d'uscita): js/scuola.js sceglie cosa stampare.
 */

const { svgIcon } = require('../icons');
const S = require('./scuola-content');
const PP = require('./primi-passi-content');
const { fmt } = require('./primi-passi-pages');

function x(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function a(s) {
  return x(s).replace(/"/g, '&quot;');
}

function L(o, lang) {
  if (!o || typeof o !== 'object' || !(lang in o)) throw new Error(`Testo mancante (${lang}): ${JSON.stringify(o)}`);
  return o[lang];
}

const GENERATED = '<!-- Generato da scripts/build-scuola.js: i testi stanno in server/lib/scuola-content.js -->';

function head(title, desc) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${x(title)}</title>
  <meta name="description" content="${a(desc)}">
  <link rel="stylesheet" href="/css/style.css">
  <link rel="stylesheet" href="/css/per-tutti.css">
  <link rel="stylesheet" href="/css/scuola.css">
  <script src="/js/per-tutti.js" defer></script>
  <script src="/js/scuola.js" defer></script>
</head>`;
}

function stage(slug) {
  const t = PP.TAPPE.find((s) => s.slug === slug);
  if (!t) throw new Error(`Tappa sconosciuta: ${slug}`);
  return t;
}

function sourceList(sources, lang) {
  return sources.map((s) => `          <li><a href="${a(s.url)}" target="_blank" rel="noopener noreferrer">${x(L(s.label, lang))}</a></li>`).join('\n');
}

// ------------------------------------------------------------------ pagina di un kit

function renderKit(k, lang) {
  const U = S.UI;
  const title = L(k.title, lang);
  const cycle = L(S.CYCLES[k.cycle], lang);
  const catLabel = Object.fromEntries(k.game.categories.map((c) => [c.id, L(c.label, lang)]));

  const stageLinks = k.stages.map((slug) => {
    const t = stage(slug);
    return `            <li><a href="/${t.file}">${x(fmt(L(U.stageLink, lang), { n: t.n, title: L(t.title, lang) }))}</a></li>`;
  }).join('\n');
  const goals = L(k.goals, lang).map((g) => `          <li>${x(g)}</li>`).join('\n');
  const materials = L(k.materials, lang).map((m) => `          <li>${x(m)}</li>`).join('\n');
  const before = L(k.before, lang).map((b) => `          <li>${x(b)}</li>`).join('\n');
  const plan = k.plan.map((p) => `          <li class="sk-step">
            <p class="sk-step__time">${x(fmt(L(U.minutes, lang), { a: p.from, b: p.to }))}</p>
            <div class="sk-step__body">
              <h3>${x(L(p.title, lang))}</h3>
              <p>${x(L(p.text, lang))}</p>${p.say ? `
              <p class="sk-say"><strong>${x(L(U.say, lang))}</strong> ${x(L(p.say, lang))}</p>` : ''}
            </div>
          </li>`).join('\n');
  const answers = k.game.items.map((it) => `          <li><strong>${x(L(it.text, lang))}</strong> <span class="sk-answer sk-answer--${it.cat}">${x(catLabel[it.cat])}.</span> ${x(L(it.why, lang))}</li>`).join('\n');
  const discussion = k.discussion.map((d) => `          <li>
            <p class="sk-q">${x(L(d.q, lang))}</p>
            <p class="sk-a"><strong>${x(L(U.where, lang))}</strong> ${x(L(d.a, lang))}</p>
          </li>`).join('\n');
  const cards = [
    ...k.game.categories.map((c) => `            <li class="sk-cut sk-cut--head sk-cut--${c.id}">${x(L(c.label, lang))}</li>`),
    ...k.game.items.map((it) => `            <li class="sk-cut">${x(L(it.text, lang))}</li>`),
  ].join('\n');
  const ticketLines = L(k.ticket, lang).map((line) => `                <li>${x(line)}</li>`).join('\n');
  const ticket = `            <li class="sk-ticket">
              <p class="sk-ticket__k">${x(L(S.PAGE.navTitle, lang))} · ${x(title)}</p>
              <p class="sk-ticket__name">${x(L(U.nameLine, lang))}</p>
              <ol class="sk-ticket__lines">
${ticketLines}
              </ol>
            </li>`;

  return `${head(fmt(L(U.metaTitle, lang), { title, n: k.n }), L(k.desc, lang))}
<body class="evil-theme pt-page sk-page" data-sk-kit="${k.slug}">
  ${GENERATED}
  <div id="fade-overlay"></div>
  <canvas id="matrix-canvas"></canvas>

  <!--evil:header-->

  <main id="scuola" class="pt sk">
    <div class="sk-guide">
      <div class="pt__wrap">
        <p class="sk-back"><a href="/${S.PAGE.file}">← ${x(L(U.back, lang))}</a></p>
        <section class="pt-hero sk-hero" aria-labelledby="sk-title">
          <div>
            <p class="pt-kicker">${x(fmt(L(U.kicker, lang), { n: k.n, cycle }))}</p>
            <h1 id="sk-title">${x(title)}</h1>
            <p class="pt-hero__lead">${x(L(k.hook, lang))}</p>
            <p class="sk-facts">${x(fmt(L(U.facts, lang), { classes: L(k.classes, lang) }))}</p>${k.sensitive ? `
            <p class="sk-review"><strong>${x(L(U.review, lang))}.</strong> ${x(L(U.reviewNote, lang))}</p>` : ''}
            <div class="sk-print" data-sk-print-bar hidden>
              <button class="pt-btn pt-btn--primary" type="button" data-sk-print="guide">${x(L(U.printGuide, lang))}</button>
              <button class="pt-btn pt-btn--ghost" type="button" data-sk-print="sheets">${x(L(U.printCards, lang))}</button>
            </div>
            <p class="sk-print__hint" data-sk-print-hint>${x(L(U.printHint, lang))}</p>
          </div>
          <div class="sk-hero__ico" aria-hidden="true">${svgIcon(k.icon)}</div>
        </section>
      </div>

      <section class="pt-section sk-brief" aria-labelledby="idea-title">
        <div class="pt__wrap pt__narrow">
          <div class="sk-idea">
            <h2 id="idea-title">${x(L(U.ideaTitle, lang))}</h2>
            <p>${x(L(k.idea, lang))}</p>
          </div>
          <h2>${x(L(U.goalsTitle, lang))}</h2>
          <ul class="sk-list">
${goals}
          </ul>
          <ul class="sk-stages">
${stageLinks}
          </ul>
          <div class="sk-cols">
            <div>
              <h2>${x(L(U.materialsTitle, lang))}</h2>
              <ul class="sk-list">
${materials}
              </ul>
            </div>
            <div>
              <h2>${x(L(U.beforeTitle, lang))}</h2>
              <ol class="sk-list">
${before}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section class="pt-section sk-plan" aria-labelledby="plan-title">
        <div class="pt__wrap pt__narrow">
          <h2 id="plan-title">${x(L(U.planTitle, lang))}</h2>
          <ol class="sk-steps">
${plan}
          </ol>
          <h2>${x(L(U.answersTitle, lang))}</h2>
          <ul class="sk-answers">
${answers}
          </ul>
          <h2>${x(L(U.discussionTitle, lang))}</h2>
          <ol class="sk-discussion">
${discussion}
          </ol>
          <div class="pt-callout pt-callout--help sk-care" role="note">
            <span class="pt-callout__icon" aria-hidden="true">!</span>
            <p class="pt-callout__title">${x(L(U.disclosureTitle, lang))}</p>
            <div class="pt-callout__body">
              <p>${x(L(U.disclosure, lang))}</p>${k.sensitive ? `
              <!--evil:fragment:help-numbers-->` : ''}
            </div>
          </div>
        </div>
      </section>

      <section class="pt-section sk-more" aria-labelledby="adapt-title">
        <div class="pt__wrap pt__narrow">
          <h2 id="adapt-title">${x(L(U.adaptTitle, lang))}</h2>
          <dl class="sk-adapt">
            <dt>${x(L(U.easier, lang))}</dt><dd>${x(L(k.adapt.easier, lang))}</dd>
            <dt>${x(L(U.harder, lang))}</dt><dd>${x(L(k.adapt.harder, lang))}</dd>
            <dt>${x(L(U.inclusion, lang))}</dt><dd>${x(L(k.adapt.inclusion, lang))}</dd>
          </dl>
          <h2>${x(L(U.homeTitle, lang))}</h2>
          <p>${x(L(k.home, lang))}</p>
          <h2>${x(L(U.curriculumTitle, lang))}</h2>
          <dl class="sk-adapt">
            <dt>${x(L(U.civica, lang))}</dt><dd>${x(L(k.civica, lang))}</dd>
            <dt>${x(L(U.digcomp, lang))}</dt><dd>${x(L(k.digcomp, lang))}</dd>
          </dl>
          <h2>${x(L(U.sourcesTitle, lang))}</h2>
          <ul class="sk-sources">
${sourceList(k.sources, lang)}
          </ul>
          <p class="sk-sources__note">${x(L(U.sourcesNote, lang))}</p>
        </div>
      </section>
    </div>

    <section class="pt-section sk-sheets" aria-labelledby="sheets-title">
      <div class="pt__wrap">
        <h2 id="sheets-title">${x(L(U.sheetsTitle, lang))}</h2>
        <div class="sk-sheet">
          <p class="sk-sheet__k">${x(L(U.cardsSheet, lang))}</p>
          <ul class="sk-cuts">
${cards}
          </ul>
        </div>
        <div class="sk-sheet">
          <p class="sk-sheet__k">${x(L(U.ticketSheet, lang))}</p>
          <ul class="sk-tickets">
${[ticket, ticket, ticket, ticket].join('\n')}
          </ul>
        </div>
      </div>
    </section>
  </main>

  <!--evil:footer-->
  <script src="/js/matrixrain.js" defer></script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ pagina di presentazione

function renderLanding(lang) {
  const P = S.PAGE;
  const how = L(P.how, lang).map((h, i) => `          <li class="sk-how__item"><span class="sk-how__n" aria-hidden="true">${i + 1}</span><p>${h}</p></li>`).join('\n');
  const cycles = Object.keys(S.CYCLES).map((id) => {
    const ready = S.KITS.filter((k) => k.cycle === id).map((k) => ({ ...k, ready: true }));
    const planned = S.PLANNED.filter((k) => k.cycle === id);
    const all = [...ready, ...planned].sort((p, q) => p.n - q.n);
    const items = all.map((k) => (k.ready
      ? `            <li class="sk-kit">
              <p class="sk-kit__k">Kit ${k.n} · ${x(L(k.classes, lang))}${k.sensitive ? ` · <span class="sk-kit__review">${x(L(S.UI.review, lang))}</span>` : ''}</p>
              <h4 class="sk-kit__t"><a href="/${k.file}">${x(L(k.title, lang))}</a></h4>
              <p>${x(L(k.hook, lang))}</p>
            </li>`
      : `            <li class="sk-kit sk-kit--planned">
              <p class="sk-kit__k">Kit ${k.n} · <span class="sk-kit__soon">${x(L(P.planned, lang))}</span></p>
              <h4 class="sk-kit__t">${x(L(k.title, lang))}</h4>
              <p>${x(L(k.hook, lang))}</p>
            </li>`)).join('\n');
    return `        <section class="sk-cycle" aria-labelledby="cycle-${id}">
          <h3 id="cycle-${id}">${x(L(S.CYCLES[id], lang))}</h3>
          <ul class="sk-kits">
${items}
          </ul>
        </section>`;
  }).join('\n');
  const curriculum = L(P.curriculum, lang).map((c) => `          <li>${c}</li>`).join('\n');
  const care = L(P.care, lang).map((c) => `            <li>${c}</li>`).join('\n');
  const resources = [S.SRC.epolicy, S.SRC.legge92, S.SRC.lineeGuida, S.SRC.orientamento, S.SRC.digcomp, S.SRC.nota5274, S.SRC.nota3392, S.SRC.nota121];

  return `${head(L(P.metaTitle, lang), L(P.navDesc, lang))}
<body class="evil-theme pt-page sk-page sk-home">
  ${GENERATED}
  <div id="fade-overlay"></div>
  <canvas id="matrix-canvas"></canvas>

  <!--evil:header-->

  <main id="scuola" class="pt sk">
    <div class="pt__wrap">
      <section class="pt-hero sk-hero" aria-labelledby="sk-title">
        <div>
          <p class="pt-kicker">${x(L(P.kicker, lang))}</p>
          <h1 id="sk-title">${x(L(P.h1, lang))}</h1>
          <p class="pt-hero__lead">${x(L(P.lead, lang))}</p>
          <div class="pt-hero__actions">
            <a class="pt-btn pt-btn--primary" href="#kit">${x(L(P.goKits, lang))}</a>
          </div>
        </div>
        <div class="pt-hero__art"><!--evil:fragment:mascot--></div>
      </section>
    </div>

    <section class="pt-section sk-how" aria-labelledby="how-title">
      <div class="pt__wrap">
        <h2 id="how-title">${x(L(P.howTitle, lang))}</h2>
        <ol class="sk-how__list">
${how}
        </ol>
      </div>
    </section>

    <section class="pt-section" id="kit" aria-labelledby="kits-title">
      <div class="pt__wrap">
        <h2 id="kits-title">${x(L(P.kitsTitle, lang))}</h2>
        <p class="pt-section__lead">${x(L(P.kitsLead, lang))}</p>
${cycles}
      </div>
    </section>

    <section class="pt-section" aria-labelledby="care-title">
      <div class="pt__wrap pt__narrow">
        <div class="pt-callout pt-callout--help">
          <span class="pt-callout__icon" aria-hidden="true">!</span>
          <h2 class="pt-callout__title" id="care-title">${x(L(P.careTitle, lang))}</h2>
          <div class="pt-callout__body">
            <ul class="sk-list">
${care}
            </ul>
            <!--evil:fragment:help-numbers-->
            <p>${L(P.careMore, lang)}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="pt-section" aria-labelledby="curr-title">
      <div class="pt__wrap pt__narrow">
        <h2 id="curr-title">${x(L(P.curriculumTitle, lang))}</h2>
        <ul class="sk-list">
${curriculum}
        </ul>
        <h2>${x(L(P.resourcesTitle, lang))}</h2>
        <ul class="sk-sources">
${sourceList(resources, lang)}
        </ul>
        <p class="sk-sources__note">${x(L(S.UI.sourcesNote, lang))}</p>
        <h2>${x(L(P.privacyTitle, lang))}</h2>
        <p>${x(L(P.privacy, lang))}</p>
      </div>
    </section>
  </main>

  <!--evil:footer-->
  <script src="/js/matrixrain.js" defer></script>
</body>
</html>
`;
}

module.exports = { renderKit, renderLanding };
