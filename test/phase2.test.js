/* Phase-2 tests: field-scoped search, target extraction, sort, hash state,
 * aggregates, CSV escaping, and the vector/target label dictionary.
 * Numerical expectations use the real dist/countries.json (built by
 * `npm run build` ahead of `npm test` or regenerated here on demand).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  filterAttacks, searchAttackFields, extractTargets, countryCounts,
  sortAttacks, parseHash, buildHash, aggregate,
  csvField, toCsv, entriesToCsvRows
} from '../docs/js/gcsa-core.js';
import { labelFor, t } from '../docs/js/gcsa-messages.js';

async function loadDataset(){
  const path = 'dist/countries.json';
  try { return JSON.parse(await fs.readFile(path, 'utf-8')); }
  catch(_) {
    // Build on demand so tests do not require a prior `npm run build`.
    spawnSync('node', ['tools/build-index.mjs'], { stdio: 'inherit' });
    spawnSync('node', ['tools/build-countries.mjs'], { stdio: 'inherit' });
    return JSON.parse(await fs.readFile(path, 'utf-8'));
  }
}

const DATA = await loadDataset();

/* -------------------- searchAttackFields --------------------------------- */

test('searchAttackFields hits by field name', () => {
  const atk = {
    id: 'jp-999',
    title: { ja: '押し売りの店', en: 'Hard sell store' },
    short_desc: { ja: '店舗', en: 'storefront' },
    scenario: { ja: 'シナリオA', en: 'scenario A' },
    cultural_lever: { ja: '互恵', en: 'reciprocity' },
    red_flags: { ja: ['あやしい'], en: ['suspicious'] },
    mitigations: { ja: ['断る'], en: ['refuse'] },
    tags: ['tourism'], attack_vector: ['in-person'], targets: ['tourist']
  };
  assert.deepEqual(searchAttackFields(atk, '', 'ja'), { matched: true, fields: [] });
  const titleHit = searchAttackFields(atk, '押し売り', 'ja');
  assert.ok(titleHit.matched && titleHit.fields.includes('title'));
  // EN query still hits JA-primary entry (because EN translation exists)
  const enHit = searchAttackFields(atk, 'storefront', 'ja');
  assert.ok(enHit.matched && enHit.fields.includes('short_desc'));
  // id search works
  assert.ok(searchAttackFields(atk, 'jp-999', 'ja').fields.includes('id'));
  // tag search works
  assert.ok(searchAttackFields(atk, 'tourism', 'en').fields.includes('tags'));
  // red_flags search works
  assert.ok(searchAttackFields(atk, 'あやしい', 'ja').fields.includes('red_flags'));
  // mitigations search works
  assert.ok(searchAttackFields(atk, 'refuse', 'en').fields.includes('mitigations'));
  // cultural_lever search works
  assert.ok(searchAttackFields(atk, 'reciprocity', 'en').fields.includes('cultural_lever'));
  // no match
  assert.equal(searchAttackFields(atk, 'xyznothing', 'ja').matched, false);
});

/* -------------------- filterAttacks: target + matchedFields --------------- */

test('filterAttacks honours target and exposes matchedFields', () => {
  const data = {
    countries: [{
      country_code: 'JP',
      attacks: [
        { id: 'jp-001', title: { ja: 'A', en: 'A' }, short_desc: { ja: '', en: '' },
          scenario: { ja: '', en: '' }, cultural_lever: { ja: '', en: '' },
          red_flags: { ja: [] }, mitigations: { ja: [] },
          attack_vector: ['phone'], targets: ['elderly'], tags: [] },
        { id: 'jp-002', title: { ja: 'B', en: 'B' }, short_desc: { ja: '', en: '' },
          scenario: { ja: '', en: '' }, cultural_lever: { ja: '', en: '' },
          red_flags: { ja: [] }, mitigations: { ja: [] },
          attack_vector: ['phone'], targets: ['tourist'], tags: [] }
      ]
    }]
  };
  assert.equal(filterAttacks(data, { target: 'elderly' }).length, 1);
  assert.equal(filterAttacks(data, { target: 'tourist' }).length, 1);
  assert.equal(filterAttacks(data, { target: '__all__' }).length, 2);
  const hit = filterAttacks(data, { q: 'jp-001' })[0];
  assert.ok(hit.matchedFields.includes('id'));
});

/* -------------------- extractTargets / countryCounts --------------------- */

test('extractTargets and countryCounts match the real dataset', () => {
  const targets = extractTargets(DATA);
  for(const built of ['tourist', 'general', 'elderly', 'business', 'student']){
    // Only assert ones that actually appear in the dataset.
    if(DATA.countries.some(c => c.attacks.some(a => (a.targets || []).includes(built)))){
      assert.ok(targets.includes(built), `missing target ${built}`);
    }
  }
  const { counts, total } = countryCounts(DATA);
  assert.equal(total, 53);
  assert.equal(counts.JP, 32);
  assert.equal(counts.US, 20);
  assert.equal(counts.IN, 1);
});

