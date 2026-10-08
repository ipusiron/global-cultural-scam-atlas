/* Unit tests for docs/js/gcsa-core.js (pure logic). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLang, pickList, clampRisk, riskStars, sanitizeUrl,
  escapeHtml, escapeAttr, matchQuery, filterAttacks,
  resolveLocale, resolveTheme
} from '../docs/js/gcsa-core.js';

test('pickLang falls back to ja when locale missing', () => {
  assert.equal(pickLang({ ja: 'あ', en: 'a' }, 'en'), 'a');
  assert.equal(pickLang({ ja: 'あ' }, 'en'), 'あ');
  assert.equal(pickLang({ en: 'a' }, 'ja'), 'a');
  assert.equal(pickLang(null, 'ja'), '');
  assert.equal(pickLang('plain', 'ja'), 'plain');
});

test('pickList returns [] for missing input', () => {
  assert.deepEqual(pickList(null, 'ja'), []);
  assert.deepEqual(pickList({ ja: ['x'] }, 'en'), ['x']);
  assert.deepEqual(pickList({ en: ['x'] }, 'ja'), ['x']);
  assert.deepEqual(pickList(['raw'], 'ja'), ['raw']);
});

test('clampRisk coerces and clamps to [0,5]', () => {
  assert.equal(clampRisk(-1), 0);
  assert.equal(clampRisk(0), 0);
  assert.equal(clampRisk(3), 3);
  assert.equal(clampRisk(5), 5);
  assert.equal(clampRisk(6), 5);
  assert.equal(clampRisk(99), 5);
  assert.equal(clampRisk(NaN), 0);
  assert.equal(clampRisk(undefined), 0);
  assert.equal(clampRisk(null), 0);
  // Decided behavior: numeric strings coerce via Number().
  assert.equal(clampRisk('4'), 4);
  assert.equal(clampRisk('abc'), 0);
});

test('riskStars never throws and always returns 5 glyphs', () => {
  for(const v of [-1, 0, 1, 2, 3, 4, 5, 6, 99, NaN, '3', 'x']){
    const s = riskStars(v);
    // 5 stars worth of code points (★ and ☆ are each single BMP code points)
    assert.equal([...s].length, 5, `len for ${v}`);
  }
});

test('sanitizeUrl allows only http(s)', () => {
  assert.equal(sanitizeUrl('https://example.com'), 'https://example.com');
  assert.equal(sanitizeUrl('http://example.com'), 'http://example.com');
  assert.equal(sanitizeUrl('  https://e.com  '), 'https://e.com');
  assert.equal(sanitizeUrl('javascript:alert(1)'), '#');
  assert.equal(sanitizeUrl('data:text/html,x'), '#');
  assert.equal(sanitizeUrl('/relative'), '#');
  assert.equal(sanitizeUrl(''), '#');
  assert.equal(sanitizeUrl(null), '#');
});

test('escapeHtml and escapeAttr cover the five entities', () => {
  assert.equal(escapeHtml('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
  assert.equal(escapeAttr('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(0), '0');
});

test('matchQuery is case-insensitive AND, empty = match', () => {
  assert.equal(matchQuery('Hello World', ''), true);
  assert.equal(matchQuery('Hello World', 'hello'), true);
  assert.equal(matchQuery('Hello World', 'HELLO WORLD'), true);
  assert.equal(matchQuery('Hello World', 'hello missing'), false);
  // Non-ASCII
  assert.equal(matchQuery('観光地での押し売り', '観光'), true);
  // Surrogate pair (musical G clef U+1D11E)
  assert.equal(matchQuery('a𝄞b', '𝄞'), true);
});

test('filterAttacks combines country, vector and query (AND)', () => {
  const data = {
    countries: [
      {
        country_code: 'JP',
        attacks: [
          { id: 'jp-001', title: { ja: '押し売り', en: 'Hard sell' },
            short_desc: { ja: '店舗', en: 'store' },
            scenario: { ja: '', en: '' }, cultural_lever: { ja: '', en: '' },
            attack_vector: ['in-person'], tags: ['tourism'] },
          { id: 'jp-002', title: { ja: '電話詐欺', en: 'Phone scam' },
            short_desc: { ja: '', en: '' },
            scenario: { ja: '', en: '' }, cultural_lever: { ja: '', en: '' },
            attack_vector: ['phone'], tags: ['elderly'] }
        ]
      },
      {
        country_code: 'US',
        attacks: [
          { id: 'us-001', title: { en: 'Tech support' },
            short_desc: { en: '' }, scenario: { en: '' }, cultural_lever: { en: '' },
            attack_vector: ['phone'], tags: [] }
        ]
      }
    ]
  };
  assert.equal(filterAttacks(data).length, 3);
  assert.equal(filterAttacks(data, { country: 'JP' }).length, 2);
  assert.equal(filterAttacks(data, { vector: 'phone' }).length, 2);
  assert.equal(filterAttacks(data, { country: 'JP', vector: 'phone' }).length, 1);
  assert.equal(filterAttacks(data, { q: '押し売り' }).length, 1);
  assert.equal(filterAttacks(data, { q: 'tech', locale: 'en' }).length, 1);
  assert.equal(filterAttacks(data, { q: 'nothing-matches' }).length, 0);
  assert.equal(filterAttacks(null).length, 0);
  assert.equal(filterAttacks({}).length, 0);
});

test('resolveLocale: ?lang= wins over stored and browser', () => {
  assert.equal(resolveLocale({ query: '?lang=en', stored: 'ja', languages: ['ja-JP'] }), 'en');
  assert.equal(resolveLocale({ query: 'lang=ja', stored: 'en', languages: ['en-US'] }), 'ja');
  // invalid ?lang=xx is ignored, falls through to stored
  assert.equal(resolveLocale({ query: '?lang=xx', stored: 'en' }), 'en');
  // stored
  assert.equal(resolveLocale({ stored: 'ja' }), 'ja');
  assert.equal(resolveLocale({ stored: 'bogus', languages: ['en-US'] }), 'en');
  // browser
  assert.equal(resolveLocale({ languages: ['ja-JP'] }), 'ja');
  assert.equal(resolveLocale({ languages: ['en-US'] }), 'en');
  assert.equal(resolveLocale({ languages: ['fr'] }), 'en');
  // nothing
  assert.equal(resolveLocale({}), 'ja');
  assert.equal(resolveLocale(), 'ja');
});

test('resolveTheme respects stored, falls back to prefers-color-scheme', () => {
  assert.equal(resolveTheme({ stored: 'light' }), 'light');
  assert.equal(resolveTheme({ stored: 'dark' }), 'dark');
  assert.equal(resolveTheme({ stored: 'bogus', prefersLight: true }), 'light');
  assert.equal(resolveTheme({ prefersLight: true }), 'light');
  assert.equal(resolveTheme({ prefersLight: false }), 'dark');
  assert.equal(resolveTheme({}), 'dark');
});
