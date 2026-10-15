'use strict';
/**
 * PDF del diploma: A4 orizzontale, fondo chiaro da stampare,
 * accenti nella palette del sito, stessa impronta e stesso QR delle pagine.
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { fingerprint, microtextFor, glyphsOnCircle, qrMatrix, titleInLang } = require('./certificates');

const PAGE = { width: 841.89, height: 595.28 }; // A4 landscape in punti

function registerGeorgia(doc) {
  const candidates = [
    'C:\\Windows\\Fonts\\georgia.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Georgia.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
    '/Library/Fonts/Georgia.ttf',
    path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSerif.ttf'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        doc.registerFont('DiplomaSerif', file);
        const bold = file.replace(/georgia\.ttf/i, 'georgiab.ttf')
          .replace(/LiberationSerif-Regular/, 'LiberationSerif-Bold')
          .replace(/DejaVuSerif\.ttf$/i, 'DejaVuSerif-Bold.ttf');
        if (fs.existsSync(bold)) doc.registerFont('DiplomaSerif-Bold', bold);
        else doc.registerFont('DiplomaSerif-Bold', file);
        return { regular: 'DiplomaSerif', bold: 'DiplomaSerif-Bold' };
      } catch {
        /* prova il successivo */
      }
    }
  }
  return { regular: 'Times-Roman', bold: 'Times-Bold' };
}

function drawPaths(doc, fp, x, y, scale) {
  doc.save();
  doc.translate(x, y);
  doc.scale(scale);
  for (const p of fp.paths) {
    if (!p.d) continue;
    doc.save();
    doc.strokeColor(p.stroke || '#05070b');
    doc.lineWidth(p.width || 0.5);
    doc.opacity(p.opacity == null ? 1 : p.opacity);
    doc.path(p.d).stroke();
    doc.restore();
  }
  doc.restore();
}

function drawQr(doc, url, x, y, size, color) {
  const { size: n, cells } = qrMatrix(url);
  const cell = size / n;
  doc.save();
  doc.fillColor(color);
  for (const [cx, cy] of cells) {
    doc.rect(x + cx * cell, y + cy * cell, cell, cell).fill();
  }
  doc.restore();
}

function formatDate(iso, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = lang === 'en' ? 'en-GB' : 'it-IT';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function labels(lang) {
  if (lang === 'en') {
    return {
      diploma: 'Diploma',
      of: 'has completed',
      score: 'Score',
      code: 'Code',
      issued: 'Issued',
      sign: 'EVIL · cybersecurity training platform',
      verify: 'Verify at',
    };
  }
  return {
    diploma: 'Diploma',
    of: 'ha completato',
    score: 'Punteggio',
    code: 'Codice',
    issued: 'Emesso il',
    sign: 'EVIL · piattaforma didattica di cybersecurity',
    verify: 'Verifica su',
  };
}

function buildCertificatePdf({ certificate, verifyUrl, lang = 'it' }) {
  const L = labels(lang);
  const course = titleInLang(certificate, lang);
  const fp = fingerprint(certificate.signature);
  const micro = microtextFor(certificate.name, certificate.code);
  const glyphs = glyphsOnCircle(micro, fp.microCircle.cx, fp.microCircle.cy, fp.microCircle.r);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    info: {
      Title: `EVIL — ${L.diploma} — ${course}`,
      Author: 'EVIL',
      Subject: certificate.code,
    },
  });
  const serif = registerGeorgia(doc);
  const W = PAGE.width;
  const H = PAGE.height;

  doc.rect(0, 0, W, H).fill('#f7f4ea');

  // doppia cornice
  doc.lineWidth(1.6).strokeColor(fp.colors.primary).rect(18, 18, W - 36, H - 36).stroke();
  doc.lineWidth(0.6).strokeColor(fp.colors.secondary).rect(26, 26, W - 52, H - 52).stroke();

  doc.fillColor('#05070b').font(serif.bold).fontSize(28).text('EVIL', 48, 44, { width: 280, align: 'left' });
  doc.fillColor(fp.colors.primary).font(serif.regular).fontSize(11)
    .text(L.diploma.toUpperCase(), 48, 76, { width: 280, characterSpacing: 4 });

  doc.fillColor('#1a1d24').font(serif.bold).fontSize(16)
    .text(course, 48, 98, { width: 420 });

  doc.fillColor('#64748b').font(serif.regular).fontSize(11).text(L.of, 48, 168, { width: 420 });
  doc.fillColor('#05070b').font(serif.bold).fontSize(36)
    .text(certificate.name, 48, 186, { width: 430 });

  const metaY = 268;
  doc.font('Courier').fontSize(9).fillColor('#64748b');
  doc.text(L.issued.toUpperCase(), 48, metaY);
  doc.text(L.score.toUpperCase(), 48, metaY + 36);
  doc.text(L.code.toUpperCase(), 48, metaY + 72);
  doc.font(serif.regular).fontSize(13).fillColor('#1a1d24');
  doc.text(formatDate(certificate.issuedAt, lang), 48, metaY + 12);
  doc.text(`${certificate.score} / 100`, 48, metaY + 48);
  doc.font('Courier').fontSize(12).fillColor('#05070b').text(certificate.code, 48, metaY + 84);

  const rosetteSize = 250;
  const rosetteX = 470;
  const rosetteY = 70;
  const scale = rosetteSize / fp.size;
  drawPaths(doc, fp, rosetteX, rosetteY, scale);

  doc.save();
  doc.translate(rosetteX, rosetteY);
  doc.scale(scale);
  doc.fillColor(fp.colors.secondary);
  doc.font('Courier').fontSize(7);
  for (const g of glyphs) {
    doc.save();
    doc.translate(g.x, g.y);
    doc.rotate(g.deg);
    doc.text(g.ch, -3, -4, { lineBreak: false, width: 10 });
    doc.restore();
  }
  doc.restore();

  const qrSize = 92;
  const qrX = W - 48 - qrSize;
  const qrY = H - 48 - qrSize - 28;
  doc.rect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12).fill('#ffffff');
  drawQr(doc, verifyUrl, qrX, qrY, qrSize, '#05070b');

  doc.font(serif.regular).fontSize(9).fillColor('#1a1d24')
    .text(L.sign, 48, H - 62, { width: 400 });
  doc.font('Courier').fontSize(7).fillColor('#64748b')
    .text(`${L.verify} ${verifyUrl}`, 48, H - 46, { width: 500 });

  return doc;
}

function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

module.exports = { buildCertificatePdf, pdfToBuffer };
