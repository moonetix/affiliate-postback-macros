import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectSources, normalizeText, compare, sha256, pendingFromBody, issueBody, looksBlocked } from '../scripts/watch-sources.mjs';

test('collects each cited page once, without the fragment, with every vendor that cites it', () => {
  const data = {
    concepts: [{ id: 'click_id' }],
    tracking_platforms: [{ id: 'a', website: 'https://a.example', inbound: { source: 'https://docs.a.example/p#one' }, macros: [{ source: 'https://docs.a.example/p#two' }] }],
    offerwall_networks: [{ id: 'b', source: 'https://docs.a.example/p', signature: [{ source: 'https://docs.b.example/s' }] }],
  };
  const pages = collectSources(data);
  assert.deepEqual([...pages.keys()], ['https://docs.a.example/p', 'https://docs.b.example/s']);
  assert.deepEqual(pages.get('https://docs.a.example/p'), ['a', 'b']);
});

test('normalized text ignores scripts, navigation, footers, markup and whitespace', () => {
  const a = '<html><head><title>x</title><script>var t=1</script></head><body><nav>Home Pricing</nav><main><h1>Postbacks</h1><p>Send   {clickid}&amp;sum</p></main><footer>(c) 2026</footer></body></html>';
  const b = '<html><head><script>var t=2</script></head><body><nav>Home Blog Pricing</nav><main class="x">\n<h1>Postbacks</h1>\n<p>Send {clickid}&#38;sum</p></main><footer>(c) 2027</footer></body></html>';
  assert.equal(normalizeText(a), 'Postbacks\nSend {clickid}&sum');
  assert.equal(normalizeText(a), normalizeText(b));
  assert.notEqual(normalizeText(a), normalizeText(a.replace('{clickid}', '{click_id}')));
});

test('relative timestamps do not count as a change', () => {
  assert.equal(normalizeText('<main><p>Updated 3 days ago</p><p>Body</p></main>'), normalizeText('<main><p>Updated 5 months ago</p><p>Body</p></main>'));
});

test('content inside template elements is kept (Wiki.js help centers render pages that way)', () => {
  assert.match(normalizeText('<body><div id="root"><template slot="contents"><p>status token</p></template></div></body>'), /status token/);
});

test('compare reports changed and missing pages, records new ones quietly, and keeps hashes on errors', () => {
  const sources = new Map([['u1', ['a']], ['u2', ['a']], ['u3', ['b']], ['u4', ['b']], ['u5', ['c']]]);
  const stored = {
    u1: { sha256: sha256('same'), chars: 4, changed: '2026-10-01', vendors: ['a'] },
    u2: { sha256: sha256('old'), chars: 3, changed: '2026-10-01', vendors: ['a'] },
    u3: { sha256: sha256('x'), chars: 1, changed: '2026-10-01', vendors: ['b'] },
    u4: { sha256: sha256('y'), chars: 1, changed: '2026-10-01', vendors: ['b'] },
    gone: { sha256: sha256('z'), chars: 1, changed: '2026-10-01', vendors: ['d'] },
  };
  const fetched = new Map([
    ['u1', { kind: 'ok', text: 'same' }],
    ['u2', { kind: 'ok', text: 'new text' }],
    ['u3', { kind: 'missing', detail: 'HTTP 404' }],
    ['u4', { kind: 'error', detail: 'timeout' }],
    ['u5', { kind: 'ok', text: 'first' }],
  ]);
  const r = compare(sources, stored, fetched, '2026-12-02');
  assert.deepEqual(r.changed.map((c) => c.url), ['u2']);
  assert.deepEqual(r.missing.map((c) => c.url), ['u3']);
  assert.deepEqual(r.errors.map((c) => c.url), ['u4']);
  assert.deepEqual(r.added.map((c) => c.url), ['u5']);
  assert.deepEqual(r.dropped, ['gone']);
  assert.equal(r.next.u1.changed, '2026-10-01');
  assert.equal(r.next.u2.sha256, sha256('new text'));
  assert.equal(r.next.u2.changed, '2026-12-02');
  assert.equal(r.next.u3.sha256, stored.u3.sha256, 'a missing page keeps its hash');
  assert.equal(r.next.u4.sha256, stored.u4.sha256, 'a fetch error keeps its hash');
  assert.ok(!('gone' in r.next));
});

test('the issue body carries its pending list, so a later run can add to it', () => {
  const pending = [{ url: 'https://a.example/p', vendors: ['a'], kind: 'changed', detected: '2026-11-02' }];
  const body = issueBody({ pending, names: { a: 'Vendor A' }, run: 'https://github.com/run/1' });
  assert.match(body, /\| Vendor A \| https:\/\/a\.example\/p \| text changed \| 2026-11-02 \|/);
  assert.deepEqual(pendingFromBody(body), pending);
  assert.deepEqual(pendingFromBody('edited by hand'), []);
});

test('bot protection pages are not treated as content', () => {
  assert.ok(looksBlocked(403, '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/x"></script>'));
  assert.ok(!looksBlocked(200, '<main>Postback captcha settings are described below.</main>' + 'x'.repeat(40000)));
});
