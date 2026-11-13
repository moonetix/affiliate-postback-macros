import {
  DIRECTION_LABEL, monthLabel, hostOf, networkParams, trackingParams, senderMacro, firstMacro, pickMacro, coverage,
} from './builder.js';

const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid !== null && kid !== undefined && kid !== '') node.append(kid);
  return node;
};
const src = (url, label = 'Source') => el('a', { href: url, class: 'src', text: label });
const code = (text) => el('code', { text });
const exampleBlock = (label, text, what) => el('div', { class: 'code example' },
  el('div', { class: 'code-bar' },
    el('span', { text: label }),
    el('button', { type: 'button', class: 'copy', 'data-copy': true, 'aria-label': `Copy the ${what}`, text: 'Copy' })),
  el('pre', { class: 'wrap', tabindex: '0' }, code(text)));

let data;
let concepts;
let entries = [];
const builder = { rows: [] };
const DEFAULT_ENDPOINT = 'https://yoursite.com/postback';

const conceptLabel = (id) => concepts.get(id)?.label ?? id;

function makeEntries() {
  const tracking = data.tracking_platforms.map((p) => ({ type: 'tracking', item: p }));
  const networks = data.offerwall_networks.map((n) => ({ type: 'network', item: n }));
  for (const e of [...tracking, ...networks]) {
    e.hay = searchText(e).toLowerCase();
  }
  return [...tracking, ...networks];
}

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

function searchText(entry) {
  const parts = collectStrings(entry.item, []);
  for (const m of entry.item.macros) parts.push(conceptLabel(m.concept));
  if (entry.item.macros.some((m) => m.direction)) {
    for (const m of entry.item.macros) parts.push(DIRECTION_LABEL[m.direction]);
  }
  parts.push(entry.type === 'tracking' ? 'tracking platform' : 'offerwall network');
  return parts.join('\n');
}

function renderStats() {
  const latest = [...data.tracking_platforms, ...data.offerwall_networks].map((x) => x.checked).sort().at(-1);
  const sources = new Set(collectStrings(data, []).filter((s) => s.startsWith('https://') && !s.includes(' ')));
  const items = [
    `${data.tracking_platforms.length} tracking platforms`,
    `${data.offerwall_networks.length} offerwall networks`,
    `${data.concepts.length} concepts`,
    `Sources checked ${monthLabel(latest)}`,
  ];
  for (const text of items) $('#stats').append(el('li', { class: 'chip', text }));
  $('#edition').textContent = `Edition ${monthLabel(data.edition)}. ${sources.size} distinct vendor pages are cited. A monthly workflow fetches each cited page and opens an issue when one changes.`;
}

function renderGlance() {
  const networks = data.offerwall_networks;
  const tbody = $('#g-sign tbody');
  for (const n of networks) {
    const s = n.signature;
    tbody.append(el('tr', {},
      el('th', { scope: 'row' }, el('a', { href: `#${n.id}`, text: n.name })),
      el('td', {}, ...(s
        ? [el('a', { href: s.source, text: s.scheme }), el('span', { class: 'muted small block', text: `Sent in: ${s.location}` })]
        : [el('a', { href: n.source, text: 'None documented' })])),
      el('td', {}, n.reversal ? el('a', { href: n.reversal.source, text: 'Documented' }) : el('span', { class: 'muted', text: 'n/d' })),
    ));
  }
  const signed = networks.filter((n) => n.signature).length;
  const reversed = networks.filter((n) => n.reversal).length;
  $('#g-sign-sum').textContent = `${signed} of ${networks.length} networks document a signature or a shared secret, and ${reversed} of ${networks.length} document how a reversal arrives. Each link opens the vendor page.`;

  const trackers = data.tracking_platforms;
  for (const p of trackers) {
    const click = pickMacro(p.macros, 'click_id', ['inbound']);
    const security = p.security.flatMap((s, i) => [i ? ', ' : '', el('a', { href: s.source, text: s.mechanism })]);
    $('#g-track tbody').append(el('tr', {},
      el('th', { scope: 'row' }, el('a', { href: `#${p.id}`, text: p.name })),
      el('td', {}, click ? el('a', { href: click.source }, code(click.macro)) : el('span', { class: 'muted', text: 'n/d' })),
      el('td', {}, ...(security.length ? security : [el('span', { class: 'muted', text: 'n/d' })])),
    ));
  }
  const allowlists = trackers.filter((p) => p.security.some((s) => /allowlist/i.test(s.mechanism))).length;
  $('#g-track-sum').textContent = `${allowlists} of ${trackers.length} platforms document an IP allowlist for inbound postbacks. The parameter is the one that carries the platform's click ID back.`;

  const groups = [
    ['#g-cover-ow', data.mapping.offerwall, networks],
    ['#g-cover-tp', data.mapping.tracking, trackers],
  ];
  for (const [sel, rows, platforms] of groups) {
    for (const row of coverage(rows, platforms)) {
      const fill = el('span');
      fill.style.width = `${(row.have / row.total) * 100}%`;
      $(sel).append(el('li', {},
        el('span', { class: 'cover-label', text: row.label }),
        el('span', { class: 'meter', 'aria-hidden': 'true' }, fill),
        el('span', { class: 'cover-n', text: `${row.have} of ${row.total}` }),
        row.missing.length ? el('span', { class: 'cover-miss muted small', text: `n/d: ${row.missing.join(', ')}` }) : '',
      ));
    }
  }

  $('#jq-out').textContent = networks.map((n) => `${n.name}\t${n.signature?.scheme ?? 'none documented'}`).join('\n');
  const payout = data.tracking_platforms.find((p) => p.id === 'voluum')?.macros.find((m) => m.direction === 'outbound' && m.concept === 'amount');
  if (payout) $('#node-out').textContent = `${payout.macro} ${payout.source}`;
}

