/* GCSA main.js - DOM wiring only.
 * All pure logic lives in gcsa-core.js; all UI text lives in gcsa-messages.js.
 * This module:
 *   - loads dist/countries.json
 *   - populates filter widgets and renders cards
 *   - syncs state with the URL hash and offers a share-link button
 *   - renders the Stats tab (country/vector/target/risk aggregates as SVG)
 *   - exports the current filter result as CSV
 *   - handles locale/theme switching and the detail modal
 */
import {
  filterAttacks, sortAttacks, pickLang, pickList, riskStars, clampRisk,
  sanitizeUrl, escapeHtml, escapeAttr, resolveLocale, resolveTheme,
  extractTargets, countryCounts, parseHash, buildHash,
  aggregate, toCsv, entriesToCsvRows, SORT_OPTIONS
} from './gcsa-core.js';
import { messages, t, labelFor } from './gcsa-messages.js';

/* ---------------- storage helpers (localStorage may throw) --------------- */
function safeGet(key){
  try { return localStorage.getItem(key); } catch(_) { return null; }
}
function safeSet(key, value){
  try { localStorage.setItem(key, value); } catch(_) { /* ignore */ }
}

/* ---------------- initial state ----------------------------------------- */
const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
  ? Array.from(navigator.languages)
  : (navigator.language ? [navigator.language] : []);

const hashState = parseHash(window.location.hash);

const state = {
  data: null,
  locale: hashState.lang || resolveLocale({
    query: window.location.search,
    stored: safeGet('gcsa_locale'),
    languages: browserLanguages
  }),
  theme: resolveTheme({
    stored: safeGet('gcsa_theme'),
    prefersLight: window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
  }),
  country: hashState.country || '__all__',
  vector: hashState.vector || '__all__',
  target: hashState.target || '__all__',
  q: hashState.q || '',
  sort: hashState.sort || 'default',
  view: 'list',               // 'list' | 'stats'
  lastOpener: null            // button that opened the modal (for focus return)
};

const els = {
  localeToggle: document.getElementById('localeToggle'),
  themeToggle: document.getElementById('themeToggle'),
  jsonLink: document.getElementById('jsonLink'),
  tabList: document.getElementById('tabList'),
  tabStats: document.getElementById('tabStats'),
  country: document.getElementById('country'),
  vector: document.getElementById('vector'),
  target: document.getElementById('target'),
  q: document.getElementById('q'),
  sort: document.getElementById('sort'),
  searchClear: document.getElementById('searchClear'),
  resetFilters: document.getElementById('resetFilters'),
  shareLink: document.getElementById('shareLink'),
  csvExport: document.getElementById('csvExport'),
  cards: document.getElementById('cards'),
  statsView: document.getElementById('statsView'),
  resultCount: document.getElementById('resultCount'),
  dlg: document.getElementById('detailDialog'),
  dlgTitle: document.getElementById('dlgTitle'),
  dlgId: document.getElementById('dlgId'),
  dlgCountry: document.getElementById('dlgCountry'),
  dlgVector: document.getElementById('dlgVector'),
  dlgTargets: document.getElementById('dlgTargets'),
  dlgRisk: document.getElementById('dlgRisk'),
  dlgShort: document.getElementById('dlgShort'),
  dlgLever: document.getElementById('dlgLever'),
  dlgScenario: document.getElementById('dlgScenario'),
  dlgFlags: document.getElementById('dlgFlags'),
  dlgMitigations: document.getElementById('dlgMitigations'),
  dlgRefs: document.getElementById('dlgRefs'),
  dlgClose: document.getElementById('dlgClose'),
  toast: document.getElementById('toast'),
  footerLinkPrefix: document.getElementById('footerLinkPrefix'),
  footerLinkAnchor: document.getElementById('footerLinkAnchor')
};

init().catch(err => {
  console.error(err);
  const msg = t(state.locale, 'error.load');
  els.cards.innerHTML =
    `<div class="card"><p>${escapeHtml(msg)}</p><pre>${escapeHtml(String(err))}</pre></div>`;
});

