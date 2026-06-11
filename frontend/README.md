# frontend — Travel Risk Platform web UI

React SPA for the tourism travel safety risk assessment platform
(see `.specs/plan-implementation/API_CONTRACT.md` — the binding contract).

## Stack

- Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`)
- react-router (declarative `<BrowserRouter>` mode)
- @tanstack/react-query for all server state (no client cache duplication)
- react-i18next — Ukrainian (default) + English, persisted to `localStorage`
- Recharts for the dashboard charts
- Hand-rolled CSS (CSS variables, light theme, WCAG AA) — no UI kit

## Pages

| Route | Purpose |
|---|---|
| `/regions` | Region cards + CRUD, Excel/CSV import with row-error report, demo-dataset loader, respondent table (filters + paging), questionnaire editor grouped by G1–G3 |
| `/panel` | DM panel: Ξ input, Δ select, readiness badges, run evaluation, per-module intermediate results (M_I→M_R1→M_R2→M_R3), decision-support callout |
| `/dashboard` | Run selector, region comparison table, μ_R bar chart, r* distribution, Z-spline/S-shape MF plots with region markers, per-region individuals drill-down, xlsx/pdf export |
| `/parameters` | Versioned platform config editor, If–Then rule builder (M_R1), criteria label editor |

## Development

```bash
npm install
npm run dev        # dev server on :5173, proxies /api -> http://localhost:8000
npm run build      # tsc -b && vite build
npm run lint       # eslint (flat config, typescript-eslint)
```

The backend (FastAPI) must run on `localhost:8000` for live data.

## Structure

- `src/api/` — typed fetch client, one module per contract resource
- `src/i18n/` — `uk.json` / `en.json` (identical key sets) + i18next setup
- `src/components/` — Layout, Modal (native `<dialog>`), badges, pagination, feedback
- `src/pages/` — one folder per route
- `src/lib/` — risk-color constants (per contract), formatting, language helpers
