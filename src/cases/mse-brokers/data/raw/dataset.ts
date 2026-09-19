/**
 * RAW data — untouched input, exactly as given.
 * Rule: copy numbers here once, then never edit.
 * Your Python script reads this (or the .json/.csv next to it)
 * and writes chart-ready output to `data/processed/`.
 */

export interface RawMonthlyPoint {
  month: string;
  value: number;
}

export const rawMonthly: RawMonthlyPoint[] = [
  { month: 'Jan', value: 12 },
  { month: 'Feb', value: 19 },
  { month: 'Mar', value: 8 },
];
