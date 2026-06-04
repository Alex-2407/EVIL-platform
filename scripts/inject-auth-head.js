#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VERSION = process.env.AUTH_CHROME_VERSION || '20260609';
const root = path.join(__dirname, '..', 'html');
const block =
  `  <style id="evil-auth-pending-style">html.evil-auth-pending .auth-buttons{visibility:hidden;pointer-events:none;min-height:2.25rem}</style>\n` +
  `  <script>document.documentElement.classList.add("evil-auth-pending");</script>\n` +
  `  <script src="/js/evil-site-chrome.js?v=${VERSION}" defer></script>\n`;

const stripRe =
  /\s*<script[^>]*src="[^"]*(?:auth-manager|load-header|evil-site-chrome)\.js[^"]*"[^>]*>\s*<\/script>\s*/gi;
const stripStyleRe = /<style id="evil-auth-pending-style">[\s\S]*?<\/style>\s*/gi;

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
    html = html.replace(stripStyleRe, '');
    html = html.replace(
      /<script>document\.documentElement\.classList\.add\(["']evil-auth-pending["']\);<\/script>\s*/gi,
      ''
    );
    html = html.replace('</head>', `${block}</head>`);

    html = html.replace(/href="([a-z][a-z0-9-]*\.html)"/gi, (m, file) => `href="/${file}"`);

    fs.writeFileSync(p, html, 'utf8');
    console.log('ok', path.relative(root, p));
  }
}

walk(root);
