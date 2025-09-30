/* GCSA minimal UI
 * - fetch ./dist/countries.json
 * - build filters (country)
 * - search / vector filter
 * - render cards + modal detail
 * - simple i18n (ja/en) for field selection
 */
const i18n = {
  ja: {
    tagline: '文化・慣習の文脈を悪用したソーシャルエンジニアリングの教育データベース',
    'filter.country': '国 / Country',
    'filter.vector': '攻撃ベクター / Vector',
    'filter.search': '検索 / Search',
    'filter.reset': 'リセット',
    'search.placeholder': 'タイトル・説明・シナリオ・タグを検索…',
    'summary.attacks': '件の攻撃が表示中',
    'modal.country': 'Country:',
    'modal.vector': 'Vector:',
    'modal.targets': 'Targets:',
    'modal.risk': 'Risk:',
    'modal.cultural_lever': '文化的レバー / Cultural lever',
    'modal.scenario': 'シナリオ / Scenario',
    'modal.red_flags': 'Red Flags',
    'modal.mitigations': 'Mitigations',
    'modal.references': 'References',
    'footer.github': '🔗 GitHubリポジトリはこちら（',
    'footer.github_close': '）',
    'card.details': '詳細 / Details',
    'tooltip.json': '集約された攻撃事例データベース（JSON形式）をダウンロード'
  },
  en: {
    tagline: 'An educational database of social engineering attacks that exploit cultural contexts',
    'filter.country': 'Country',
    'filter.vector': 'Attack Vector',
    'filter.search': 'Search',
    'filter.reset': 'Reset',
    'search.placeholder': 'Search by title, description, scenario, tags…',
    'summary.attacks': 'attacks shown',
    'modal.country': 'Country:',
    'modal.vector': 'Vector:',
    'modal.targets': 'Targets:',
    'modal.risk': 'Risk:',
    'modal.cultural_lever': 'Cultural Lever',
    'modal.scenario': 'Scenario',
    'modal.red_flags': 'Red Flags',
    'modal.mitigations': 'Mitigations',
    'modal.references': 'References',
    'footer.github': '🔗 GitHub Repository: ',
    'footer.github_close': '',
    'card.details': 'Details',
    'tooltip.json': 'Download aggregated attack database (JSON format)'
  }
};

