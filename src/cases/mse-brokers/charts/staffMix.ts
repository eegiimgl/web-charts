import type { ChartSpec } from '../../types';
import { brokerStaff, staffCategories, totalStaff } from '../data/processed/employeeStats';

// Demo: https://apexcharts.com/javascript-chart-demos/treemap-charts/distributed/
// One rect per staff category, sized by headcount at the chosen broker.

const orderedSymbols: string[] = [...brokerStaff]
  .sort((a, b) => (b.total as number) - (a.total as number))
  .map((r) => r.symbol);

const nameBySymbol = new Map(brokerStaff.map((r) => [r.symbol, r.name]));

const DEFAULT_SYMBOL = orderedSymbols[0];

const ALL = '__all__';

interface StaffPoint {
  x: string;
  y: number;
}

function pointsFor(symbol: string): StaffPoint[] {
  if (symbol === ALL) {
    // All brokers combined: sum each category across the whole market.
    return staffCategories
      .map((c) => ({
        x: c.label,
        y: brokerStaff.reduce((s, r) => s + Number(r[c.category] ?? 0), 0),
      }))
      .filter((p) => p.y > 0)
      .sort((a, b) => b.y - a.y);
  }
  const row = brokerStaff.find((r) => r.symbol === symbol);
  if (!row) return [];
  return staffCategories
    .map((c) => ({ x: c.label, y: Number(row[c.category] ?? 0) }))
    .filter((p) => p.y > 0)
    .sort((a, b) => b.y - a.y);
}

function optionLabel(symbol: string): string {
  const name = nameBySymbol.get(symbol) ?? symbol;
  const total = brokerStaff.find((r) => r.symbol === symbol)?.total ?? 0;
  const short = name.length > 30 ? `${name.slice(0, 30)}…` : name;
  return `${symbol} · ${short} (${total})`;
}

export function staffMixChart(): ChartSpec {
  return {
    id: 'staff-mix',
    title: 'Ажилтнуудын бүтэц',
    tab: 'Боловсон хүчин',
    description:
      'Сонгосон брокерын ажилтнууд ангиллаар — тэгш өнцөгтийн хэмжээ нь тухайн ангиллын толгойн тоо.',
    height: 460,
    controls: `
      <label class="control-label" for="staffmix-broker">Брокер
        <select id="staffmix-broker">
          <option value="${ALL}">Бүх брокер (${totalStaff})</option>
          ${orderedSymbols.map((s) => `<option value="${s}"${s === DEFAULT_SYMBOL ? ' selected' : ''}>${optionLabel(s)}</option>`).join('')}
        </select>
      </label>`,
    options: {
      // Toolbar floats above the chart, right of the broker picker —
      // the treemap has no legend row, so the corner would overlap the rects.
      chart: { type: 'treemap', toolbar: { show: true, offsetY: -40 } },
      series: [{ name: 'Ажилтан', data: pointsFor(DEFAULT_SYMBOL) }],
      legend: { show: false },
      dataLabels: {
        enabled: true,
        style: { fontSize: '12px' },
        formatter: (text: string, op?: any) => {
          const data = (op?.w?.config?.series?.[op?.seriesIndex ?? 0]?.data ?? []) as { y: number }[];
          const total = data.reduce((s, d) => s + (d.y || 0), 0);
          const value = op?.value ?? 0;
          const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
          return [`${text}`, `${value} (${pct}%)`];
        },
      },
      plotOptions: { treemap: { distributed: true, enableShades: false } },
      tooltip: { y: { formatter: (v?: number) => (v == null ? '—' : `${v} ажилтан`) } },
    },
    onMounted: (card, chart) => {
      const select = card.querySelector<HTMLSelectElement>('#staffmix-broker');
      select?.addEventListener('change', () => {
        if (!select) return;
        void chart.updateSeries([{ name: 'Ажилтан', data: pointsFor(select.value) }]);
      });
    },
  };
}
