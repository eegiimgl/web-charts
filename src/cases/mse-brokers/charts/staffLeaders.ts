import type { ChartSpec } from '../../types';
import { brokerStaff, staffCategories } from '../data/processed/employeeStats';

// Demo: https://apexcharts.com/javascript-chart-demos/bar-charts/basic-bar/
// Top-10 brokers by headcount in the chosen staff category (ангилал).

const labelByCategory = new Map(staffCategories.map((c) => [c.category, c.label]));
const totalByCategory = new Map(
  staffCategories.map((c) => [
    c.category,
    brokerStaff.reduce((s, r) => s + Number(r[c.category] ?? 0), 0),
  ]),
);

function topFor(category: string) {
  return brokerStaff
    .map((r) => ({ symbol: r.symbol, name: r.name, count: Number(r[category] ?? 0) }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .reverse(); // ascending so the largest bar lands on top
}

function optionLabel(category: string): string {
  return `${labelByCategory.get(category) ?? category} (${totalByCategory.get(category) ?? 0})`;
}

const DEFAULT_CATEGORY = 'broker';

export function staffLeadersChart(): ChartSpec {
  const initial = topFor(DEFAULT_CATEGORY);

  return {
    id: 'staff-leaders',
    title: `Ангиллаар топ 10 — ${labelByCategory.get(DEFAULT_CATEGORY)}`,
    tab: 'Боловсон хүчин',
    description:
      'Сонгосон ангилалд хамгийн олон ажилтантай 10 брокер. Хаалтанд буй тоо нь тухайн ангиллын нийт толгойн тоо.',
    height: 460,
    controls: `
      <label class="control-label" for="staffleaders-category">Ангилал
        <select id="staffleaders-category">
          ${staffCategories.map((c) => `<option value="${c.category}"${c.category === DEFAULT_CATEGORY ? ' selected' : ''}>${optionLabel(c.category)}</option>`).join('')}
        </select>
      </label>`,
    options: {
      chart: { type: 'bar', toolbar: { show: true } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      series: [{ name: 'Ажилтан', data: initial.map((t) => t.count) }],
      xaxis: {
        categories: initial.map((t) => `${t.symbol} · ${t.name.slice(0, 28)}`),
      },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: (v?: number) => (v == null ? '—' : `${v} ажилтан`) } },
    },
    onMounted: (card, chart) => {
      const select = card.querySelector<HTMLSelectElement>('#staffleaders-category');
      const title = card.querySelector('h2');
      select?.addEventListener('change', () => {
        if (!select) return;
        const leaders = topFor(select.value);
        if (title) title.textContent = `Ангиллаар топ 10 — ${labelByCategory.get(select.value)}`;
        void chart.updateOptions({
          xaxis: { categories: leaders.map((t) => `${t.symbol} · ${t.name.slice(0, 28)}`) },
          series: [{ name: 'Ажилтан', data: leaders.map((t) => t.count) }],
        });
      });
    },
  };
}