function securitySummary(entry) {
  const x = entry.item;
  if (entry.type === 'network') return x.signature ? x.signature.scheme : 'No signature documented';
  return x.security.length ? x.security.map((s) => s.mechanism).join(', ') : 'No security documented';
}

function factRow(dl, term, content) {
  dl.append(el('dt', { text: term }), el('dd', {}, ...content));
}

function fact(f, missing = 'Not documented on the linked pages.') {
  return f ? [f.detail, ' ', src(f.source)] : [el('span', { class: 'muted', text: missing })];
}

function macroTable(item, withDirection) {
  const head = ['Concept', 'Macro', 'Notes', 'Source'];
  if (withDirection) head.unshift('Where');
  const thead = el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col', text: h }))));
  const tbody = el('tbody');
  for (const m of item.macros) {
    const tr = el('tr', { 'data-text': [m.macro, m.note ?? '', conceptLabel(m.concept)].join(' ').toLowerCase() });
    if (withDirection) tr.append(el('td', { text: DIRECTION_LABEL[m.direction] }));
    tr.append(
      el('td', { text: conceptLabel(m.concept) }),
      el('td', {}, code(m.macro)),
      el('td', { text: m.note ?? '' }),
      el('td', {}, src(m.source)),
    );
    tbody.append(tr);
  }
  return el('div', { class: 'scroll' }, el('table', { class: 'macros' }, thead, tbody));
}

function renderNetwork(n, body) {
  body.append(el('p', { class: 'meta' },
    el('a', { href: n.website, text: hostOf(n.website) }),
    ` · Method: ${n.method} · Sources checked ${monthLabel(n.checked)} · `,
    src(n.source, 'Postback docs')));
  if (n.example) body.append(exampleBlock('Example postback', n.example, `${n.name} example postback`));
  body.append(el('h4', { text: 'Macros' }), macroTable(n, false));
  const dl = el('dl', { class: 'facts' });
  if (n.signature) {
    const s = n.signature;
    factRow(dl, 'Signature', [el('strong', { text: s.scheme }), el('br'),
      el('span', { class: 'muted', text: 'Signed input: ' }), s.input, el('br'),
      el('span', { class: 'muted', text: 'Sent in: ' }), s.location, el('br'),
      el('span', { class: 'muted', text: 'Key: ' }), s.key, el('br'),
      s.detail, ' ', src(s.source)]);
  } else {
    factRow(dl, 'Signature', [el('span', { class: 'muted', text: 'None documented. ' }), src(n.source)]);
  }
  factRow(dl, 'Reversals', fact(n.reversal));
  factRow(dl, 'Response', fact(n.response));
  factRow(dl, 'Source IPs', fact(n.ip_allowlist));
  if (n.notes) factRow(dl, 'Notes', [n.notes]);
  body.append(dl);
}