/* -------------------- sortAttacks ---------------------------------------- */

test('sortAttacks: default / risk / id', () => {
  const entries = [
    { country: { country_code: 'US' }, atk: { id: 'us-002', risk_score: 2 } },
    { country: { country_code: 'JP' }, atk: { id: 'jp-002', risk_score: 5 } },
    { country: { country_code: 'JP' }, atk: { id: 'jp-001', risk_score: 3 } }
  ];
  assert.deepEqual(sortAttacks(entries, 'default').map(e => e.atk.id), ['jp-001', 'jp-002', 'us-002']);
  assert.deepEqual(sortAttacks(entries, 'risk').map(e => e.atk.id), ['jp-002', 'jp-001', 'us-002']);
  assert.deepEqual(sortAttacks(entries, 'id').map(e => e.atk.id), ['jp-001', 'jp-002', 'us-002']);
  // unknown key falls back to default
  assert.deepEqual(sortAttacks(entries, 'bogus').map(e => e.atk.id), ['jp-001', 'jp-002', 'us-002']);
});

/* -------------------- parseHash / buildHash round-trip ------------------- */

test('parseHash drops invalid keys and values', () => {
  assert.deepEqual(parseHash(''), {});
  assert.deepEqual(parseHash('#foo=bar'), {});
  assert.deepEqual(parseHash('#country=jp'), {}); // lowercase rejected
  assert.deepEqual(parseHash('#country=JP&vector=phone&q=ATM&lang=en&sort=risk'),
    { country: 'JP', vector: 'phone', q: 'ATM', lang: 'en', sort: 'risk' });
  assert.deepEqual(parseHash('#target=elderly&q=' + encodeURIComponent('警察 詐欺')),
    { target: 'elderly', q: '警察 詐欺' });
  // invalid sort / lang dropped
  assert.deepEqual(parseHash('#sort=bogus&lang=xx'), {});
});

test('buildHash drops defaults and round-trips with parseHash', () => {
  assert.equal(buildHash({}), '');
  assert.equal(buildHash({ country: '__all__', sort: 'default' }), '');
  assert.equal(buildHash({ country: 'JP', vector: 'phone', sort: 'risk', lang: 'en' }),
    '#country=JP&vector=phone&sort=risk&lang=en');
  // round trip
  const state = { country: 'JP', vector: 'phone', target: 'elderly', q: '警察 詐欺', sort: 'risk', lang: 'ja' };
  const parsed = parseHash(buildHash(state));
  assert.deepEqual(parsed, state);
});

/* -------------------- aggregate ------------------------------------------ */

test('aggregate: totals match countryCounts and risk histogram sums to total', () => {
  const stats = aggregate(DATA);
  assert.equal(stats.total, 53);
  assert.equal(stats.byCountry.JP, 32);
  assert.equal(stats.byCountry.US, 20);
  assert.equal(stats.byCountry.IN, 1);
  const riskSum = Object.values(stats.byRisk).reduce((a, b) => a + b, 0);
  assert.equal(riskSum, 53);
  // Every vector/target in the aggregate must appear in at least one country.
  for(const v of Object.keys(stats.byVector)){
    assert.ok(DATA.countries.some(c => c.attacks.some(a => (a.attack_vector || []).includes(v))));
  }
});

test('aggregate accepts a filterAttacks result (array of {country, atk})', () => {
  const entries = filterAttacks(DATA, { country: 'JP' });
  const stats = aggregate(entries);
  assert.equal(stats.total, 32);
  assert.equal(stats.byCountry.JP, 32);
  assert.equal(stats.byCountry.US || 0, 0);
});

/* -------------------- CSV ----------------------------------------------- */

test('csvField quotes, escapes, and defuses formulas', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('with, comma'), '"with, comma"');
  assert.equal(csvField('with "quote"'), '"with ""quote"""');
  assert.equal(csvField('multi\nline'), '"multi\nline"');
  // Formula lead characters get a leading apostrophe.
  assert.equal(csvField('=1+1'), "'=1+1");
  assert.equal(csvField('+danger'), "'+danger");
  assert.equal(csvField('-danger'), "'-danger");
  assert.equal(csvField('@attack'), "'@attack");
  // Combination: quoted and defused.
  assert.equal(csvField('=A1, B1'), `"'=A1, B1"`);
  assert.equal(csvField(null), '');
  assert.equal(csvField(undefined), '');
});

test('toCsv builds header + CRLF rows via accessors', () => {
  const rows = [{ a: 1, b: 'two' }, { a: 3, b: 'with,comma' }];
  const csv = toCsv(rows, [['A', 'a'], ['B', 'b']]);
  assert.equal(csv, 'A,B\r\n1,two\r\n3,"with,comma"\r\n');
});

