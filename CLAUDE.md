# Cost of Living Estimate

Static web app (no build step) for host schools to document living costs for J-1 exchange teachers. Runs entirely in the browser using ES modules and pdf-lib.

## Local Development

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

Must be served over HTTP — `file://` won't work due to ES module imports.

## Versioning

Version is defined in `config/version.js` as the single source of truth. It is displayed in the page footer and included in debug reports.

**When releasing changes**, update both:
1. `APP_VERSION` in `config/version.js`
2. The `?v=` query strings on `<link>` and `<script>` tags in `index.html`

## Key Files

- `index.html` — Main page, wizard steps, sport entry template
- `main.js` — Wizard logic, state management, validation, draft auto-save
- `lib/pdf.js` — PDF generation with pdf-lib (cost tables, no images)
- `lib/storage.js` — Generic localStorage draft module (shared with other CHF forms)
- `config/org.js` — Organization branding, PDF styling constants
- `config/version.js` — App version constant
- `styles.css` — All styles

## PDF Generation Notes

- Uses standard Helvetica font (WinAnsi encoding) — text passed to `drawText()` must not contain control characters (`\n`, `\r`, etc.).
- `drawCostRow` sanitizes text before drawing.
- No image embedding (except org logo in header).
- Table-oriented layout with label-value rows.
