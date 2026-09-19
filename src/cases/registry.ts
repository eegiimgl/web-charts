import type { CaseEntry, UseCase } from './types';
import { meta as mseBrokersMeta } from './mse-brokers/meta';

// ─── Registry ──────────────────────────────────────────────
// To add a new use-case:
//   1. Copy `src/cases/_template/` → `src/cases/<your-slug>/`
//      (or run `npm run new:case -- <your-slug>`)
//   2. Fill in meta.ts / scraping/ / data/processed/ / charts/
//   3. Import the LIGHT meta + a lazy loader below (one entry).
//      Importing `./<slug>/meta` (not `./<slug>`) keeps heavy
//      datasets out of the home-page bundle.
//
// Example:
//   import { meta as saasMeta } from './saas-revenue/meta';
//   { meta: saasMeta, load: () => import('./saas-revenue').then((m) => m.saasRevenueCase) },

export const cases: CaseEntry[] = [
  {
    meta: mseBrokersMeta,
    load: () => import('./mse-brokers').then((m): UseCase => m.mseBrokersCase),
  },
];

export function getCase(slug: string): CaseEntry | undefined {
  return cases.find((c) => c.meta.slug === slug);
}
