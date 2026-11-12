#!/usr/bin/env node
// Monthly check of every vendor page cited as a "source" in data/macros.json.
//
// Each page is fetched once, one request per second, and reduced to its main
// text (no scripts, navigation, headers or footers, whitespace collapsed). The
// SHA-256 of that text is compared with data/source-hashes.json. Pages whose
// text changed are listed in a single open issue so a maintainer can re-verify
// the macros that cite them; the issue keeps collecting changes until it is
// closed.
//
//   node scripts/watch-sources.mjs              check, update data/source-hashes.json, print the would-be issue
//   node scripts/watch-sources.mjs --issue      same, and open or update the GitHub issue (needs GITHUB_TOKEN)
//   node scripts/watch-sources.mjs --no-write   check only, leave data/source-hashes.json alone
//
// A page seen for the first time is recorded without a report. A page that
// cannot be fetched keeps its stored hash; a 404 or 410 is reported as missing.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { githubClient, findIssue, upsertIssue, runUrl } from './github-issue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HASHES = join(ROOT, 'data', 'source-hashes.json');
export const TOPIC = 'vendor-docs-changed';
const USER_AGENT = 'affiliate-postback-macros source watch (+https://github.com/moonetix/affiliate-postback-macros)';
const DELAY_MS = 1000;
const TIMEOUT_MS = 30000;
const MIN_CHARS = 300;

// Every distinct page cited as a source, without the #fragment, with the
// vendors that cite it.
export function collectSources(data) {
  const pages = new Map();
  const add = (url, vendor) => {
    const page = url.split('#')[0];
    if (!pages.has(page)) pages.set(page, new Set());
    pages.get(page).add(vendor);
  };
  const walk = (node, vendor) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, vendor));
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'source' && typeof value === 'string' && value.startsWith('https://')) add(value, vendor);
      else walk(value, vendor);
    }
  };
  for (const group of ['tracking_platforms', 'offerwall_networks']) {
    for (const entry of data[group] ?? []) walk(entry, entry.id);
  }
  for (const [key, value] of Object.entries(data)) {
    if (!['tracking_platforms', 'offerwall_networks'].includes(key)) walk(value, 'general');
  }
  return new Map([...pages].sort(([a], [b]) => a.localeCompare(b)).map(([url, v]) => [url, [...v].sort()]));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: '(c)', reg: '(r)', trade: '(tm)' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? all;
  });
}

// Reduces a page to the text a reader sees in its main content area, so that
// a new cookie banner, script bundle or navigation item does not count as a change.
export function normalizeText(body, contentType = 'text/html') {
  let text = body;
  if (/html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(body)) {
    text = text
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|iframe|head|button|select|form)\b[\s\S]*?<\/\1\s*>/gi, ' ');
    const main = /<main\b[^>]*>([\s\S]*)<\/main\s*>/i.exec(text) ?? /<article\b[^>]*>([\s\S]*)<\/article\s*>/i.exec(text) ?? /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(text);
    if (main) text = main[1];
    text = text
      .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<\/?(p|div|section|li|ul|ol|tr|table|h[1-6]|pre|br|hr|dt|dd|blockquote)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    text = decodeEntities(text);
  }
  return text
    .replace(/\b(updated|edited|modified|published)\b[^\n]{0,40}?\b(ago|yesterday|today)\b/gi, ' ')
    .replace(/\b(about |over |almost )?(an?|\d+) (second|minute|hour|day|week|month|year)s? ago\b/gi, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// Bot-protection pages are reported as fetch errors, never as content changes.
export function looksBlocked(status, body) {
  return /cf-chl|challenge-platform|just a moment\.\.\.|attention required|enable javascript and cookies to continue|captcha/i.test(body.slice(0, 20000)) && (status === 403 || status === 503 || status === 429 || body.length < 30000);
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.8' },
    });
    const body = await res.text();
    if (looksBlocked(res.status, body)) return { kind: 'error', detail: `bot protection page (HTTP ${res.status})` };
    if (res.status === 404 || res.status === 410) return { kind: 'missing', detail: `HTTP ${res.status}` };
    if (!res.ok) return { kind: 'error', detail: `HTTP ${res.status}` };
    const text = normalizeText(body, res.headers.get('content-type') ?? '');
    // A near-empty result means the page now renders in the browser only, or
    // the layout moved; hashing it would hide every later change.
    if (text.length < MIN_CHARS) return { kind: 'error', detail: `only ${text.length} characters of text` };
    return { kind: 'ok', text, finalUrl: res.url };
  } catch (err) {
    return { kind: 'error', detail: err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? err.message) };
  }
}

// Pure comparison step, kept separate so it can be tested without the network.
export function compare(sources, stored, fetched, today) {
  const next = {};
  const changed = [];
  const missing = [];
  const errors = [];
  const added = [];
  for (const [url, vendors] of sources) {
    const old = stored[url];
    const got = fetched.get(url);
    if (!got || got.kind !== 'ok') {
      if (old) next[url] = { ...old, vendors };
      if (got?.kind === 'missing') missing.push({ url, vendors, detail: got.detail });
      else errors.push({ url, vendors, detail: got?.detail ?? 'not fetched' });
      continue;
    }
    const hash = sha256(got.text);
    if (!old) {
      next[url] = { sha256: hash, chars: got.text.length, changed: today, vendors };
      added.push({ url, vendors });
    } else if (old.sha256 !== hash) {
      next[url] = { sha256: hash, chars: got.text.length, changed: today, vendors };
      changed.push({ url, vendors, before: old.chars, after: got.text.length });
    } else {
      next[url] = { ...old, vendors };
    }
  }
  const dropped = Object.keys(stored).filter((url) => !sources.has(url));
  return { next, changed, missing, errors, added, dropped };
}

