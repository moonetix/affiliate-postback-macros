#!/usr/bin/env node
// Assembles the GitHub Pages demo in _site/ from site/ and data/.
// The data is validated with the same schema and editorial checks as
// scripts/build.mjs first, so an invalid macros.json never gets published.
// Node 22 built-ins only. Run: node scripts/build-site.mjs
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, build, loadJson } from './build.mjs';

const { errors } = build();
if (errors.length) {
  for (const e of errors) console.error(`error  ${e}`);
  console.error(`${errors.length} problem(s) in data/macros.json, site not built`);
  process.exit(1);
}

const out = join(ROOT, '_site');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'data'), { recursive: true });
cpSync(join(ROOT, 'site'), out, { recursive: true });
for (const file of ['macros.json', 'macros.schema.json']) {
  cpSync(join(ROOT, 'data', file), join(out, 'data', file));
}

const data = loadJson(join(ROOT, 'data', 'macros.json'));
console.log(`Built _site/ (${data.tracking_platforms.length} tracking platforms, ${data.offerwall_networks.length} offerwall networks, edition ${data.edition})`);
