import type { ChartSpec } from '../../types';
import { trendChart } from './trend';

/** Aggregate every chart in this folder. Add new charts here. */
export function buildCharts(): ChartSpec[] {
  return [trendChart()];
}
