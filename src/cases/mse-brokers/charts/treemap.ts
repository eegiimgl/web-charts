import type { ChartSpec } from '../../types';
import {
  latestPeriod,
  monthlyTotalsDeduped,
  periods,
  totalByPeriodCode,
} from '../data/processed/monthlyTotals';
import { tooltipTugrik } from './format';
import { METRICS, type Metric } from './metrics';

// Demo: https://apexcharts.com/javascript-chart-demos/treemap-charts/nested-market-map/
// Rect size = broker's value for the chosen metric + month, color = MoM change of the same metric.

function colorFor(change: number | null): string {
  if (change == null) return '#8a90a8';
  if (change >= 20) return '#00A66C';
  if (change >= 0) return '#5BD6A2';
  if (change > -20) return '#F28B82';
  return '#D33F2F';
}

interface TreePoint {
  x: string;
  y: number;
  fillColor: string;
}

function valueOf(
  period: string,
  code: string,
  metric: Metric,
): { value: number; change: number | null } | null {
  const idx = periods.indexOf(period);
  const row = totalByPeriodCode.get(`${period}|${code}`);
  if (!row) return null;
  const raw =
    metric === 'total'
      ? row.monthly_total
      : metric === 'other'
        ? Math.max(
            0,
            row.monthly_total - (row.ipo ?? 0) - (row.stocks ?? 0) - (row.bonds ?? 0),
          )
        : (row[metric] ?? 0);
  const value = Math.round(raw);
  if (value <= 0) return null;
  let change: number | null = null;
  if (idx > 0) {
    const prevRow = totalByPeriodCode.get(`${periods[idx - 1]}|${code}`);
    const prevRaw =
      !prevRow || metric === 'total'
        ? (prevRow?.monthly_total ?? 0)
        : metric === 'other'
          ? Math.max(
              0,
              (prevRow?.monthly_total ?? 0) -
                (prevRow?.ipo ?? 0) -
                (prevRow?.stocks ?? 0) -
                (prevRow?.bonds ?? 0),
            )
          : (prevRow?.[metric] ?? 0);
    if (prevRaw > 0) change = ((raw - prevRaw) / prevRaw) * 100;
  }
  return { value, change };
}

function pointsFor(period: string, metric: Metric): TreePoint[] {
  const pts: TreePoint[] = [];
  for (const r of monthlyTotalsDeduped) {
    if (r.period !== period) continue;
    const v = valueOf(period, r.code, metric);
    if (!v) continue;
    pts.push({ x: r.code, y: v.value, fillColor: colorFor(v.change) });
  }
  return pts.sort((a, b) => b.y - a.y);
}

const state: { period: string; metric: Metric } = { period: latestPeriod, metric: 'total' };

const METRIC_LABELS: Record<Metric, string> = {
  total: 'Нийт',
  ipo: 'IPO',
  stocks: 'Хувьцаа',
  bonds: 'Бонд',
  other: 'Бусад',
};

export function treemapChart(): ChartSpec {
  return {
    id: 'treemap',
    title: 'Сараар брокеруудын зураглал',
    tab: 'Миний графикууд',
    description:
      'Тэгш өнцөгтийн хэмжээ нь сонгосон метрик + сарын брокерын утга. Ногоон = өмнөх сараас өссөн, улаан = буурсан, саарал = өмнөх өгөгдөлгүй.',
    height: 520,
    controls: `
      <label class="control-label" for="treemap-month">Сар
        <select id="treemap-month">
          ${periods.map((p) => `<option value="${p}"${p === latestPeriod ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </label>
      <label class="control-label" for="treemap-metric">Метрик
        <select id="treemap-metric">
          ${METRICS.map((m) => `<option value="${m.id}"${m.id === 'total' ? ' selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>`,
    options: {
      // Toolbar floats above the chart, right of the Month/Metric controls —
      // the treemap has no legend row, so the corner would overlap the rects.
      chart: { type: 'treemap', toolbar: { show: true, offsetY: -40 } },
      series: [{ name: 'Brokers', data: pointsFor(latestPeriod, 'total') }],
      legend: { show: false },
      dataLabels: { enabled: true, style: { fontSize: '12px' } },
      plotOptions: { treemap: { distributed: false, enableShades: false } },
      noData: {
        text: 'Энэ сар/метрикийн хувьд өгөгдөл алга',
        align: 'center',
        verticalAlign: 'middle',
        style: { color: '#a4abc9', fontSize: '14px' },
      },
      tooltip: {
        custom: (opts: {
          seriesIndex: number;
          dataPointIndex: number;
          w: { config: { series: { data: { x: string }[] }[] } };
        }) => {
          const code = opts.w.config.series[opts.seriesIndex].data[opts.dataPointIndex].x;
          const row = totalByPeriodCode.get(`${state.period}|${code}`);
          const v = valueOf(state.period, code, state.metric);
          if (!row || !v) return '';
          return `<div class="treemap-tip">
            <div><b>${code} · ${row.name.slice(0, 40)}</b></div>
            <div>${METRIC_LABELS[state.metric]}: ${tooltipTugrik(v.value)}</div>
            <div>Сарын өөрчлөлт: ${v.change == null ? '—' : `${v.change >= 0 ? '+' : ''}${v.change.toFixed(1)}%`}</div>
          </div>`;
        },
      },
    },
    onMounted: (card, chart) => {
      const month = card.querySelector<HTMLSelectElement>('#treemap-month');
      const metric = card.querySelector<HTMLSelectElement>('#treemap-metric');
      const refresh = () => {
        if (!month || !metric) return;
        state.period = month.value;
        state.metric = metric.value as Metric;
        void chart.updateSeries([
          { name: 'Brokers', data: pointsFor(state.period, state.metric) },
        ]);
      };
      month?.addEventListener('change', refresh);
      metric?.addEventListener('change', refresh);
    },
  };
}
