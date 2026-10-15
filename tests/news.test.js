'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFeed, createNewsService, toText } = require('../services/news-service');

const NOW = Date.parse('2026-10-15T12:00:00Z');
const SRC = { id: 't', name: 'Testata', lang: 'en' };
const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[LockBit ransomware hits hospital &amp; steals data]]></title><link>https://example.com/a</link>
<pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Attackers exploited <b>CVE-2026-1234</b> to get in.</p>]]></description></item>
<item><title>Link pericoloso</title><link>javascript:alert(1)</link><pubDate>Thu, 15 Oct 2026 10:00:00 GMT</pubDate></item>
<item><title>Senza data</title><link>https://example.com/c</link></item>
</channel></rss>`;
const ATOM = `<feed><entry><title>Phishing campaign</title><link rel="alternate" href="https://example.com/p"/><updated>2026-10-15T09:00:00Z</updated><summary>Truffa via email</summary></entry></feed>`;

test('parseFeed: RSS con CDATA, tag, CVE e scarto di link non http(s)', () => {
  const items = parseFeed(RSS, SRC, NOW);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'LockBit ransomware hits hospital & steals data');
  assert.ok(items[0].tags.includes('ransomware'));
  assert.deepEqual(items[0].cve, ['CVE-2026-1234']);
  assert.ok(!items[0].summary.includes('<'));
});

test('parseFeed: Atom', () => {
  const items = parseFeed(ATOM, SRC, NOW);
  assert.equal(items[0].link, 'https://example.com/p');
  assert.ok(items[0].tags.includes('phishing'));
});

test('toText rimuove script e tag', () => {
  assert.equal(toText('<script>x()</script><p>Ciao&nbsp;<b>mondo</b></p>'), 'Ciao mondo');
});

test('refresh: tiene gli articoli delle fonti che non rispondono', async () => {
  let fail = false;
  const svc = createNewsService({
    now: () => NOW,
    sources: [SRC, { id: 'u', name: 'Altra', lang: 'it' }],
    fetchText: async (url) => {
      if (fail && url.includes('/b')) throw new Error('down');
      return url.includes('/b') ? ATOM : RSS;
    },
  });
  svc.SOURCES[0].url = 'https://x/a'; svc.SOURCES[1].url = 'https://x/b';
  let snap = await svc.refresh();
  assert.equal(snap.items.length, 2);
  fail = true;
  snap = await svc.refresh();
  assert.equal(snap.items.length, 2);
  assert.equal(snap.sources.find((s) => s.id === 'u').ok, false);
});

test('GET /api/news risponde con articoli simulati', async () => {
  const { createTestApp, request } = require('./helpers/app');
  const { createNewsService: mk } = require('../services/news-service');
  const svc = mk({ now: () => Date.now(), sources: [{ ...SRC, url: 'https://x/a' }], fetchText: async () => RSS.replace(/2026-10-15|15 Oct 2026/g, (m) => m) });
  const { app } = await createTestApp({ newsService: svc });
  const res = await request(app).get("/api/news");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'success');
  assert.ok(Array.isArray(res.body.items));
});
