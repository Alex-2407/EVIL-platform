'use strict';
/**
 * Contatti di aiuto della sezione Aiuto (e del modulo di contatto).
 *
 * Ogni contatto ha:
 * - le fonti ufficiali aperte per verificarlo e la data dell'ultima verifica (verifiedOn);
 * - reviewedBy: chi ha rivisto i testi (null finché un esperto non li approva,
 *   docs/evil-per-tutti/PIANO.md, decisione D3).
 *
 * tests/help-contacts.test.js fallisce se un contatto non è verificato da più di MAX_AGE_DAYS
 * giorni: per chi chiede aiuto, un numero sbagliato è il danno peggiore che il sito possa fare.
 * Per riverificare: aprire ogni fonte, controllare numero, orari e canali, aggiornare verifiedOn.
 */

const MAX_AGE_DAYS = 90;

const GROUPS = [
  { id: 'urgent', title: { it: 'Pericolo immediato', en: 'Immediate danger' } },
  { id: 'talk', title: { it: 'Parlare con qualcuno', en: 'Talk to someone' } },
  { id: 'report', title: { it: 'Segnalare e far togliere un contenuto', en: 'Report it and get content removed' } },
  { id: 'world', title: { it: 'Risorse internazionali', en: 'International resources' } },
];

const SRC = {
  nue: { label: { it: 'Provincia autonoma di Trento, NUE 112', en: 'Autonomous Province of Trento, NUE 112' }, url: 'https://www.provincia.tn.it/Servizi/NUE-112-Numero-Unico-Europeo-per-le-chiamate-di-emergenza' },
  dlgs99: { label: { it: 'D.lgs. 99/2025, Normattiva', en: 'Legislative Decree 99/2025, Normattiva' }, url: 'https://www.normattiva.it/eli/id/2025/07/01//25G00100/CONSOLIDATED' },
  azzurro: { label: { it: 'Telefono Azzurro, bollettino 2025-26', en: 'Telefono Azzurro, 2025-26 bulletin' }, url: 'https://azzurro.it/wp-content/uploads/2026/04/Bollettino_19696_ANNO25_26__6_0_.pdf' },
  amico: { label: { it: 'L’Espresso, 8 settembre 2026', en: 'L’Espresso, 8 September 2026' }, url: 'https://lespresso.it/c/attualita/2026/09/08/suicidi-prevenzione-giornata-mondiale-giovani-telefono-amico-italia/64569' },
  pariopp: { label: { it: 'Dipartimento per le Pari Opportunità', en: 'Department for Equal Opportunities' }, url: 'https://www.pariopportunita.gov.it/media/axpl4lue/relazione-1522-dicembre-2025-gennaio-febbraio-2026.pdf' },
  garanteRp: { label: { it: 'Garante privacy, revenge porn', en: 'Italian Data Protection Authority, intimate images' }, url: 'https://www.garanteprivacy.it/it/temi/revengeporn' },
  garanteCb: { label: { it: 'Garante privacy, cyberbullismo', en: 'Italian Data Protection Authority, cyberbullying' }, url: 'https://garanteprivacy.it/temi/cyberbullismo' },
  legge71: { label: { it: 'Legge 71/2017, scheda dell’Autorità garante per l’infanzia', en: 'Law 71/2017, Children’s Ombudsman summary' }, url: 'https://www.garanteinfanzia.org/sites/default/files/scheda_legge_71.pdf' },
  stopit: { label: { it: 'Save the Children, Stop-It', en: 'Save the Children, Stop-It' }, url: 'https://stop-it.savethechildren.it/en/project' },
  takeitdown: { label: { it: 'NCMEC, Take It Down', en: 'NCMEC, Take It Down' }, url: 'https://takeitdown.ncmec.org/' },
  chi: { label: { it: 'Child Helpline International', en: 'Child Helpline International' }, url: 'https://childhelplineinternational.org/category/child-helpline/asia-pacific/page/2/' },
};

