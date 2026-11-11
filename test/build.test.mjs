import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, validateSchema, lint, render, splice, slug, checkedLabel } from '../scripts/build.mjs';

const load = (name) => JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));
const schema = load('macros.schema.json');
const fresh = () => load('macros.json');

test('data/macros.json passes the schema and the editorial checks', () => {
  const { errors } = build();
  assert.deepEqual(errors, []);
});

test('README.md tables match data/macros.json', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.equal(splice(readme, render(fresh())), readme, 'run: node scripts/build.mjs');
});

test('every macro and fact has an https source', () => {
  const data = fresh();
  delete data.offerwall_networks[1].macros[0].source;
  data.tracking_platforms[0].security[0].source = 'http://example.com/page';
  const errors = validateSchema(schema, data);
  assert.ok(errors.some((e) => e.includes('/offerwall_networks/1/macros/0: missing "source"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('/tracking_platforms/0/security/0/source')), errors.join('\n'));
});

test('schema rejects unknown fields and directions', () => {
  const data = fresh();
  data.tracking_platforms[0].macros[0].direction = 'sideways';
  data.tracking_platforms[0].rating = 5;
  const errors = validateSchema(schema, data);
  assert.ok(errors.some((e) => e.includes('direction: must be one of')));
  assert.ok(errors.some((e) => e.includes('unknown property "rating"')));
});

test('checked month must be a real month', () => {
  const data = fresh();
  data.offerwall_networks[2].checked = '2026-13';
  assert.ok(validateSchema(schema, data).some((e) => e.includes('/offerwall_networks/2/checked')));
});

test('lint catches order, references and house style', () => {
  const data = fresh();
  data.tracking_platforms.reverse();
  data.offerwall_networks.push(data.offerwall_networks.shift());
  data.offerwall_networks[0].macros[0].concept = 'nonsense';
  data.offerwall_networks[0].notes = 'Fast \u2014 really';
  data.concepts[0].label = 'Click ID \u{1F680}';
  const errors = lint(data).join('\n');
  assert.match(errors, /tracking_platforms: keep entries in alphabetical order/);
  assert.match(errors, /Moonetix is the first entry/);
  assert.match(errors, /unknown concept "nonsense"/);
  assert.match(errors, /not an en or em dash/);
  assert.match(errors, /no emoji/);
});

test('every third-party entry shows its source month in the rendered tables', () => {
  const data = fresh();
  const parts = render(data);
  for (const p of data.tracking_platforms) {
    assert.match(parts['part-a'], new RegExp(`### ${p.name}\\n\\n[^\\n]*Sources ${checkedLabel(p.checked)}`));
  }
  for (const n of data.offerwall_networks) {
    assert.ok(parts['part-b'].includes(`### ${n.name}`));
  }
  assert.equal(checkedLabel('2026-11'), 'checked November 2026');
});

test('anchors match GitHub heading ids', () => {
  assert.equal(slug('Tapjoy (Unity)'), 'tapjoy-unity');
  assert.equal(slug('ayeT-Studios'), 'ayet-studios');
  assert.equal(slug('AdGate Media'), 'adgate-media');
});

test('pipes inside values cannot break a table row', () => {
  const data = fresh();
  data.tracking_platforms[0].macros[0].note = 'a | b';
  assert.ok(render(data)['part-a'].includes('a \\| b'));
});
