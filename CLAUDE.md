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

- `gcsa-core.js`: pure logic shared with the tests (`filterAttacks`, `matchQuery`, `clampRisk`, `riskStars`, `pickLang`, `pickList`, `sanitizeUrl`, `escapeHtml`, `escapeAttr`, `resolveLocale`, `resolveTheme`). No DOM access.
- `gcsa-messages.js`: i18n dictionary. `ja` and `en` keys must stay in sync; `test/i18n.test.js` enforces this.
- `main.js`: DOM wiring only. Loads `./dist/countries.json`, applies filters, renders cards, drives the modal, and switches locale/theme without re-fetching.

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

## Tests

Runs via `npm test` (`node --test`, zero extra dependencies). See `README.md` for a per-file summary.

- `test/core.test.js`, `test/i18n.test.js`, `test/data.test.js`, `test/html.test.js`, `test/contrast.test.js`, `test/format.test.js`, `test/readme.test.js`.

## CI/CD

### GitHub Actions
- **`.github/workflows/ci.yml`**: validates on PR/push to main (build + schema validation).
- **`.github/workflows/test.yml`**: runs `npm test` on PR/push to main (Node 22).
- **`.github/workflows/pages.yml`**: deploys to GitHub Pages on push to main.
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
   - IN (India): APAC region, hi/en languages (1 entry).

## Content Guidelines (`docs/content-guidelines.md`)

- Educational purpose: do not generalize cultures or people.
- Frame as "attackers could exploit this tendency".
- `red_flags` must pair with actionable `mitigations`.
- Use controlled vocabulary for `attack_vector`, `targets`, `mediums`, `tags`.
- Verify reference URLs before committing.
- Ensure unique IDs per country.

### Controlled Vocabulary

- **attack_vector**: `in-person`, `phone`, `email`, `sms`, `social`, `website`, `payment-app`, `postal`, `door-to-door`, `marketplace`, `mixed`.
- **targets**: `tourist`, `general`, `elderly`, `business`, `student`.
- **mediums**: `cash`, `credit`, `bank-transfer`, `cryptocurrency`, `gift-cards`.
- **risk_score**: integer 1-5 (1=lowest, 5=highest).

## Public URLs
- Demo: https://ipusiron.github.io/global-cultural-scam-atlas/
- Aggregated data: https://ipusiron.github.io/global-cultural-scam-atlas/dist/countries.json
