#!/usr/bin/env node
/**
 * Audit rapido: asset mancanti, chrome pagine, link rotti comuni
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');
const cssDir = path.join(root, 'css');
const jsDir = path.join(root, 'js');

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walkHtml(full, out);
      continue;
    }
    if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function extractAssets(html) {
  const css = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]);
  const js = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  return { css, js };
}

function resolveAsset(href) {
  if (href.startsWith('http') || href.startsWith('//')) return null;
  const clean = href.split('?')[0].replace(/^\//, '');
  if (clean.startsWith('css/')) return path.join(root, clean);
  if (clean.startsWith('js/')) return path.join(root, clean);
  return null;
}

const requiredCss = ['system-theme.css', 'responsive.css', 'galaxy-btn.css', 'evil-scrollbar.css'];
const missingFiles = requiredCss.filter((f) => !fs.existsSync(path.join(cssDir, f)));
if (missingFiles.length) {
  console.error('CSS mancanti in css/:', missingFiles.join(', '));
  process.exit(1);
}

const pages = walkHtml(htmlDir).filter((p) => !p.includes('components'));
const issues = [];

pages.forEach((filePath) => {
  const rel = path.relative(htmlDir, filePath).replace(/\\/g, '/');
  const html = fs.readFileSync(filePath, 'utf8');
  const hasHeader = /<header[\s>]/i.test(html);
  const hasFooter = html.includes('evil-site-foot');

  if (hasHeader && !html.includes('load-header.js')) {
    issues.push(`${rel}: manca load-header.js`);
  }
  if (hasHeader && !html.includes('site-header.css')) {
    issues.push(`${rel}: manca site-header.css`);
  }
  if (hasFooter && !html.includes('site-footer.css')) {
    issues.push(`${rel}: manca site-footer.css`);
  }
  if (!html.includes('responsive.css')) {
    issues.push(`${rel}: manca responsive.css`);
  }
  if (!html.includes('viewport-fit=cover')) {
    issues.push(`${rel}: viewport senza safe-area (viewport-fit=cover)`);
  }

  const { css, js } = extractAssets(html);
  [...css, ...js].forEach((href) => {
    const local = resolveAsset(href);
    if (local && !fs.existsSync(local)) {
      issues.push(`${rel}: asset 404 locale ${href}`);
    }
  });
});

if (issues.length) {
  console.log('Problemi trovati:\n');
  issues.forEach((i) => console.log('  -', i));
  process.exit(1);
}

console.log(`OK: ${pages.length} pagine HTML verificate, asset locali presenti.`);
