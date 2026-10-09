#!/usr/bin/env node
/* tools/check-refs.mjs
 * Walk every data/attacks/<CC>/*.json, collect references[].url, and send a
 * HEAD request per URL (falling back to GET on 405/501) with ~1s spacing per
 * host. Print a status table to stdout. Exit code 1 if any 4xx/5xx is seen.
 *
 * Not wired into CI: external endpoints are flaky and would make the CI
 * meaningless. Run manually via `npm run check:refs`.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';

const ROOT = 'data/attacks';

/**
 * Pure helper: given an attack-shaped JSON object, return its reference URLs.
 * Exported so test/check-refs.test.js can exercise it without going on the
 * network.
 */
export function extractUrls(obj){
  if(!obj || typeof obj !== 'object' || !Array.isArray(obj.references)) return [];
  const out = [];
  for(const r of obj.references){
    if(r && typeof r.url === 'string' && /^https?:\/\//i.test(r.url)) out.push(r.url);
  }
  return out;
}

/**
 * Pure helper: dedupe URLs preserving first-seen order.
 */
export function dedupeUrls(urls){
  const seen = new Set();
  const out = [];
  for(const u of urls || []){
    if(seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

async function listUrlsFromDisk(){
  const dirs = await fs.readdir(ROOT, { withFileTypes: true });
  const items = [];
  for(const d of dirs){
    if(!d.isDirectory()) continue;
    const files = (await fs.readdir(path.join(ROOT, d.name))).filter(f => f.endsWith('.json')).sort();
    for(const f of files){
      const obj = JSON.parse(await fs.readFile(path.join(ROOT, d.name, f), 'utf-8'));
      for(const u of extractUrls(obj)){
        items.push({ id: obj.id, url: u });
      }
    }
  }
  return items;
}

// Many government and consumer-protection sites reject bare HEAD or custom
// User-Agent strings via WAF rules. Match a common browser UA and fall back
// to GET on any HEAD rejection (403/404/405/501) so false positives from
// method/UA filtering do not drown out real breakage.
const UA = 'Mozilla/5.0 (compatible; GCSA-check-refs/1.0; +https://github.com/ipusiron/global-cultural-scam-atlas)';

function doRequest(method, url){
  return new Promise(resolve => {
    let parsed;
    try { parsed = new URL(url); } catch(e){ resolve({ ok: false, status: 'EINVALID', detail: String(e) }); return; }
    const opts = {
      method, hostname: parsed.hostname, port: parsed.port || undefined,
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ja,en;q=0.8' },
      timeout: 20000
    };
    const client = parsed.protocol === 'http:' ? httpRequest : request;
    const req = client(opts, res => {
      resolve({ ok: res.statusCode < 400 || res.statusCode === 405 || res.statusCode === 501,
                status: res.statusCode });
      res.resume();
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', err => resolve({ ok: false, status: 'ERROR', detail: String(err) }));
    req.end();
  });
}

async function headOrGet(url){
  const h = await doRequest('HEAD', url);
  if(h.ok || typeof h.status !== 'number') return h;
  // Fall back to GET for any HEAD-specific rejection (not only 405). Many
  // WAFs mark HEAD requests as suspicious and return 403/404 even when the
  // page is live and returns 200 for GET from the same client.
  if(h.status === 403 || h.status === 404 || h.status === 405 || h.status === 501){
    return doRequest('GET', url);
  }
  return h;
}

async function main(){
  const items = await listUrlsFromDisk();
  const urls = dedupeUrls(items.map(x => x.url));
  const seenHostLast = new Map();
  const results = [];
  for(const u of urls){
    try {
      const host = new URL(u).host;
      const last = seenHostLast.get(host) || 0;
      const delta = Date.now() - last;
      if(delta < 1100) await new Promise(r => setTimeout(r, 1100 - delta));
      seenHostLast.set(host, Date.now());
    } catch { /* ignore */ }
    const res = await headOrGet(u);
    results.push({ url: u, status: res.status, ok: res.ok });
    const mark = res.ok ? 'OK  ' : 'FAIL';
    console.log(`${mark} ${String(res.status).padEnd(6)} ${u}`);
  }
  const fails = results.filter(r => !r.ok);
  console.log('');
  console.log(`Checked ${results.length} unique URLs, ${results.length - fails.length} ok, ${fails.length} failing`);
  if(fails.length){
    console.log('\nFailing URLs:');
    for(const f of fails) console.log(`  [${f.status}] ${f.url}`);
    process.exit(1);
  }
}

const invokedDirectly = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
                        import.meta.url.endsWith(path.basename(process.argv[1] || ''));
if(invokedDirectly){
  main().catch(e => { console.error(e); process.exit(1); });
}
