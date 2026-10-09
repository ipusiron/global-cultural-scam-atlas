/* GCSA core - pure logic shared between the browser UI and node:test suites.
 * No DOM, no window, no fetch. Every function takes its inputs explicitly so
 * that test/core.test.js can exercise them without a browser.
 */

/**
 * Pick the first available localized string, falling back ja → en → ''.
 */
export function pickLang(obj, locale){
  if(obj == null) return '';
  if(typeof obj === 'string') return obj;
  if(typeof obj !== 'object') return '';
  if(obj[locale]) return obj[locale];
  if(obj.ja) return obj.ja;
  if(obj.en) return obj.en;
  return '';
}

/**
 * Pick a localized array (red_flags / mitigations). Falls back the same way
 * as pickLang. Returns [] rather than null so callers can map/join safely.
 */
export function pickList(obj, locale){
  if(obj == null) return [];
  if(Array.isArray(obj)) return obj;
  if(typeof obj !== 'object') return [];
  if(Array.isArray(obj[locale])) return obj[locale];
  if(Array.isArray(obj.ja)) return obj.ja;
  if(Array.isArray(obj.en)) return obj.en;
  return [];
}

/**
 * Clamp risk_score to [0,5] and coerce numeric strings. Non-numeric → 0.
 * Rationale: data/schema.json allows 1..5 but hostile data could still be
 * served; riskStars uses this to keep String.repeat() out of RangeError.
 */
export function clampRisk(v){
  const n = typeof v === 'number' ? v : Number(v);
  if(!Number.isFinite(n)) return 0;
  const floored = Math.floor(n);
  if(floored < 0) return 0;
  if(floored > 5) return 5;
  return floored;
}

/**
 * Render a 5-slot star bar (`★` filled, `☆` empty) with the risk clamped.
 */
export function riskStars(v){
  const r = clampRisk(v);
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}

/**
 * Allow only http:/https: URLs. Anything else resolves to '#'.
 */
export function sanitizeUrl(url){
  if(url == null) return '#';
  const s = String(url).trim();
  if(!s) return '#';
  if(!/^https?:\/\//i.test(s)) return '#';
  return s;
}

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, m => HTML_ESCAPES[m]);
}

export function escapeAttr(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, m => HTML_ESCAPES[m]);
}

/**
 * Case-insensitive AND match: every whitespace-separated term in `q` must
 * appear in `haystack`. Empty query matches everything.
 */
export function matchQuery(haystack, q){
  if(!q) return true;
  const hay = String(haystack).toLowerCase();
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length) return true;
  return terms.every(term => hay.includes(term));
}

/**
 * Field-scoped search. Returns `{matched, fields}` so callers can show which
 * fields the query hit on each card. Searches title / short_desc / scenario /
 * cultural_lever / red_flags / mitigations / tags / id, in both the active
 * locale and the English fallback (so an EN query still finds JA entries
 * that have an EN translation and vice versa).
 */
export function searchAttackFields(atk, q, locale){
  if(!q) return { matched: true, fields: [] };
  const loc = locale || 'ja';
  const other = loc === 'ja' ? 'en' : 'ja';
  const checks = [
    ['title',          [pickLang(atk.title, loc),          pickLang(atk.title, other)]],
    ['short_desc',     [pickLang(atk.short_desc, loc),     pickLang(atk.short_desc, other)]],
    ['scenario',       [pickLang(atk.scenario, loc),       pickLang(atk.scenario, other)]],
    ['cultural_lever', [pickLang(atk.cultural_lever, loc), pickLang(atk.cultural_lever, other)]],
    ['red_flags',      [pickList(atk.red_flags, loc).join(' '),    pickList(atk.red_flags, other).join(' ')]],
    ['mitigations',    [pickList(atk.mitigations, loc).join(' '),  pickList(atk.mitigations, other).join(' ')]],
    ['tags',           [(atk.tags || []).join(' ')]],
    ['id',             [atk.id || '']]
  ];
  const hits = [];
  for(const [name, parts] of checks){
    const hay = parts.filter(Boolean).join(' ');
    if(hay && matchQuery(hay, q)) hits.push(name);
  }
  return { matched: hits.length > 0, fields: hits };
}

/**
 * Filter attacks by country / vector / target / free-text query. All active
 * filters AND together. Returns `{country, atk, tTitle, tShort, matchedFields}`
 * entries preserving source order.
 */
export function filterAttacks(data, { country, vector, target, q, locale } = {}){
  const out = [];
  if(!data || !Array.isArray(data.countries)) return out;
  const cc = country || '__all__';
  const vec = vector || '__all__';
  const tgt = target || '__all__';
  const query = q || '';
  const loc = locale || 'ja';
  for(const c of data.countries){
    if(cc !== '__all__' && c.country_code !== cc) continue;
    if(!Array.isArray(c.attacks)) continue;
    for(const atk of c.attacks){
      if(vec !== '__all__' && !(atk.attack_vector || []).includes(vec)) continue;
      if(tgt !== '__all__' && !(atk.targets || []).includes(tgt)) continue;
      const search = searchAttackFields(atk, query, loc);
      if(!search.matched) continue;
      const tTitle = pickLang(atk.title, loc);
      const tShort = pickLang(atk.short_desc, loc);
      out.push({ country: c, atk, tTitle, tShort, matchedFields: search.fields });
    }
  }
  return out;
}