async function init(){
  applyLocale(state.locale);
  applyTheme(state.theme);

  const res = await fetch('./dist/countries.json', {
    cache: 'no-store',
    credentials: 'same-origin',
    mode: 'same-origin'
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  try {
    state.data = JSON.parse(text);
  } catch(_) {
    throw new Error('Invalid JSON data');
  }
  if(!state.data || !Array.isArray(state.data.countries)){
    throw new Error('Invalid data structure');
  }

  buildCountryOptions();
  buildVectorOptions();
  buildTargetOptions();
  syncControlsFromState();
  bindEvents();
  render();
}

/* ---------------- select population -------------------------------------- */

function buildCountryOptions(){
  els.country.innerHTML = '';
  const { total, counts } = countryCounts(state.data);
  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = `${t(state.locale, 'filter.all')} (${total})`;
  els.country.appendChild(allOpt);
  for(const c of state.data.countries){
    const o = document.createElement('option');
    o.value = c.country_code;
    const name = state.locale === 'ja' ? c.country_name_local : c.country_name_en;
    const n = counts[c.country_code] || 0;
    o.textContent = `${name} (${c.country_code}) (${n})`;
    els.country.appendChild(o);
  }
  els.country.value = state.country;
}

const VECTOR_VOCAB = [
  'in-person', 'phone', 'sms', 'email', 'social', 'website',
  'payment-app', 'postal', 'door-to-door', 'marketplace', 'mixed'
];

function buildVectorOptions(){
  els.vector.innerHTML = '';
  const presentDataVectors = new Set();
  for(const c of state.data.countries){
    for(const a of c.attacks){
      for(const v of (a.attack_vector || [])) presentDataVectors.add(v);
    }
  }
  // Keep controlled-vocab order first, then append any extras found in data.
  const order = VECTOR_VOCAB.filter(v => presentDataVectors.has(v))
    .concat([...presentDataVectors].filter(v => !VECTOR_VOCAB.includes(v)).sort());
  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = t(state.locale, 'filter.all');
  els.vector.appendChild(allOpt);
  for(const v of order){
    const o = document.createElement('option');
    o.value = v;
    o.textContent = labelFor('vector', v, state.locale);
    els.vector.appendChild(o);
  }
  els.vector.value = state.vector;
}

function buildTargetOptions(){
  els.target.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = t(state.locale, 'filter.all');
  els.target.appendChild(allOpt);
  for(const v of extractTargets(state.data)){
    const o = document.createElement('option');
    o.value = v;
    o.textContent = labelFor('target', v, state.locale);
    els.target.appendChild(o);
  }
  els.target.value = state.target;
}

function syncControlsFromState(){
  els.country.value = state.country;
  els.vector.value = state.vector;
  els.target.value = state.target;
  els.q.value = state.q;
  els.sort.value = SORT_OPTIONS.includes(state.sort) ? state.sort : 'default';
  updateTabAria();
}

/* ---------------- event wiring ------------------------------------------ */

function bindEvents(){
  els.localeToggle.addEventListener('click', () => {
    state.locale = state.locale === 'ja' ? 'en' : 'ja';
    safeSet('gcsa_locale', state.locale);
    applyLocale(state.locale);
    buildCountryOptions();
    buildVectorOptions();
    buildTargetOptions();
    render();
    pushHash();
  });

  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    safeSet('gcsa_theme', state.theme);
    applyTheme(state.theme);
  });

  els.country.addEventListener('change', () => { state.country = els.country.value; render(); pushHash(); });
  els.vector .addEventListener('change', () => { state.vector  = els.vector .value; render(); pushHash(); });
  els.target .addEventListener('change', () => { state.target  = els.target .value; render(); pushHash(); });
  els.sort   .addEventListener('change', () => { state.sort    = els.sort   .value; render(); pushHash(); });
  els.q.addEventListener('input', debounce(() => {
    state.q = els.q.value.trim();
    render();
    pushHash();
  }, 150));

  els.searchClear.addEventListener('click', () => {
    els.q.value = '';
    state.q = '';
    els.q.focus();
    render();
    pushHash();
  });

  els.resetFilters.addEventListener('click', () => {
    state.country = '__all__';
    state.vector  = '__all__';
    state.target  = '__all__';
    state.q = '';
    state.sort = 'default';
    syncControlsFromState();
    render();
    pushHash();
  });

  els.shareLink.addEventListener('click', copyShareLink);
  els.csvExport.addEventListener('click', downloadCsv);

  els.tabList .addEventListener('click', () => switchView('list'));
  els.tabStats.addEventListener('click', () => switchView('stats'));

  els.dlgClose.addEventListener('click', () => els.dlg.close());
  // Click on backdrop (click target is the dialog itself) closes the modal.
  els.dlg.addEventListener('click', e => { if(e.target === els.dlg) els.dlg.close(); });
  // Return focus to the opener once the dialog closes (Esc or close button).
  els.dlg.addEventListener('close', () => {
    if(state.lastOpener && typeof state.lastOpener.focus === 'function'){
      state.lastOpener.focus();
    }
    state.lastOpener = null;
  });

  // External URL changes (back/forward button) re-sync state.
  window.addEventListener('hashchange', () => {
    const h = parseHash(window.location.hash);
    state.country = h.country || '__all__';
    state.vector  = h.vector  || '__all__';
    state.target  = h.target  || '__all__';
    state.q       = h.q || '';
    state.sort    = h.sort || 'default';
    if(h.lang && h.lang !== state.locale){
      state.locale = h.lang;
      safeSet('gcsa_locale', state.locale);
      applyLocale(state.locale);
      buildCountryOptions();
      buildVectorOptions();
      buildTargetOptions();
    }
    syncControlsFromState();
    render();
  });
}

