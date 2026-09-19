import type { ChartSpec } from '../../types';
import {
  latestPeriod,
  monthlyTotalsDeduped,
  periods,
  totalByPeriodCode,
  type MonthlyTotal,
} from '../data/processed/monthlyTotals';
import { axisBillions, tooltipTugrik } from './format';
import { METRICS, type Metric } from './metrics';

const TOP_N = 8;

function valueOf(row: MonthlyTotal, metric: Metric): number | null {
  if (metric === 'total') return Math.round(row.monthly_total);
  if (metric === 'other') {
    return Math.max(
      0,
      Math.round(row.monthly_total - (row.ipo ?? 0) - (row.stocks ?? 0) - (row.bonds ?? 0)),
    );
  }
  return row[metric] == null ? null : Math.round(row[metric] as number);
}

/** Top brokers by latest-month value of the metric, with full monthly series. */
function seriesFor(metric: Metric) {
  const topCodes = monthlyTotalsDeduped
    .filter((r) => r.period === latestPeriod)
    .map((r) => ({ code: r.code, v: valueOf(r, metric) ?? 0 }))
    .sort((a, b) => b.v - a.v)
    .slice(0, TOP_N)
    .map((r) => r.code);

  return topCodes.map((code) => ({
    name: code,
    data: periods.map((p) => {
      const row = totalByPeriodCode.get(`${p}|${code}`);
      return row ? valueOf(row, metric) : null;
    }),
  }));
}

/** Monthly series for the top 8 brokers of the latest month, per selectable metric. */
export function topBrokersChart(): ChartSpec {
  return {
    id: 'top-brokers',
    title: `Тэргүүлэх ${TOP_N} брокер — хугацааны турш`,
    tab: 'Миний графикууд',
    description: `${latestPeriod} сарын ${TOP_N} том брокерын сарын утгууд. Метрик сонгож дахин эрэмбэлж, дахин зурна. Тасарсан цэг нь тухайн сарын тайланд брокер ороогүй гэсэн үг.`,
    height: 420,
    controls: `
      <label class="control-label" for="topbrokers-metric">Метрик
        <select id="topbrokers-metric">
          ${METRICS.map((m) => `<option value="${m.id}"${m.id === 'total' ? ' selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>`,
    options: {
      chart: { type: 'line', toolbar: { show: true }, zoom: { enabled: true } },
      series: seriesFor('total'),
      xaxis: { categories: periods, tickAmount: 12, title: { text: 'Сар' } },
      yaxis: { labels: { formatter: axisBillions }, title: { text: '₮ (тэрбумаар)' } },
      stroke: { curve: 'smooth', width: 2.5 },
      dataLabels: { enabled: false },
      legend: { position: 'top' },
      tooltip: { y: { formatter: (v?: number) => (v == null ? '—' : tooltipTugrik(v)) } },
    },
    onMounted: (card, chart) => {
      const metric = card.querySelector<HTMLSelectElement>('#topbrokers-metric');
      metric?.addEventListener('change', () => {
        if (!metric) return;
        void chart.updateSeries(seriesFor(metric.value as Metric));
      });
    },
  };
}
