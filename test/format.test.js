// Tests for file-level format hygiene:
//  - max line length per file type
//  - minimum file sizes (ensures code is not accidentally one-lined)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { glob } from 'glob';

async function longestLine(file){
  const text = await fs.readFile(file, 'utf-8');
  let max = 0;
  for(const line of text.split(/\r?\n/)){
    if(line.length > max) max = line.length;
  }
  return max;
}

async function lineCount(file){
  const text = await fs.readFile(file, 'utf-8');
  return text.split(/\r?\n/).length;
}

test('docs/js/*.js max line length <= 160', async () => {
  const files = await glob('docs/js/*.js');
  assert.ok(files.length >= 3, `expected at least 3 JS files in docs/js, got ${files.length}`);
  for(const f of files){
    const m = await longestLine(f);
    assert.ok(m <= 160, `${f}: longest line ${m} > 160`);
  }
});

test('docs/style.css max line length <= 160', async () => {
  const m = await longestLine('docs/style.css');
  assert.ok(m <= 160, `docs/style.css: longest line ${m} > 160`);
});

test('test/*.js max line length <= 160', async () => {
  const files = await glob('test/*.js');
  for(const f of files){
    const m = await longestLine(f);
    assert.ok(m <= 160, `${f}: longest line ${m} > 160`);
  }
});

test('docs/index.html max line length <= 250', async () => {
  const m = await longestLine('docs/index.html');
  assert.ok(m <= 250, `docs/index.html: longest line ${m} > 250`);
});

test('key files meet minimum line counts', async () => {
  const main = await lineCount('docs/js/main.js');
  const css = await lineCount('docs/style.css');
  const core = await lineCount('docs/js/gcsa-core.js');
  assert.ok(main >= 150, `docs/js/main.js: ${main} lines < 150`);
  assert.ok(css >= 150, `docs/style.css: ${css} lines < 150`);
  assert.ok(core >= 60, `docs/js/gcsa-core.js: ${core} lines < 60`);
});
