export const DIRECTION_LABEL = {
  inbound: 'Inbound postback',
  click_url: 'Offer URL',
  outbound: 'Outbound postback',
  general: 'Macro list',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function monthLabel(yyyymm) {
  const [year, month] = yyyymm.split('-').map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function hostOf(url) {
  return new URL(url).host.replace(/^www\./, '');
}

const DELIMITED = /[{}[\]<>#%]/;

export function isPlaceholder(macro) {
  return DELIMITED.test(macro);
}

export function expandRange(macro) {
  const m = macro.match(/^(.*?)(\d+)([^\d\s]*)\s*\.\.\.\s*(.*?)(\d+)([^\d\s]*)$/);
  if (!m || m[1] !== m[4] || m[3] !== m[6]) return [macro.split(/\s*(?:\.\.\.|,)\s*/)[0]];
  const from = Number(m[2]);
  const to = Number(m[5]);
  if (!(to >= from) || to - from > 30) return [`${m[1]}${m[2]}${m[3]}`];
  const out = [];
  for (let i = from; i <= to; i++) out.push(`${m[1]}${i}${m[3]}`);
  return out;
}

export function firstMacro(macro) {
  return expandRange(macro)[0];
}

export function tokenName(macro) {
  return macro.replace(/[{}[\]<>#%]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

const NETWORK_PARAM = {
  user_id: 'user_id',
  transaction_id: 'transaction_id',
  event: 'event',
  status: 'status',
  reward: 'reward',
  currency_name: 'currency',
  amount: 'payout',
  offer_id: 'offer_id',
  offer_name: 'offer_name',
  country: 'country',
  ip: 'ip',
  timestamp: 'time',
  campaign_id: 'campaign_id',
};

const OFF_BY_DEFAULT = new Set(['sub_id', 'other']);

function uniqueName(name, used) {
  let candidate = name || 'param';
  let n = 2;
  while (used.has(candidate)) candidate = `${name}_${n++}`;
  used.add(candidate);
  return candidate;
}

export function networkParams(network) {
  const used = new Set();
  const params = [];
  const fixed = [];
  for (const m of network.macros) {
    if (!isPlaceholder(m.macro)) {
      fixed.push(m);
      continue;
    }
    for (const value of expandRange(m.macro)) {
      let name;
      if (m.concept === 'sub_id') {
        const digits = tokenName(value).match(/(\d+)$/);
        name = digits ? `sub${digits[1]}` : 'sub_id';
      } else if (m.concept === 'security' || m.concept === 'other') {
        name = tokenName(value);
      } else {
        name = NETWORK_PARAM[m.concept] ?? tokenName(value);
      }
      params.push({
        name: uniqueName(name, used),
        value,
        concept: m.concept,
        note: m.note ?? '',
        source: m.source,
        on: !OFF_BY_DEFAULT.has(m.concept),
      });
    }
  }
  return { params, fixed };
}

export function splitExample(example) {
  const at = example.indexOf('?');
  if (at === -1) return { base: example, pairs: [] };
  const pairs = example.slice(at + 1).split('&').filter(Boolean).map((p) => {
    const eq = p.indexOf('=');
    return eq === -1 ? { name: p, value: '' } : { name: p.slice(0, eq), value: p.slice(eq + 1) };
  });
  return { base: example.slice(0, at), pairs };
}

export function senderMacro(sender, concept) {
  if (!sender) return null;
  const want = concept === 'click_id' ? 'partner_click_id' : concept;
  for (const direction of ['outbound', 'general']) {
    const hit = sender.macros.find((m) => m.direction === direction && m.concept === want);
    if (hit) return hit;
  }
  return null;
}

export function trackingParams(platform, sender = null) {
  const inbound = platform.macros.filter((m) => m.direction === 'inbound');
  const usable = inbound.filter((m) => !/\.\.\.|=|\s/.test(m.macro));
  const extra = inbound.filter((m) => !usable.includes(m));
  const names = new Set(usable.map((m) => m.macro));
  const { base, pairs } = splitExample(platform.inbound.example);
  const kept = pairs.filter((p) => !names.has(p.name));
  const params = usable.map((m) => {
    let value = 'REPLACE';
    let from = null;
    if (m.concept === 'security') {
      value = 'YOUR_TOKEN';
    } else {
      from = senderMacro(sender, m.concept);
      if (from) value = firstMacro(from.macro);
    }
    return {
      name: m.macro,
      value,
      concept: m.concept,
      note: m.note ?? '',
      source: m.source,
      from,
      missing: Boolean(sender) && !from && m.concept !== 'security',
      on: !OFF_BY_DEFAULT.has(m.concept),
    };
  });
  return { base, kept, params, extra };
}

export function pickMacro(macros, concept, directions) {
  for (const direction of directions || [undefined]) {
    const hit = macros.find((m) => m.concept === concept && (direction === undefined || m.direction === direction));
    if (hit) return hit;
  }
  return null;
}

export function coverage(rows, platforms) {
  return rows.map((row) => {
    const missing = platforms.filter((p) => !pickMacro(p.macros, row.concept, row.directions));
    return { label: row.label, have: platforms.length - missing.length, total: platforms.length, missing: missing.map((p) => p.name) };
  });
}
