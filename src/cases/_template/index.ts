import { meta } from './meta';
import { buildCharts } from './charts';
import { table } from './data/processed/monthly';
import type { UseCase } from '../types';

/**
 * Template use-case. Copy this folder to start a new case.
 * This export is intentionally NOT registered in registry.ts.
 */
export const templateCase: UseCase = {
  meta,
  charts: buildCharts(),
  dataTable: table,
};
