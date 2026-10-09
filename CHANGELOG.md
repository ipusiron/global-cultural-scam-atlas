# Changelog / 変更履歴

All notable changes to the Global Cultural Scam Atlas project will be documented in this file.
このプロジェクトの主な変更はすべてこのファイルに記録されます。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
このフォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に基づいています。

---

## [Unreleased]

### Added / 追加
- ターゲット（観光客・一般・高齢者・事業者・学生など）の絞り込みセレクトを追加。/ Added a Target filter select driven by values present in the dataset.
- 国セレクトの各項目に件数を併記（例「日本 (JP) (32)」「すべて (53)」）。/ Country select options now carry per-country counts.
- 検索対象を `cultural_lever`・`red_flags`・`mitigations`・`id` にも拡張し、どのフィールドで当たったかをカードに表示するようにしました。/ Full-text search now covers `cultural_lever`, `red_flags`, `mitigations`, and `id`, and each card shows which fields matched.
- 並び替えセレクト（国コード順・リスクが高い順・ID 順）を追加。/ Added a Sort select with three stable orders.
- 絞り込み・並び替え・言語の状態を URL ハッシュ（例 `#country=JP&vector=phone&target=elderly&q=ATM&sort=risk&lang=ja`）と往復するようにし、「共有リンクをコピー」ボタンを追加しました。/ Filter/sort/language state round-trips through the URL hash and a Copy-share-link button writes it to the clipboard.
- 統計タブを追加。国別・ベクター別・ターゲット別・リスク分布を全データと絞り込み後の2系列で SVG 横棒グラフ表示します。/ Added a Statistics tab rendering country/vector/target/risk histograms (all vs. filtered) as self-contained SVG.
- 絞り込み結果を CSV（UTF-8 BOM・CRLF・式インジェクション対策）でダウンロードするボタンを追加。/ Added a CSV download that exports the current filter result with UTF-8 BOM, CRLF, and formula-injection defusing.
- 新規事例の雛形を自動採番で作る `tools/new-attack.mjs` を追加（既存ファイルは上書きしない）。/ Added `tools/new-attack.mjs` to scaffold a new attack JSON with the next free sequence, refusing to overwrite existing files.
- コア関数 `searchAttackFields`・`extractTargets`・`countryCounts`・`sortAttacks`・`parseHash`・`buildHash`・`aggregate`・`csvField`・`toCsv`・`entriesToCsvRows` と、ベクター/ターゲット/一致フィールドの i18n 辞書 `labelFor()` を追加。/ Added new pure helpers and the `labelFor()` dictionary for controlled-vocabulary labels.
- テストに `test/phase2.test.js`（検索拡張・ターゲット・並び替え・URL 状態・集計・CSV・辞書）と `test/new-attack.test.js`（雛形スクリプトを一時ディレクトリーで実行）を追加。/ Added `test/phase2.test.js` and `test/new-attack.test.js`.

### Changed / 変更
- 詳細モーダルを背景クリックでも閉じ、閉じると開いたボタンへフォーカスを戻すようにしました。/ Clicking the dialog backdrop now closes the detail modal, and focus returns to the opener on close.
- `.github/workflows/ci.yml` と `.github/workflows/pages.yml` の Node を 22 に揃えました。/ Pinned ci and pages workflows to Node 22 to match the test workflow.
- 検索フィールドのプレースホルダーを `… ID` も含む文言に更新し、辞書を同期しました。/ Updated the search placeholder and i18n dictionary to mention ID search.

- 最新の攻撃手法を2件追加 / Added 2 recent attack entries.
- 自動テスト基盤を追加（`node --test`、依存なし）。`test/core.test.js`・`test/i18n.test.js`・`test/data.test.js`・`test/html.test.js`・`test/contrast.test.js`・`test/format.test.js`・`test/readme.test.js` を追加。/ Added a dependency-free `node --test` suite covering core logic, i18n dictionaries, attack JSON, index.html structure, WCAG contrast, format hygiene, and README structure.
- `.github/workflows/test.yml` を追加（Node 22 で `npm test`）。/ Added a `test` workflow that runs `npm test` on Node 22.
- `docs/js/gcsa-core.js` と `docs/js/gcsa-messages.js` を追加し、純粋ロジックとi18n辞書を分離。/ Split pure logic (`gcsa-core.js`) and i18n dictionaries (`gcsa-messages.js`) out of `main.js`.
- `tools/copy-local.mjs` と `npm run build:local` を追加（ローカルHTTP配信用）。/ Added `tools/copy-local.mjs` and `npm run build:local` for local HTTP preview.
- `README.en.md` を追加。/ Added `README.en.md`.
- `?lang=ja|en` でURLから初期言語を指定できるようにした。/ Allow overriding the initial language via `?lang=ja|en` in the URL.
- `noscript` と favicon の `data:` URI を追加。/ Added `noscript` and a `data:` favicon link.
- スクリーンショットを3枚（日本語ライト初期・詳細モーダル・日本語ダーク）と英語ライト初期の計4枚に差し替え。/ Replaced the single screenshot with four (JA light, JA light + modal, JA dark, EN light).

