import data from './forecast.json';

/**
 * PROCESSED — Oyu Tolgoi price forecast from `process.py` (committed output).
 * Thin typed re-export only.
 */
export interface ForecastPoint {
  scenario: 'trq-2022' | 'scenario-2026' | string;
  metal: 'copper' | 'gold' | 'silver' | 'total';
  kind: 'volume' | 'price' | 'revenue';
  unit: string;
  grand_total?: number;
  yearly: Record<string, number>;
}

export interface Forecast {
  source_sheet: string;
  scenarios: string[];
  metals: string[];
  years: number[];
  series: ForecastPoint[];
}

export const forecast = data as unknown as Forecast;

/** Total gross revenue ($M) by year per scenario — the case data table. */
const totals = forecast.series.filter((s) => s.metal === 'total' && s.kind === 'revenue');

export const table = {
  columns: ['Scenario', ...forecast.years.map(String)],
  rows: totals.map(
    (s): (string | number)[] => [s.scenario, ...forecast.years.map((y) => Math.round(s.yearly[String(y)]))],
  ),
};