/* ---------------- URL state --------------------------------------------- */

function pushHash(){
  const h = buildHash({
    country: state.country,
    vector:  state.vector,
    target:  state.target,
    q: state.q,
    sort: state.sort,
    lang: state.locale
  });
  const url = window.location.pathname + window.location.search + (h || '');
  try { history.replaceState(null, '', url); } catch(_) { /* ignore */ }
}

function shareUrl(){
  const h = buildHash({
    country: state.country,
    vector:  state.vector,
    target:  state.target,
    q: state.q,
    sort: state.sort,
    lang: state.locale
  });
  return window.location.origin + window.location.pathname + window.location.search + (h || '');
}

async function copyShareLink(){
  const url = shareUrl();
  const copied = t(state.locale, 'share.copied');
  const failed = t(state.locale, 'share.copyFail');
  if(navigator.clipboard && navigator.clipboard.writeText){
    try { await navigator.clipboard.writeText(url); showToast(copied); return; }
    catch(_) { /* fall through */ }
  }
  // Fallback: show the URL in a selectable input the user can Ctrl+C.
  showToast(failed);
  prompt(failed, url);
}

function showToast(message){
  if(!els.toast) return;
  els.toast.textContent = message;
  els.toast.hidden = false;
  els.toast.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.classList.remove('visible');
    els.toast.hidden = true;
  }, 2600);
}

/* ---------------- locale / theme application ---------------------------- */

function applyLocale(locale){
  if(locale === 'ja'){
    els.localeToggle.textContent = '🌐 EN';
    els.localeToggle.setAttribute('aria-label', t('ja', 'aria.localeToEn'));
  } else {
    els.localeToggle.textContent = '🌐 JA';
    els.localeToggle.setAttribute('aria-label', t('en', 'aria.localeToJa'));
  }
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(key in messages[locale]) el.textContent = messages[locale][key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if(key in messages[locale]) el.placeholder = messages[locale][key];
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if(key in messages[locale]) el.setAttribute('aria-label', messages[locale][key]);
  });
  if(els.jsonLink){
    els.jsonLink.setAttribute('data-tooltip', t(locale, 'tooltip.json'));
    els.jsonLink.setAttribute('aria-label', t(locale, 'json.label'));
  }
  if(els.footerLinkPrefix) els.footerLinkPrefix.textContent = `🔗 ${t(locale, 'footer.github.prefix')}`;
  if(els.footerLinkAnchor) els.footerLinkAnchor.textContent = t(locale, 'footer.github.label');
  document.documentElement.setAttribute('lang', locale);
  refreshThemeAria();
}

function applyTheme(theme){
  const html = document.documentElement;
  if(theme === 'light'){
    html.setAttribute('data-theme', 'light');
    els.themeToggle.textContent = '🌙';
  } else {
    html.setAttribute('data-theme', 'dark');
    els.themeToggle.textContent = '☀️';
  }
  refreshThemeAria();
}

function refreshThemeAria(){
  if(!els.themeToggle) return;
  const key = state.theme === 'light' ? 'aria.themeToDark' : 'aria.themeToLight';
  els.themeToggle.setAttribute('aria-label', t(state.locale, key));
}

/* ---------------- rendering --------------------------------------------- */

function currentEntries(){
  return sortAttacks(
    filterAttacks(state.data, {
      country: state.country, vector: state.vector,
      target: state.target, q: state.q, locale: state.locale
    }),
    state.sort
  );
}

