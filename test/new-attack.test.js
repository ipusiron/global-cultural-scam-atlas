/* Tests for tools/new-attack.mjs. All I/O goes to a tmp dir so the real
 * data/attacks tree stays untouched (no scaffold files leak into the repo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  pad3, nextSequence, scaffoldAttack, writeScaffold
} from '../tools/new-attack.mjs';

async function mkTmp(){
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'gcsa-new-attack-'));
  return base;
}

test('pad3 and nextSequence', () => {
  assert.equal(pad3(1), '001');
  assert.equal(pad3(33), '033');
  assert.equal(pad3(999), '999');
  assert.equal(nextSequence([]), 1);
  assert.equal(nextSequence([1, 2, 4]), 3);
  assert.equal(nextSequence([1, 2, 3]), 4);
  // Garbage ignored.
  assert.equal(nextSequence(['abc', null, 2]), 1);
});

test('scaffoldAttack returns a schema-shaped object with the right id', () => {
  const obj = scaffoldAttack('JP', 33);
  assert.equal(obj.id, 'jp-033');
  for(const k of ['title','short_desc','cultural_lever','scenario',
                  'red_flags','mitigations','attack_vector','targets',
                  'risk_score','tags']){
    assert.ok(k in obj, `missing required key ${k}`);
  }
  assert.ok(Array.isArray(obj.attack_vector) && obj.attack_vector.length >= 1);
  assert.ok(Array.isArray(obj.targets) && obj.targets.length >= 1);
  assert.ok(Number.isInteger(obj.risk_score) && obj.risk_score >= 1 && obj.risk_score <= 5);
  // Both languages present for localised strings.
  for(const k of ['title','short_desc','cultural_lever','scenario']){
    assert.ok('ja' in obj[k], `${k}.ja missing`);
    assert.ok('en' in obj[k], `${k}.en missing`);
  }
});

test('writeScaffold creates a new file and never overwrites', async () => {
  const root = await mkTmp();
  try {
    const first = await writeScaffold({ root, cc: 'JP' });
    assert.equal(first.id, 'jp-001');
    const second = await writeScaffold({ root, cc: 'JP' });
    assert.equal(second.id, 'jp-002');
    // Explicit sequence that collides with an existing file must throw.
    await assert.rejects(
      () => writeScaffold({ root, cc: 'JP', seq: 1 }),
      /refusing to overwrite/
    );
    // Different country starts fresh.
    const us = await writeScaffold({ root, cc: 'US' });
    assert.equal(us.id, 'us-001');
    // Content on disk round-trips to JSON with id matching the file name.
    const text = await fs.readFile(first.file, 'utf-8');
    const parsed = JSON.parse(text);
    assert.equal(parsed.id, 'jp-001');
    assert.equal(path.basename(first.file), 'jp-001.json');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('writeScaffold rejects malformed cc or seq', async () => {
  const root = await mkTmp();
  try {
    await assert.rejects(() => writeScaffold({ root, cc: 'jp' }), /two uppercase/);
    await assert.rejects(() => writeScaffold({ root, cc: 'JAP' }), /two uppercase/);
    await assert.rejects(() => writeScaffold({ root, cc: 'JP', seq: 0 }), /\[1,999\]/);
    await assert.rejects(() => writeScaffold({ root, cc: 'JP', seq: 1000 }), /\[1,999\]/);
    await assert.rejects(() => writeScaffold({ root, cc: 'JP', seq: 'abc' }), /\[1,999\]/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