function renderTracking(p, body) {
  body.append(el('p', { class: 'meta' },
    `${p.kind === 'tracker' ? 'Tracker' : 'Network platform'} · `,
    el('a', { href: p.website, text: hostOf(p.website) }),
    ` · Sources checked ${monthLabel(p.checked)}`));
  body.append(
    el('h4', { text: `Inbound postback (${p.inbound.method})` }),
    exampleBlock('Example', p.inbound.example, `${p.name} inbound postback example`),
    el('p', {}, p.inbound.note, ' ', src(p.inbound.source)),
    el('h4', { text: 'Macros and parameters' }),
    macroTable(p, true),
  );
  const dl = el('dl', { class: 'facts' });
  const sec = p.security.length
    ? [el('ul', { class: 'plain' }, ...p.security.map((s) => el('li', {}, el('strong', { text: `${s.mechanism}. ` }), s.detail, ' ', src(s.source))))]
    : [el('span', { class: 'muted', text: 'Not documented on the linked pages.' })];
  factRow(dl, 'Security', sec);
  factRow(dl, 'Duplicates', fact(p.duplicates));
  if (p.delivery) factRow(dl, 'Delivery', fact(p.delivery));
  if (p.not_documented.length) {
    factRow(dl, 'Not documented', [el('ul', { class: 'plain' }, ...p.not_documented.map((t) => el('li', { text: t })))]);
  }
  body.append(dl);
}

function renderList() {
  const list = $('#list');
  for (const e of entries) {
    const x = e.item;
    const details = el('details', { class: 'card entry', id: x.id });
    const summary = el('summary', {},
      el('span', { class: 'name', text: x.name }),
      el('span', { class: `chip ${e.type}`, text: e.type === 'tracking' ? 'Tracking platform' : 'Offerwall network' }),
      el('span', { class: 'sum muted', text: `${securitySummary(e)} · ${x.macros.length} macros` }),
    );
    const body = el('div', { class: 'body' });
    if (e.type === 'network') renderNetwork(x, body);
    else renderTracking(x, body);
    body.append(el('p', { class: 'small' },
      el('button', { type: 'button', class: 'btn small-btn', 'data-build': x.id, text: `Build a postback URL for ${x.name}` })));
    details.append(summary, body);
    e.node = details;
    list.append(details);
  }
  list.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-build]');
    if (!btn) return;
    $('#b-platform').value = btn.dataset.build;
    onPlatform();
    $('#builder-h').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#b-platform').focus({ preventScroll: true });
  });
}

function applyFilters() {
  const q = $('#q').value.trim().toLowerCase();
  const type = $('#type').value;
  let shown = 0;
  for (const e of entries) {
    const visible = (!type || e.type === type) && (!q || e.hay.includes(q));
    e.node.hidden = !visible;
    for (const tr of e.node.querySelectorAll('tr[data-text]')) {
      tr.classList.toggle('hit', Boolean(q) && tr.dataset.text.includes(q));
    }
    if (visible) shown++;
    if (q && visible) e.node.open = true;
  }
  const t = data.tracking_platforms.length + data.offerwall_networks.length;
  $('#count').textContent = `Showing ${shown} of ${t}${q ? `, matching "${$('#q').value.trim()}"` : ''}`;
  $('#empty').hidden = shown > 0;
}

function resetFilters() {
  $('#q').value = '';
  $('#type').value = '';
  applyFilters();
  $('#q').focus();
}

function findEntry(id) {
  return entries.find((e) => e.item.id === id);
}

function fillPlatformSelect() {
  const sel = $('#b-platform');
  const groups = [
    ['Offerwall networks', data.offerwall_networks],
    ['Tracking platforms (inbound postback)', data.tracking_platforms],
  ];
  for (const [label, items] of groups) {
    const g = el('optgroup', { label });
    for (const x of items) g.append(el('option', { value: x.id, text: x.name }));
    sel.append(g);
  }
}