const CONTACTS = [
  {
    id: 'nue-112',
    group: 'urgent',
    country: 'IT',
    name: { it: '112 · Numero unico di emergenza', en: '112 · Single emergency number' },
    short: { it: 'Emergenza', en: 'Emergency' },
    phone: '112',
    url: null,
    for: {
      it: 'Quando qualcuno rischia di farsi male, è minacciato o è in pericolo adesso.',
      en: 'When someone may get hurt, is being threatened or is in danger right now.',
    },
    how: {
      it: 'Gratuito, anche senza SIM o credito e con il telefono bloccato. Esiste anche l’app Where ARE U.',
      en: 'Free, even without a SIM card or credit and from a locked phone. There is also the Where ARE U app.',
    },
    sources: [SRC.nue],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'emergenza-infanzia-114',
    group: 'talk',
    country: 'IT',
    name: { it: '114 · Emergenza Infanzia', en: '114 · Emergenza Infanzia (child emergency line)' },
    short: { it: 'Emergenza Infanzia', en: 'Child emergency line' },
    phone: '114',
    url: null,
    for: {
      it: 'Bullismo, cyberbullismo e ogni pericolo o disagio che riguarda un minorenne. Può chiamare chiunque: il ragazzo, un genitore, un amico, un docente.',
      en: 'Bullying, cyberbullying and any danger or distress involving a minor. Anyone can call: the young person, a parent, a friend, a teacher.',
    },
    how: {
      it: 'Attivo 24 ore su 24, tutti i giorni. Dà una prima assistenza psicologica e legale; ha un’app gratuita con chat.',
      en: 'Open 24 hours a day, every day. Gives first psychological and legal support; it has a free app with chat.',
    },
    sources: [SRC.dlgs99],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'telefono-azzurro-19696',
    group: 'talk',
    country: 'IT',
    name: { it: '1.96.96 · Telefono Azzurro', en: '1.96.96 · Telefono Azzurro' },
    short: { it: 'Telefono Azzurro', en: 'Telefono Azzurro' },
    phone: '19696',
    phoneLabel: '1.96.96',
    url: 'https://azzurro.it/',
    for: {
      it: 'Ascolto per bambini e ragazzi, e per gli adulti che si preoccupano per loro.',
      en: 'A listening line for children and young people, and for adults who are worried about them.',
    },
    how: {
      it: 'Gratuito, 24 ore su 24, tutti i giorni, al telefono o in chat.',
      en: 'Free, 24 hours a day, every day, by phone or chat.',
    },
    sources: [SRC.azzurro],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'telefono-amico-italia',
    group: 'talk',
    country: 'IT',
    name: { it: 'Telefono Amico Italia', en: 'Telefono Amico Italia' },
    phone: '0223272327',
    phoneLabel: '02 2327 2327',
    url: 'https://www.telefonoamico.it/',
    for: {
      it: 'Per chi si sente solo o sta attraversando un momento difficile.',
      en: 'For anyone who feels alone or is going through a hard time.',
    },
    how: {
      it: 'Attivo 24 ore su 24, 7 giorni su 7, dal 1° settembre 2026.',
      en: 'Open 24 hours a day, 7 days a week, since 1 September 2026.',
    },
    sources: [SRC.amico],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'antiviolenza-1522',
    group: 'talk',
    country: 'IT',
    name: { it: '1522 · Antiviolenza e stalking', en: '1522 · Violence and stalking helpline' },
    phone: '1522',
    url: 'https://www.1522.eu/',
    for: {
      it: 'Per chi subisce violenza di genere o stalking.',
      en: 'For anyone facing gender-based violence or stalking.',
    },
    how: {
      it: 'Gratuito, 24 ore su 24, tutti i giorni: telefono, chat sul sito 1522.eu o app. Alcune lingue straniere in giorni fissi.',
      en: 'Free, 24 hours a day, every day: phone, chat on 1522.eu or app. Some foreign languages on set days.',
    },
    sources: [SRC.pariopp],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'polizia-postale',
    group: 'report',
    country: 'IT',
    name: { it: 'Polizia Postale · Commissariato di P.S. online', en: 'Polizia Postale · online police station' },
    phone: null,
    url: 'https://www.commissariatodips.it/',
    for: {
      it: 'Minacce, ricatti ed estorsioni online, anche con foto intime.',
      en: 'Online threats, blackmail and extortion, including with intimate images.',
    },
    how: {
      it: 'Il sito ufficiale della Polizia Postale. In pericolo immediato chiama il 112.',
      en: 'The official site of the Italian Postal and Communications Police. In immediate danger, call 112.',
    },
    sources: [SRC.garanteRp],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'garante-cyberbullismo',
    group: 'report',
    country: 'IT',
    name: { it: 'Garante privacy · cyberbullismo', en: 'Data Protection Authority · cyberbullying' },
    phone: null,
    url: 'https://garanteprivacy.it/temi/cyberbullismo',
    for: {
      it: 'Far togliere un contenuto che offende o prende di mira un minorenne, se il sito o il social non lo fa.',
      en: 'Getting content that offends or targets a minor removed, if the website or social network does not do it.',
    },
    how: {
      it: 'Prima si chiede la rimozione al sito o al social. Se non risponde entro 24 ore o non toglie il contenuto entro 48, si manda il modulo del Garante a cyberbullismo@gpdp.it. Dai 14 anni si può fare da soli.',
      en: 'First ask the website or social network to remove it. If it does not reply within 24 hours or remove it within 48, send the Authority’s form to cyberbullismo@gpdp.it. From the age of 14 you can do it yourself.',
    },
    sources: [SRC.garanteCb, SRC.legge71],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'garante-immagini-intime',
    group: 'report',
    country: 'IT',
    name: { it: 'Garante privacy · foto e video intimi', en: 'Data Protection Authority · intimate photos and videos' },
    phone: null,
    url: 'https://www.garanteprivacy.it/it/temi/revengeporn',
    for: {
      it: 'Impedire che foto o video intimi vengano diffusi, anche prima che succeda.',
      en: 'Stopping intimate photos or videos from being shared, even before it happens.',
    },
    how: {
      it: 'Modulo online sul sito del Garante, anche dai 14 anni. Il Garante decide entro 48 ore e manda alle piattaforme solo l’impronta digitale del file.',
      en: 'Online form on the Authority’s website, also from the age of 14. It decides within 48 hours and sends platforms only the file’s digital fingerprint.',
    },
    sources: [SRC.garanteRp],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'stop-it',
    group: 'report',
    country: 'IT',
    name: { it: 'Stop-It · Save the Children', en: 'Stop-It · Save the Children' },
    phone: null,
    url: 'https://stop-it.savethechildren.it/',
    for: {
      it: 'Segnalare in modo anonimo materiale online di abuso sessuale su minori.',
      en: 'Reporting online child sexual abuse material anonymously.',
    },
    how: {
      it: 'Modulo di segnalazione anonimo: basta il link. Non salvare e non inoltrare le immagini.',
      en: 'Anonymous reporting form: the link is enough. Do not save or forward the images.',
    },
    sources: [SRC.stopit],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'take-it-down',
    group: 'world',
    country: 'INT',
    name: { it: 'Take It Down · NCMEC', en: 'Take It Down · NCMEC' },
    phone: null,
    url: 'https://takeitdown.ncmec.org/',
    for: {
      it: 'Foto o video intimi fatti quando avevi meno di 18 anni: aiuta a toglierli dalle piattaforme che aderiscono.',
      en: 'Intimate photos or videos taken when you were under 18: it helps remove them from participating platforms.',
    },
    how: {
      it: 'Gratuito, anche in forma anonima. Il file resta sul tuo telefono: viene inviata solo la sua impronta digitale.',
      en: 'Free, and you can stay anonymous. The file stays on your phone: only its digital fingerprint is sent.',
    },
    sources: [SRC.takeitdown],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'stopncii',
    group: 'world',
    country: 'INT',
    name: { it: 'StopNCII.org', en: 'StopNCII.org' },
    phone: null,
    url: 'https://stopncii.org/',
    for: {
      it: 'Lo stesso aiuto per le immagini intime di chi aveva già 18 anni.',
      en: 'The same help for intimate images of people who were already 18.',
    },
    how: {
      it: 'Indicato da Take It Down per le immagini di maggiorenni.',
      en: 'Recommended by Take It Down for images of adults.',
    },
    sources: [SRC.takeitdown],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
  {
    id: 'child-helpline-international',
    group: 'world',
    country: 'INT',
    name: { it: 'Child Helpline International', en: 'Child Helpline International' },
    phone: null,
    url: 'https://childhelplineinternational.org/',
    for: {
      it: 'Trovare la linea di ascolto per bambini e ragazzi in un altro Paese.',
      en: 'Finding the child and youth helpline in another country.',
    },
    how: {
      it: 'Elenco delle linee aderenti, per regione e Paese.',
      en: 'A list of member helplines, by region and country.',
    },
    sources: [SRC.chi],
    verifiedOn: '2026-10-18',
    reviewedBy: null,
  },
];

const STR = {
  it: {
    call: (label) => `Chiama ${label}`,
    callAria: (label, name) => `Chiama ${label}, ${name}`,
    site: 'Sito ufficiale',
    siteAria: (name) => `Sito ufficiale: ${name} (si apre in una nuova scheda)`,
    source: 'Fonte',
    sources: 'Fonti',
    checked: (d) => `verificato il ${d}`,
    locale: 'it-IT',
  },
  en: {
    call: (label) => `Call ${label}`,
    callAria: (label, name) => `Call ${label}, ${name}`,
    site: 'Official website',
    siteAria: (name) => `Official website: ${name} (opens in a new tab)`,
    source: 'Source',
    sources: 'Sources',
    checked: (d) => `checked on ${d}`,
    locale: 'en-GB',
  },
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function strings(lang) {
  return STR[lang] || STR.it;
}

function fmtDay(iso, lang) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(strings(lang).locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

function pick(obj, lang) {
  return (obj && (obj[lang] || obj.it)) || '';
}

function phoneLabel(c) {
  return c.phoneLabel || c.phone;
}

function card(c, lang) {
  const s = strings(lang);
  const name = pick(c.name, lang);
  const actions = [];
  if (c.phone) {
    const label = phoneLabel(c);
    actions.push(
      `<a class="pt-help-card__call" href="tel:${esc(c.phone)}" aria-label="${esc(s.callAria(label, name))}">${esc(s.call(label))}</a>`
    );
  }
  if (c.url) {
    actions.push(
      `<a class="pt-help-card__site" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(s.siteAria(name))}">${esc(s.site)}</a>`
    );
  }
  const srcLinks = c.sources
    .map((src) => `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(pick(src.label, lang))}</a>`)
    .join(' · ');
  const srcWord = c.sources.length > 1 ? s.sources : s.source;
  return `<li class="pt-help-card pt-help-card--${esc(c.group)}" data-contact="${esc(c.id)}">
        <p class="pt-help-card__name" translate="no">${esc(name)}</p>
        <p class="pt-help-card__for">${esc(pick(c.for, lang))}</p>
        <p class="pt-help-card__how">${esc(pick(c.how, lang))}</p>
        ${actions.length ? `<p class="pt-help-card__actions">${actions.join(' ')}</p>` : ''}
        <p class="pt-help-card__src">${esc(srcWord)}: ${srcLinks} · ${esc(s.checked(fmtDay(c.verifiedOn, lang)))}</p>
      </li>`;
}

/**
 * Tutti i contatti, divisi per gruppo.
 * @param {string} lang
 * @param {{ heading?: 'h2'|'h3'|'h4', groups?: string[] }} [opts]
 */
function renderHelpContacts(lang, opts = {}) {
  const heading = ['h2', 'h3', 'h4'].includes(opts.heading) ? opts.heading : 'h3';
  const wanted = Array.isArray(opts.groups) && opts.groups.length ? opts.groups : GROUPS.map((g) => g.id);
  const blocks = GROUPS.filter((g) => wanted.includes(g.id))
    .map((g) => {
      const items = CONTACTS.filter((c) => c.group === g.id);
      if (!items.length) return '';
      return `<section class="pt-help-group pt-help-group--${g.id}" aria-labelledby="pt-help-${g.id}">
      <${heading} class="pt-help-group__title" id="pt-help-${g.id}">${esc(pick(g.title, lang))}</${heading}>
      <ul class="pt-help-list" role="list">
      ${items.map((c) => card(c, lang)).join('\n      ')}
      </ul>
    </section>`;
    })
    .filter(Boolean);
  return `<div class="pt-help-groups">\n    ${blocks.join('\n    ')}\n  </div>`;
}

/** I numeri da chiamare subito, in una riga di pulsanti (per il modulo di contatto e i riquadri). */
function renderHelpNumbers(lang) {
  const s = strings(lang);
  const ids = ['nue-112', 'emergenza-infanzia-114', 'telefono-azzurro-19696'];
  const links = ids
    .map((id) => CONTACTS.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => {
      const label = phoneLabel(c);
      const name = pick(c.name, lang);
      return `<a class="pt-help-number" href="tel:${esc(c.phone)}" aria-label="${esc(s.callAria(label, name))}" translate="no"><b>${esc(label)}</b> <span>${esc(pick(c.short, lang) || name)}</span></a>`;
    });
  return `<p class="pt-help-numbers">${links.join(' ')}</p>`;
}

/** Contatti la cui verifica è più vecchia di maxAgeDays (o con data non valida). */
function staleContacts(now = Date.now(), maxAgeDays = MAX_AGE_DAYS) {
  return CONTACTS.filter((c) => {
    const t = Date.parse(`${c.verifiedOn}T00:00:00Z`);
    if (!Number.isFinite(t)) return true;
    const days = (now - t) / 864e5;
    return days > maxAgeDays || days < -1;
  });
}

module.exports = {
  MAX_AGE_DAYS,
  GROUPS,
  CONTACTS,
  renderHelpContacts,
  renderHelpNumbers,
  staleContacts,
  fmtDay,
};
