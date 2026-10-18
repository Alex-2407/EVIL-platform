'use strict';
/**
 * Pezzi di pagina generati dal server nella lingua della pagina (docs/evil-per-tutti/PIANO.md, T3).
 *
 * Nella pagina HTML si scrive un segnaposto, da solo e fuori dai paragrafi:
 *   <div class="pt-help"><!--evil:fragment:help-contacts--></div>
 * renderPage lo sostituisce DOPO la traduzione, così i dati (per esempio i contatti di aiuto,
 * con fonte e data di verifica) hanno una sola fonte e arrivano già nella lingua giusta.
 */

const { renderHelpContacts, renderHelpNumbers } = require('./lib/help-contacts');
const { renderMascot } = require('./lib/mascot');

const FRAGMENTS = {
  'help-contacts': (lang) => renderHelpContacts(lang, { heading: 'h3' }),
  'help-numbers': (lang) => renderHelpNumbers(lang),
  // Lù (docs/evil-per-tutti/STILE.md): pulsante interattivo o immagine decorativa
  mascot: (lang) => renderMascot(lang, { size: 'lg' }),
  'mascot-md': (lang) => renderMascot(lang, { size: 'md' }),
  'mascot-help': (lang) => renderMascot(lang, { size: 'lg', mood: 'help', interactive: false }),
  'mascot-small': (lang) => renderMascot(lang, { size: 'sm', interactive: false }),
};

const PLACEHOLDER = /<!--evil:fragment:([a-z0-9-]+)-->/g;

/** Sostituisce i segnaposto noti; quelli sconosciuti restano commenti (innocui). */
function fillFragments(html, lang) {
  if (typeof html !== 'string' || !html.includes('<!--evil:fragment:')) return html;
  return html.replace(PLACEHOLDER, (m, name) => (Object.hasOwn(FRAGMENTS, name) ? FRAGMENTS[name](lang) : m));
}

module.exports = { fillFragments, FRAGMENTS };
