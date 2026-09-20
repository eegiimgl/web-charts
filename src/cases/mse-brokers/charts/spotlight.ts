import type { ChartSpec } from '../../types';
import { brokerList } from '../data/processed/brokers';
import {
  latestPeriod,
  monthlyTotalsDeduped,
  periods,
  totalByPeriodCode,
} from '../data/processed/monthlyTotals';
import { axisBillions, tooltipTugrik } from './format';
import { METRICS, type Metric } from './metrics';

// Demo: https://apexcharts.com/javascript-chart-demos/column-charts/stacked-column/
// Each month stacked: IPO + stocks (ХУВЬЦАА) + bonds + other (remainder to Нийт арилжаа).

const latestTotals = new Map(
  monthlyTotalsDeduped.filter((r) => r.period === latestPeriod).map((r) => [r.code, r.monthly_total]),
);
const nameByCode = new Map(brokerList.map((b) => [b.code, b.name]));

const orderedCodes: string[] = [...brokerList.map((b) => b.code)].sort((a, b) => {
  const ta = latestTotals.get(a);
  const tb = latestTotals.get(b);
  if (ta != null && tb != null) return tb - ta;
  if (ta != null) return -1;
  if (tb != null) return 1;
  return a.localeCompare(b);
});

const DEFAULT_CODE = orderedCodes[0];

interface SpotlightSeries {
  ipo: (number | null)[];
  stocks: (number | null)[];
  bonds: (number | null)[];
  other: (number | null)[];
}

function seriesFor(code: string): SpotlightSeries {
  const ipo: (number | null)[] = [];
  const stocks: (number | null)[] = [];
  const bonds: (number | null)[] = [];
  const other: (number | null)[] = [];
  for (const p of periods) {
    const row = totalByPeriodCode.get(`${p}|${code}`);
    if (!row) {
      ipo.push(null);
      stocks.push(null);
      bonds.push(null);
      other.push(null);
      continue;
    }
    const i = Math.round(row.ipo ?? 0);
    const s = Math.round(row.stocks ?? 0);
    const b = Math.round(row.bonds ?? 0);
    ipo.push(i);
    stocks.push(s);
    bonds.push(b);
    // Remainder to the monthly total (block trades etc.; also covers eras with no IPO column).
    other.push(Math.max(0, Math.round(row.monthly_total) - i - s - b));
  }
  return { ipo, stocks, bonds, other };
}

const SERIES_NAMES: Record<Exclude<Metric, 'total'>, string> = {
  ipo: 'IPO',
  stocks: 'Хувьцаа',
  bonds: 'Бонд',
  other: 'Бусад',
};

function toApexSeries(s: SpotlightSeries, metric: Metric) {
  if (metric === 'total') {
    return [
      { name: 'IPO', data: s.ipo },
      { name: 'Хувьцаа', data: s.stocks },
      { name: 'Бонд', data: s.bonds },
      { name: 'Бусад', data: s.other },
    ];
  }
  return [{ name: SERIES_NAMES[metric], data: s[metric] }];
}

function optionLabel(code: string): string {
  const name = nameByCode.get(code) ?? code;
  const short = name.length > 34 ? `${name.slice(0, 34)}…` : name;
  return `${code} · ${short}`;
}

export function spotlightChart(): ChartSpec {
  const initial = seriesFor(DEFAULT_CODE);

  return {
    id: 'spotlight',
    title: 'Брокерын тойм',
    tab: 'Миний графикууд',
    description:
      'Брокер болон метрик сонгоно: нийтээр нь сар бүрийг IPO, хувьцаа, бонд болон бусдад задалж харуулна.',
    height: 420,
    controls: `
      <label class="control-label" for="spotlight-broker">Брокер
        <select id="spotlight-broker">
          ${orderedCodes.map((c) => `<option value="${c}"${c === DEFAULT_CODE ? ' selected' : ''}>${optionLabel(c)}</option>`).join('')}
        </select>
      </label>
      <label class="control-label" for="spotlight-metric">Метрик
        <select id="spotlight-metric">
          ${METRICS.map((m) => `<option value="${m.id}"${m.id === 'total' ? ' selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </label>`,
    options: {
      chart: {
        type: 'bar',
        stacked: true,
        toolbar: {
          show: true,
          export: {
            csv: { filename: 'mse-broker-spotlight', headerCategory: 'month' },
            svg: { filename: 'mse-broker-spotlight' },
            png: { filename: 'mse-broker-spotlight' },
          },
          autoSelected: 'zoom',
        },
        zoom: { enabled: true },
      },
      plotOptions: { bar: { horizontal: false, borderRadius: 0 } },
      series: toApexSeries(initial, 'total'),
      xaxis: { categories: periods, tickAmount: 12, title: { text: 'Сар' } },
      yaxis: { labels: { formatter: axisBillions }, title: { text: '₮ (тэрбумаар)' } },
      dataLabels: { enabled: false },
      legend: { position: 'top' },
      tooltip: { y: { formatter: (v?: number) => (v == null ? '—' : tooltipTugrik(v)) } },
    },
    onMounted: (card, chart) => {
      const broker = card.querySelector<HTMLSelectElement>('#spotlight-broker');
      const metric = card.querySelector<HTMLSelectElement>('#spotlight-metric');
      const refresh = () => {
        if (!broker || !metric) return;
        void chart.updateSeries(
          toApexSeries(seriesFor(broker.value), metric.value as Metric),
        );
      };
      broker?.addEventListener('change', refresh);
      metric?.addEventListener('change', refresh);
    },
  };
}
