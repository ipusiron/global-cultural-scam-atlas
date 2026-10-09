# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Global Cultural Scam Atlas (GCSA)** is an educational database of social engineering attacks that exploit cultural contexts across countries. Each attack is stored as a single JSON file and aggregated at build time for distribution.

## Key Commands

### Test, Build, and Validation
```bash
npm test                  # Run node --test (no extra deps). Node 22+.
npm run build:index       # Generate data/index.json from attack files
npm run build:countries   # Generate dist/countries.json (aggregated data)
npm run build             # Run both build scripts
npm run validate:schema   # Validate dist/countries.json against schema
npm run build:local       # Build and copy dist/countries.json to docs/dist/

# Scaffold a new attack JSON (auto-numbered or explicit sequence)
node tools/new-attack.mjs JP        # writes data/attacks/JP/jp-033.json etc.
node tools/new-attack.mjs US 42     # forces us-042.json, refuses to overwrite
```

### Local Preview

`file://` cannot `fetch` the JSON, so an HTTP server is required.

```bash
npm install
npm run build:local
python -m http.server 8000 --directory docs
# open http://localhost:8000/
```

### Development Workflow

1. Create/edit attack files in `data/attacks/{ISO2}/{id}.json`.
2. Run `npm run build` to aggregate (or `npm run build:local` to preview locally).
3. Run `npm test` and `npm run validate:schema` to verify.

## Front-end Module Layout

The UI is split into three ES modules under `docs/js/`.

- `gcsa-core.js`: pure logic shared with the tests (`filterAttacks`, `searchAttackFields`, `extractTargets`, `countryCounts`, `sortAttacks`, `parseHash`, `buildHash`, `aggregate`, `csvField`, `toCsv`, `entriesToCsvRows`, `matchQuery`, `clampRisk`, `riskStars`, `pickLang`, `pickList`, `sanitizeUrl`, `escapeHtml`, `escapeAttr`, `resolveLocale`, `resolveTheme`). No DOM access.
- `gcsa-messages.js`: i18n dictionary plus `labelFor(prefix, value, locale)` for controlled-vocab labels (`vector.*`, `target.*`, `field.*`). `ja` and `en` keys must stay in sync; `test/i18n.test.js` enforces this.
- `main.js`: DOM wiring only. Loads `./dist/countries.json`, applies filters, renders cards, syncs the URL hash, draws the stats SVG, exports CSV, drives the modal (backdrop click + focus return), and switches locale/theme without re-fetching.

`docs/index.html` loads `main.js` with `type="module"`.

## Data Architecture

### File Structure
- **Attack files**: `data/attacks/{ISO2}/{id}.json` (e.g., `data/attacks/JP/jp-001.json`).
  - One file per attack, following `data/schema.json`.
  - ID format: `^[a-z]{2}-\d{3}$` (enforced in the schema).

- **Build outputs**:
  - `data/index.json`: index mapping country codes to attack IDs.
  - `dist/countries.json`: aggregated data for distribution (version, last_updated, countries[]).
  - `docs/dist/countries.json`: local copy produced by `npm run build:local` (gitignored).

### Schema Requirements (`data/schema.json`)

Attack files must include (all with `ja` locale, optionally `en`):
- `id` (pattern `^[a-z]{2}-\d{3}$`), `title`, `short_desc`, `cultural_lever`.
- `attack_vector[]`, `targets[]`, `scenario`.
- `red_flags`, `mitigations` (both localized arrays).
- `risk_score` (1-5), `tags[]`.
- Optional: `mediums[]`, `legal_notes`, `references[]`.

### Build Process
1. `tools/build-index.mjs`: scans attack files, creates index by country code.
2. `tools/build-countries.mjs`: aggregates attack files with country metadata from `COUNTRY_META`, outputs to `dist/countries.json`.
3. `tools/copy-local.mjs`: copies the aggregated file into `docs/dist/` for local HTTP preview.
4. `tools/new-attack.mjs`: writes a schema-shaped TODO scaffold at `data/attacks/<ISO2>/<id>.json`; never overwrites an existing file.

