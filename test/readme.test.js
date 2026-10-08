/* Tests for README.md and README.en.md:
 *  - YAML metadata structure (inside an HTML comment at the top)
 *  - Section parity (same number and order of H2 headings)
 *  - All referenced images exist, and no stray images under assets/
 *  - Directory structure block mentions every tracked file (or its directory)
 *  - Banned words do not appear in README.md body text
 *  - README.md does not claim ineffective server-side security as implemented
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

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

test('README.md starts with the English-link line (above the HTML comment)', () => {
  const firstNonEmpty = JA.split(/\r?\n/).find(l => l.trim().length > 0);
  assert.equal(firstNonEmpty, '[English](README.en.md) · 日本語');
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

// --- helpers ---------------------------------------------------------------

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
