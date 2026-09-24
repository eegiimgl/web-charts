import type { ChartSpec } from '../../types';
import { forecast } from '../data/processed/forecast';

// Demo: https://apexcharts.com/javascript-chart-demos/streamgraph-charts/streamgraph-many-series/
// OT HNL1 payable volumes (t) as a smooth stacked area ("stream").
// Copper outweighs gold/silver ~50000:1, so a scale toggle is included:
// raw tonnes, or indexed to 2025 = 100 to compare trajectories.

const METAL_LABELS: Record<string, string> = {
  copper: 'Зэс',
  gold: 'Алт',
  silver: 'Мөнгө',
};

type Scale = 'raw' | 'index';

const years = forecast.years.map(String);

function baseOf(metal: string): number[] {
  const s = forecast.series.find(
    (x) => x.scenario === 'ot-hnl1' && x.metal === metal && x.kind === 'volume',
  )!;
  return forecast.years.map((y) => s.yearly[String(y)]);
}

function tonnesFormatter(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return `${v}`;
}

function tonnesTooltip(v?: number): string {
  return v == null ? '—' : `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} тн`;
}

function seriesFor(scale: Scale) {
  return ['copper', 'gold', 'silver'].map((metal) => {
    const base = baseOf(metal);
    const data =
      scale === 'raw'
        ? base.map((v) => Math.round(v * 100) / 100)
        : base.map((v) => Math.round((v / base[0]) * 1000) / 10);
    return { name: METAL_LABELS[metal], data };
  });
}

export function volumesChart(): ChartSpec {
  return {
    id: 'volumes-stream',
    title: 'Баяжмал дахь төлбөртэй металл — OT HNL1',
    description:
      'Зэс, алт, мөнгөний жилийн хэмжээ (тн). Зэс давамгайлдаг тул хуваарь сольгож 2025=100 индексээр харьцуулж болно; легенд дээр дарж металл нууж/харуулна.',
    height: 420,
    controls: `
      <label class="control-label" for="volumes-scale">Хуваарь
        <select id="volumes-scale">
          <option value="raw" selected>Тонн</option>
          <option value="index">Индекс (2025=100)</option>
        </select>
      </label>`,
    options: {
      chart: { type: 'area', stacked: true, toolbar: { show: true }, zoom: { enabled: true } },
      series: seriesFor('raw'),
      xaxis: { categories: years, tickAmount: 8, title: { text: 'Он' } },
      yaxis: { labels: { formatter: tonnesFormatter }, title: { text: 'тн' } },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.6, opacityTo: 0.1 } },
      dataLabels: { enabled: false },
      legend: { position: 'top' },
      tooltip: { y: { formatter: tonnesTooltip } },
    },
    onMounted: (card, chart) => {
      const scale = card.querySelector<HTMLSelectElement>('#volumes-scale');
      scale?.addEventListener('change', () => {
        if (!scale) return;
        const indexed = scale.value === 'index';
        void chart.updateOptions({
          series: seriesFor(indexed ? 'index' : 'raw'),
          yaxis: {
            labels: { formatter: indexed ? (v: number) => `${v}` : tonnesFormatter },
            title: { text: indexed ? 'индекс' : 'тн' },
          },
          tooltip: {
            y: {
              formatter: (v?: number) =>
                v == null ? '—' : indexed ? `${v}` : tonnesTooltip(v),
            },
          },
        });
      });
    },
  };
}
