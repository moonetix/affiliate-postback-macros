import {
  DIRECTION_LABEL, monthLabel, hostOf, networkParams, trackingParams, senderMacro, firstMacro, pickMacro, coverage,
  isPlaceholder, exampleUrl, schemeSamples, sourcePages, shortList,
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
const SVG_NS = 'http://www.w3.org/2000/svg';
const icon = (id, cls = 'ic') => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
};
const src = (url, label = 'Source') => el('a', { href: url, class: 'src', text: label });
const code = (text) => el('code', { text });
const copyButton = (what) => el('button', { type: 'button', class: 'copy', 'data-copy': true, 'aria-label': `Copy the ${what}` },
  icon('i-copy'), el('span', { class: 'copy-label', text: 'Copy' }));
const exampleBlock = (label, text, what) => el('div', { class: 'codeblock example' },
  el('div', { class: 'cb-bar' }, el('span', { text: label }), copyButton(what)),
  el('pre', { class: 'soft', tabindex: '0' }, code(text)));

let data;
let concepts;
let entries = [];
const groups = [];
const builder = { rows: [], kept: [] };
const DEFAULT_ENDPOINT = 'https://yoursite.com/postback';
const TABLE_CAP = 8;
const LIST_CAP = 8;
const SLACK = 2;
const AUTO_OPEN = 3;
const TYPES = {
  network: { one: 'offerwall network', many: 'offerwall networks', title: 'Offerwall networks', icon: 'i-grid' },
  tracking: { one: 'tracking platform', many: 'tracking platforms', title: 'Tracking platforms', icon: 'i-route' },
};

const conceptLabel = (id) => concepts.get(id)?.label ?? id;
const kindLabel = (p) => (p.kind === 'tracker' ? 'Tracker' : 'Network platform');
const countOf = (n, type) => `${n} ${n === 1 ? TYPES[type].one : TYPES[type].many}`;

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
  parts.push(TYPES[entry.type].one);
  return parts.join('\n');
}

function makeEntries() {
  const list = [
    ...data.offerwall_networks.map((item) => ({ type: 'network', item })),
    ...data.tracking_platforms.map((item) => ({ type: 'tracking', item })),
  ];
  for (const e of list) e.hay = searchText(e).toLowerCase();
  return list;
}

function urlNodes(base, pairs) {
  const out = [el('span', { class: 'u-base', text: base })];
  pairs.forEach((p, i) => {
    const sep = i === 0 && !base.includes('?') ? '?' : '&';
    out.push(el('span', { class: 'u-pair' },
      el('span', { class: 'u-name', text: p.value === '' ? `${sep}${p.name}` : `${sep}${p.name}=` }),
      p.value === '' ? '' : el('span', { class: 'u-val', text: p.value })));
  });
  return out;
}

function renderStats() {
  const all = [...data.offerwall_networks, ...data.tracking_platforms];
  const latest = all.map((x) => x.checked).sort().at(-1);
  const pages = sourcePages(data).size;
  const items = [
    countOf(data.offerwall_networks.length, 'network'),
    countOf(data.tracking_platforms.length, 'tracking'),
    `Sources checked ${monthLabel(latest)}`,
  ];
  $('#stats').replaceChildren(...items.map((text) => el('li', { class: 'chip', text })));
  $('#edition').textContent = `Edition ${monthLabel(data.edition)}. ${pages} distinct vendor pages are cited. A monthly workflow fetches each cited page and opens an issue when one changes.`;
  $('#n-all').textContent = all.length;
  $('#n-network').textContent = data.offerwall_networks.length;
  $('#n-tracking').textContent = data.tracking_platforms.length;
}

