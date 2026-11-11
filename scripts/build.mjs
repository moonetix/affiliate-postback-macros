#!/usr/bin/env node
// Validates data/macros.json against data/macros.schema.json, runs the
// editorial checks, and rewrites the table sections of README.md.
//
//   node scripts/build.mjs           validate and update README.md
//   node scripts/build.mjs --check   validate and fail if README.md is stale

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'macros.json');
const SCHEMA = join(ROOT, 'data', 'macros.schema.json');
const README = join(ROOT, 'README.md');

export const SECTIONS = ['part-a', 'part-b', 'part-c'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const DIRECTION_LABEL = {
  inbound: 'Inbound postback',
  click_url: 'Offer URL',
  outbound: 'Outbound postback',
  general: 'Macro list',
};

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// A small JSON Schema validator covering the keywords macros.schema.json uses.
// Keeping it in-repo means contributors need nothing but Node.
export function validateSchema(schema, value, path = '', root = schema) {
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/')
      .reduce((node, key) => node[key], root);
    return validateSchema(target, value, path, root);
  }
  const errors = [];
  const at = path || '/';

  if (schema.oneOf) {
    const passing = schema.oneOf.filter((s) => validateSchema(s, value, path, root).length === 0);
    if (passing.length !== 1) {
      const detail = schema.oneOf.map((s) => validateSchema(s, value, path, root))
        .sort((a, b) => a.length - b.length)[0];
      return passing.length === 0 ? detail : [`${at}: matches more than one allowed shape`];
    }
    return [];
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  }
  if (schema.type && !hasType(value, schema.type)) {
    errors.push(`${at}: must be ${schema.type}`);
    return errors;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${at}: must not be empty`);
    }
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${at}: "${value}" does not match ${schema.pattern}`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${at}: needs at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, i) => errors.push(...validateSchema(schema.items, item, `${path}/${i}`, root)));
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push(`${at}: missing "${key}"`);
    }
    const props = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (props[key]) {
        errors.push(...validateSchema(props[key], child, `${path}/${key}`, root));
      } else if (schema.additionalProperties === false) {
        errors.push(`${at}: unknown property "${key}"`);
      }
    }
  }
  return errors;
}

function hasType(value, type) {
  switch (type) {
    case 'null': return value === null;
    case 'array': return Array.isArray(value);
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'integer': return Number.isInteger(value);
    default: return typeof value === type;
  }
}

// Checks a schema cannot express: references, ordering, house style.
export function lint(data) {
  const errors = [];
  const concepts = new Set(data.concepts.map((c) => c.id));

  const unique = (list, label) => {
    const seen = new Set();
    for (const item of list) {
      if (seen.has(item.id)) errors.push(`${label}: duplicate id "${item.id}"`);
      seen.add(item.id);
    }
  };
  unique(data.concepts, 'concepts');
  unique(data.tracking_platforms, 'tracking_platforms');
  unique(data.offerwall_networks, 'offerwall_networks');

  const checkConcept = (concept, where) => {
    if (!concepts.has(concept)) errors.push(`${where}: unknown concept "${concept}"`);
  };
  data.mapping.tracking.forEach((row, i) => checkConcept(row.concept, `mapping.tracking[${i}]`));
  data.mapping.offerwall.forEach((row, i) => checkConcept(row.concept, `mapping.offerwall[${i}]`));
  for (const p of data.tracking_platforms) {
    p.macros.forEach((m, i) => checkConcept(m.concept, `${p.id}.macros[${i}]`));
    if (p.checked > data.edition) errors.push(`${p.id}: checked ${p.checked} is after edition ${data.edition}`);
  }
  for (const n of data.offerwall_networks) {
    n.macros.forEach((m, i) => checkConcept(m.concept, `${n.id}.macros[${i}]`));
    if (n.checked > data.edition) errors.push(`${n.id}: checked ${n.checked} is after edition ${data.edition}`);
  }

  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const names = (list) => list.map((x) => x.name).join(', ');
  const tracking = data.tracking_platforms;
  if (names(tracking) !== names([...tracking].sort(byName))) {
    errors.push('tracking_platforms: keep entries in alphabetical order by name');
  }
  const [first, ...rest] = data.offerwall_networks;
  if (!first || first.id !== 'moonetix') {
    errors.push('offerwall_networks: Moonetix is the first entry');
  }
  if (names(rest) !== names([...rest].sort(byName))) {
    errors.push('offerwall_networks: keep entries after the first in alphabetical order by name');
  }

  walkStrings(data, (text, path) => {
    if (/[\u2013\u2014]/u.test(text)) errors.push(`${path}: use a plain hyphen, not an en or em dash`);
    if (/\p{Extended_Pictographic}/u.test(text)) errors.push(`${path}: no emoji`);
  });
  return errors;
}

