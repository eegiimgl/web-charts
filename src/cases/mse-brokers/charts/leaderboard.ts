import type { ChartSpec } from '../../types';
import {
  latestPeriod,
  monthlyTotalsDeduped,
  periods,
  type MonthlyTotal,
} from '../data/processed/monthlyTotals';
import { tooltipTugrik } from './format';
import { METRICS, type Metric } from './metrics';

const TOP_N = 15;

function valueOf(r: MonthlyTotal, metric: Metric): number | null {
  if (metric === 'total') return Math.round(r.monthly_total);
  if (metric === 'other') {
    return Math.max(
      0,
      Math.round(r.monthly_total - (r.ipo ?? 0) - (r.stocks ?? 0) - (r.bonds ?? 0)),
    );
  }
  return r[metric] == null ? null : Math.round(r[metric] as number);
}

function seriesName(metric: Metric): string {
  return metric === 'total' ? 'Нийт арилжаа' : (METRICS.find((m) => m.id === metric)?.label ?? metric);
}

function topFor(period: string, metric: Metric) {
  return monthlyTotalsDeduped
    .filter((r) => r.period === period)
    .map((r) => ({ r, v: valueOf(r, metric) }))
    .filter((x): x is { r: MonthlyTotal; v: number } => x.v != null && x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, TOP_N)
    .map((x) => x.r)
    .reverse(); // ascending so the largest bar lands on top
}

/** Horizontal leaderboard: largest brokers in the chosen month and metric. */
export function leaderboardChart(): ChartSpec {
  const initial = topFor(latestPeriod, 'total');

  return {
    id: 'leaderboard',
    title: `Чансаа — ${latestPeriod}`,
    tab: 'Миний графикууд',
    description: `Шилдэг ${TOP_N} брокер. Сар болон метрик сонгож дахин эрэмбэлнэ.`,
    height: 480,
    controls: `
      <label class="control-label" for="leaderboard-month">Сар
        <select id="leaderboard-month">
          ${periods.map((p) => `<option value="${p}"${p === latestPeriod ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </label>
      <label class="control-label" for="leaderboard-metric">Метрик
        <select id="leaderboard-metric">
          ${METRICS.map((m) => `<option value="${m.id}"${m.id === 'total' ? ' selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>`,
    options: {
      chart: { type: 'bar', toolbar: { show: true } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      series: [
        {
          name: 'Нийт арилжаа',
          data: initial.map((r) => valueOf(r, 'total') as number),
        },
      ],
      xaxis: {
        categories: initial.map((r) => `${r.code} · ${r.name.slice(0, 28)}`),
        labels: {
          formatter: (v: string) => `₮${(Number(v) / 1e9).toFixed(1)}тб`,
        },
      },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: tooltipTugrik } },
    },
    onMounted: (card, chart) => {
      const month = card.querySelector<HTMLSelectElement>('#leaderboard-month');
      const metric = card.querySelector<HTMLSelectElement>('#leaderboard-metric');
      const title = card.querySelector('h2');
      const refresh = () => {
        if (!month || !metric) return;
        const m = metric.value as Metric;
        const top = topFor(month.value, m);
        if (title) title.textContent = `Чансаа — ${month.value}`;
        void chart.updateOptions({
          xaxis: { categories: top.map((r) => `${r.code} · ${r.name.slice(0, 28)}`) },
          series: [
            {
              name: seriesName(m),
              data: top.map((r) => valueOf(r, m) as number),
            },
          ],
        });
      };
      month?.addEventListener('change', refresh);
      metric?.addEventListener('change', refresh);
    },
  };
}
