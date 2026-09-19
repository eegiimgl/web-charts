import { meta } from './meta';
import { buildCharts } from './charts';
import type { UseCase } from '../types';

/** MSE member-company monthly trading reports, normalized by scraping/process.py. */
export const mseBrokersCase: UseCase = {
  meta,
  charts: buildCharts(),
};
