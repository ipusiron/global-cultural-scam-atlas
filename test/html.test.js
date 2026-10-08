/* Tests for docs/index.html structure, security attributes, and i18n hooks. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

const HTML_PATH = 'docs/index.html';

async function readHtml(){ return fs.readFile(HTML_PATH, 'utf-8'); }

test('CSP meta exists and omits frame-ancestors and unsafe-inline', async () => {
  const html = await readHtml();
  const m = html.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"/i);
  assert.ok(m, 'CSP meta not found');
  const csp = m[1];
  assert.ok(!/frame-ancestors/i.test(csp), 'CSP must not include frame-ancestors (ineffective in meta)');
  assert.ok(!/unsafe-inline/i.test(csp), 'CSP must not include unsafe-inline');
  assert.ok(/default-src\s+'self'/.test(csp), 'CSP must include default-src self');
  assert.ok(/script-src\s+'self'/.test(csp), 'CSP must include script-src self');
});

test('ineffective meta http-equiv headers are not present', async () => {
  const html = await readHtml();
  assert.ok(!/http-equiv=["']X-Frame-Options["']/i.test(html), 'remove X-Frame-Options meta');
  assert.ok(!/http-equiv=["']X-Content-Type-Options["']/i.test(html), 'remove X-Content-Type-Options meta');
});

test('referrer meta is set to no-referrer', async () => {
  const html = await readHtml();
  const m = html.match(/<meta[^>]*name=["']referrer["'][^>]*content=["']([^"']+)["']/i);
  assert.ok(m, 'referrer meta not found');
  assert.equal(m[1], 'no-referrer');
});

test('favicon link is declared (avoids /favicon.ico 404)', async () => {
  const html = await readHtml();
  assert.ok(/<link[^>]*rel=["']icon["']/i.test(html), 'rel="icon" link missing');
});

test('noscript block is present', async () => {
  const html = await readHtml();
  assert.ok(/<noscript[^>]*>[\s\S]*?<\/noscript>/i.test(html), 'noscript block missing');
});

test('main script is loaded as a module', async () => {
  const html = await readHtml();
  assert.ok(/<script[^>]*type=["']module["'][^>]*src=["']\.\/js\/main\.js["']/i.test(html),
    'main.js must be loaded with type="module"');
});

test('no inline on* handlers or style= attributes', async () => {
  const html = await readHtml();
  assert.ok(!/\son[a-z]+=/i.test(html), 'inline on* handlers must not appear');
  assert.ok(!/\sstyle=/i.test(html), 'inline style= attributes must not appear');
});

test('required element ids are present', async () => {
  const html = await readHtml();
  const required = [
    'country', 'vector', 'q', 'searchClear', 'resetFilters',
    'resultCount', 'cards', 'detailDialog', 'dlgClose',
    'themeToggle', 'localeToggle'
  ];
  for(const id of required){
    assert.ok(new RegExp(`id=["']${id}["']`).test(html), `id="${id}" missing`);
  }
});

test('modal OK button and footer have been removed', async () => {
  const html = await readHtml();
  assert.ok(!/id=["']dlgOk["']/.test(html), 'dlgOk must be removed');
  assert.ok(!/<footer>\s*<button[^>]*id=["']dlgOk["']/i.test(html), 'modal footer must be removed');
});

test('static HTML contains no full-width brackets 「（」 「）」', async () => {
  const html = await readHtml();
  // The tooltip on #jsonLink is seeded in Japanese (「（JSON形式）」) and is
  // replaced by JS on load; strip tooltip attribute values before checking.
  const stripped = html.replace(/\sdata-tooltip="[^"]*"/g, '');
  assert.ok(!/[（）]/.test(stripped), 'static HTML must not use full-width brackets outside i18n-managed attributes');
});

test('country select has no static placeholder option (JS populates it)', async () => {
  const html = await readHtml();
  const m = html.match(/<select[^>]*id=["']country["'][^>]*>([\s\S]*?)<\/select>/i);
  assert.ok(m, 'country select not found');
  assert.ok(!/<option/i.test(m[1]), 'country <select> must be empty; JS populates options');
});
