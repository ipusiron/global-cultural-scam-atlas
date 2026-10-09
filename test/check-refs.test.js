/* Tests for the pure helpers in tools/check-refs.mjs.
 * The HTTP side is intentionally not covered here: it depends on external
 * endpoints and is run manually via `npm run check:refs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUrls, dedupeUrls } from '../tools/check-refs.mjs';

test('extractUrls returns only http(s) URLs from references[]', () => {
  const atk = {
    references: [
      { label: 'a', url: 'https://example.com/a' },
      { label: 'b', url: 'HTTP://EXAMPLE.COM/b' },
      { label: 'c', url: 'ftp://example.com/c' },
      { label: 'd' },
      { label: 'e', url: '' }
    ]
  };
  assert.deepEqual(extractUrls(atk), ['https://example.com/a', 'HTTP://EXAMPLE.COM/b']);
  assert.deepEqual(extractUrls({}), []);
  assert.deepEqual(extractUrls(null), []);
});

test('dedupeUrls preserves first-seen order', () => {
  assert.deepEqual(dedupeUrls(['a', 'b', 'a', 'c', 'b']), ['a', 'b', 'c']);
  assert.deepEqual(dedupeUrls([]), []);
  assert.deepEqual(dedupeUrls(null), []);
});
