import type { ChartSpec } from '../../types';
import { months, values } from '../data/processed/monthly';

/**
 * One file per chart. Each exports a function returning a ChartSpec.
 * Charts read ONLY from `data/processed/` (Python output) — never from `data/raw/`.
 * Reference: https://apexcharts.com/javascript-chart-demos
 */
export function trendChart(): ChartSpec {
  return {
    id: 'trend',
    title: 'Сарын хандлага',
    description: 'Энэ график юу харуулж, яагаад чухал болохыг бичнэ.',
    height: 350,
    options: {
      chart: { type: 'line', toolbar: { show: true } },
      series: [{ name: 'Value', data: values }],
      xaxis: { categories: months },
      stroke: { curve: 'smooth', width: 3 },
      dataLabels: { enabled: false },
    },
  };
}
