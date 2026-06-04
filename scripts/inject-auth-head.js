#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const VERSION = process.env.AUTH_CHROME_VERSION || '20260610';
const root = path.join(__dirname, '..', 'html');
const block =
  `  <style id="evil-auth-pending-style">html.evil-auth-pending .auth-buttons{visibility:hidden;pointer-events:none;min-height:2.25rem}</style>\n` +
  `  <script>document.documentElement.classList.add("evil-auth-pending");</script>\n` +
  `  <script src="/js/evil-site-chrome.js?v=${VERSION}" defer></script>\n`;

const AUTH_REQUIRED_HTML =
  /^(security-check|vulnerability-scanner|dns-enumerator|subdomain-finder|ssl-analyzer|file-analysis|social-profiling|public-info|profile)\.html$/i;

const DEFER_BODY_SCRIPT_RE =
  /(?:matrixrain\.js|\/js\/js\.js|tools-api\.js|progress-manager\.js|security-check\.js|http-header-audit\.js|dns-enumerator\.js|subdomain-finder\.js|ssl-analyzer\.js|file-analysis\.js|social-profiling\.js|public-info\.js|profile-page\.js|web-simulator-lab\.js)/i;

const stripRe =
  /\s*<script[^>]*src="[^"]*(?:auth-manager|load-header|evil-site-chrome)\.js[^"]*"[^>]*>\s*<\/script>\s*/gi;
const stripStyleRe = /<style id="evil-auth-pending-style">[\s\S]*?<\/style>\s*/gi;

function injectAuthRequiredBody(html, fileName) {
  if (!AUTH_REQUIRED_HTML.test(fileName)) return html;
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/data-evil-auth/i.test(attrs)) return match;
    return `<body${attrs} data-evil-auth="required">`;
  });
}

function addDeferToBodyScripts(html) {
  return html.replace(
    /<script([^>]*)\ssrc="(\/js\/[^"]+\.js[^"]*)"([^>]*)>\s*<\/script>/gi,
    (full, before, src, after) => {
      if (/\bdefer\b/i.test(`${before} ${after}`)) return full;
      if (!DEFER_BODY_SCRIPT_RE.test(src)) return full;
      return `<script${before} src="${src}" defer${after}></script>`;
    }
  );
}

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
    html = injectAuthRequiredBody(html, name);
    html = addDeferToBodyScripts(html);

    fs.writeFileSync(p, html, 'utf8');
    console.log('ok', path.relative(root, p));
  }
}

walk(root);
