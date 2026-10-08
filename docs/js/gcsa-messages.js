/* GCSA messages - i18n dictionaries for ja / en.
 * Keys in `ja` and `en` must stay in sync; test/i18n.test.js enforces this.
 * Values are plain strings. The footer link label is kept as a single phrase
 * so the HTML side does not need to wrap it in brackets.
 */

export const messages = {
  ja: {
    'tagline': '文化・慣習の文脈を悪用したソーシャルエンジニアリングの教育データベース',
    'filter.country': '国 / Country',
    'filter.vector': '攻撃ベクター / Vector',
    'filter.search': '検索 / Search',
    'filter.reset': 'リセット',
    'filter.all': 'すべて',
    'search.placeholder': 'タイトル・説明・シナリオ・タグを検索…',
    'summary.attacks': '件の攻撃が表示中',
    'empty.noMatch': '該当する攻撃が見つかりませんでした。',
    'error.load': 'データの読み込みに失敗しました。',
    'noscript.message': 'このページを閲覧するには JavaScript を有効にしてください。',
    'modal.country': 'Country:',
    'modal.vector': 'Vector:',
    'modal.targets': 'Targets:',
    'modal.risk': 'Risk:',
    'modal.cultural_lever': '文化的レバー / Cultural lever',
    'modal.scenario': 'シナリオ / Scenario',
    'modal.red_flags': 'Red Flags',
    'modal.mitigations': 'Mitigations',
    'modal.references': 'References',
    'modal.noReferences': '参考リンクはありません',
    'card.details': '詳細',
    'footer.github.prefix': 'GitHub リポジトリー: ',
    'footer.github.label': 'ipusiron/global-cultural-scam-atlas',
    'tooltip.json': '集約された攻撃事例データベース（JSON形式）をダウンロード',
    'json.label': 'countries.json をダウンロード',
    'aria.themeToLight': 'ライトモードに切り替え',
    'aria.themeToDark': 'ダークモードに切り替え',
    'aria.localeToEn': 'Switch to English',
    'aria.localeToJa': '日本語に切り替え',
    'aria.searchClear': '検索語をクリア',
    'aria.dialogClose': '詳細モーダルを閉じる'
  },
  en: {
    'tagline': 'An educational database of social engineering attacks that exploit cultural contexts',
    'filter.country': 'Country',
    'filter.vector': 'Attack Vector',
    'filter.search': 'Search',
    'filter.reset': 'Reset',
    'filter.all': 'All',
    'search.placeholder': 'Search by title, description, scenario, tags...',
    'summary.attacks': 'attacks shown',
    'empty.noMatch': 'No attacks match the current filters.',
    'error.load': 'Failed to load the dataset.',
    'noscript.message': 'Please enable JavaScript to view this page.',
    'modal.country': 'Country:',
    'modal.vector': 'Vector:',
    'modal.targets': 'Targets:',
    'modal.risk': 'Risk:',
    'modal.cultural_lever': 'Cultural Lever',
    'modal.scenario': 'Scenario',
    'modal.red_flags': 'Red Flags',
    'modal.mitigations': 'Mitigations',
    'modal.references': 'References',
    'modal.noReferences': 'No references',
    'card.details': 'Details',
    'footer.github.prefix': 'GitHub repository: ',
    'footer.github.label': 'ipusiron/global-cultural-scam-atlas',
    'tooltip.json': 'Download the aggregated attack dataset (JSON)',
    'json.label': 'Download countries.json',
    'aria.themeToLight': 'Switch to light mode',
    'aria.themeToDark': 'Switch to dark mode',
    'aria.localeToEn': 'Switch to English',
    'aria.localeToJa': 'Switch to Japanese',
    'aria.searchClear': 'Clear search input',
    'aria.dialogClose': 'Close detail dialog'
  }
};

/**
 * Look up a message by key with a safe fallback.
 * Uses `in` so that explicitly-empty translations also apply.
 */
export function t(locale, key){
  const dict = messages[locale] || messages.ja;
  if(key in dict) return dict[key];
  if(key in messages.ja) return messages.ja[key];
  return key;
}
