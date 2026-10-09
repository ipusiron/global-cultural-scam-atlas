// Tests for data/attacks (one JSON per attack):
//  - id matches the file name and ^[a-z]{2}-\d{3}$
//  - per-country counts (JP=32, US=20, IN=1, GB=7, total=60)
//  - risk_score is an integer in [1,5]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('data/attacks');
const EXPECTED_COUNTS = { JP: 32, US: 20, IN: 1, GB: 7 };
const ID_PATTERN = /^[a-z]{2}-\d{3}$/;

const VECTOR_VOCAB = new Set([
  'in-person','phone','email','sms','social','website',
  'payment-app','postal','door-to-door','marketplace','mixed'
]);
const TARGET_VOCAB = new Set(['tourist','general','elderly','business','student','expat']);
const MEDIUM_VOCAB = new Set(['cash','credit','bank-transfer','cryptocurrency','gift-cards','e-wallet','qr-pay']);
const VERIFICATION_STATUS = new Set(['verified','partial','unverified']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function listCountryDirs(){
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name).sort();
}

async function listAttackFiles(cc){
  const dir = path.join(ROOT, cc);
  const files = await fs.readdir(dir);
  return files.filter(f => f.endsWith('.json')).sort().map(f => path.join(dir, f));
}

test('country directories match the configured COUNTRY_META', async () => {
  const dirs = await listCountryDirs();
  assert.deepEqual(dirs, Object.keys(EXPECTED_COUNTS).sort());
});

test('per-country attack counts match the README table', async () => {
  const dirs = await listCountryDirs();
  let total = 0;
  for(const cc of dirs){
    const files = await listAttackFiles(cc);
    assert.equal(files.length, EXPECTED_COUNTS[cc],
      `${cc}: expected ${EXPECTED_COUNTS[cc]}, got ${files.length}`);
    total += files.length;
  }
  assert.equal(total, Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0));
  assert.equal(total, 60);
});

test('every attack id matches the file name and the ^[a-z]{2}-\\d{3}$ pattern', async () => {
  const dirs = await listCountryDirs();
  for(const cc of dirs){
    for(const file of await listAttackFiles(cc)){
      const content = JSON.parse(await fs.readFile(file, 'utf-8'));
      const base = path.basename(file, '.json');
      assert.equal(content.id, base, `${file}: id "${content.id}" != file name`);
      assert.match(content.id, ID_PATTERN, `${file}: id "${content.id}" fails pattern`);
      assert.equal(content.id.slice(0, 2), cc.toLowerCase(),
        `${file}: id prefix does not match country directory ${cc}`);
    }
  }
});

test('risk_score is an integer in [1,5]', async () => {
  const dirs = await listCountryDirs();
  for(const cc of dirs){
    for(const file of await listAttackFiles(cc)){
      const c = JSON.parse(await fs.readFile(file, 'utf-8'));
      assert.ok(Number.isInteger(c.risk_score), `${file}: risk_score not integer`);
      assert.ok(c.risk_score >= 1 && c.risk_score <= 5,
        `${file}: risk_score ${c.risk_score} out of [1,5]`);
    }
  }
});

test('data/schema.json pins the id pattern to ^[a-z]{2}-\\d{3}$', async () => {
  const schema = JSON.parse(await fs.readFile('data/schema.json', 'utf-8'));
  const idSchema = schema.properties.countries.items.properties.attacks.items.properties.id;
  assert.equal(idSchema.pattern, '^[a-z]{2}-\\d{3}$',
    'schema.json: attack.id must specify pattern ^[a-z]{2}-\\d{3}$');
});

test('attack_vector / targets / mediums use only controlled vocabulary', async () => {
  const dirs = await listCountryDirs();
  for(const cc of dirs){
    for(const file of await listAttackFiles(cc)){
      const c = JSON.parse(await fs.readFile(file, 'utf-8'));
      for(const v of (c.attack_vector || [])){
        assert.ok(VECTOR_VOCAB.has(v), `${file}: vector "${v}" is out of vocab`);
      }
      for(const t of (c.targets || [])){
        assert.ok(TARGET_VOCAB.has(t), `${file}: target "${t}" is out of vocab`);
      }
      for(const m of (c.mediums || [])){
        assert.ok(MEDIUM_VOCAB.has(m), `${file}: medium "${m}" is out of vocab`);
      }
    }
  }
});

test('verification (when present) has status in enum and checked in YYYY-MM-DD', async () => {
  const dirs = await listCountryDirs();
  for(const cc of dirs){
    for(const file of await listAttackFiles(cc)){
      const c = JSON.parse(await fs.readFile(file, 'utf-8'));
      if(!c.verification) continue;
      assert.ok(VERIFICATION_STATUS.has(c.verification.status),
        `${file}: verification.status "${c.verification.status}" out of enum`);
      if(c.verification.checked != null){
        assert.match(c.verification.checked, DATE_PATTERN,
          `${file}: verification.checked "${c.verification.checked}" not YYYY-MM-DD`);
      }
    }
  }
});

test('every references entry has an http(s) URL', async () => {
  const dirs = await listCountryDirs();
  for(const cc of dirs){
    for(const file of await listAttackFiles(cc)){
      const c = JSON.parse(await fs.readFile(file, 'utf-8'));
      for(const r of (c.references || [])){
        assert.ok(typeof r.url === 'string' && /^https?:\/\//.test(r.url),
          `${file}: reference url "${r.url}" is not http(s)`);
        if(r.accessed != null){
          assert.match(r.accessed, DATE_PATTERN,
            `${file}: reference accessed "${r.accessed}" not YYYY-MM-DD`);
        }
      }
    }
  }
});
