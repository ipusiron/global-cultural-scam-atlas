/* Tests for docs/js/gcsa-messages.js:
 *  - ja/en share the same key set
 *  - no Japanese code points leak into English values
 *  - no empty strings in Japanese values (the UI relies on real text)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messages, t } from '../docs/js/gcsa-messages.js';

test('ja and en have the same keys', () => {
  const jaKeys = Object.keys(messages.ja).sort();
  const enKeys = Object.keys(messages.en).sort();
  assert.deepEqual(enKeys, jaKeys,
    `ja/en key sets differ:\n  only in ja: ${diff(jaKeys, enKeys)}\n  only in en: ${diff(enKeys, jaKeys)}`);
});

test('every en value is free of Japanese characters', () => {
  // Hiragana, katakana, CJK ideographs, full-width brackets and punctuation.
  const banned = /[぀-ゟ゠-ヿ一-鿿（）、。]/;
  for(const [k, v] of Object.entries(messages.en)){
    assert.ok(!banned.test(v), `en["${k}"] contains Japanese: ${JSON.stringify(v)}`);
  }
});

test('every ja value is non-empty', () => {
  for(const [k, v] of Object.entries(messages.ja)){
    assert.ok(typeof v === 'string' && v.length > 0, `ja["${k}"] is empty`);
  }
});

test('t() applies explicit empty translations too (not falsy-filtered)', () => {
  // Insert a temporary empty value and ensure t() returns '' (not the key).
  const key = '__test.empty__';
  messages.ja[key] = '';
  try {
    assert.equal(t('ja', key), '');
  } finally {
    delete messages.ja[key];
  }
});

test('t() falls back to ja when locale key is missing', () => {
  assert.equal(t('en', 'filter.country'), 'Country');
  assert.equal(t('xx', 'filter.country'), '国 / Country');
});

function diff(a, b){ const s = new Set(b); return a.filter(x => !s.has(x)).join(', '); }