const state = {
  data: null,
  locale: localStorage.getItem('gcsa_locale') || 'ja',
  theme: localStorage.getItem('gcsa_theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  country: '__all__',
  vector: '__all__',
  q: ''
};

const els = {
  localeToggle: document.getElementById('localeToggle'),
  themeToggle: document.getElementById('themeToggle'),
  country: document.getElementById('country'),
  vector: document.getElementById('vector'),
  q: document.getElementById('q'),
  searchClear: document.getElementById('searchClear'),
  resetFilters: document.getElementById('resetFilters'),
  cards: document.getElementById('cards'),
  resultCount: document.getElementById('resultCount'),
  dlg: document.getElementById('detailDialog'),
  dlgTitle: document.getElementById('dlgTitle'),
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
  dlgOk: document.getElementById('dlgOk')
};

init().catch(err => {
  console.error(err);
  els.cards.innerHTML = `<div class="card"><p>データの読み込みに失敗しました。</p><pre>${escapeHtml(String(err))}</pre></div>`;
});

async function init(){
  // set initial locale
  applyLocale(state.locale);

  // set initial theme
  applyTheme(state.theme);

  // load data
  const res = await fetch('./dist/countries.json', {
    cache: 'no-store',
    credentials: 'same-origin',
    mode: 'same-origin'
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);

  // Validate JSON structure before parsing
  const text = await res.text();
  try {
    state.data = JSON.parse(text);
  } catch(e) {
    throw new Error('Invalid JSON data');
  }

  // Basic schema validation
  if(!state.data || !Array.isArray(state.data.countries)) {
    throw new Error('Invalid data structure');
  }

  buildCountryOptions();
  bindEvents();
  render();
}

function buildCountryOptions(){
  const opts = ['__all__', ...state.data.countries.map(c => c.country_code)];
  for(const code of opts){
    const o = document.createElement('option');
    o.value = code;
    if(code === '__all__'){
      o.textContent = 'All';
    }else{
      const c = state.data.countries.find(x => x.country_code === code);
      o.textContent = state.locale === 'ja' ? `${c.country_name_local} (${code})` : `${c.country_name_en} (${code})`;
    }
    els.country.appendChild(o);
  }
}

function bindEvents(){
  els.localeToggle.addEventListener('click', () => {
    state.locale = state.locale === 'ja' ? 'en' : 'ja';
    localStorage.setItem('gcsa_locale', state.locale);
    applyLocale(state.locale);
    // 再描画（国名表記が変わるので）
    // 国セレクトを作り直す
    const keep = state.country;
    els.country.innerHTML = '';
    buildCountryOptions();
    els.country.value = keep;
    render();
  });

  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('gcsa_theme', state.theme);
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

  // modal buttons
  const closeModal = () => els.dlg.close();
  els.dlgClose.addEventListener('click', closeModal);
  els.dlgOk.addEventListener('click', closeModal);
}

function applyLocale(locale){
  if(locale === 'ja'){
    els.localeToggle.textContent = '🌐 EN';
    els.localeToggle.setAttribute('aria-label', 'Switch to English');
  }else{
    els.localeToggle.textContent = '🌐 JA';
    els.localeToggle.setAttribute('aria-label', '日本語に切り替え');
  }

  // Update all UI text
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(i18n[locale][key]) {
      el.textContent = i18n[locale][key];
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if(i18n[locale][key]) {
      el.placeholder = i18n[locale][key];
    }
  });

  // Update tooltips
  const jsonLink = document.getElementById('jsonLink');
  if(jsonLink) {
    jsonLink.setAttribute('data-tooltip', i18n[locale]['tooltip.json']);
  }

  // Update html lang attribute
  document.documentElement.setAttribute('lang', locale);
}

function applyTheme(theme){
  const html = document.documentElement;
  if(theme === 'light'){
    html.setAttribute('data-theme', 'light');
    els.themeToggle.textContent = '🌙';
    els.themeToggle.setAttribute('aria-label', state.locale === 'ja' ? 'ダークモードに切り替え' : 'Switch to dark mode');
  }else{
    html.setAttribute('data-theme', 'dark');
    els.themeToggle.textContent = '☀️';
    els.themeToggle.setAttribute('aria-label', state.locale === 'ja' ? 'ライトモードに切り替え' : 'Switch to light mode');
  }
}

function render(){
  const cards = [];
  const countries = state.data.countries;

  for(const c of countries){
    if(state.country !== '__all__' && c.country_code !== state.country) continue;

    for(const atk of c.attacks){
      if(state.vector !== '__all__' && !(atk.attack_vector||[]).includes(state.vector)) continue;

      // text for search
      const tTitle = pickLang(atk.title);
      const tShort = pickLang(atk.short_desc);
      const tScenario = pickLang(atk.scenario);
      const tLever = pickLang(atk.cultural_lever);
      const tags = (atk.tags||[]).join(' ').toLowerCase();

      const hay = `${tTitle} ${tShort} ${tScenario} ${tLever} ${tags}`.toLowerCase();
      if(state.q && !hay.includes(state.q)) continue;

      cards.push({ country: c, atk, tTitle, tShort });
    }
  }

  els.resultCount.textContent = String(cards.length);
  els.cards.innerHTML = cards.length ? cards.map(renderCard).join('') :
    `<div class="card"><p>該当する攻撃が見つかりませんでした。</p></div>`;

  // wire buttons
  els.cards.querySelectorAll('button.open').forEach(btn => {
    btn.addEventListener('click', () => {
      const [cc, id] = btn.dataset.key.split(':');
      const country = state.data.countries.find(x => x.country_code === cc);
      const atk = country.attacks.find(a => a.id === id);
      openDetail(country, atk);
    });
  });
}

function renderCard({country, atk, tTitle, tShort}){
  const vectors = (atk.attack_vector||[]).map(v=>`<span class="chip vector">${escapeHtml(v)}</span>`).join(' ');
  const targets = (atk.targets||[]).map(v=>`<span class="chip target">${escapeHtml(v)}</span>`).join(' ');
  const risk = Number(atk.risk_score||0);
  const riskStars = '★'.repeat(risk) + '☆'.repeat(5-risk);
  const countryLabel = i18n[state.locale]['modal.country'];
  const riskLabel = i18n[state.locale]['modal.risk'];
  const detailsLabel = i18n[state.locale]['card.details'];

  return `
  <article class="card">
    <h3>${escapeHtml(tTitle)}</h3>
    <div class="kvs">
      <div><strong>${countryLabel}</strong> ${escapeHtml(country.country_code)}</div>
      <div><strong>${riskLabel}</strong> <span class="risk-${risk}">${riskStars}</span></div>
    </div>
    <p>${escapeHtml(tShort)}</p>
    <div class="chips">${vectors}</div>
    <div class="chips">${targets}</div>
    <footer>
      <button class="open" data-key="${country.country_code}:${atk.id}">${detailsLabel}</button>
    </footer>
  </article>`;
}

function openDetail(country, atk){
  els.dlgTitle.textContent = pickLang(atk.title);
  els.dlgCountry.textContent = `${country.country_code} / ${state.locale==='ja'?country.country_name_local:country.country_name_en}`;
  els.dlgVector.textContent = (atk.attack_vector||[]).join(', ');
  els.dlgTargets.textContent = (atk.targets||[]).join(', ');
  const risk = Number(atk.risk_score || 0);
  const riskStars = '★'.repeat(risk) + '☆'.repeat(5-risk);
  els.dlgRisk.innerHTML = `<span class="risk-${risk}">${riskStars}</span> (${risk} / 5)`;

  els.dlgShort.textContent = pickLang(atk.short_desc);
  els.dlgLever.textContent = pickLang(atk.cultural_lever);
  els.dlgScenario.textContent = pickLang(atk.scenario);

  els.dlgFlags.innerHTML = (pickList(atk.red_flags)||[]).map(li=>`<li>${escapeHtml(li)}</li>`).join('');
  els.dlgMitigations.innerHTML = (pickList(atk.mitigations)||[]).map(li=>`<li>${escapeHtml(li)}</li>`).join('');
  els.dlgRefs.innerHTML = (atk.references||[]).length
    ? atk.references.map(r=>`<li><a href="${escapeAttr(sanitizeUrl(r.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label||r.url)}</a></li>`).join('')
    : '<li class="muted">No references</li>';

  els.dlg.showModal();
}

// helpers
function pickLang(obj){
  if(!obj) return '';
  if(typeof obj === 'string') return obj;
  return obj[state.locale] || obj.ja || obj.en || '';
}
function pickList(obj){
  if(!obj) return [];
  if(Array.isArray(obj)) return obj;
  return obj[state.locale] || obj.ja || obj.en || [];
}
function debounce(fn, ms){
  let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
}
function escapeHtml(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s){
  if(s == null) return '';
  return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function sanitizeUrl(url) {
  if(!url) return '#';
  const str = String(url).trim();
  // Only allow http/https protocols
  if(!str.match(/^https?:\/\//i)) return '#';
  return str;
}