function render(){
  const entries = currentEntries();
  els.resultCount.textContent = String(entries.length);
  if(state.view === 'stats'){
    renderStats(entries);
    return;
  }
  if(entries.length){
    els.cards.innerHTML = entries.map(renderCard).join('');
    els.cards.querySelectorAll('button.open').forEach(btn => {
      btn.addEventListener('click', () => {
        const [cc, id] = btn.dataset.key.split(':');
        const country = state.data.countries.find(x => x.country_code === cc);
        const atk = country && country.attacks.find(a => a.id === id);
        if(country && atk) openDetail(country, atk, btn);
      });
    });
  } else {
    const empty = t(state.locale, 'empty.noMatch');
    els.cards.innerHTML = `<div class="card"><p>${escapeHtml(empty)}</p></div>`;
  }
}

function renderCard({ country, atk, tTitle, tShort, matchedFields }){
  const loc = state.locale;
  const vectors = (atk.attack_vector || []).map(v =>
    `<span class="chip vector">${escapeHtml(labelFor('vector', v, loc))}</span>`).join(' ');
  const targets = (atk.targets || []).map(v =>
    `<span class="chip target">${escapeHtml(labelFor('target', v, loc))}</span>`).join(' ');
  const risk = clampRisk(atk.risk_score);
  const stars = riskStars(risk);
  const countryLabel = t(loc, 'modal.country');
  const riskLabel = t(loc, 'modal.risk');
  const detailsLabel = t(loc, 'card.details');
  const key = `${escapeAttr(country.country_code)}:${escapeAttr(atk.id)}`;
  let matchedHtml = '';
  if(Array.isArray(matchedFields) && matchedFields.length && state.q){
    const chips = matchedFields.map(f =>
      `<span class="chip matched">${escapeHtml(t(loc, 'field.' + f))}</span>`).join(' ');
    const label = escapeHtml(t(loc, 'card.matched'));
    matchedHtml = `<div class="matched-row"><span class="muted">${label}:</span> ${chips}</div>`;
  }
  return `
  <article class="card">
    <h3>${escapeHtml(tTitle)}</h3>
    <div class="kvs">
      <div><strong>${escapeHtml(countryLabel)}</strong> ${escapeHtml(country.country_code)}</div>
      <div><strong>${escapeHtml(riskLabel)}</strong> <span class="risk-${risk}">${stars}</span></div>
    </div>
    <p>${escapeHtml(tShort)}</p>
    <div class="chips">${vectors}</div>
    <div class="chips">${targets}</div>
    ${matchedHtml}
    <footer>
      <button type="button" class="open" data-key="${key}">${escapeHtml(detailsLabel)}</button>
    </footer>
  </article>`;
}

function openDetail(country, atk, opener){
  const loc = state.locale;
  state.lastOpener = opener || null;
  els.dlgTitle.textContent = pickLang(atk.title, loc);
  els.dlgId.textContent = atk.id || '';
  const localName = loc === 'ja' ? country.country_name_local : country.country_name_en;
  els.dlgCountry.textContent = `${country.country_code} / ${localName}`;
  els.dlgVector.textContent = (atk.attack_vector || [])
    .map(v => labelFor('vector', v, loc)).join(', ');
  els.dlgTargets.textContent = (atk.targets || [])
    .map(v => labelFor('target', v, loc)).join(', ');

  const risk = clampRisk(atk.risk_score);
  const stars = riskStars(risk);
  els.dlgRisk.textContent = '';
  const span = document.createElement('span');
  span.className = `risk-${risk}`;
  span.textContent = stars;
  els.dlgRisk.appendChild(span);
  els.dlgRisk.appendChild(document.createTextNode(` (${risk} / 5)`));

  els.dlgShort.textContent = pickLang(atk.short_desc, loc);
  els.dlgLever.textContent = pickLang(atk.cultural_lever, loc);
  els.dlgScenario.textContent = pickLang(atk.scenario, loc);

  els.dlgFlags.innerHTML = pickList(atk.red_flags, loc)
    .map(li => `<li>${escapeHtml(li)}</li>`).join('');
  els.dlgMitigations.innerHTML = pickList(atk.mitigations, loc)
    .map(li => `<li>${escapeHtml(li)}</li>`).join('');
  const refs = atk.references || [];
  if(refs.length){
    els.dlgRefs.innerHTML = refs.map(r =>
      `<li><a href="${escapeAttr(sanitizeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label || r.url)}</a></li>`
    ).join('');
  } else {
    const none = t(loc, 'modal.noReferences');
    els.dlgRefs.innerHTML = `<li class="muted">${escapeHtml(none)}</li>`;
  }
  els.dlg.showModal();
}

/* ---------------- tabs / stats view -------------------------------------- */