function fillSenderSelect(receiverId) {
  const sel = $('#b-sender');
  const prev = sel.value;
  sel.textContent = '';
  sel.append(el('option', { value: '', text: 'Not set (REPLACE placeholders)' }));
  for (const p of data.tracking_platforms) {
    if (p.id !== receiverId) sel.append(el('option', { value: p.id, text: p.name }));
  }
  const fallback = receiverId === 'everflow' ? 'affise' : 'everflow';
  sel.value = prev && prev !== receiverId ? prev : fallback;
}

function onPlatform() {
  const id = $('#b-platform').value;
  const e = findEntry(id);
  const isNet = e.type === 'network';
  $('#b-sender-field').hidden = isNet;
  $('#b-base-label').textContent = isNet ? 'Your postback endpoint' : `${e.item.name} postback endpoint (from the vendor example)`;
  if (isNet) {
    if (!builder.wasNetwork) $('#b-base').value = DEFAULT_ENDPOINT;
  } else {
    fillSenderSelect(id);
  }
  builder.wasNetwork = isNet;
  builder.resetBase = !isNet;
  rebuildRows();
  builder.resetBase = false;
}

function rebuildRows() {
  const e = findEntry($('#b-platform').value);
  const tbody = $('#b-params tbody');
  tbody.textContent = '';
  const fixedNote = $('#b-fixed');
  fixedNote.textContent = '';
  let rows;
  if (e.type === 'network') {
    const { params, fixed } = networkParams(e.item);
    rows = params;
    builder.kept = [];
    if (fixed.length) {
      fixedNote.append(`${e.item.name} adds these itself, so they are not part of the URL you enter: `);
      fixed.forEach((m, i) => fixedNote.append(i ? ', ' : '', code(m.macro), ` (${conceptLabel(m.concept)})`));
      fixedNote.append('.');
    }
  } else {
    const sender = data.tracking_platforms.find((p) => p.id === $('#b-sender').value) ?? null;
    const t = trackingParams(e.item, sender);
    rows = t.params;
    builder.kept = t.kept;
    if (builder.resetBase) $('#b-base').value = t.base;
    const notes = [];
    if (t.kept.length) notes.push(['Kept from the vendor example: ', ...t.kept.map((p, i) => [i ? ', ' : '', code(`${p.name}=${p.value}`)]).flat(), '. ']);
    if (t.extra.length) notes.push(['Also accepted: ', ...t.extra.map((m, i) => [i ? ', ' : '', code(m.macro)]).flat(), '. ']);
    if (sender && rows.some((r) => r.missing)) notes.push([`${sender.name} has no documented outbound macro for the rows marked "no macro".`]);
    for (const n of notes) fixedNote.append(...n);
  }
  builder.rows = rows;
  rows.forEach((r, i) => {
    const check = el('input', { type: 'checkbox', id: `b-on-${i}`, 'data-i': String(i), 'aria-label': `Include ${conceptLabel(r.concept)}` });
    check.checked = r.on;
    const name = el('input', { type: 'text', class: 'pname', value: r.name, 'data-i': String(i), 'aria-label': `Parameter name for ${conceptLabel(r.concept)}`, spellcheck: 'false', autocomplete: 'off' });
    const valueCell = el('td', {}, code(r.value));
    if (r.missing) valueCell.append(' ', el('span', { class: 'warn small', text: 'no macro' }));
    tbody.append(el('tr', { class: r.on ? null : 'opt', hidden: !r.on && !$('#b-optional').checked },
      el('td', {}, check),
      el('td', {}, name),
      valueCell,
      el('td', {}, el('span', { text: conceptLabel(r.concept) }), r.note ? el('span', { class: 'muted small block', text: r.note }) : ''),
      el('td', {}, src((r.from ?? r).source)),
    ));
  });
  const optional = rows.filter((r) => !r.on).length;
  $('#b-optional-row').hidden = optional === 0;
  $('#b-optional-label').textContent = `Show ${optional} optional parameter${optional === 1 ? '' : 's'} (sub IDs and extras)`;
  if (!rows.length) tbody.append(el('tr', {}, el('td', { colspan: '5', class: 'muted', text: 'No URL macros to place. See the note below.' })));
  renderNotes(e);
  renderUrl();
}

function senderClickText(sender) {
  const back = sender && senderMacro(sender, 'click_id');
  if (!back) return ['. The sender has to store it and send it back.'];
  return [`. ${sender.name} has to store it, for example in a sub parameter, and send it back with `, code(firstMacro(back.macro)), '.'];
}

