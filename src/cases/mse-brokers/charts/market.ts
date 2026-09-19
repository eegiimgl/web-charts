import type { ChartSpec } from '../../types';
import { marketTotals, type MarketTotal } from '../data/processed/marketTotals';
import { axisBillions, tooltipTugrik } from './format';
import { METRICS, type Metric } from './metrics';

// Demo: https://apexcharts.com/javascript-chart-demos/area-charts/basic-area/
// Market-wide monthly series, switchable between total and IPO/stocks/bonds/other.

const SERIES_NAMES: Record<Metric, string> = {
  total: 'Зах зээлийн нийт',
  ipo: 'Зах зээлийн IPO',
  stocks: 'Зах зээлийн хувьцаа',
  bonds: 'Зах зээлийн бонд',
  other: 'Зах зээлийн бусад',
};

const rows = [...marketTotals].sort((a, b) => a.period.localeCompare(b.period));
const categories = rows.map((r) => r.period);

function valueOf(r: MarketTotal, metric: Metric): number | null {
  if (metric === 'total') return Math.round(r.monthly_total);
  if (metric === 'other') {
    return Math.max(0, Math.round(r.monthly_total - (r.ipo ?? 0) - (r.stocks ?? 0) - (r.bonds ?? 0)));
  }
  return r[metric] == null ? null : Math.round(r[metric] as number);
}

function seriesFor(metric: Metric) {
  return [{ name: SERIES_NAMES[metric], data: rows.map((r) => valueOf(r, metric)) }];
}

/** Market-wide monthly series, 2014 → 2026. */
export function marketChart(): ChartSpec {
  return {
    id: 'market-total',
    title: 'Зах зээлийн сарын нийт дүн',
    tab: 'Миний графикууд',
    description:
      'Бүх зах зээлийн сарын цуваа (₮). Метрик сонгож зах зээлийг IPO, хувьцаа, бонд болон бусдад задална.',
    height: 380,
    controls: `
      <label class="control-label" for="market-metric">Метрик
        <select id="market-metric">
          ${METRICS.map((m) => `<option value="${m.id}"${m.id === 'total' ? ' selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>`,
    options: {
      chart: { type: 'area', toolbar: { show: true }, zoom: { enabled: true } },
      series: seriesFor('total'),
      xaxis: { categories, tickAmount: 12, title: { text: 'Сар' } },
      yaxis: { labels: { formatter: axisBillions }, title: { text: '₮ (тэрбумаар)' } },
      stroke: { curve: 'straight', width: 2 },
      markers: { size: 0 },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.5, opacityTo: 0.05 },
      },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v?: number) => (v == null ? '—' : tooltipTugrik(v)) } },
    },
    onMounted: (card, chart) => {
      const metric = card.querySelector<HTMLSelectElement>('#market-metric');
      metric?.addEventListener('change', () => {
        if (!metric) return;
        void chart.updateSeries(seriesFor(metric.value as Metric));
      });
    },
  };
}