function walkStrings(value, fn, path = '') {
  if (typeof value === 'string') fn(value, path || '/');
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, fn, `${path}/${i}`));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkStrings(v, fn, `${path}/${k}`);
  }
}

// ---------- Markdown ----------

export function checkedLabel(yyyymm) {
  const [year, month] = yyyymm.split('-').map(Number);
  return `checked ${MONTHS[month - 1]} ${year}`;
}

export function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9 _-]/g, '').trim().replace(/ /g, '-');
}

function cell(text) {
  return String(text).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function plain(text) {
  return cell(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function code(text) {
  return '`' + cell(text) + '`';
}

function link(url, label = 'docs') {
  return `[${label}](${url})`;
}

function table(head, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

function conceptLabel(data, id) {
  return data.concepts.find((c) => c.id === id).label;
}

function renderPartA(data) {
  const out = [];
  const list = data.tracking_platforms;

  out.push('### Inbound postback formats', '');
  out.push('The URL an advertiser or network calls to report a conversion to the platform.', '');
  out.push(table(['Platform', 'Method', 'Example from the vendor docs', 'Source'], list.map((p) => [
    `[${p.name}](#${slug(p.name)})`,
    plain(p.inbound.method),
    code(p.inbound.example),
    `${link(p.inbound.source)}, ${checkedLabel(p.checked)}`,
  ])));

  out.push('', '### How inbound postbacks are secured', '');
  out.push('None of these platforms documents an HMAC signature on inbound postbacks. Protection is a shared token, an IP allowlist, or both.', '');
  out.push(table(['Platform', 'Mechanisms', 'Duplicates'], list.map((p) => [
    p.name,
    p.security.length
      ? p.security.map((s) => `**${plain(s.mechanism)}.** ${plain(s.detail)} ${link(s.source)}`).join('<br>')
      : 'n/d',
    p.duplicates ? `${plain(p.duplicates.detail)} ${link(p.duplicates.source)}` : 'n/d',
  ])));

  for (const p of list) {
    out.push('', `### ${p.name}`, '');
    out.push(`${p.kind === 'tracker' ? 'Tracker' : 'Network platform'}. [${hostOf(p.website)}](${p.website}). Sources ${checkedLabel(p.checked)}.`, '');
    out.push(`Inbound postback (${plain(p.inbound.method)}):`, '');
    out.push('```text', p.inbound.example, '```', '');
    out.push(`${plain(p.inbound.note)} ${link(p.inbound.source)}`, '');
    out.push(table(['Where', 'Concept', 'Macro or parameter', 'Notes', 'Source'], p.macros.map((m) => [
      DIRECTION_LABEL[m.direction],
      conceptLabel(data, m.concept),
      code(m.macro),
      m.note ? plain(m.note) : '',
      link(m.source),
    ])));
    if (p.delivery) out.push('', `**Delivery.** ${plain(p.delivery.detail)} ${link(p.delivery.source)}`);
    if (p.not_documented.length) {
      out.push('', `**Not documented on the pages above:** ${p.not_documented.map(plain).join('; ')}.`);
    }
  }
  return out.join('\n');
}

function renderPartB(data) {
  const out = [];
  const list = data.offerwall_networks;

  out.push('### Signatures', '');
  out.push(table(['Network', 'Scheme', 'Signed input', 'Sent in', 'Key', 'Source'], list.map((n) => n.signature
    ? [
      `[${n.name}](#${slug(n.name)})`,
      plain(n.signature.scheme),
      plain(n.signature.input),
      plain(n.signature.location),
      plain(n.signature.key),
      `${link(n.signature.source)}, ${checkedLabel(n.checked)}`,
    ]
    : [`[${n.name}](#${slug(n.name)})`, 'None documented', '', '', '', `${link(n.source)}, ${checkedLabel(n.checked)}`])));

  out.push('', '### Reversals and responses', '');
  out.push(table(['Network', 'How a reversal arrives', 'What your endpoint must answer'], list.map((n) => [
    n.name,
    n.reversal ? `${plain(n.reversal.detail)} ${link(n.reversal.source)}` : 'n/d',
    n.response ? `${plain(n.response.detail)} ${link(n.response.source)}` : 'n/d',
  ])));

  for (const n of list) {
    out.push('', `### ${n.name}`, '');
    out.push(`[${hostOf(n.website)}](${n.website}). Method: ${plain(n.method)}. Sources ${checkedLabel(n.checked)}.`, '');
    if (n.example) out.push('```text', n.example, '```', '');
    out.push(table(['Concept', 'Macro', 'Notes', 'Source'], n.macros.map((m) => [
      conceptLabel(data, m.concept),
      code(m.macro),
      m.note ? plain(m.note) : '',
      link(m.source),
    ])));
    if (n.signature) {
      out.push('', `**Signature.** ${plain(n.signature.scheme)} over ${plain(n.signature.input)}. ${plain(n.signature.detail)} ${link(n.signature.source)}`);
    }
    if (n.ip_allowlist) out.push('', `**Source IPs.** ${plain(n.ip_allowlist.detail)} ${link(n.ip_allowlist.source)}`);
    if (n.notes) out.push('', `**Notes.** ${plain(n.notes)}`);
  }
  return out.join('\n');
}

function pick(macros, concept, directions) {
  for (const d of directions || [undefined]) {
    const hit = macros.find((m) => m.concept === concept && (d === undefined || m.direction === d));
    if (hit) return code(hit.macro);
  }
  return 'n/d';
}

function renderPartC(data) {
  const out = [];
  const tp = data.tracking_platforms;
  out.push('### Tracking platforms', '');
  out.push(table(['Concept', ...tp.map((p) => `[${p.name}](#${slug(p.name)})`)],
    data.mapping.tracking.map((row) => [row.label, ...tp.map((p) => pick(p.macros, row.concept, row.directions))])));

  const ow = data.offerwall_networks;
  out.push('', '### Offerwall networks', '');
  out.push(table(['Concept', ...ow.map((n) => `[${n.name}](#${slug(n.name)})`)],
    data.mapping.offerwall.map((row) => [row.label, ...ow.map((n) => pick(n.macros, row.concept))])));
  return out.join('\n');
}

function hostOf(url) {
  return new URL(url).host.replace(/^www\./, '');
}

export function render(data) {
  return {
    'part-a': renderPartA(data),
    'part-b': renderPartB(data),
    'part-c': renderPartC(data),
  };
}

export function splice(readme, parts) {
  let text = readme;
  for (const name of SECTIONS) {
    const start = `<!-- ${name}:start -->`;
    const end = `<!-- ${name}:end -->`;
    const a = text.indexOf(start);
    const b = text.indexOf(end);
    if (a === -1 || b === -1 || b < a) throw new Error(`README.md is missing the ${start} / ${end} markers`);
    text = text.slice(0, a + start.length) + '\n\n' + parts[name] + '\n\n' + text.slice(b);
  }
  return text;
}

export function build({ data = loadJson(DATA), schema = loadJson(SCHEMA) } = {}) {
  const errors = [...validateSchema(schema, data), ...lint(data)];
  return { errors, parts: errors.length ? null : render(data) };
}

function main(argv) {
  const check = argv.includes('--check');
  const { errors, parts } = build();
  if (errors.length) {
    for (const e of errors) console.error(`error  ${e}`);
    console.error(`${errors.length} problem(s) in data/macros.json`);
    return 1;
  }
  const current = readFileSync(README, 'utf8');
  const next = splice(current, parts);
  if (check) {
    if (next !== current) {
      console.error('README.md tables are out of date. Run: node scripts/build.mjs');
      return 1;
    }
    console.log('data/macros.json is valid and README.md is up to date');
    return 0;
  }
  if (next !== current) writeFileSync(README, next);
  console.log(next !== current ? 'README.md updated' : 'README.md already up to date');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