/**
 * Return the sorted list of distinct target values present in the data.
 * Preserves first-seen order per country so built-in controlled vocabulary
 * (tourist/general/elderly/business/student) stays near the front.
 */
export function extractTargets(data){
  const seen = new Set();
  const order = [];
  if(!data || !Array.isArray(data.countries)) return order;
  for(const c of data.countries){
    if(!Array.isArray(c.attacks)) continue;
    for(const atk of c.attacks){
      for(const t of (atk.targets || [])){
        if(typeof t !== 'string') continue;
        if(seen.has(t)) continue;
        seen.add(t);
        order.push(t);
      }
    }
  }
  return order;
}

/**
 * Return `{ cc: count }` and the total, matching the shape of filterAttacks
 * (country only — vector/query do not apply here).
 */
export function countryCounts(data){
  const counts = {};
  let total = 0;
  if(!data || !Array.isArray(data.countries)) return { counts, total };
  for(const c of data.countries){
    const n = Array.isArray(c.attacks) ? c.attacks.length : 0;
    counts[c.country_code] = n;
    total += n;
  }
  return { counts, total };
}

/**
 * Return a stable comparator for the given sort key. Unknown keys fall back
 * to 'default'. Sort keys:
 *   - default: country_code ASC, id ASC
 *   - risk:    risk_score DESC, id ASC
 *   - id:      id ASC
 */
export function sortAttacks(entries, sortKey){
  const arr = Array.isArray(entries) ? entries.slice() : [];
  const key = SORT_KEYS.has(sortKey) ? sortKey : 'default';
  const idOf = e => (e && e.atk && e.atk.id) || '';
  const ccOf = e => (e && e.country && e.country.country_code) || '';
  const riskOf = e => clampRisk(e && e.atk && e.atk.risk_score);
  if(key === 'risk'){
    arr.sort((a, b) => (riskOf(b) - riskOf(a)) || idOf(a).localeCompare(idOf(b)));
  } else if(key === 'id'){
    arr.sort((a, b) => idOf(a).localeCompare(idOf(b)));
  } else {
    arr.sort((a, b) => ccOf(a).localeCompare(ccOf(b)) || idOf(a).localeCompare(idOf(b)));
  }
  return arr;
}

const SORT_KEYS = new Set(['default', 'risk', 'id']);
export const SORT_OPTIONS = ['default', 'risk', 'id'];

/* ----------------------- URL hash state ---------------------------------- */

const HASH_KEYS = ['country', 'vector', 'target', 'q', 'sort', 'lang'];
const HASH_VALIDATORS = {
  country: v => /^[A-Z]{2}$/.test(v) || v === '__all__',
  vector:  v => /^[a-z-]{2,32}$/.test(v) || v === '__all__',
  target:  v => /^[a-z-]{2,32}$/.test(v) || v === '__all__',
  q:       v => typeof v === 'string' && v.length <= 200,
  sort:    v => SORT_KEYS.has(v),
  lang:    v => v === 'ja' || v === 'en'
};

/**
 * Parse `#k=v&k=v` (or the same body with a leading `#`) into a flat object.
 * Unknown keys and invalid values are dropped. `q` is URI-decoded.
 */
