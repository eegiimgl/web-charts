/** Metric options shared by the interactive charts. */
export type Metric = 'total' | 'ipo' | 'stocks' | 'bonds' | 'other';

export const METRICS: { id: Metric; label: string }[] = [
  { id: 'total', label: 'Нийт' },
  { id: 'ipo', label: 'IPO' },
  { id: 'stocks', label: 'Хувьцаа' },
  { id: 'bonds', label: 'Бонд' },
  { id: 'other', label: 'Бусад' },
];
