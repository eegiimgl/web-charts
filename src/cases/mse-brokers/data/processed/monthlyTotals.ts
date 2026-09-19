import data from './monthly_totals.json';

/**
 * PROCESSED — one row per broker × month from `process.py` (committed output).
 * `monthly_total` = "Нийт арилжаа" for that month (₮). Thin re-export only.
 */
export interface MonthlyTotal {
  period: string;
  year: number;
  month: number;
  source_row: number;
  code: string;
  name: string;
  monthly_total: number;
  ytd_total: number | null;
  /** Primary-market IPO slice (₮). Null where the sheet has no IPO column. */
  ipo: number | null;
  /** Secondary-market stocks slice: ХУВЬЦАА / ХУВЬЦАА /ХОС/ / Equity (₮). */
  stocks: number | null;
  /** Sum of all bond legs: ЗГҮЦ/ЗГДҮЦ, Бонд…, ХБҮЦ, Corporate/Government bonds (₮). */
  bonds: number | null;
}

export const monthlyTotals: MonthlyTotal[] = data as MonthlyTotal[];

/**
 * Deduped rows: 2017-08 was published twice — keep the revised report
 * (higher source_row). Charts must use this, never `monthlyTotals` raw.
 */
const byKey = new Map<string, MonthlyTotal>();
for (const r of monthlyTotals) {
  const key = `${r.period}|${r.code}`;
  const prev = byKey.get(key);
  if (!prev || r.source_row > prev.source_row) byKey.set(key, r);
}
export const monthlyTotalsDeduped: MonthlyTotal[] = [...byKey.values()].sort((a, b) =>
  a.period === b.period ? a.code.localeCompare(b.code) : a.period.localeCompare(b.period),
);

export const periods: string[] = [...new Set(monthlyTotalsDeduped.map((r) => r.period))].sort();
export const latestPeriod: string = periods[periods.length - 1];

/** Monthly total (₮) lookup: `${period}|${code}` → row (or undefined). */
export const totalByPeriodCode = new Map<string, MonthlyTotal>(
  monthlyTotalsDeduped.map((r) => [`${r.period}|${r.code}`, r]),
);

/** Latest-month leaderboard, shown as the data table on the case page. */
export const table = {
  columns: ['Period', 'Code', 'Broker', 'Нийт арилжаа (₮)'],
  rows: monthlyTotalsDeduped
    .filter((r) => r.period === latestPeriod)
    .sort((a, b) => b.monthly_total - a.monthly_total)
    .map((r): (string | number)[] => [r.period, r.code, r.name, Math.round(r.monthly_total)]),
};