## Tests

Runs via `npm test` (`node --test`, zero extra dependencies). See `README.md` for a per-file summary.

- `test/core.test.js`, `test/i18n.test.js`, `test/data.test.js`, `test/html.test.js`, `test/contrast.test.js`, `test/format.test.js`, `test/readme.test.js`, `test/phase2.test.js`, `test/new-attack.test.js`.

## CI/CD

### GitHub Actions
- **`.github/workflows/ci.yml`**: validates on PR/push to main (build + schema validation, Node 22).
- **`.github/workflows/test.yml`**: runs `npm test` on PR/push to main (Node 22).
- **`.github/workflows/pages.yml`**: deploys to GitHub Pages on push to main (Node 22).
  - Builds `dist/countries.json`.
  - Copies `docs/*` and `dist/countries.json` to `public/`.
  - Deploys to `gh-pages` branch.

## Adding New Countries

1. Add country metadata to `COUNTRY_META` in `tools/build-countries.mjs`:
   ```js
   XX: {
     country_name_local: "...",
     country_name_en: "...",
     regions: ["..."],
     language_codes: ["..."],
     notes: "Educational use..."
   }
   ```
2. Create attack files in `data/attacks/{ISO2}/` using IDs that match `^[a-z]{2}-\d{3}$`.
3. If the README table of per-country counts changes, update it so `test/data.test.js` and `test/readme.test.js` stay in sync.
4. Currently configured countries:
   - JP (Japan): APAC region, ja/en languages (32 entries).
   - US (United States): AMER region, en language (20 entries).
   - GB (United Kingdom): EMEA region, en language (7 entries).
   - AU (Australia): APAC region, en language (7 entries).
   - SG (Singapore): APAC region, en/zh/ms/ta languages (7 entries).
   - KR (South Korea): APAC region, ko/en languages (6 entries).
   - IN (India): APAC region, hi/en languages (1 entry).
   - TW: configured in COUNTRY_META, entries pending.

## Content Guidelines (`docs/content-guidelines.md`)

- Educational purpose: do not generalize cultures or people.
- Frame as "attackers could exploit this tendency".
- `red_flags` must pair with actionable `mitigations`.
- Use controlled vocabulary for `attack_vector`, `targets`, `mediums`, `tags`.
- Verify reference URLs before committing.
- Ensure unique IDs per country.

### Controlled Vocabulary

- **attack_vector**: `in-person`, `phone`, `email`, `sms`, `social`, `website`, `payment-app`, `postal`, `door-to-door`, `marketplace`, `mixed`.
- **targets**: `tourist`, `general`, `elderly`, `business`, `student`, `expat`（在留外国人・駐在員）.
- **mediums**: `cash`, `credit`, `bank-transfer`, `cryptocurrency`, `gift-cards`, `e-wallet`, `qr-pay`.
  - `postal` と `identity-theft` は決済手段ではないため mediums から外した。`postal` は attack_vector、`identity-theft` は tags に寄せる。
- **risk_score**: integer 1-5 (1=lowest, 5=highest).
- **verification.status**: `verified`（事例の手口を個別ページで裏づけた）／`partial`（総論ページで関連する注意喚起のみ）／`unverified`（出典が見つからなかった）.

### Fact-checking Guide

- 出典は官公庁・警察・消費者機関・金融当局を第一とし、次に大手報道。個別ページを優先する。
- 候補ページは WebSearch で探し、本文は `curl -sL` で取得して逐語で `quote` に書く。要約や記憶で書かない。
- 1 ページ 1 秒以上の間隔を空ける。CI には入れない（外部依存で落ちるため）。手動 `npm run check:refs` でリンク生存を確かめる。

## Public URLs
- Demo: https://ipusiron.github.io/global-cultural-scam-atlas/
- Aggregated data: https://ipusiron.github.io/global-cultural-scam-atlas/dist/countries.json
