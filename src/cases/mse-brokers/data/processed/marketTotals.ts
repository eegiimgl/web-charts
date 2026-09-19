import data from './market_totals.json';

/**
 * PROCESSED — market-wide "Нийт" row per month from `process.py`.
 * Thin typed re-export only.
 */
export interface MarketTotal {
  period: string;
  year: number;
  month: number;
  source_row: number;
  monthly_total: number;
  ytd_total: number | null;
  ipo: number | null;
  stocks: number | null;
  bonds: number | null;
}

export const marketTotals: MarketTotal[] = ((): MarketTotal[] => {
  // 2017-08 was published twice — keep the revised report (higher source_row).
  const byPeriod = new Map<string, MarketTotal>();
  for (const r of data as MarketTotal[]) {
    const prev = byPeriod.get(r.period);
    if (!prev || r.source_row > prev.source_row) byPeriod.set(r.period, r);
  }
  return [...byPeriod.values()];
})();
