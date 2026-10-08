/* Tests WCAG 2.x relative-luminance contrast for key foreground/background
 * color pairs defined in docs/style.css, in both light and dark themes.
 * Any pair below 4.5:1 is a failure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';

const CSS_PATH = 'docs/style.css';
const PAIRS = [['--fg','--bg'], ['--fg','--card'], ['--muted','--bg'], ['--muted','--card'],
               ['--accent','--bg'], ['--accent','--card']];
const THRESHOLD = 4.5;

function hexToRgb(hex){
  const s = hex.replace('#', '').trim();
  const n = parseInt(s, 16);
  if(s.length === 6) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  if(s.length === 3){
    const r = (n >> 8) & 15, g = (n >> 4) & 15, b = n & 15;
    return [r * 17, g * 17, b * 17];
  }
  throw new Error(`unexpected hex color: ${hex}`);
}

function channelLum(c){
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relLuminance([r, g, b]){
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
}

function ratio(hex1, hex2){
  const l1 = relLuminance(hexToRgb(hex1));
  const l2 = relLuminance(hexToRgb(hex2));
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function extractBlock(css, selector){
  const i = css.indexOf(selector);
  if(i < 0) throw new Error(`block ${selector} not found`);
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function extractVars(block){
  const vars = {};
  for(const line of block.split(/[;\n]/)){
    const m = line.match(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/);
    if(m) vars[m[1]] = m[2];
  }
  return vars;
}

const css = await fs.readFile(CSS_PATH, 'utf-8');
const dark = extractVars(extractBlock(css, '[data-theme="dark"]'));
const light = extractVars(extractBlock(css, '[data-theme="light"]'));

for(const theme of [['dark', dark], ['light', light]]){
  const [name, vars] = theme;
  test(`${name} theme contrast >= ${THRESHOLD}:1 for all key pairs`, () => {
    const failures = [];
    for(const [fg, bg] of PAIRS){
      const r = ratio(vars[fg], vars[bg]);
      if(r < THRESHOLD){
        failures.push(`${fg}(${vars[fg]}) on ${bg}(${vars[bg]}): ${r.toFixed(2)}:1`);
      }
    }
    assert.equal(failures.length, 0, `insufficient contrast:\n  ${failures.join('\n  ')}`);
  });
}
