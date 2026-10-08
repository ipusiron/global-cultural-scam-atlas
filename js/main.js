/* GCSA main.js - DOM wiring only.
 * All pure logic lives in gcsa-core.js; all UI text lives in gcsa-messages.js.
 * This module:
 *   - loads dist/countries.json
 *   - populates filter widgets and renders cards
 *   - handles locale/theme switching and detail modal
 */
import {
  filterAttacks, pickLang, pickList, riskStars, clampRisk,
  sanitizeUrl, escapeHtml, escapeAttr, resolveLocale, resolveTheme
} from './gcsa-core.js';
import { messages, t } from './gcsa-messages.js';

// ---- storage helpers (localStorage may throw in private mode) ----
function safeGet(key){
  try { return localStorage.getItem(key); } catch(_) { return null; }
}
function safeSet(key, value){
  try { localStorage.setItem(key, value); } catch(_) { /* ignore */ }
}

// ---- initial state ----
const browserLanguages = Array.isArray(navigator.languages) && navigator.languages.length
  ? Array.from(navigator.languages)
  : (navigator.language ? [navigator.language] : []);

const state = {
  data: null,
  locale: resolveLocale({
    query: window.location.search,
    stored: safeGet('gcsa_locale'),
    languages: browserLanguages
  }),
  theme: resolveTheme({
    stored: safeGet('gcsa_theme'),
    prefersLight: window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
  }),
  country: '__all__',
  vector: '__all__',
  q: ''
};

const els = {
  localeToggle: document.getElementById('localeToggle'),
  themeToggle: document.getElementById('themeToggle'),
  jsonLink: document.getElementById('jsonLink'),
  country: document.getElementById('country'),
  vector: document.getElementById('vector'),
  q: document.getElementById('q'),
  searchClear: document.getElementById('searchClear'),
  resetFilters: document.getElementById('resetFilters'),
  cards: document.getElementById('cards'),
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
  bindEvents();
  render();
}

function buildCountryOptions(){
  // Rebuild from scratch so the static placeholder (if any) does not duplicate.
  els.country.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = t(state.locale, 'filter.all');
  els.country.appendChild(allOpt);
  for(const c of state.data.countries){
    const o = document.createElement('option');
    o.value = c.country_code;
    const name = state.locale === 'ja' ? c.country_name_local : c.country_name_en;
    o.textContent = `${name} (${c.country_code})`;
    els.country.appendChild(o);
  }
  els.country.value = state.country;
}

function bindEvents(){
  els.localeToggle.addEventListener('click', () => {
    state.locale = state.locale === 'ja' ? 'en' : 'ja';
    safeSet('gcsa_locale', state.locale);
    applyLocale(state.locale);
    // Rebuild the country select so its labels follow the new locale.
    buildCountryOptions();
    // Re-render cards without re-fetching.
    render();
  });

  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    safeSet('gcsa_theme', state.theme);
    applyTheme(state.theme);
  });

  els.country.addEventListener('change', () => {
    state.country = els.country.value;
    render();
  });
  els.vector.addEventListener('change', () => {
    state.vector = els.vector.value;
    render();
  });
  els.q.addEventListener('input', debounce(() => {
    state.q = els.q.value.trim().toLowerCase();
    render();
  }, 150));

  els.searchClear.addEventListener('click', () => {
    els.q.value = '';
    state.q = '';
    els.q.focus();
    render();
  });

  els.resetFilters.addEventListener('click', () => {
    state.country = '__all__';
    state.vector = '__all__';
    state.q = '';
    els.country.value = '__all__';
    els.vector.value = '__all__';
    els.q.value = '';
    render();
  });

  // Modal: only the close button; the OK/footer was removed in favor of ×.
  els.dlgClose.addEventListener('click', () => els.dlg.close());
}

function applyLocale(locale){
  // Update toggle button label and its aria-label.
  if(locale === 'ja'){
    els.localeToggle.textContent = '🌐 EN';
    els.localeToggle.setAttribute('aria-label', t('ja', 'aria.localeToEn'));
  } else {
    els.localeToggle.textContent = '🌐 JA';
    els.localeToggle.setAttribute('aria-label', t('en', 'aria.localeToJa'));
  }

  // Static text nodes marked with data-i18n.
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(key in messages[locale]){
      el.textContent = messages[locale][key];
    }
  });

  // placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if(key in messages[locale]){
      el.placeholder = messages[locale][key];
    }
  });

  // aria-label attributes (used by icon-only buttons)
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    if(key in messages[locale]){
      el.setAttribute('aria-label', messages[locale][key]);
    }
  });

  // Tooltip on the countries.json download link.
  if(els.jsonLink){
    els.jsonLink.setAttribute('data-tooltip', t(locale, 'tooltip.json'));
    els.jsonLink.setAttribute('aria-label', t(locale, 'json.label'));
  }

  // Footer link prefix (anchor label stays stable).
  if(els.footerLinkPrefix){
    els.footerLinkPrefix.textContent = `🔗 ${t(locale, 'footer.github.prefix')}`;
  }
  if(els.footerLinkAnchor){
    els.footerLinkAnchor.textContent = t(locale, 'footer.github.label');
  }

  document.documentElement.setAttribute('lang', locale);

  // Theme button aria-label depends on current locale.
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

function render(){
  const cards = filterAttacks(state.data, {
    country: state.country,
    vector: state.vector,
    q: state.q,
    locale: state.locale
  });

  els.resultCount.textContent = String(cards.length);
  if(cards.length){
    els.cards.innerHTML = cards.map(renderCard).join('');
    els.cards.querySelectorAll('button.open').forEach(btn => {
      btn.addEventListener('click', () => {
        const [cc, id] = btn.dataset.key.split(':');
        const country = state.data.countries.find(x => x.country_code === cc);
        const atk = country && country.attacks.find(a => a.id === id);
        if(country && atk) openDetail(country, atk);
      });
    });
  } else {
    const empty = t(state.locale, 'empty.noMatch');
    els.cards.innerHTML = `<div class="card"><p>${escapeHtml(empty)}</p></div>`;
  }
}

function renderCard({ country, atk, tTitle, tShort }){
  const vectors = (atk.attack_vector || [])
    .map(v => `<span class="chip vector">${escapeHtml(v)}</span>`).join(' ');
  const targets = (atk.targets || [])
    .map(v => `<span class="chip target">${escapeHtml(v)}</span>`).join(' ');
  const risk = clampRisk(atk.risk_score);
  const stars = riskStars(risk);
  const countryLabel = t(state.locale, 'modal.country');
  const riskLabel = t(state.locale, 'modal.risk');
  const detailsLabel = t(state.locale, 'card.details');
  const key = `${escapeAttr(country.country_code)}:${escapeAttr(atk.id)}`;
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
    <footer>
      <button type="button" class="open" data-key="${key}">${escapeHtml(detailsLabel)}</button>
    </footer>
  </article>`;
}

function openDetail(country, atk){
  const loc = state.locale;
  els.dlgTitle.textContent = pickLang(atk.title, loc);
  els.dlgId.textContent = atk.id || '';
  const localName = loc === 'ja' ? country.country_name_local : country.country_name_en;
  els.dlgCountry.textContent = `${country.country_code} / ${localName}`;
  els.dlgVector.textContent = (atk.attack_vector || []).join(', ');
  els.dlgTargets.textContent = (atk.targets || []).join(', ');

  const risk = clampRisk(atk.risk_score);
  const stars = riskStars(risk);
  // No innerHTML with user data: build the risk span through the DOM.
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

function debounce(fn, ms){
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
