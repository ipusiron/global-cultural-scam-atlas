/* Scaffold a new attack JSON under data/attacks/<ISO2>/<id>.json.
 *
 * Usage:
 *   node tools/new-attack.mjs JP
 *       → picks the next free zero-padded sequence (e.g. jp-033).
 *   node tools/new-attack.mjs JP 42
 *       → forces id "jp-042"; refuses to overwrite an existing file.
 *
 * The emitted scaffold contains every key that data/schema.json requires,
 * with placeholder values so the file passes `npm run validate:schema` only
 * after a human replaces the TODO strings with vetted content. This tool is
 * intentionally content-free; adding real cases is a human review step.
 *
 * Exported for tests: scaffoldAttack(cc, seq), nextSequence(ids), writeScaffold(opts).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ID_PATTERN = /^[a-z]{2}-\d{3}$/;

export function pad3(n){
  const s = String(Math.floor(n));
  return s.length >= 3 ? s : '0'.repeat(3 - s.length) + s;
}

/**
 * Given the existing numeric sequence numbers, return the next one.
 * Starts at 1 (jp-001) when the list is empty.
 */
export function nextSequence(existingSeqs){
  const used = new Set(existingSeqs.filter(n => Number.isInteger(n) && n > 0));
  for(let n = 1; n <= 999; n++){
    if(!used.has(n)) return n;
  }
  throw new Error('sequence exhausted (001..999 all taken)');
}

export function scaffoldAttack(cc, seq){
  const id = `${cc.toLowerCase()}-${pad3(seq)}`;
  return {
    id,
    title:          { ja: 'TODO: タイトル', en: 'TODO: title' },
    short_desc:     { ja: 'TODO: 説明',    en: 'TODO: short description' },
    cultural_lever: { ja: 'TODO: 文化的レバー', en: 'TODO: cultural lever' },
    attack_vector: ['in-person'],
    targets: ['general'],
    scenario: { ja: 'TODO: シナリオ', en: 'TODO: scenario' },
    red_flags:   { ja: ['TODO'], en: ['TODO'] },
    mitigations: { ja: ['TODO'], en: ['TODO'] },
    risk_score: 3,
    mediums: [],
    legal_notes: { ja: '', en: '' },
    references: [],
    tags: []
  };
}

async function listExistingSeqs(dir){
  let entries = [];
  try { entries = await fs.readdir(dir); }
  catch(e){ if(e.code === 'ENOENT') return []; throw e; }
  const out = [];
  for(const name of entries){
    const m = name.match(/^([a-z]{2})-(\d{3})\.json$/);
    if(!m) continue;
    out.push(parseInt(m[2], 10));
  }
  return out;
}

/**
 * Create `<root>/<CC>/<id>.json`. Returns `{file, id, seq}`. Throws if the
 * target path already exists (never overwrites) or the inputs are invalid.
 */
export async function writeScaffold({ root, cc, seq }){
  if(typeof cc !== 'string' || !/^[A-Z]{2}$/.test(cc)){
    throw new Error(`country code must be two uppercase letters, got "${cc}"`);
  }
  const dir = path.join(root, cc);
  await fs.mkdir(dir, { recursive: true });
  if(seq == null){
    seq = nextSequence(await listExistingSeqs(dir));
  } else {
    seq = parseInt(seq, 10);
    if(!Number.isInteger(seq) || seq < 1 || seq > 999){
      throw new Error(`sequence must be an integer in [1,999], got "${seq}"`);
    }
  }
  const obj = scaffoldAttack(cc, seq);
  if(!ID_PATTERN.test(obj.id)) throw new Error(`generated id "${obj.id}" failed pattern`);
  const file = path.join(dir, `${obj.id}.json`);
  try {
    // 'wx' flag → fail if the file exists.
    const handle = await fs.open(file, 'wx');
    try {
      await handle.writeFile(JSON.stringify(obj, null, 2) + '\n', 'utf-8');
    } finally { await handle.close(); }
  } catch(e){
    if(e.code === 'EEXIST'){
      throw new Error(`refusing to overwrite existing ${file}`);
    }
    throw e;
  }
  return { file, id: obj.id, seq };
}

async function main(){
  const argv = process.argv.slice(2);
  if(!argv.length){
    console.error('usage: node tools/new-attack.mjs <ISO2> [sequence]');
    process.exit(2);
  }
  const [cc, rawSeq] = argv;
  const root = process.env.GCSA_ATTACK_ROOT || 'data/attacks';
  try {
    const { file, id } = await writeScaffold({ root, cc: cc.toUpperCase(), seq: rawSeq });
    console.log(`✔ Wrote ${file} (id=${id})`);
    console.log('  Fill in the TODO fields before `npm run build` and `npm run validate:schema`.');
  } catch(e){
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
}

// Only run main when invoked directly (not when imported from tests).
if(import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
   || process.argv[1]?.endsWith('new-attack.mjs')){
  main();
}
