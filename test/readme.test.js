/* Tests for README.md and README.en.md:
 *  - YAML metadata structure (inside an HTML comment at the top)
 *  - Section parity (same number and order of H2 headings)
 *  - All referenced images exist, and no stray images under assets/
 *  - Directory structure block mentions every tracked file (or its directory)
 *  - Banned words do not appear in README.md body text
 *  - README.md does not claim ineffective server-side security as implemented
 *  - "このツールならではの使い方" / "Ways of using this tool in particular" opens the
 *    Use Cases section of each README, and its numbers match a recomputation with
 *    docs/js/gcsa-core.js over data/attacks (the UI labels it quotes come from
 *    docs/js/gcsa-messages.js)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { aggregate, entriesToCsvRows, filterAttacks, matchQuery, sortAttacks } from '../docs/js/gcsa-core.js';
import { t } from '../docs/js/gcsa-messages.js';

const JA = await fs.readFile('README.md', 'utf-8');
const EN = await fs.readFile('README.en.md', 'utf-8');

function h2sIn(md){
  const out = [];
  for(const line of md.split(/\r?\n/)){
    const m = line.match(/^##\s+(.+?)\s*$/);
    if(m) out.push(m[1]);
  }
  return out;
}

test('README.md YAML metadata is enclosed in an HTML comment with required keys', () => {
  const commentMatch = JA.match(/<!--\s*([\s\S]*?)\s*-->/);
  assert.ok(commentMatch, 'top HTML comment not found');
  const inside = commentMatch[1];
  assert.ok(/^---\s*$/m.test(inside) && /^---\s*$/m.test(inside.split('\n').slice(-2).join('\n')),
    'YAML front-matter delimiters missing inside the comment');
  assert.match(inside, /^id:\s*day082\s*$/m);
  assert.match(inside, /^slug:\s*global-cultural-scam-atlas\s*$/m);
  assert.match(inside, /^repo_url:\s*"https:\/\/github\.com\/ipusiron\/global-cultural-scam-atlas"\s*$/m);
  assert.match(inside, /^demo_url:\s*"https:\/\/ipusiron\.github\.io\/global-cultural-scam-atlas\/"\s*$/m);
  // category_ja / category_en / tags use the block list form (next line starts with "  - ")
  for(const key of ['category_ja', 'category_en', 'tags']){
    const re = new RegExp(`^${key}:\\n(\\s{2}-\\s.+\\n)+`, 'm');
    assert.match(inside, re, `${key} must use block list form`);
  }
});

test('README.md keeps the YAML comment first and puts the English-link line right after it', () => {
  const lines = JA.split(/\r?\n/);
  const firstNonEmpty = lines.find(l => l.trim().length > 0);
  assert.equal(firstNonEmpty, '<!--', 'the YAML HTML comment must be the first line (hackinglab.online reads it)');
  const end = lines.indexOf('-->');
  assert.ok(end > 0, 'comment end not found');
  const next = lines.slice(end + 1).find(l => l.trim().length > 0);
  assert.equal(next, '[English](README.en.md) · 日本語');
  const h1 = lines.findIndex(l => l.startsWith('# '));
  assert.ok(h1 > end, 'H1 must come after the link line');
});

test('README.en.md starts with the Japanese-link line (no YAML)', () => {
  const first = EN.split(/\r?\n/).find(l => l.trim().length > 0);
  assert.equal(first, 'English · [日本語](README.md)');
  assert.ok(!/^<!--/.test(EN.trimStart()), 'README.en.md must not carry YAML metadata');
});

test('H2 headings in README.md match the Day082 standard order', () => {
  const expected = [
    '🌐 デモページ', '📸 スクリーンショット', '✨ 特徴', '📖 使い方', '📐 画面構成',
    '🎯 ユースケース', '📊 データ構造', '💻 データの利用方法', '⚙️ データ生成とCI/CD',
    '🧪 テスト', '🔒 セキュリティ', '⚠️ 注意・免責',
    '📁 ディレクトリー構造', '💻 動作環境', '📄 ライセンス', '🛠️ このツールについて'
  ];
  assert.deepEqual(h2sIn(JA), expected);
});

test('H2 headings in README.en.md are the English counterparts in the same order', () => {
  const expected = [
    '🌐 Demo', '📸 Screenshots', '✨ Features', '📖 Usage', '📐 Screen Layout',
    '🎯 Use Cases', '📊 Data Structure', '💻 Using the Data', '⚙️ Data Build and CI/CD',
    '🧪 Tests', '🔒 Security', '⚠️ Notes and Disclaimer',
    '📁 Directory Structure', '💻 Requirements', '📄 License', '🛠️ About this tool'
  ];
  assert.deepEqual(h2sIn(EN), expected);
});

test('H2 counts match between README.md and README.en.md', () => {
  assert.equal(h2sIn(JA).length, h2sIn(EN).length);
});

test('README verification counts match the actual data', async () => {
  const counts = { verified: 0, partial: 0, unverified: 0 };
  const countries = await fs.readdir('data/attacks');
  for(const cc of countries){
    const dir = path.posix.join('data/attacks', cc);
    for(const name of await fs.readdir(dir)){
      if(!name.endsWith('.json')) continue;
      const j = JSON.parse(await fs.readFile(path.posix.join(dir, name), 'utf-8'));
      const s = j.verification?.status;
      if(s && counts[s] !== undefined) counts[s]++;
    }
  }
  // Both READMEs must mention the three counts (verified/partial/unverified) that match the data.
  const readmes = [['README.md', JA], ['README.en.md', EN]];
  for(const [name, md] of readmes){
    for(const k of ['verified', 'partial', 'unverified']){
      const re = new RegExp(`\\b${k}[^|\\n]*\\|\\s*${counts[k]}\\s*\\|`, 'i');
      assert.match(md, re, `${name}: expected ${k}=${counts[k]} in verification table`);
    }
  }
});

test('all image references resolve to existing files', async () => {
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  for(const [name, md] of [['README.md', JA], ['README.en.md', EN]]){
    let m;
    while((m = re.exec(md))){
      const p = m[1];
      if(/^https?:/i.test(p)) continue;
      await fs.access(p);
    }
    re.lastIndex = 0;
  }
});

test('assets/ PNGs that exist are referenced from README files', async () => {
  const files = [];
  async function walk(d){
    for(const e of await fs.readdir(d, { withFileTypes: true })){
      const p = path.join(d, e.name).replace(/\\/g, '/');
      if(e.isDirectory()) await walk(p);
      else if(/\.png$/i.test(e.name)) files.push(p);
    }
  }
  await walk('assets');
  const seen = new Set();
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  for(const md of [JA, EN]){
    let m;
    while((m = re.exec(md))){
      if(!/^https?:/i.test(m[1])) seen.add(m[1].replace(/^\.\//, ''));
    }
    re.lastIndex = 0;
  }
  const orphans = files.filter(f => !seen.has(f));
  assert.equal(orphans.length, 0, `assets/ PNG not referenced from README: ${orphans.join(', ')}`);
});

test('directory structure block covers every tracked file', () => {
  const tracked = execSync('git ls-files').toString().split(/\r?\n/).filter(Boolean);
  const dirBlock = extractCodeBlock(JA, '## 📁 ディレクトリー構造');
  assert.ok(dirBlock.length > 0, 'directory block missing in README.md');
  const missing = [];
  for(const f of tracked){
    if(fileCoveredByBlock(dirBlock, f)) continue;
    missing.push(f);
  }
  // Attack JSONs are summarised by their enclosing directory + a per-country count line.
  const unexpected = missing.filter(f => !/^data\/attacks\/[A-Z]{2}\/[a-z]{2}-\d{3}\.json$/.test(f)
    || !/jp-001|us-001|in-001/.test(f) ? !isSummarisedAttack(dirBlock, f) : false);
  assert.equal(unexpected.length, 0, `tracked files missing from directory block:\n  ${unexpected.join('\n  ')}`);
});

test('directory structure lines use "# " for comments (half-width space after #)', () => {
  const dirBlock = extractCodeBlock(JA, '## 📁 ディレクトリー構造');
  for(const line of dirBlock.split(/\r?\n/)){
    if(/#\S/.test(line.replace(/#!/g, ''))){
      // Allow the opening fence line and bare path lines (no #).
      if(/^```/.test(line)) continue;
      assert.fail(`comment must have a space after '#': ${line}`);
    }
  }
});

test('banned words do not appear in README.md body text (outside code blocks)', () => {
  const banned = ['全て', '分かる', '既に', '無い', 'インターフェース'];
  const stripped = stripCodeAndUrls(JA);
  for(const w of banned){
    assert.ok(!stripped.includes(w), `banned word "${w}" present in README.md body text`);
  }
  // ディレクトリ must be followed by ー (so "ディレクトリ構造" without ー is banned).
  const bareDir = stripped.match(/ディレクトリ[^ー]/g);
  assert.ok(!bareDir, `"ディレクトリ" must be followed by "ー": ${bareDir?.join(', ')}`);
});

test('README.md does not claim ineffective server-side security as implemented', () => {
  const stripped = stripCodeAndUrls(JA);
  // These must not be presented as "implemented" controls in GCSA's static site.
  // The Security section mentions them explicitly as *limits* (and prefixes them
  // with "meta" or clarifies they are header-only); banning the bare tokens
  // "X-Frame-Options" and ".htaccess" would conflict with that. So check that
  // they do not appear under an implemented-controls bullet.
  const sec = extractSection(JA, '## 🔒 セキュリティ');
  const impl = sec.split('制約')[0];
  assert.ok(!/X-Frame-Options\s*(?:ヘッダー|を実装|を設定)/.test(impl),
    'X-Frame-Options must not be listed under implemented controls');
  assert.ok(!/\.htaccess\s*(?:による|を実装)/.test(impl),
    '.htaccess must not be listed under implemented controls');
});

// --- このツールならではの使い方 / Ways of using this tool in particular ----

const UNIQUE_JA = '### このツールならではの使い方';
const UNIQUE_EN = '### Ways of using this tool in particular';

test('Use Cases opens with the tool-specific block in both READMEs (3 items each)', () => {
  const cases = [
    [JA, '## 🎯 ユースケース', UNIQUE_JA, '### 教育'],
    [EN, '## 🎯 Use Cases', UNIQUE_EN, '### Education']
  ];
  for(const [md, h2, h3, next] of cases){
    const sec = extractSection(md, h2);
    assert.equal(sec.trim().split(/\r?\n/)[0], h3, `${h3} must come first under ${h2}`);
    assert.ok(sec.indexOf(h3) < sec.indexOf(next), `${h3} must precede ${next}`);
    const items = uniqueBlock(md, h3).split(/\r?\n/).filter(l => l.startsWith('- '));
    assert.equal(items.length, 3, `${h3}: expected 3 items, got ${items.length}`);
  }
});

test('use case 1 (multiple-answer tallies) matches aggregate() in both READMEs', async () => {
  const stats = aggregate(await loadDataset());
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  const total = stats.total;
  const vec = sum(stats.byVector);
  const tgt = sum(stats.byTarget);
  const phone = stats.byVector.phone;
  const avg = (vec / total).toFixed(2);
  const perEntry = (phone / total * 100).toFixed(1);
  const perMention = (phone / vec * 100).toFixed(1);
  // The two percentages for phone differ by vec / total: 「2倍以上」 / "more than twice".
  const times = [2, 'twice'];
  assert.ok(vec > total && tgt > total, 'multi-valued totals must exceed the number of entries');
  assert.ok(vec / total > times[0], `the two percentages for phone must be more than ${times[1]} apart`);
  const ja = uniqueBlock(JA, UNIQUE_JA);
  const jaFacts = [
    `足すと${vec}で、事例の${total}件を超える`,
    `平均${avg}個`,
    `電話の${phone}件は、事例の${total}件を分母にすると${perEntry}%`,
    `延べ${vec}件を分母にすると${perMention}%`,
    `同じ${phone}件の割合が${times[0]}倍以上違う`,
    `合計も${tgt}で、${total}件を超える`
  ];
  for(const s of jaFacts) assert.ok(ja.includes(s), `README.md: "${s}" not found`);
  const en = uniqueBlock(EN, UNIQUE_EN);
  const enFacts = [
    `bars gives ${vec}, more than the ${total} entries`,
    `${avg} vectors per entry`,
    `The ${phone} phone entries are ${perEntry}% when divided by the ${total} entries`,
    `${perMention}% when divided by the ${vec} total mentions`,
    `the same ${phone} entries give percentages more than ${times[1]} apart`,
    `add up to ${tgt}, more than the ${total} entries`
  ];
  for(const s of enFacts) assert.ok(en.includes(s), `README.en.md: "${s}" not found`);
});

test('use case 2 (tie-break in the risk sort) matches sortAttacks() in both READMEs', async () => {
  const data = await loadDataset();
  const sorted = sortAttacks(filterAttacks(data, {}), 'risk');
  const cut = 10; // 「上位10件」 / "top 10"
  const r5 = sorted.filter(e => e.atk.risk_score === 5);
  const r5Ids = r5.map(e => e.atk.id);
  assert.deepEqual(sorted.slice(0, r5.length), r5, 'risk 5 entries come first');
  assert.deepEqual(r5Ids, r5Ids.slice().sort(), 'entries with the same risk are in ID order');
  assert.ok(r5.length > cut, `the top-${cut} cut must fall inside the risk 5 tie`);
  // 「auから始まりusで終わる」: the country prefix of the first and the last ID in ID order.
  const byId = sortAttacks(filterAttacks(data, {}), 'id').map(e => e.atk.id);
  const head = byId[0].slice(0, 2);
  const tail = byId.at(-1).slice(0, 2);
  const first = sorted[0];
  assert.equal(first.country.country_code, 'AU');
  const isUS = e => e.country.country_code === 'US';
  const top = sorted.slice(0, cut);
  assert.equal(top.filter(isUS).length, 0, `no US entry in the top ${cut}`);
  const usR5 = r5.filter(isUS).length;
  assert.ok(usR5 > 0);
  const firstUS = sorted.findIndex(isUS) + 1;
  // Another tie-break, done on the CSV in a spreadsheet: risk descending, then id descending.
  const rows = entriesToCsvRows(sorted, 'ja');
  const alt = rows.slice().sort((a, b) => (Number(b.risk) - Number(a.risk)) || b.id.localeCompare(a.id)).slice(0, cut);
  const topIds = top.map(e => e.atk.id);
  assert.equal(alt.filter(r => topIds.includes(r.id)).length, 0, `none of the top ${cut} on screen stays`);
  const altTally = tally(alt.map(r => r.country));
  const topTally = tally(top.map(e => e.country.country_code));
  const jaCount = pairs => pairs.map(([c, n]) => `${c} ${n}件`).join('・');
  const enCount = pairs => `${andList(pairs.map(([c, n]) => `${n} ${c}`))} entries`;
  const ja = uniqueBlock(JA, UNIQUE_JA);
  const jaFacts = [
    `「${t('ja', 'sort.risk')}」は、リスクが同じ事例をIDの順（${head}から始まり${tail}で終わる）に並べる`,
    `リスク5の事例は${r5.length}件`,
    `同点の${r5.length}件のうちIDが最初の${first.atk.id}（オーストラリア）が先頭に来る`,
    `上位${cut}件で切ると、リスク5の事例を${usR5}件持つUS（アメリカ）は1件も入らない（USがはじめて出るのは${firstUS}件目）`,
    `「${t('ja', 'export.csv')}」で取り出したCSVで試す`,
    `上位${cut}件は${jaCount(altTally)}になり、画面の上位${cut}件（${jaCount(topTally)}）は1件も残らない`,
    `「上位${cut}件」を切り出す記事`
  ];
  for(const s of jaFacts) assert.ok(ja.includes(s), `README.md: "${s}" not found`);
  const en = uniqueBlock(EN, UNIQUE_EN);
  const enFacts = [
    `"${t('en', 'sort.risk')}" puts entries with the same risk in ID order (starting with ${head} and ending with ${tail})`,
    `(league tables, "top ${cut}" articles)`,
    `There are ${r5.length} entries with risk 5`,
    `${first.atk.id} (Australia) comes first`,
    `the first of the ${r5.length} tied entries`,
    `Cutting the list at the top ${cut} leaves out the US entirely, although the US has ${usR5} entries with risk 5`,
    `(the first US entry is at position ${firstUS})`,
    `the CSV from "${t('en', 'export.csv')}"`,
    `the top ${cut} becomes ${enCount(altTally)}, and none of the top ${cut} on screen (${enCount(topTally)}) remains`,
    `write "top ${cut}" articles`
  ];
  for(const s of enFacts) assert.ok(en.includes(s), `README.en.md: "${s}" not found`);
});

test('use case 3 (words only one language has) matches filterAttacks() in both READMEs', async () => {
  const data = await loadDataset();
  // Mitigations quoted in the READMEs, with the English counterpart at the same index.
  const quotes = {
    'au-007': ['家族・銀行員など第三者に相談', 'Consult a trusted third party'],
    'jp-008': ['決済前に家族/知人へ相談', 'Consult before payment'],
    'jp-010': ['危険なら110番通報', 'Call police if threatened']
  };
  const all = data.countries.flatMap(c => c.attacks);
  for(const [id, [jaText, enText]] of Object.entries(quotes)){
    const atk = all.find(a => a.id === id);
    const i = atk.mitigations.ja.indexOf(jaText);
    assert.ok(i >= 0, `${id}: "${jaText}" not in mitigations.ja`);
    assert.equal(atk.mitigations.en[i], enText, `${id}: English counterpart differs`);
  }
  const run = locale => {
    const ids = q => filterAttacks(data, { q, locale }).map(e => e.atk.id);
    return { kazoku: ids('家族'), family: ids('family'), keisatsu: ids('警察'), police: ids('police') };
  };
  const r = run('ja');
  assert.deepEqual(run('en'), r, 'both languages are searched, so the display language does not matter');
  const only = (a, b) => a.filter(x => !b.includes(x));
  const famDiff = only(r.kazoku, r.family);
  const polDiff = only(r.police, r.keisatsu);
  assert.deepEqual(only(r.family, r.kazoku), []);
  assert.deepEqual(only(r.keisatsu, r.police), []);
  assert.deepEqual([...famDiff, ...polDiff], Object.keys(quotes));
  // The limit stated in both READMEs: a query must be contained as is, so a plural is missed.
  assert.equal(matchQuery('families', 'family'), false);
  // The counts compare entries, so a word that only one language has in one field is hidden when the
  // other word sits in another field of the same entry. The field names after 「一致」/"matched" on the
  // cards show it field by field; tags and id are left out as they are not written in both languages.
  const noPair = ['tags', 'id'];
  const fieldsHit = (q, locale) => filterAttacks(data, { q, locale }).flatMap(e =>
    e.matchedFields.filter(f => !noPair.includes(f)).map(f => `${e.atk.id}:${f}`));
  const kazokuF = fieldsHit('家族', 'ja');
  const familyF = fieldsHit('family', 'ja');
  assert.deepEqual([fieldsHit('家族', 'en'), fieldsHit('family', 'en')], [kazokuF, familyF]);
  const kazokuOnly = only(kazokuF, familyF);
  const familyOnly = only(familyF, kazokuF);
  // The example entry hits both searches, so the counts miss it, but its fields differ.
  const ex = 'jp-023';
  assert.ok(r.kazoku.includes(ex) && r.family.includes(ex), `${ex} must hit both searches`);
  const fieldsOf = keys => keys.filter(k => k.startsWith(`${ex}:`)).map(k => k.slice(ex.length + 1));
  const [exKazoku, exFamily] = [fieldsOf(kazokuF), fieldsOf(familyF)];
  assert.equal(exKazoku.length, 1);
  assert.equal(exFamily.length, 1);
  assert.ok(kazokuOnly.includes(`${ex}:${exKazoku[0]}`) && familyOnly.includes(`${ex}:${exFamily[0]}`));
  // The quoted pair sits at the same index in mitigations, and only the English side has the word.
  const [exJa, exEn] = ['事前の合言葉設定', 'Set family passwords'];
  const exAtk = all.find(a => a.id === ex);
  const exI = exAtk.mitigations.ja.indexOf(exJa);
  assert.ok(exI >= 0 && exAtk.mitigations.en[exI] === exEn, `${ex}: quoted mitigations differ`);
  assert.ok(!exJa.includes('家族') && exEn.includes('family'));
  const jaLabel = f => t('ja', `field.${f}`);
  const enLabel = f => t('en', `field.${f}`);
  const fieldsWord = n => n === 1 ? '1 field hits' : `${n} fields hit`;
  const ja = uniqueBlock(JA, UNIQUE_JA);
  const jaFacts = [
    `検索すると${r.kazoku.length}件と${r.family.length}件になる`,
    `差の${famDiff.length}件（${famDiff.join('・')}）`,
    `「警察」は${r.keisatsu.length}件、「police」は${r.police.length}件`,
    `差の${polDiff.length}件（${polDiff.join('・')}）`,
    '訳で省いた箇所や足した箇所、別の言い方にした箇所の候補',
    '件数は事例の単位で比べるので',
    `カードの「${t('ja', 'card.matched')}」に並ぶ欄名を見比べる`,
    `日英で対になっていない${noPair.map(jaLabel).join('と')}を除くと`,
    `「家族」にだけ当たる欄が${kazokuOnly.length}カ所、「family」にだけ当たる欄が${familyOnly.length}カ所ある`,
    `${ex}は両方の検索に当たるので件数の差に出ないが、欄名は「家族」では${jaLabel(exKazoku[0])}、「family」では${jaLabel(exFamily[0])}になる`,
    `「${exEn}」には、日本語の「${exJa}」にないfamilyの語がある`,
    '「family」は「families」に当たらない'
  ];
  const en = uniqueBlock(EN, UNIQUE_EN);
  const enFacts = [
    `\`family\` gives ${r.kazoku.length} and ${r.family.length} hits`,
    `In the ${famDiff.length} extra entries (${famDiff.join(', ')})`,
    `\`警察\` (police) gives ${r.keisatsu.length} hits and \`police\` gives ${r.police.length};`,
    `in the ${polDiff.length} extra entry (${polDiff.join(', ')})`,
    'a word was left out, added or put another way',
    'The counts compare entries',
    `compare the field names listed after "${t('en', 'card.matched')}" on the cards in the two searches`,
    'Not counting the tags and the ID, which are not written in both languages',
    `${fieldsWord(kazokuOnly.length)} only \`家族\` and ${fieldsWord(familyOnly.length)} only \`family\``,
    `${ex} hits both searches, so it does not show up in the difference of the counts`,
    `the field names on its card are ${enLabel(exKazoku[0])} for \`家族\` and ${enLabel(exFamily[0])} for \`family\``,
    `"${exEn}" has the word family, which the Japanese \`${exJa}\``,
    '`family` does not hit "families"'
  ];
  for(const [jaText, enText] of Object.values(quotes)){
    jaFacts.push(`「${jaText}」`, `「${enText}」`);
    enFacts.push(`\`${jaText}\``, `"${enText}"`);
  }
  for(const s of jaFacts) assert.ok(ja.includes(s), `README.md: "${s}" not found`);
  for(const s of enFacts) assert.ok(en.includes(s), `README.en.md: "${s}" not found`);
});

// --- helpers ---------------------------------------------------------------

async function loadDataset(){
  // Same shape as tools/build-countries.mjs, read straight from data/attacks so the
  // checks do not depend on a prior `npm run build` (CI runs npm test without it).
  const countries = [];
  for(const cc of (await fs.readdir('data/attacks')).sort()){
    const dir = path.posix.join('data/attacks', cc);
    const attacks = [];
    for(const name of (await fs.readdir(dir)).filter(n => n.endsWith('.json'))){
      attacks.push(JSON.parse(await fs.readFile(path.posix.join(dir, name), 'utf-8')));
    }
    attacks.sort((a, b) => a.id.localeCompare(b.id));
    countries.push({ country_code: cc, attacks });
  }
  return { countries };
}

function tally(codes){
  // [[code, count], ...]: most first, and ties in code order (the order the READMEs list them in).
  const counts = new Map();
  for(const c of codes) counts.set(c, (counts.get(c) || 0) + 1);
  return [...counts].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

function andList(items){
  // "a", "a and b", "a, b and c"
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

function uniqueBlock(md, h3){
  // From the given H3 up to the next H2/H3 heading.
  const i = md.indexOf(h3);
  if(i < 0) return '';
  const rest = md.slice(i + h3.length);
  const end = rest.search(/\n#{2,3}\s/);
  return end < 0 ? rest : rest.slice(0, end);
}

function extractCodeBlock(md, afterHeading){
  const i = md.indexOf(afterHeading);
  if(i < 0) return '';
  const rest = md.slice(i);
  const m = rest.match(/```[\s\S]*?```/);
  return m ? m[0] : '';
}

function extractSection(md, heading){
  const i = md.indexOf(heading);
  if(i < 0) return '';
  const after = md.slice(i + heading.length);
  const next = after.search(/\n##\s/);
  return next < 0 ? after : after.slice(0, next);
}

function fileCoveredByBlock(block, f){
  const base = path.posix.basename(f);
  const dir = path.posix.dirname(f);
  if(block.includes(f)) return true;
  if(block.includes(base)) return true;
  // allow coverage by any ancestor directory mentioned explicitly
  for(let d = dir; d && d !== '.'; d = path.posix.dirname(d)){
    if(block.includes(d + '/') || block.includes(d)) return true;
  }
  return false;
}

function isSummarisedAttack(block, f){
  const m = f.match(/^data\/attacks\/([A-Z]{2})\//);
  if(!m) return false;
  return block.includes(`data/attacks/${m[1]}/`) || block.includes(`${m[1]}/`);
}

function stripCodeAndUrls(md){
  // Remove fenced code blocks, inline code, URLs, and the YAML HTML comment.
  let s = md.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/```[\s\S]*?```/g, '');
  s = s.replace(/`[^`]*`/g, '');
  s = s.replace(/https?:\/\/\S+/g, '');
  return s;
}