function updateTabAria(){
  const listSel = state.view === 'list';
  els.tabList.setAttribute('aria-selected', listSel ? 'true' : 'false');
  els.tabStats.setAttribute('aria-selected', listSel ? 'false' : 'true');
  els.tabList.classList.toggle('active', listSel);
  els.tabStats.classList.toggle('active', !listSel);
}

function switchView(view){
  state.view = view;
  updateTabAria();
  if(view === 'stats'){
    els.cards.hidden = true;
    els.statsView.hidden = false;
  } else {
    els.cards.hidden = false;
    els.statsView.hidden = true;
  }
  render();
}

function renderStats(filteredEntries){
  const loc = state.locale;
  const allStats = aggregate(state.data);
  const filteredStats = aggregate(filteredEntries);
  const sections = [
    section('stats.byCountry', 'stats.country', allStats.byCountry, filteredStats.byCountry,
      c => `${c} (${c})`,
      c => `${c} (${c})`),
    section('stats.byVector', 'stats.vector', allStats.byVector, filteredStats.byVector,
      v => labelFor('vector', v, loc),
      v => labelFor('vector', v, loc)),
    section('stats.byTarget', 'stats.target', allStats.byTarget, filteredStats.byTarget,
      v => labelFor('target', v, loc),
      v => labelFor('target', v, loc)),
    section('stats.byRisk', 'stats.risk',
      Object.fromEntries([1,2,3,4,5].map(r => [String(r), allStats.byRisk[r] || 0])),
      Object.fromEntries([1,2,3,4,5].map(r => [String(r), filteredStats.byRisk[r] || 0])),
      r => `${r} / 5`, r => `${r} / 5`)
  ];
  els.statsView.innerHTML = sections.join('');

  function section(titleKey, _axisKey, allMap, filteredMap, labelAll, labelFilt){
    const allRows = toRows(allMap, labelAll);
    const filtRows = toRows(filteredMap, labelFilt);
    const scopeAll = t(loc, 'stats.scope.all');
    const scopeFilt = t(loc, 'stats.scope.filtered');
    const title = escapeHtml(t(loc, titleKey));
    return `<section class="stats-section">
      <h3>${title}</h3>
      <div class="stats-pair">
        <div class="stats-col">
          <h4>${escapeHtml(scopeAll)}</h4>
          ${chart(allRows)}
        </div>
        <div class="stats-col">
          <h4>${escapeHtml(scopeFilt)}</h4>
          ${chart(filtRows)}
        </div>
      </div>
    </section>`;
  }

  function toRows(map, labelFn){
    return Object.keys(map)
      .map(k => ({ key: k, label: labelFn(k), count: map[k] || 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
}

function chart(rows){
  if(!rows.length){
    return `<p class="muted">${escapeHtml(t(state.locale, 'stats.empty'))}</p>`;
  }
  const max = Math.max(1, ...rows.map(r => r.count));
  const rowH = 24;
  const h = rows.length * rowH + 8;
  const labelW = 110;
  const barMax = 180;
  const countX = labelW + barMax + 8;
  const w = countX + 40;
  const bars = rows.map((r, i) => {
    const y = 4 + i * rowH;
    const bw = Math.max(1, (r.count / max) * barMax);
    return `
      <text x="${labelW - 6}" y="${y + 16}" class="stats-label" text-anchor="end">${escapeHtml(r.label)}</text>
      <rect x="${labelW}" y="${y + 4}" width="${bw.toFixed(2)}" height="${rowH - 10}" class="stats-bar"></rect>
      <text x="${countX}" y="${y + 16}" class="stats-count">${r.count}</text>
    `;
  }).join('');
  return `<svg class="stats-chart" viewBox="0 0 ${w} ${h}" role="img"
      aria-label="${escapeAttr(t(state.locale, 'stats.count'))}">${bars}</svg>`;
}

/* ---------------- CSV export -------------------------------------------- */

function downloadCsv(){
  const entries = currentEntries();
  const rows = entriesToCsvRows(entries, state.locale);
  const columns = [
    ['id', 'id'], ['country', 'country'], ['title', 'title'],
    ['vector', 'vector'], ['targets', 'targets'], ['risk', 'risk'],
    ['cultural_lever', 'cultural_lever'],
    ['red_flags', 'red_flags'], ['mitigations', 'mitigations']
  ];
  const csv = toCsv(rows, columns);
  const bom = '﻿';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  const scope = state.country === '__all__' ? 'all' : state.country;
  a.href = url;
  a.download = `gcsa-${scope}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------- misc --------------------------------------------------- */

function debounce(fn, ms){
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
