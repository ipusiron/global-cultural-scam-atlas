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
 * Filter attacks by country / vector / free-text query across all countries.
 * `data.countries` must be the shape produced by tools/build-countries.mjs.
 * Returns an array of `{country, atk}` entries preserving source order.
 */
export function filterAttacks(data, { country, vector, q, locale } = {}){
  const out = [];
  if(!data || !Array.isArray(data.countries)) return out;
  const cc = country || '__all__';
  const vec = vector || '__all__';
  const query = q || '';
  const loc = locale || 'ja';
  for(const c of data.countries){
    if(cc !== '__all__' && c.country_code !== cc) continue;
    if(!Array.isArray(c.attacks)) continue;
    for(const atk of c.attacks){
      if(vec !== '__all__' && !(atk.attack_vector || []).includes(vec)) continue;
      const tTitle = pickLang(atk.title, loc);
      const tShort = pickLang(atk.short_desc, loc);
      const tScenario = pickLang(atk.scenario, loc);
      const tLever = pickLang(atk.cultural_lever, loc);
      const tags = (atk.tags || []).join(' ');
      const hay = `${tTitle} ${tShort} ${tScenario} ${tLever} ${tags}`;
      if(!matchQuery(hay, query)) continue;
      out.push({ country: c, atk, tTitle, tShort });
    }
  }
  return out;
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