const PENDING_RX = /<!-- pending: (\[[\s\S]*?\]) -->/;

export function pendingFromBody(body) {
  const m = PENDING_RX.exec(body ?? '');
  if (!m) return [];
  try {
    return JSON.parse(m[1]);
  } catch {
    return [];
  }
}

// Issue body: everything reported since the issue was opened, newest first.
export function issueBody({ pending, names, run }) {
  const rows = [...pending]
    .sort((a, b) => (b.detected.localeCompare(a.detected)) || a.url.localeCompare(b.url))
    .map((p) => `| ${p.vendors.map((v) => names[v] ?? v).join(', ')} | ${p.url} | ${p.kind === 'missing' ? 'page missing' : 'text changed'} | ${p.detected} |`);
  return [
    'The main text of these vendor pages changed since the last check. Re-verify the entries in `data/macros.json` that cite them, update the data and the `checked` month where needed, then close this issue.',
    '',
    '| Vendor | Page | Change | Detected |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
    'The comparison ignores scripts, navigation, headers, footers and whitespace, so a listed page may have changed only in wording. The stored hashes are in `data/source-hashes.json`.',
    '',
    `Last run: ${run}`,
    '',
    `<!-- pending: ${JSON.stringify(pending)} -->`,
  ].join('\n');
}

function vendorNames(data) {
  const names = { general: 'General' };
  for (const group of ['tracking_platforms', 'offerwall_networks']) for (const e of data[group] ?? []) names[e.id] = e.name;
  return names;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const data = JSON.parse(readFileSync(join(ROOT, 'data', 'macros.json'), 'utf8'));
  const file = JSON.parse(readFileSync(HASHES, 'utf8'));
  const sources = collectSources(data);
  const today = new Date().toISOString().slice(0, 10);

  const fetched = new Map();
  let i = 0;
  for (const url of sources.keys()) {
    if (i++ > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    let got = await fetchPage(url);
    if (got.kind === 'error') {
      await new Promise((r) => setTimeout(r, 5000));
      got = await fetchPage(url);
    }
    fetched.set(url, got);
    console.log(`${got.kind.padEnd(7)} ${got.kind === 'ok' ? `${got.text.length} chars` : got.detail}  ${url}`);
  }

  const result = compare(sources, file.sources ?? {}, fetched, today);
  console.log(`\n${sources.size} pages: ${result.changed.length} changed, ${result.missing.length} missing, ${result.errors.length} not reachable, ${result.added.length} recorded for the first time, ${result.dropped.length} no longer cited`);

  const summary = [
    `## Vendor source watch`,
    '',
    `${sources.size} pages checked. ${result.changed.length} changed, ${result.missing.length} missing, ${result.errors.length} not reachable, ${result.added.length} new.`,
    ...(result.errors.length ? ['', '| Not reachable | Detail |', '| --- | --- |', ...result.errors.map((e) => `| ${e.url} | ${e.detail} |`)] : []),
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');

  const reported = [
    ...result.changed.map((c) => ({ url: c.url, vendors: c.vendors, kind: 'changed', detected: today })),
    ...result.missing.map((m) => ({ url: m.url, vendors: m.vendors, kind: 'missing', detected: today })),
  ];

  if (reported.length) {
    const request = args.has('--issue') ? githubClient() : null;
    if (args.has('--issue') && !request) throw new Error('--issue needs GITHUB_TOKEN and GITHUB_REPOSITORY');
    const open = request ? await findIssue(request, TOPIC) : null;
    const pending = new Map(pendingFromBody(open?.body).map((p) => [p.url, p]));
    for (const r of reported) pending.set(r.url, r);
    const all = [...pending.values()];
    const title = `Vendor docs changed: ${all.length} page${all.length === 1 ? '' : 's'} to re-verify`;
    const comment = open ? `New this run (${today}):\n\n${reported.map((r) => `- ${r.url} (${r.kind === 'missing' ? 'page missing' : 'text changed'})`).join('\n')}` : undefined;
    await upsertIssue(request, { topic: TOPIC, title, body: issueBody({ pending: all, names: vendorNames(data), run: runUrl() }), comment });
  } else {
    console.log('Nothing to report.');
  }

  const sorted = Object.fromEntries(Object.entries(result.next).sort(([a], [b]) => a.localeCompare(b)));
  const output = JSON.stringify({ about: file.about, sources: sorted }, null, 2) + '\n';
  if (args.has('--no-write')) return;
  if (output !== readFileSync(HASHES, 'utf8')) {
    writeFileSync(HASHES, output);
    console.log('data/source-hashes.json updated.');
  } else {
    console.log('data/source-hashes.json unchanged.');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
