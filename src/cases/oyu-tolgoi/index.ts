import { meta } from './meta';
import { buildCharts } from './charts';
import type { UseCase } from '../types';

/** Oyu Tolgoi price forecast, normalized by scraping/process.py. */
export const oyuTolgoiCase: UseCase = {
  meta,
  charts: buildCharts(),
};
