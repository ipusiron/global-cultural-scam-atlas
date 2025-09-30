/* GCSA minimal UI
 * - fetch ./dist/countries.json
 * - build filters (country)
 * - search / vector filter
 * - render cards + modal detail
 * - simple i18n (ja/en) for field selection
 */
const state = {
  data: null,
  locale: localStorage.getItem('gcsa_locale') || 'ja',
  country: '__all__',
  vector: '__all__',
  q: ''
};

const els = {
  locale: document.getElementById('locale'),
  country: document.getElementById('country'),
  vector: document.getElementById('vector'),
  q: document.getElementById('q'),
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
  els.locale.value = state.locale;

  // load data
  const res = await fetch('./dist/countries.json', {cache: 'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  state.data = await res.json();

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
  els.locale.addEventListener('change', () => {
    state.locale = els.locale.value;
    localStorage.setItem('gcsa_locale', state.locale);
    // 再描画（国名表記が変わるので）
    // 国セレクトを作り直す
    const keep = state.country;
    els.country.innerHTML = '';
    buildCountryOptions();
    els.country.value = keep;
    render();
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

  // modal buttons
  const closeModal = () => els.dlg.close();
  els.dlgClose.addEventListener('click', closeModal);
  els.dlgOk.addEventListener('click', closeModal);
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
  const vectors = (atk.attack_vector||[]).map(v=>`<span class="chip">${escapeHtml(v)}</span>`).join(' ');
  const targets = (atk.targets||[]).map(v=>`<span class="chip">${escapeHtml(v)}</span>`).join(' ');
  const risk = Number(atk.risk_score||0);
  const riskStars = '★'.repeat(risk) + '☆'.repeat(5-risk);

  return `
  <article class="card">
    <h3>${escapeHtml(tTitle)}</h3>
    <div class="kvs">
      <div><strong>Country:</strong> ${escapeHtml(country.country_code)}</div>
      <div><strong>Risk:</strong> ${riskStars}</div>
    </div>
    <p>${escapeHtml(tShort)}</p>
    <div class="chips">${vectors}</div>
    <div class="chips">${targets}</div>
    <footer>
      <button class="open" data-key="${country.country_code}:${atk.id}">詳細 / Details</button>
    </footer>
  </article>`;
}

function openDetail(country, atk){
  els.dlgTitle.textContent = pickLang(atk.title);
  els.dlgCountry.textContent = `${country.country_code} / ${state.locale==='ja'?country.country_name_local:country.country_name_en}`;
  els.dlgVector.textContent = (atk.attack_vector||[]).join(', ');
  els.dlgTargets.textContent = (atk.targets||[]).join(', ');
  els.dlgRisk.textContent = `${atk.risk_score || 0} / 5`;

  els.dlgShort.textContent = pickLang(atk.short_desc);
  els.dlgLever.textContent = pickLang(atk.cultural_lever);
  els.dlgScenario.textContent = pickLang(atk.scenario);

  els.dlgFlags.innerHTML = (pickList(atk.red_flags)||[]).map(li=>`<li>${escapeHtml(li)}</li>`).join('');
  els.dlgMitigations.innerHTML = (pickList(atk.mitigations)||[]).map(li=>`<li>${escapeHtml(li)}</li>`).join('');
  els.dlgRefs.innerHTML = (atk.references||[]).length
    ? atk.references.map(r=>`<li><a href="${escapeAttr(r.url)}" target="_blank" rel="noopener">${escapeHtml(r.label||r.url)}</a></li>`).join('')
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
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escapeAttr(s){ return String(s).replace(/"/g, '&quot;'); }
