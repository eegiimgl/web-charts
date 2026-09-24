import type { ChartSpec } from '../../types';
import { volumesChart } from './volumes';
import { revenueChart } from './revenue';

/** Aggregate every chart in this folder. Add new charts here. */
export function buildCharts(): ChartSpec[] {
  return [volumesChart(), revenueChart()];
}
