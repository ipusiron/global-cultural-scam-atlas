English · [日本語](README.md)

# Global Cultural Scam Atlas (GCSA) - An Educational Database of Culturally-Framed Scams

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/global-cultural-scam-atlas?style=social)
![GitHub forks](https://img.shields.io/github/forks/ipusiron/global-cultural-scam-atlas?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/global-cultural-scam-atlas)
![GitHub license](https://img.shields.io/github/license/ipusiron/global-cultural-scam-atlas)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/global-cultural-scam-atlas/)

**Day082 - 100 Security Tools with Generative AI**

**Global Cultural Scam Atlas (GCSA)** is an open, educational database of social engineering attacks that exploit cultural and customary contexts observed in different countries. It does not generalise national character; each entry is written from the standpoint of "an attacker could exploit this tendency".

Attacks are stored one JSON per file under `data/attacks/{ISO2}/{id}.json`, aggregated at build time into `dist/countries.json` by GitHub Actions, and served as a dependency-free vanilla-JS UI on GitHub Pages.

---

## 🌐 Demo

👉 **[https://ipusiron.github.io/global-cultural-scam-atlas/](https://ipusiron.github.io/global-cultural-scam-atlas/)**

Open it directly in a browser.

---

## 📸 Screenshots

> ![English light theme, initial view](assets/en/screenshot.png)
> *English, light theme, initial view (53 attacks).*

> ![Japanese light theme with detail modal open](assets/screenshot2.png)
> *The detail modal for jp-001 (Red Flags and Mitigations).*

> ![Japanese dark theme](assets/screenshot3.png)
> *Dark theme.*

---

## ✨ Features

- One JSON file per attack, so each contribution is reviewable in isolation.
- JSON Schema validation runs automatically in CI.
- Japanese/English UI switch that also swaps the data labels.
- Filters by country, attack vector, and full-text search, with a reset button.
- Risk score (1-5) displayed as a colour-coded star bar.
- Static site: no external APIs or CDNs are called at runtime.
- The aggregated dataset is publicly available as `dist/countries.json`.

---

## 📖 Usage

### Use the hosted demo

Open the demo page and filter by country, attack vector, or keywords. Click "Details" on a card to see the Red Flags, Mitigations, and references in a modal. The buttons in the header toggle theme (light/dark) and language (JA/EN).

### Override the initial language via URL

Append `?lang=ja` or `?lang=en` to force the initial locale, overriding stored preferences and browser settings.

### Run locally

Install dependencies, build, and serve `docs/` over HTTP (`file://` cannot `fetch` the JSON, so an HTTP server is required).

```bash
npm install
npm run build:local        # builds dist/countries.json and copies it under docs/dist/
python -m http.server 8000 --directory docs
# open http://localhost:8000/
```

---

## 📐 Screen Layout

| Area | Role |
|------|------|
| Header | Title, theme toggle, language toggle, countries.json download link |
| Filters | Country select, attack vector select, full-text search, reset |
| Summary | Current number of visible attacks (announced via `aria-live`) |
| Cards | One card per attack (title, country, risk, vectors, targets, details button) |
| Detail modal | ID, cultural lever, scenario, Red Flags, Mitigations, references |
| Footer | Link to the GitHub repository |

---

## 🎯 Use Cases

### Education

- In information-literacy or security classes, line up attacks from different countries to see how the same psychological levers (authority, urgency, reciprocity, conformity) wear different cultural clothing.
- In comparative-culture or intercultural-communication classes, use the "cultural lever" field to reverse-lookup customs from each country.

### Work (beyond security)

- Hand out country-filtered summaries during pre-departure training for staff posted or travelling abroad.
- Use entries as source material for travel-agency or study-abroad advisories.
- Help customer-support agents cross-reference incidents reported by non-local users.
- Give cross-border e-commerce or remittance anti-fraud teams a per-country tendency reference.

### Daily life

- Read the entries for your destination before an overseas trip.
- Share with family members going abroad for study.
- Show Japanese scams (JP) in English to foreign friends visiting Japan.

### Hobby and creative work

- Research realistic scam plots for mystery or suspense writing.
- Draw scenario material for escape-room or tabletop games.
- Use the bilingual entries as parallel-text language study material.

### Research

- Classify tactics by attack vector x target x cultural lever.
- Load `countries.json` directly into analysis notebooks.
- Follow the addition history over time to see how trends shift.

### Combinations

- Paste scenario text into Day081's [Emotion-Based Scam Detector](https://ipusiron.github.io/emotion-based-scam-detector/) to practice judging emotional language.
- Add your own case as JSON and send a pull request to grow the database (follow `docs/content-guidelines.md`).

### Limits

Entries are observations at the time of writing and are not exhaustive. They are not legal advice. Please do not use this project to generalise national character; see `docs/content-guidelines.md`.

---

## 📊 Data Structure

- One attack = one file (`data/attacks/{ISO2}/{id}.json`).
- ID format: `^[a-z]{2}-\d{3}$` (e.g. `jp-001`).
- Aggregated into `dist/countries.json` at build time.
- Structure defined in `data/schema.json` (JSON Schema draft-07).

### Key fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g. `jp-001`) |
| `title` | object | Attack name (`ja`, `en`) |
| `short_desc` | object | Short description (`ja`, `en`) |
| `cultural_lever` | object | Cultural tendency being exploited (`ja`, `en`) |
| `attack_vector` | array | Channel (`in-person`, `phone`, `email`, `sms`, `social`, `website`, `payment-app`, `postal`, `door-to-door`, `marketplace`) |
| `targets` | array | Target type (`tourist`, `elderly`, `student`, `general`, `business`) |
| `scenario` | object | Attack flow (`ja`, `en`) |
| `red_flags` | object | Warning signs (`ja`, `en`) |
| `mitigations` | object | Mitigations (`ja`, `en`) |
| `risk_score` | integer | Risk score 1-5 |
| `mediums` | array | Payment channels (`cash`, `credit`, `bank-transfer`, `cryptocurrency`, `gift-cards`) |
| `legal_notes` | object | Legal notes (`ja`, `en`, optional) |
| `references` | array | Sources (`{label, url}`) |
| `tags` | array | Tags |

### Current counts

| Country | Attacks |
|---------|---------|
| JP (Japan) | 32 |
| US (United States) | 20 |
| IN (India) | 1 |
| **Total** | **53** |

---

## 💻 Using the Data

The aggregated `dist/countries.json` is public and does not need an API key.

```javascript
const url = 'https://ipusiron.github.io/global-cultural-scam-atlas/dist/countries.json';
const data = await (await fetch(url)).json();
// Attacks for a specific country
const jp = data.countries.find(c => c.country_code === 'JP').attacks;
// Filter by risk score
const highRisk = data.countries.flatMap(c => c.attacks).filter(a => a.risk_score >= 4);
// Filter by attack vector
const phoneScams = data.countries.flatMap(c => c.attacks)
  .filter(a => a.attack_vector.includes('phone'));
```

---

## ⚙️ Data Build and CI/CD

### Build commands

- `npm run build:index` generates `data/index.json`.
- `npm run build:countries` generates `dist/countries.json`.
- `npm run build` runs both.
- `npm run validate:schema` validates `dist/countries.json` against `data/schema.json`.
- `npm run build:local` runs the build and copies `dist/countries.json` into `docs/dist/` so a local HTTP server rooted at `docs/` can serve it.

### Workflows

| File | Role |
|------|------|
| `.github/workflows/ci.yml` | Runs `npm run build` and `npm run validate:schema` on push to `main` and on PRs |
| `.github/workflows/test.yml` | Runs `npm test` (Node 22) on push to `main` and on PRs |
| `.github/workflows/pages.yml` | On push to `main`, deploys the site with `dist/countries.json` to GitHub Pages |

---

## 🧪 Tests

Tests run with `node --test` (Node 22+) and require no additional dependencies.

```bash
npm test
```

What the suites cover:

- `test/core.test.js`: filtering, risk clamping, URL sanitisation, HTML escaping, locale resolution, theme resolution.
- `test/i18n.test.js`: `ja` and `en` key sets match, English values contain no Japanese characters.
- `test/data.test.js`: every attack JSON matches its file name and the ID pattern; per-country counts and `risk_score` bounds.
- `test/html.test.js`: CSP, meta, favicon, noscript, IDs, module script, and absence of full-width brackets in `docs/index.html`.
- `test/contrast.test.js`: in both light and dark themes, the six key `(fg,bg)(fg,card)(muted,bg)(muted,card)(accent,bg)(accent,card)` pairs meet WCAG 4.5:1.
- `test/format.test.js`: per-file maximum line length and minimum line count.
- `test/readme.test.js`: structural checks on `README.md` and `README.en.md`.

The `test` GitHub Actions workflow runs the same `npm test` on push and pull request.

---

## 🔒 Security

The site is served as a static site on GitHub Pages. GitHub Pages cannot set arbitrary response headers, so header-based protections (`X-Frame-Options`, `Strict-Transport-Security`, and so on) are not available for this project. The implemented controls and their limits are listed below.

Implemented controls

- `Content-Security-Policy` meta: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'`. All external scripts, styles, fonts, and fetches are blocked.
- Every value shown to the user is HTML-escaped. External links are passed through `sanitizeUrl()`, which allows only http/https URLs.
- No external APIs or CDNs are called. No tracking scripts.
- External links use `rel="noopener noreferrer"`.
- Referrer policy is set to `no-referrer`.

Limits

- `frame-ancestors` in a meta CSP is ignored by browsers; click-jacking cannot be prevented at the header level here.
- `http-equiv="X-Frame-Options"` and `X-Content-Type-Options` meta elements are ignored by browsers (they are HTTP-header only). This repository does not include them.
- `.htaccess` is not interpreted by GitHub Pages; this repository does not ship one.

---

## ⚠️ Notes and Disclaimer

The dataset is for educational purposes. It does not intend to generalise about any country, culture, or people. It is not legal or medical advice. Sources point to primary material wherever possible, and broken links or updates are addressed as they are reported.

---

## 📁 Directory Structure

```
global-cultural-scam-atlas/
├── .github/
│   └── workflows/
│       ├── ci.yml                       # Build and schema validation
│       ├── pages.yml                    # Automatic deploy to GitHub Pages
│       └── test.yml                     # Runs npm test on Node 22
├── .gitignore                           # Ignore patterns
├── assets/
│   ├── screenshot.png                   # Japanese light, initial view
│   ├── screenshot2.png                  # Japanese light, detail modal
│   ├── screenshot3.png                  # Japanese dark, initial view
│   └── en/
│       └── screenshot.png               # English light, initial view
├── CHANGELOG.md                         # Change log (JA/EN)
├── CLAUDE.md                            # Guide for Claude Code
├── data/
│   ├── attacks/                         # Source data (one JSON per attack)
│   │   ├── IN/                          # India (1 entry)
│   │   │   └── in-001.json
│   │   ├── JP/                          # Japan (32 entries, jp-001.json .. jp-032.json)
│   │   │   ├── jp-001.json
│   │   │   └── ...
│   │   └── US/                          # United States (20 entries, us-001.json .. us-020.json)
│   │       ├── us-001.json
│   │       └── ...
│   ├── index.json                       # Index of attack IDs (generated)
│   └── schema.json                      # JSON Schema (draft-07, id pattern enforced)
├── docs/                                # GitHub Pages root
│   ├── content-guidelines.md            # Guidelines for adding/editing entries
│   ├── index.html                       # UI (CSP, noscript, favicon)
│   ├── js/
│   │   ├── gcsa-core.js                 # Pure logic (tested)
│   │   ├── gcsa-messages.js             # i18n dictionaries (ja/en)
│   │   └── main.js                      # DOM wiring (load, filter, render)
│   └── style.css                        # Styles (light/dark, responsive)
├── LICENSE                              # MIT License
├── package.json                         # npm scripts (test / build / build:local etc.)
├── package-lock.json                    # Lockfile
├── README.en.md                         # This file
├── README.md                            # Japanese README
├── test/
│   ├── contrast.test.js                 # WCAG contrast ratio checks
│   ├── core.test.js                     # Unit tests for gcsa-core.js
│   ├── data.test.js                     # Attack JSON format/count checks
│   ├── format.test.js                   # Line length and minimum-size checks
│   ├── html.test.js                     # Structural checks on docs/index.html
│   ├── i18n.test.js                     # ja/en dictionary consistency
│   └── readme.test.js                   # README structure checks
└── tools/
    ├── build-countries.mjs              # Builds dist/countries.json
    ├── build-index.mjs                  # Builds data/index.json
    └── copy-local.mjs                   # Copies the dataset under docs/dist/
```

---

## 💻 Requirements

- Node.js 22 or newer (required by `npm test` and the build scripts).
- A modern browser (recent Chromium, Firefox, or Safari).
- No additional dependencies. There are zero runtime dependencies; `devDependencies` are only `ajv`, `ajv-cli`, and `glob`.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🛠️ About this tool

This tool was created as part of the "100 Security Tools with Generative AI" project. The project tackles a 100-day challenge to design and publish security-related tools with help from generative AI. For project details and other tools, see the page below.

🔗 [https://akademeia.info/?page_id=42163](https://akademeia.info/?page_id=42163)