function renderHero() {
  const networks = data.offerwall_networks;
  const main = networks.find((n) => n.id === 'moonetix') ?? networks[0];
  const { base, pairs } = exampleUrl(main, DEFAULT_ENDPOINT);
  const macros = pairs.filter((p) => isPlaceholder(p.value)).length;
  const signed = networks.filter((n) => n.signature).length;
  const box = $('#hero-preview');
  box.replaceChildren(
    el('p', { class: 'pv-kick' },
      el('span', { text: `${main.name} postback` }),
      el('span', { text: `${main.method}, ${macros} ${macros === 1 ? 'macro' : 'macros'}` })),
    el('p', { class: 'url pv-url' }, ...urlNodes(base, pairs)),
    el('p', { class: 'pv-kick' },
      el('span', { text: 'How networks sign it' }),
      el('span', { text: `${signed} of ${networks.length} document a scheme` })),
  );
  for (const n of schemeSamples(networks)) {
    box.append(el('div', { class: 'pv-row' },
      el('span', { class: 'pv-name', text: n.name }),
      el('span', { class: 'badge scheme', text: n.signature.scheme }),
      el('span', { class: 'pv-sub', text: `Sent in: ${n.signature.location}` })));
  }
}

function capRows(tbody, button, noun) {
  const rows = [...tbody.children];
  if (rows.length <= TABLE_CAP + SLACK) return;
  const set = (open) => {
    rows.forEach((tr, i) => {
      tr.hidden = !open && i >= TABLE_CAP;
    });
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? `Show the first ${TABLE_CAP}` : `Show all ${rows.length} ${noun}`;
  };
  button.hidden = false;
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    set(open);
    button.closest('.pair').classList.toggle('open', open);
    if (!open) button.closest('.card').scrollIntoView({ block: 'nearest' });
  });
  set(false);
}