test('entriesToCsvRows pulls localised strings and includes verification + references', () => {
  const entries = filterAttacks(DATA, { country: 'JP' });
  const rows = entriesToCsvRows(entries, 'ja');
  assert.equal(rows.length, 32);
  const vocab = new Set(['verified','partial','unverified']);
  for(const r of rows){
    assert.match(r.id, /^jp-\d{3}$/);
    assert.equal(r.country, 'JP');
    assert.ok(r.title.length > 0, `empty title for ${r.id}`);
    assert.match(r.risk, /^[1-5]$/);
    assert.ok(vocab.has(r.verification), `verification "${r.verification}" out of vocab for ${r.id}`);
    assert.equal(typeof r.references, 'string');
  }
});

test('filterAttacks: verifiedOnly keeps only verified entries', () => {
  const data = {
    countries: [{
      country_code: 'JP',
      attacks: [
        { id: 'jp-001', title: { ja: 'A' }, short_desc: { ja: '' },
          scenario: { ja: '' }, cultural_lever: { ja: '' },
          red_flags: { ja: [] }, mitigations: { ja: [] },
          attack_vector: ['phone'], targets: ['elderly'], tags: [],
          verification: { status: 'verified' } },
        { id: 'jp-002', title: { ja: 'B' }, short_desc: { ja: '' },
          scenario: { ja: '' }, cultural_lever: { ja: '' },
          red_flags: { ja: [] }, mitigations: { ja: [] },
          attack_vector: ['phone'], targets: ['general'], tags: [],
          verification: { status: 'partial' } },
        { id: 'jp-003', title: { ja: 'C' }, short_desc: { ja: '' },
          scenario: { ja: '' }, cultural_lever: { ja: '' },
          red_flags: { ja: [] }, mitigations: { ja: [] },
          attack_vector: ['phone'], targets: ['general'], tags: [] }
      ]
    }]
  };
  assert.equal(filterAttacks(data, { verifiedOnly: false }).length, 3);
  assert.equal(filterAttacks(data, { verifiedOnly: true }).length, 1);
  assert.equal(filterAttacks(data, { verifiedOnly: '1' }).length, 1);
});

test('parseHash / buildHash: verified=1 round-trips', () => {
  assert.deepEqual(parseHash('#verified=1'), { verified: '1' });
  assert.deepEqual(parseHash('#verified=0'), {}); // invalid value dropped
  assert.equal(buildHash({ verified: '1' }), '#verified=1');
  assert.equal(buildHash({ verified: true }), '#verified=1');
  assert.equal(buildHash({ verified: '' }), '');
  // round-trip with other keys
  const state = { country: 'JP', verified: '1', lang: 'ja' };
  assert.deepEqual(parseHash(buildHash(state)), state);
});

test('aggregate includes byVerification totals', () => {
  const stats = aggregate(DATA);
  assert.equal(typeof stats.byVerification, 'object');
  const vSum = (stats.byVerification.verified || 0)
             + (stats.byVerification.partial  || 0)
             + (stats.byVerification.unverified || 0);
  assert.equal(vSum, 53);
});

/* -------------------- label dictionary ---------------------------------- */

test('labelFor returns dictionary values and falls back to raw', () => {
  assert.equal(labelFor('vector', 'phone', 'ja'), '電話');
  assert.equal(labelFor('vector', 'phone', 'en'), 'phone');
  assert.equal(labelFor('target', 'elderly', 'ja'), '高齢者');
  assert.equal(labelFor('target', 'tourist', 'en'), 'tourist');
  // Unknown value is returned as-is.
  assert.equal(labelFor('vector', 'unknown-x', 'ja'), 'unknown-x');
});

test('every CLAUDE.md controlled-vocabulary vector/target has JA/EN labels', () => {
  // CLAUDE.md pins these; data occasionally carries out-of-vocab values
  // (e.g. "street", "immigrant") which fall through to the raw string by design.
  const vectors = ['in-person','phone','email','sms','social','website',
    'payment-app','postal','door-to-door','marketplace','mixed'];
  const targets = ['tourist','general','elderly','business','student','expat'];
  for(const v of vectors){
    assert.notEqual(labelFor('vector', v, 'ja'), v, `vector "${v}" has no JA label`);
    assert.ok(typeof labelFor('vector', v, 'en') === 'string');
  }
  for(const tg of targets){
    assert.notEqual(labelFor('target', tg, 'ja'), tg, `target "${tg}" has no JA label`);
    assert.ok(typeof labelFor('target', tg, 'en') === 'string');
  }
});

/* -------------------- field label dictionary ---------------------------- */

test('matched-field labels exist in both locales', () => {
  for(const f of ['title', 'short_desc', 'scenario', 'cultural_lever',
                  'red_flags', 'mitigations', 'tags', 'id']){
    assert.notEqual(t('ja', `field.${f}`), `field.${f}`);
    assert.notEqual(t('en', `field.${f}`), `field.${f}`);
  }
});
