import processed from './monthly.json';

/**
 * PROCESSED data — output of the per-case Python script, committed to the repo.
 * This file only types + re-exports that output (and builds the data table).
 * All cleaning / aggregation / shaping happens in Python, not here.
 * `charts/*` may only import from here, never from `data/raw/` directly.
 */

export const months: string[] = processed.months;
export const values: number[] = processed.values;

export const table = {
  columns: ['Month', 'Value'],
  rows: processed.months.map((m, i): (string | number)[] => [m, processed.values[i]]),
};
