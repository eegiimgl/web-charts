import type { ChartSpec } from '../../types';
import { marketChart } from './market';
import { topBrokersChart } from './topBrokers';
import { leaderboardChart } from './leaderboard';
import { spotlightChart } from './spotlight';
import { treemapChart } from './treemap';
import { staffMixChart } from './staffMix';
import { staffLeadersChart } from './staffLeaders';

/** Aggregate every chart in this folder. Add new charts here. */
export function buildCharts(): ChartSpec[] {
  // 'My charts' first = the default tab; market total on top, top-8 second.
  return [marketChart(), topBrokersChart(), treemapChart(), leaderboardChart(), spotlightChart(), staffMixChart(), staffLeadersChart()];
}
