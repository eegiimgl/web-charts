# web-charts

Visual chart use-cases showcase — one subdomain project under `*.eegii.dev` (e.g. `charts.eegii.dev`).
Built with [Vite](https://vitejs.dev) + TypeScript + [ApexCharts](https://apexcharts.com/javascript-chart-demos).

## Concept

- **Home (`#/`)** — grid of all use-cases.
- **Case detail (`#/c/:slug`)** — one use-case: its story, 1–4 charts, optional data table.
- Each use-case is **self-contained**: own folder with own data + chart configs.

## Project layout

```
web-charts/
├── index.html                  # SPA shell
├── public/favicon.svg
├── scripts/new-case.mjs        # scaffolding: npm run new:case -- <slug>
├── src/
│   ├── main.ts                 # header/footer shell + hash router
│   ├── styles.css              # design system (dark)
│   ├── pages/
│   │   ├── home.ts             # home grid rendering
│   │   └── case.ts             # case detail + ApexCharts mounting
│   └── cases/
│       ├── types.ts            # UseCase / ChartSpec / CaseMeta contracts
│       ├── registry.ts         # ← register every case here (one line each)
│       ├── _template/          # copy me to start a new case
│       │   ├── meta.ts         # slug, title, tagline, tags, chartTypes
│       │   ├── scraping/       # python: scrape.py (→ data/raw), process.py (→ data/processed)
│       │   ├── data/
│       │   │   ├── raw/        # untouched input (never edit after capture)
│       │   │   └── processed/  # Python-script output, chart-ready (.json + typed re-export)
│       │   ├── charts/         # one file per chart + index.ts aggregating buildCharts()
│       │   └── index.ts        # assembles UseCase export
│       └── <your-slug>/        # one folder per use-case (same shape)
└── dist/                       # build output → deploy as-is to subdomain
```

## Adding a use-case

```bash
npm run new:case -- saas-revenue
```

Then:

1. Fill in `src/cases/saas-revenue/meta.ts` (title, tagline, tags).
2. Implement `scraping/scrape.py` → writes untouched input into `data/raw/`
   (or drop the input numbers there directly — never edit after capture).
3. Implement `scraping/process.py` → reads `data/raw/`, writes chart-ready JSON
   into `data/processed/`, and expose it via a typed `data/processed/*.ts` re-export.
4. Build ApexCharts options in `charts/` (one file per chart) — see https://apexcharts.com/javascript-chart-demos.
5. Register one line in `src/cases/registry.ts`:
   ```ts
   import { saasRevenueCase } from './saas-revenue';
   export const cases: UseCase[] = [saasRevenueCase];
   ```

Run `npm run dev` and open `#/c/saas-revenue`.

## Commands

| Command | What |
|---|---|
| `npm install` | install deps |
| `npm run dev` | local dev at http://localhost:5173 |
| `npm run build` | typecheck + static build to `dist/` |
| `npm run preview` | preview the production build |

## Deploy (subdomain)

`dist/` is a fully static site with hash routing (no server rewrites needed):

- Cloudflare Pages / Vercel / Netlify: set build `npm run build`, output `dist`.
- Point `charts.eegii.dev` (or any `*.eegii.dev` name) at it.

## Conventions

- One folder per use-case, folder name = URL slug.
- `data/raw/` holds facts (immutable); `data/processed/` holds your Python script's
  chart-ready output (committed JSON + a thin typed `*.ts` re-export) — charts read
  only from `processed`, never from `raw`.
- 1–4 charts per case; each `ChartSpec` needs a unique `id`.
- Chart options are plain `ApexOptions` — any demo from apexcharts.com drops in directly.