function renderNotes(e) {
  const box = $('#b-notes');
  box.textContent = '';
  const dl = el('dl', { class: 'facts' });
  const x = e.item;
  if (e.type === 'network') {
    if (x.signature) {
      factRow(dl, 'Verify', [`${x.signature.scheme.replace(/\.+$/, '')}. Signed input: ${x.signature.input.replace(/\.+$/, '')}. Key: ${x.signature.key.replace(/\.+$/, '')}. `, src(x.signature.source)]);
    } else {
      factRow(dl, 'Verify', [el('span', { class: 'muted', text: 'No signature documented. Restrict by source IP if the network publishes a list.' })]);
    }
    factRow(dl, 'Reversals', fact(x.reversal));
    factRow(dl, 'Answer with', fact(x.response));
  } else {
    const click = x.macros.find((m) => m.direction === 'click_url' && m.concept === 'click_id');
    const sender = data.tracking_platforms.find((p) => p.id === $('#b-sender').value);
    if (click) {
      factRow(dl, 'Click ID', [`${x.name} adds its click ID to the offer URL with `, code(click.macro),
        ...senderClickText(sender), ' ', src(click.source)]);
    }
    factRow(dl, 'Security', x.security.length
      ? [x.security.map((s) => s.mechanism).join(', '), '. ', src(x.security[0].source)]
      : [el('span', { class: 'muted', text: 'Not documented on the linked pages.' })]);
    factRow(dl, 'Duplicates', fact(x.duplicates));
  }
  box.append(dl);
}

function currentPairs() {
  const pairs = [...builder.kept.map((p) => ({ ...p, kept: true }))];
  const names = document.querySelectorAll('#b-params .pname');
  builder.rows.forEach((r, i) => {
    const on = $(`#b-on-${i}`)?.checked;
    if (on) pairs.push({ name: names[i].value.trim() || r.name, value: r.value });
  });
  return pairs;
}

function renderUrl() {
  const base = $('#b-base').value.trim() || DEFAULT_ENDPOINT;
  const pairs = currentPairs();
  const out = $('#b-url');
  out.textContent = '';
  out.append(el('span', { class: 'u-base', text: base }));
  pairs.forEach((p, i) => {
    out.append(
      el('span', { class: 'u-sep', text: i === 0 && !base.includes('?') ? '?' : '&' }),
      el('span', { class: 'u-name', text: p.value === '' ? p.name : `${p.name}=` }),
      p.value === '' ? '' : el('span', { class: 'u-val', text: p.value }),
    );
  });
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const e = id && findEntry(id);
  if (e) {
    e.node.open = true;
    e.node.scrollIntoView({ block: 'start' });
  }
}

async function init() {
  const res = await fetch('data/macros.json');
  data = await res.json();
  concepts = new Map(data.concepts.map((c) => [c.id, c]));
  entries = makeEntries();
  renderStats();
  renderGlance();
  renderList();
  fillPlatformSelect();
  for (const form of document.querySelectorAll('form')) form.addEventListener('submit', (ev) => ev.preventDefault());
  $('#b-platform').addEventListener('change', onPlatform);
  $('#b-sender').addEventListener('change', rebuildRows);
  $('#b-base').addEventListener('input', renderUrl);
  $('#b-params').addEventListener('input', renderUrl);
  $('#b-params').addEventListener('change', renderUrl);
  $('#b-optional').addEventListener('change', () => {
    for (const tr of document.querySelectorAll('#b-params tr.opt')) tr.hidden = !$('#b-optional').checked;
  });
  $('#q').addEventListener('input', applyFilters);
  $('#type').addEventListener('input', applyFilters);
  $('#reset').addEventListener('click', resetFilters);
  $('#expand').addEventListener('click', () => entries.forEach((e) => { if (!e.node.hidden) e.node.open = true; }));
  $('#collapse').addEventListener('click', () => entries.forEach((e) => { e.node.open = false; }));
  window.addEventListener('hashchange', openFromHash);
  onPlatform();
  applyFilters();
  openFromHash();
}

init().catch(() => {
  $('#load-error-wrap').hidden = false;
  $('#sheet').hidden = true;
});
