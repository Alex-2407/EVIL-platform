#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VERSION = process.env.AUTH_CHROME_VERSION || '20260608';
const root = path.join(__dirname, '..', 'html');
const block = `  <script src="/js/evil-site-chrome.js?v=${VERSION}" defer></script>\n`;

const stripRe =
  /\s*<script[^>]*src="[^"]*(?:auth-manager|load-header|evil-site-chrome)\.js[^"]*"[^>]*>\s*<\/script>\s*/gi;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === 'components') continue;
      walk(p);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    let html = fs.readFileSync(p, 'utf8');
    if (!/<header[\s>]/i.test(html)) continue;

    html = html.replace(stripRe, '\n');
    if (!html.includes('evil-site-chrome.js')) {
      html = html.replace('</head>', `${block}</head>`);
    }

    fs.writeFileSync(p, html, 'utf8');
    console.log('ok', path.relative(root, p));
  }
}

walk(root);