export function parseHash(hash){
  const out = {};
  if(typeof hash !== 'string' || !hash) return out;
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if(!body) return out;
  for(const pair of body.split('&')){
    if(!pair) continue;
    const eq = pair.indexOf('=');
    if(eq < 0) continue;
    const k = pair.slice(0, eq);
    let v;
    try { v = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')); }
    catch(_) { continue; }
    if(!HASH_KEYS.includes(k)) continue;
    const check = HASH_VALIDATORS[k];
    if(check && !check(v)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Serialise `{country, vector, target, q, sort, lang}` into `#k=v&...`.
 * Drops defaults so a bare "no filters" state produces an empty string.
 */
export function buildHash(state){
  if(!state || typeof state !== 'object') return '';
  const parts = [];
  for(const k of HASH_KEYS){
    const v = state[k];
    if(v == null || v === '') continue;
    if((k === 'country' || k === 'vector' || k === 'target') && v === '__all__') continue;
    if(k === 'sort' && v === 'default') continue;
    const check = HASH_VALIDATORS[k];
    if(check && !check(v)) continue;
    parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? '#' + parts.join('&') : '';
}

/* ----------------------- Aggregates for stats view ----------------------- */

/**
 * Count attacks by country × vector, country × target, and overall risk 1..5.
 * Accepts either the raw countries.json shape or an array of
 * `{country, atk}` entries (so the stats view can honour the active filter).
 */
export function aggregate(input){
  const entries = normaliseEntries(input);
  const total = entries.length;
  const byCountry = {};
  const byVector = {};
  const byTarget = {};
  const byRisk = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const countryByVector = {};
  const countryByTarget = {};
  for(const { country, atk } of entries){
    const cc = country.country_code;
    byCountry[cc] = (byCountry[cc] || 0) + 1;
    for(const v of (atk.attack_vector || [])){
      byVector[v] = (byVector[v] || 0) + 1;
      countryByVector[cc] = countryByVector[cc] || {};
      countryByVector[cc][v] = (countryByVector[cc][v] || 0) + 1;
    }
    for(const t of (atk.targets || [])){
      byTarget[t] = (byTarget[t] || 0) + 1;
      countryByTarget[cc] = countryByTarget[cc] || {};
      countryByTarget[cc][t] = (countryByTarget[cc][t] || 0) + 1;
    }
    const r = clampRisk(atk.risk_score);
    if(r >= 1 && r <= 5) byRisk[r] += 1;
  }
  return { total, byCountry, byVector, byTarget, byRisk, countryByVector, countryByTarget };
}

function normaliseEntries(input){
  if(Array.isArray(input)) return input.filter(e => e && e.country && e.atk);
  if(input && Array.isArray(input.countries)){
    const out = [];
    for(const c of input.countries){
      if(!Array.isArray(c.attacks)) continue;
      for(const atk of c.attacks) out.push({ country: c, atk });
    }
    return out;
  }
  return [];
}

/* ----------------------- CSV export -------------------------------------- */

const CSV_FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * Encode a single CSV field: quote whenever needed, double embedded quotes,
 * and prefix a `'` when the value begins with a character that spreadsheets
 * interpret as a formula (`= + - @` and the leading whitespace variants).
 */
export function csvField(value){
  const s = value == null ? '' : String(value);
  const safe = CSV_FORMULA_LEAD.test(s) ? "'" + s : s;
  if(/[",\r\n]/.test(safe)){
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  return safe;
}

/**
 * Build a UTF-8 CSV string (header + rows, CRLF-terminated). `columns` is a
 * list of either header strings or `[header, accessor]` pairs; when an
 * accessor is omitted the header itself is used as the row key.
 */
export function toCsv(rows, columns){
  const cols = (columns || []).map(c => Array.isArray(c) ? c : [c, c]);
  const header = cols.map(([h]) => csvField(h)).join(',');
  const body = (rows || []).map(r =>
    cols.map(([, k]) => csvField(typeof k === 'function' ? k(r) : (r && r[k]))).join(',')
  );
  return [header, ...body].join('\r\n') + '\r\n';
}

/**
 * Convert the UI filter result (`filterAttacks` output) into CSV-ready rows.
 * Localised arrays are joined with ' / ' so the result stays spreadsheet-wide.
 */
export function entriesToCsvRows(entries, locale){
  const loc = locale || 'ja';
  const join = arr => (arr || []).join(' / ');
  return (entries || []).map(({ country, atk }) => ({
    id: atk.id || '',
    country: country.country_code || '',
    title: pickLang(atk.title, loc),
    vector: join(atk.attack_vector),
    targets: join(atk.targets),
    risk: String(clampRisk(atk.risk_score)),
    cultural_lever: pickLang(atk.cultural_lever, loc),
    red_flags: pickList(atk.red_flags, loc).join(' / '),
    mitigations: pickList(atk.mitigations, loc).join(' / ')
  }));
}

/**
 * Resolve the initial locale: ?lang=ja|en > stored value > browser language.
 * Pure: every input is passed explicitly so the function stays testable.
 *   - query:    raw query string (with or without leading '?') or null
 *   - stored:   value previously saved in localStorage (string or null)
 *   - languages: array of BCP-47 tags (navigator.languages or [])
 */
export function resolveLocale({ query, stored, languages } = {}){
  const valid = v => v === 'ja' || v === 'en';
  // 1. ?lang=
  if(typeof query === 'string' && query){
    const q = query.startsWith('?') ? query.slice(1) : query;
    for(const pair of q.split('&')){
      const [k, v] = pair.split('=');
      if(k === 'lang' && valid(v)) return v;
    }
  }
  // 2. stored
  if(valid(stored)) return stored;
  // 3. browser languages
  if(Array.isArray(languages)){
    for(const raw of languages){
      if(typeof raw !== 'string') continue;
      const tag = raw.toLowerCase();
      if(tag === 'ja' || tag.startsWith('ja-')) return 'ja';
      if(tag === 'en' || tag.startsWith('en-')) return 'en';
    }
    // Non-ja/en browser → English
    if(languages.length) return 'en';
  }
  return 'ja';
}

/**
 * Resolve the initial theme: stored value > prefers-color-scheme > dark.
 *   - stored:        string or null
 *   - prefersLight:  boolean (window.matchMedia result, passed in)
 */
export function resolveTheme({ stored, prefersLight } = {}){
  if(stored === 'light' || stored === 'dark') return stored;
  return prefersLight ? 'light' : 'dark';
}
