#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VERSION = process.env.AUTH_CHROME_VERSION || '20260607';
const root = path.join(__dirname, '..', 'html');
const block =
  `  <script src="/js/auth-manager.js?v=${VERSION}"></script>\n` +
  `  <script src="/js/load-header.js?v=${VERSION}" defer></script>\n`;

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

    html = html.replace(/\s*<script[^>]*auth-manager\.js[^>]*>\s*<\/script>\s*/gi, '\n');
    html = html.replace(/\s*<script[^>]*load-header\.js[^>]*>\s*<\/script>\s*/gi, '\n');

    if (!html.includes('auth-manager.js')) {
      html = html.replace('</head>', `${block}</head>`);
    }

    fs.writeFileSync(p, html, 'utf8');
    console.log('injected:', path.relative(root, p));
  }
}

walk(root);