function renderGlance() {
  const networks = data.offerwall_networks;
  const trackers = data.tracking_platforms;
  const signed = networks.filter((n) => n.signature).length;
  const reversed = networks.filter((n) => n.reversal).length;
  const allowlists = trackers.filter((p) => p.security.some((s) => /allowlist/i.test(s.mechanism))).length;

  const figs = [
    [signed, networks.length, 'offerwall networks document a signature or shared secret'],
    [reversed, networks.length, 'offerwall networks document how a reversal arrives'],
    [allowlists, trackers.length, 'tracking platforms document an IP allowlist'],
    [sourcePages(data).size, null, 'vendor pages cited, one source link per fact'],
  ];
  for (const [n, total, label] of figs) {
    $('#g-figs').append(el('li', { class: 'card fig' },
      el('p', { class: 'fig-n' }, el('strong', { text: n }), ' ', total === null ? '' : el('span', { text: `of ${total}` })),
      el('p', { class: 'fig-l', text: label })));
  }

  const signBody = $('#g-sign tbody');
  for (const n of networks) {
    const s = n.signature;
    signBody.append(el('tr', {},
      el('th', { scope: 'row' }, el('a', { href: `#${n.id}`, text: n.name })),
      el('td', {}, ...(s
        ? [el('a', { href: s.source, text: s.scheme }), el('span', { class: 'sub', text: `Sent in: ${s.location}` })]
        : [el('a', { href: n.source, text: 'None documented' })])),
      el('td', {}, n.reversal
        ? el('a', { href: n.reversal.source, class: 'badge t-good' }, icon('i-check', 'ic sm'), 'Documented')
        : el('span', { class: 'badge t-none', text: 'Not documented' })),
    ));
  }
  capRows(signBody, $('#g-sign-more'), TYPES.network.many);

  const trackBody = $('#g-track tbody');
  for (const p of trackers) {
    const click = pickMacro(p.macros, 'click_id', ['inbound']);
    const security = p.security.flatMap((s, i) => [i ? ', ' : '', el('a', { href: s.source, text: s.mechanism })]);
    trackBody.append(el('tr', {},
      el('th', { scope: 'row' }, el('a', { href: `#${p.id}`, text: p.name }), el('span', { class: 'sub', text: kindLabel(p) })),
      el('td', {}, click ? el('a', { href: click.source }, code(click.macro)) : el('span', { class: 'muted', text: 'Not documented' })),
      el('td', {}, ...(security.length ? security : [el('span', { class: 'muted', text: 'Not documented' })])),
    ));
  }
  capRows(trackBody, $('#g-track-more'), TYPES.tracking.many);

  const sets = [
    ['#g-cover-ow', data.mapping.offerwall, networks],
    ['#g-cover-tp', data.mapping.tracking, trackers],
  ];
  for (const [sel, rows, platforms] of sets) {
    for (const row of coverage(rows, platforms)) {
      const fill = el('span');
      fill.style.width = `${(row.have / row.total) * 100}%`;
      $(sel).append(el('li', {},
        el('span', { class: 'cover-label', text: row.label }),
        el('span', { class: 'meter', 'aria-hidden': 'true' }, fill),
        el('span', { class: 'cover-n', text: `${row.have} of ${row.total}` }),
        row.missing.length ? el('span', { class: 'cover-miss', title: row.missing.join(', '), text: `Not documented: ${shortList(row.missing, 3)}` }) : '',
      ));
    }
  }

  const out = $('#jq-out');
  out.textContent = networks.map((n) => `${n.name}\t${n.signature?.scheme ?? 'none documented'}`).join('\n');
  out.parentNode.style.tabSize = String(Math.max(...networks.map((n) => n.name.length)) + 2);
  $('#jq-out-label').textContent = `Output, ${networks.length} lines`;
  const payout = trackers.find((p) => p.id === 'voluum')?.macros.find((m) => m.direction === 'outbound' && m.concept === 'amount');
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

function factTile(dl, term, content) {
  dl.append(el('div', {}, el('dt', { text: term }), el('dd', {}, ...content)));
}

function fact(f, missing = 'Not documented on the linked pages.') {
  return f ? [f.detail, ' ', src(f.source)] : [el('span', { class: 'muted', text: missing })];
}

function macroTable(item, withDirection) {
  const head = ['Concept', 'Macro', 'Notes', 'Source'];
  if (withDirection) head.unshift('Where');
  const thead = el('thead', {}, el('tr', {}, ...head.map((h) => el('th', { scope: 'col', text: h }))));
  const tbody = el('tbody');
  let previous;
  for (const m of item.macros) {
    const tr = el('tr', {
      class: withDirection && m.direction !== previous ? 'dir-start' : null,
      'data-text': [m.macro, m.note ?? '', conceptLabel(m.concept)].join(' ').toLowerCase(),
    });
    previous = m.direction;
    if (withDirection) tr.append(el('td', { class: 'c-where', text: DIRECTION_LABEL[m.direction] }));
    tr.append(
      el('td', { class: 'c-concept', text: conceptLabel(m.concept) }),
      el('td', { class: 'c-macro' }, code(m.macro)),
      el('td', { class: 'c-note', text: m.note ?? '' }),
      el('td', { class: 'c-src' }, src(m.source)),
    );
    tbody.append(tr);
  }
  return el('div', { class: 'table-wrap' }, el('table', { class: 'macros' }, thead, tbody));
}

function renderNetwork(n, body) {
  body.append(el('p', { class: 'meta' },
    el('a', { href: n.website, text: hostOf(n.website) }),
    ` · Method: ${n.method} · Sources checked ${monthLabel(n.checked)} · `,
    src(n.source, 'Postback docs')));
  if (n.example) body.append(exampleBlock('Example postback', n.example, `${n.name} example postback`));
  body.append(el('h4', { text: 'Macros' }), macroTable(n, false));
  const dl = el('dl', { class: 'kv' });
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
    `${kindLabel(p)} · `,
    el('a', { href: p.website, text: hostOf(p.website) }),
    ` · Sources checked ${monthLabel(p.checked)}`));
  body.append(
    el('h4', { text: `Inbound postback (${p.inbound.method})` }),
    exampleBlock('Example', p.inbound.example, `${p.name} inbound postback example`),
    el('p', { class: 'after-code' }, p.inbound.note, ' ', src(p.inbound.source)),
    el('h4', { text: 'Macros and parameters' }),
    macroTable(p, true),
  );
  const dl = el('dl', { class: 'kv' });
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
  for (const type of Object.keys(TYPES)) {
    const members = entries.filter((e) => e.type === type);
    const rows = el('div', { class: 'rows' });
    for (const e of members) {
      const x = e.item;
      e.hits = el('span', { class: 'chip hits', hidden: true });
      const summary = el('summary', {},
        icon('i-chev', 'ic chev'),
        el('span', { class: 'name', text: x.name }),
        e.hits,
        el('span', { class: 'sum muted', text: `${securitySummary(e)} · ${x.macros.length} macros` }),
      );
      const body = el('div', { class: 'body' });
      if (type === 'network') renderNetwork(x, body);
      else renderTracking(x, body);
      body.append(el('p', { class: 'entry-cta' },
        el('button', { type: 'button', class: 'btn sm', 'data-build': x.id, text: `Build a postback URL for ${x.name}` })));
      e.rows = [...body.querySelectorAll('tr[data-text]')];
      e.node = el('details', { class: 'entry', id: x.id }, summary, body);
      rows.append(e.node);
    }
    const badge = el('span', { class: 'chip' });
    const more = el('button', { type: 'button', class: 'more', 'aria-expanded': 'false', hidden: true });
    const node = el('section', { class: 'card group', 'aria-labelledby': `grp-${type}` },
      el('div', { class: 'card-head' },
        el('span', { class: 'tile' }, icon(TYPES[type].icon)),
        el('h3', { id: `grp-${type}`, text: TYPES[type].title }),
        badge),
      rows, more);
    const group = { type, node, members, badge, more, expanded: false };
    more.addEventListener('click', () => {
      group.expanded = !group.expanded;
      applyFilters();
      if (!group.expanded) node.scrollIntoView({ block: 'nearest' });
    });
    groups.push(group);
    list.append(node);
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

function currentType() {
  return document.querySelector('input[name=type]:checked')?.value ?? '';
}

function applyFilters() {
  const raw = $('#q').value.trim();
  const q = raw.toLowerCase();
  const type = currentType();
  const matched = [];
  let pool = 0;
  for (const g of groups) {
    const inType = !type || g.type === type;
    if (inType) pool += g.members.length;
    const matches = g.members.filter((e) => inType && (!q || e.hay.includes(q)));
    const capped = !q && !g.expanded && matches.length > LIST_CAP + SLACK;
    for (const e of g.members) {
      const at = matches.indexOf(e);
      e.node.hidden = at < 0 || (capped && at >= LIST_CAP);
      let hits = 0;
      for (const tr of e.rows) {
        const hit = Boolean(q) && tr.dataset.text.includes(q);
        tr.classList.toggle('hit', hit);
        if (hit) hits++;
      }
      e.hits.hidden = hits === 0;
      e.hits.textContent = `${hits} ${hits === 1 ? 'row matches' : 'rows match'}`;
    }
    g.node.hidden = matches.length === 0;
    g.badge.textContent = q ? `${matches.length} of ${g.members.length}` : String(g.members.length);
    g.more.hidden = Boolean(q) || matches.length <= LIST_CAP + SLACK;
    g.more.setAttribute('aria-expanded', String(g.expanded));
    g.more.textContent = g.expanded ? `Show the first ${LIST_CAP}` : `Show all ${countOf(matches.length, g.type)}`;
    matched.push(...matches);
  }
  if (q && matched.length <= AUTO_OPEN) {
    for (const e of matched) e.node.open = true;
  }
  const what = type ? TYPES[type].many : 'platforms and networks';
  $('#count').textContent = q ? `${matched.length} of ${pool} ${what} match "${raw}"` : `${pool} ${what}`;
  $('#empty').hidden = matched.length > 0;
}

function clearFilters() {
  $('#q').value = '';
  document.querySelector('input[name=type][value=""]').checked = true;
  applyFilters();
}

function findEntry(id) {
  return entries.find((e) => e.item.id === id);
}

function fillPlatformSelect() {
  const sel = $('#b-platform');
  const sets = [
    [`Offerwall networks (${data.offerwall_networks.length})`, data.offerwall_networks],
    [`Tracking platforms, inbound postback (${data.tracking_platforms.length})`, data.tracking_platforms],
  ];
  for (const [label, items] of sets) {
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
  fixedNote.hidden = !fixedNote.childNodes.length;
  builder.rows = rows;
  rows.forEach((r, i) => {
    const check = el('input', { type: 'checkbox', id: `b-on-${i}`, 'data-i': String(i), 'aria-label': `Include ${conceptLabel(r.concept)}` });
    check.checked = r.on;
    const name = el('input', { type: 'text', class: 'pname', value: r.name, 'data-i': String(i), 'aria-label': `Parameter name for ${conceptLabel(r.concept)}`, spellcheck: 'false', autocomplete: 'off' });
    const valueCell = el('td', {}, el('code', { class: 'u-val', text: r.value }));
    if (r.missing) valueCell.append(' ', el('span', { class: 'badge t-warn', text: 'no macro' }));
    tbody.append(el('tr', { class: r.on ? null : 'opt', hidden: !r.on && !$('#b-optional').checked },
      el('td', {}, check),
      el('td', {}, name),
      valueCell,
      el('td', {}, el('span', { text: conceptLabel(r.concept) }), r.note ? el('span', { class: 'sub', text: r.note }) : ''),
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
  const dl = el('dl', { class: 'tiles' });
  const x = e.item;
  if (e.type === 'network') {
    if (x.signature) {
      factTile(dl, 'Verify', [`${x.signature.scheme.replace(/\.+$/, '')}. Signed input: ${x.signature.input.replace(/\.+$/, '')}. Key: ${x.signature.key.replace(/\.+$/, '')}. `, src(x.signature.source)]);
    } else {
      factTile(dl, 'Verify', [el('span', { class: 'muted', text: 'No signature documented. Restrict by source IP if the network publishes a list.' })]);
    }
    factTile(dl, 'Reversals', fact(x.reversal));
    factTile(dl, 'Answer with', fact(x.response));
  } else {
    const click = x.macros.find((m) => m.direction === 'click_url' && m.concept === 'click_id');
    const sender = data.tracking_platforms.find((p) => p.id === $('#b-sender').value);
    if (click) {
      factTile(dl, 'Click ID', [`${x.name} adds its click ID to the offer URL with `, code(click.macro),
        ...senderClickText(sender), ' ', src(click.source)]);
    }
    factTile(dl, 'Security', x.security.length
      ? [x.security.map((s) => s.mechanism).join(', '), '. ', src(x.security[0].source)]
      : [el('span', { class: 'muted', text: 'Not documented on the linked pages.' })]);
    factTile(dl, 'Duplicates', fact(x.duplicates));
  }
  $('#b-notes').replaceChildren(dl);
}

function currentPairs() {
  const pairs = [...builder.kept];
  const names = document.querySelectorAll('#b-params .pname');
  builder.rows.forEach((r, i) => {
    const on = $(`#b-on-${i}`)?.checked;
    if (on) pairs.push({ name: names[i].value.trim() || r.name, value: r.value });
  });
  return pairs;
}

function renderUrl() {
  const base = $('#b-base').value.trim() || DEFAULT_ENDPOINT;
  $('#b-url').replaceChildren(...urlNodes(base, currentPairs()));
}

function openFromHash() {
  let id = '';
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const e = id && findEntry(id);
  if (!e) return;
  const group = groups.find((g) => g.type === e.type);
  if (group.members.indexOf(e) >= LIST_CAP) group.expanded = true;
  applyFilters();
  if (e.node.hidden) clearFilters();
  e.node.open = true;
  e.node.scrollIntoView({ block: 'start' });
}

async function init() {
  const res = await fetch('data/macros.json');
  data = await res.json();
  concepts = new Map(data.concepts.map((c) => [c.id, c]));
  entries = makeEntries();
  renderStats();
  renderHero();
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
  $('#type').addEventListener('change', applyFilters);
  $('#reset').addEventListener('click', () => {
    clearFilters();
    $('#q').focus();
  });
  $('#expand').addEventListener('click', () => entries.forEach((e) => {
    if (!e.node.hidden) e.node.open = true;
  }));
  $('#collapse').addEventListener('click', () => entries.forEach((e) => {
    e.node.open = false;
  }));
  window.addEventListener('hashchange', openFromHash);
  onPlatform();
  applyFilters();
  openFromHash();
}

init().catch(() => {
  $('#load-error').hidden = false;
  $('#sheet').hidden = true;
  $('#stats').replaceChildren(el('li', { class: 'chip', text: 'Could not load the data' }));
  $('#hero-preview').replaceChildren(el('p', { class: 'muted', text: 'The data file did not load.' }));
});
