import type { ChartSpec } from '../../types';
import { forecast } from '../data/processed/forecast';

// Demo: https://apexcharts.com/javascript-chart-demos/column-charts/basic-column/
// Yearly revenue ($M) by metal: TRQ 2022 case (fixed) vs 2026 price scenario,
// whose prices are editable inputs (revenue = OT HNL1 volume × price).

const METALS = ['copper', 'gold', 'silver'] as const;
type Metal = (typeof METALS)[number];

const METAL_LABELS: Record<Metal, string> = {
  copper: 'Зэс',
  gold: 'Алт',
  silver: 'Мөнгө',
};

const years = forecast.years.map(String);

function findSeries(scenario: string, metal: string, kind: string) {
  const s = forecast.series.find((x) => x.scenario === scenario && x.metal === metal && x.kind === kind);
  if (!s) throw new Error(`series missing: ${scenario}/${metal}/${kind}`);
  return s;
}

const volumes: Record<Metal, number[]> = {
  copper: years.map((y) => findSeries('ot-hnl1', 'copper', 'volume').yearly[y]),
  gold: years.map((y) => findSeries('ot-hnl1', 'gold', 'volume').yearly[y]),
  silver: years.map((y) => findSeries('ot-hnl1', 'silver', 'volume').yearly[y]),
};

const trqRevenue: Record<Metal, number[]> = {
  copper: years.map((y) => findSeries('trq-2022', 'copper', 'revenue').yearly[y]),
  gold: years.map((y) => findSeries('trq-2022', 'gold', 'revenue').yearly[y]),
  silver: years.map((y) => findSeries('trq-2022', 'silver', 'revenue').yearly[y]),
};

// Sheet's 2026-scenario flat prices ($/t) as input defaults.
const DEFAULT_PRICES: Record<Metal, number> = {
  copper: 14500,
  gold: 140400000,
  silver: 2130000,
};

function scenarioRevenue(metal: Metal, price: number): number[] {
  return volumes[metal].map((v) => Math.round((v * price) / 1e6 * 100) / 100);
}

function moneyFormatter(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

function seriesFor(metal: Metal, price: number) {
  return [
    { name: 'TRQ 2022', data: trqRevenue[metal].map(Math.round) },
    { name: `2026 үнэ ($${price.toLocaleString('en-US')}/тн)`, data: scenarioRevenue(metal, price) },
  ];
}

export function revenueChart(): ChartSpec {
  return {
    id: 'revenue-estimate',
    title: 'Орлогын тооцоо — үнийн хувилбарууд',
    description:
      'Металл сонгож, 2026 оны хувилбарын үнийг өөрчилж орлогыг шууд дахин тооцоолно (эзлэхүүн × үнэ). TRQ 2022 цуваа тогтмол.',
    height: 420,
    controls: `
      <label class="control-label" for="revenue-metal">Металл
        <select id="revenue-metal">
          ${METALS.map((m) => `<option value="${m}"${m === 'copper' ? ' selected' : ''}>${METAL_LABELS[m]}</option>`).join('')}
        </select>
      </label>
      ${METALS.map(
        (m) => `
        <label class="control-label" for="revenue-price-${m}">${METAL_LABELS[m]} үнэ ($/тн)
          <input id="revenue-price-${m}" type="number" min="0" step="any" value="${DEFAULT_PRICES[m]}" />
        </label>`,
      ).join('')}`,
    options: {
      chart: { type: 'bar', toolbar: { show: true }, zoom: { enabled: true } },
      plotOptions: { bar: { horizontal: false, columnWidth: '70%', borderRadius: 2 } },
      series: seriesFor('copper', DEFAULT_PRICES.copper),
      xaxis: { categories: years, tickAmount: 8, title: { text: 'Он' } },
      yaxis: { labels: { formatter: moneyFormatter }, title: { text: '$M' } },
      dataLabels: { enabled: false },
      legend: { position: 'top' },
      tooltip: {
        y: {
          formatter: (v?: number) =>
            v == null ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}M`,
        },
      },
    },
    onMounted: (card, chart) => {
      const metal = card.querySelector<HTMLSelectElement>('#revenue-metal');
      const prices = {
        copper: card.querySelector<HTMLInputElement>('#revenue-price-copper'),
        gold: card.querySelector<HTMLInputElement>('#revenue-price-gold'),
        silver: card.querySelector<HTMLInputElement>('#revenue-price-silver'),
      };
      const refresh = () => {
        if (!metal) return;
        const m = metal.value as Metal;
        const price = Number(prices[m]?.value) || 0;
        void chart.updateSeries(seriesFor(m, price));
      };
      metal?.addEventListener('change', refresh);
      (Object.values(prices) as (HTMLInputElement | null)[]).forEach((input) =>
        input?.addEventListener('input', refresh),
      );
    },
  };
}