### Changed / 変更
- 言語切り替え時に詳細ボタン名の表示を動的に変更するように改善。/ The "Details" button label now follows the active locale.
- 詳細モーダルに攻撃識別子（ID）を表示するように変更。/ The detail modal now shows the attack ID.
- フロントエンドを ES モジュールに分離し、`docs/index.html` の `<script>` を `type="module"` にした。/ Split the front-end into ES modules; the HTML now loads `main.js` with `type="module"`.
- i18n適用の判定を `key in dict` に変更し、空文字訳も適用されるようにした。/ i18n lookup uses `in` so explicit empty translations apply.
- 初期言語の決定を `?lang=` → 保存値 → ブラウザー言語の順に。/ Initial locale resolution order is now `?lang=` → stored → navigator languages.
- 検索クリア × と詳細モーダルの ×（タップ領域）を44pxに拡大し、検索入力欄のフォントを16pxに。/ Enlarged the search-clear and modal-close tap targets to 44px and set the search input font-size to 16px.
- CSPから `frame-ancestors` と `'unsafe-inline'` を外し、referrerを `no-referrer` にした。/ Removed `frame-ancestors` and `'unsafe-inline'` from the CSP; set referrer to `no-referrer`.
- README.md を日英併記体裁に合わせて再構成。/ Restructured `README.md` to the series-standard layout.

### Fixed / 修正
- 国セレクトの「All」が2つ表示される問題を解消。/ Fixed the duplicate "All" option in the country select.
- `riskStars` を `clampRisk` 経由にし、`risk_score` が異常値でも `String.repeat` の `RangeError` が出ないようにした。/ Risk stars go through `clampRisk` so hostile `risk_score` values no longer trigger `RangeError`.
- カードの `data-key` の攻撃IDを `escapeAttr` でエスケープ。/ Escaped the attack ID in the card `data-key` attribute.
- モーダル下部のOKボタン（CSSで非表示に矛盾した指定が残り死にコードだったもの）を要素ごと削除。/ Removed the modal footer OK button, which was unreachable due to a conflicting `display` declaration.
- フッターの全角括弧の表示崩れを解消（prefix+anchorの2要素に分割）。/ Replaced the brittle "(label)" footer wrapping with a prefix+anchor pair.
- 詳細モーダル閉じるボタン・検索クリア・言語切替・テーマ切替の `aria-label` を言語に追従させた。/ Icon-only buttons now get locale-aware `aria-label`s.
- 英語表示時にUI文言に日本語が残っていた箇所（読み込み失敗・0件・ツールチップなど）を辞書化。/ Routed previously-hardcoded Japanese strings (error, empty-state, tooltip) through the dictionary.
- `data/schema.json` の `id` に `pattern: ^[a-z]{2}-\d{3}$` を追加。/ Added `pattern: ^[a-z]{2}-\d{3}$` to the `id` in `data/schema.json`.

### Removed / 削除
- `docs/.htaccess`（GitHub Pagesでは解釈されないため、README上の「実装済み」表記と合わせて削除）。/ Removed `docs/.htaccess`, which GitHub Pages does not interpret, together with the README claims that implied it did.
- `README.md` の「セキュリティ対策」節から、GitHub Pagesで実際には適用できない `X-Frame-Options` / `X-Content-Type-Options` / `Referrer-Policy` / `.htaccess` の記載を削除し、実装済み対策と制約に書き直した。/ Rewrote the Security section to list only the controls that are actually in effect, plus their limits.

---

## [Previous Updates] - 2025-10

### Added / 追加
- 日本（JP）の攻撃手法を拡充（21-30件目を追加）
- 米国（US）の攻撃情報を20件まで追加

### Fixed / 修正
- リセットボタンの名称を修正

---

## Format Guidelines / フォーマットガイドライン

### Categories / カテゴリ
- **Added / 追加**: 新機能や新しい攻撃手法の追加
- **Changed / 変更**: 既存機能の変更
- **Deprecated / 非推奨**: 間もなく削除される機能
- **Removed / 削除**: 削除された機能
- **Fixed / 修正**: バグ修正
- **Security / セキュリティ**: セキュリティ関連の変更

### Attack Addition Examples / 攻撃追加の記載例
```markdown
### Added
- JP: 振り込め詐欺の新しい手口（jp-031）
- US: Tech support scam variation (us-021)
- IN: Digital arrest scam (in-001 to in-005)
```

---

**Note / 注記**: This project focuses on educational awareness of social engineering attacks. Updates primarily consist of new attack patterns and cultural context additions.
このプロジェクトは社会工学的攻撃の教育的啓発に焦点を当てています。更新は主に新しい攻撃パターンと文化的背景の追加で構成されます。
