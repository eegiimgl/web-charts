import type ApexChartsType from 'apexcharts';
import type { UseCase } from '../cases/types';

export async function renderCaseDetail(
  el: HTMLElement,
  useCase: UseCase,
  initialTab = 0,
): Promise<void> {
  const { meta, charts, dataTable } = useCase;

  // Group charts into tabs by `tab` label (appearance order). No tab bar for one group.
  const groups: { label: string; charts: typeof charts }[] = [];
  for (const c of charts) {
    const label = c.tab ?? charts[0].tab ?? 'Charts';
    const g = groups.find((g) => g.label === label) ?? groups[groups.push({ label, charts: [] }) - 1];
    g.charts.push(c);
  }
  // Deep-linkable tab: #/c/:slug/t/:n (clamped).
  const activeTab = initialTab >= 0 && initialTab < groups.length ? initialTab : 0;

  el.innerHTML = `
    <a class="back" href="#/">← Бүх кейс</a>
    <section class="case-head">
      <div>
        <h1>${meta.title}</h1>
        <p class="tagline">${meta.tagline}</p>
        <p>${meta.description}</p>
        <div class="meta-row">
          ${meta.chartTypes.map((t) => `<span class="badge">${t}</span>`).join('')}
          ${meta.tags.map((t) => `<span class="tag">#${t}</span>`).join('')}
          ${meta.sourceUrl ? `<a class="source-link" href="${meta.sourceUrl}" target="_blank" rel="noreferrer">${meta.sourceLabel ?? 'Өгөгдлийн эх сурвалж'} ↗</a>` : ''}
          ${meta.ownerName ? `<span class="tag">Өгөгдөл эзэмшигч: ${meta.ownerUrl ? `<a class="source-link" href="${meta.ownerUrl}" target="_blank" rel="noreferrer">${meta.ownerName} ↗</a>` : meta.ownerName}</span>` : ''}
        </div>
      </div>
    </section>

    <section class="charts">
      ${groups.length > 1
        ? `<div class="tabs" role="tablist">${groups
            .map(
              (g, i) =>
                `<button class="tab-btn${i === activeTab ? ' active' : ''}" data-tab="${i}" role="tab">${g.label}</button>`,
            )
            .join('')}</div>`
        : ''}
      ${groups
        .map((g, gi) =>
          g.charts
            .map(
              (c) => `
        <article class="chart-card" data-spec="${c.id}" data-tabpanel="${gi}"${gi !== activeTab ? ' hidden' : ''}>
          <h2>${c.title}</h2>
          ${c.description ? `<p class="chart-desc">${c.description}</p>` : ''}
          ${c.customBody
            ? `<div class="custom-body">${c.customBody}</div>`
            : `${c.controls ? `<div class="chart-controls">${c.controls}</div>` : ''}
               <div id="chart-${meta.slug}-${c.id}" class="chart"></div>`}
        </article>`,
            )
            .join(''),
        )
        .join('')}
    </section>

    ${
      dataTable
        ? `<section class="data-table">
             <h2>Үндсэн өгөгдөл</h2>
             <div class="table-wrap">
               <table>
                 <thead><tr>${dataTable.columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
                 <tbody>
                   ${dataTable.rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join('')}</tr>`).join('')}
                 </tbody>
               </table>
             </div>
           </section>`
        : ''
    }
  `;

  // Mount charts after DOM insert. Destroy on route change to avoid leaks.
  // ApexCharts is lazy-loaded so the home page stays light.
  const { default: ApexCharts } = await import('apexcharts');
  const instances: ApexChartsType[] = [];
  groups.forEach((g) => {
    for (const c of g.charts) {
      const card = el.querySelector<HTMLElement>(`[data-spec="${c.id}"]`);
      if (!card) continue;
      if (c.customBody) {
        if (c.onCustomMounted) c.onCustomMounted(card);
        continue;
      }
      const node = card.querySelector(`#chart-${meta.slug}-${c.id}`);
      if (!node) continue;
      const chart = new ApexCharts(node, {
        ...(c.options ?? {}),
        chart: { foreColor: '#c9cfe6', height: c.height ?? 350, ...(c.options?.chart ?? {}) },
        // Cards are dark: light axis/legend text, dark tooltip, visible grid.
        tooltip: { theme: 'dark', ...(c.options?.tooltip ?? {}) },
        grid: { borderColor: '#2b3252', ...(c.options?.grid ?? {}) },
      });
      chart.render();
      instances.push(chart);
      if (c.onMounted) c.onMounted(card, chart);
    }
  });

  // Tab switching: show one panel, then let charts re-measure
  // (ApexCharts in a hidden container mis-measures; window resize fixes it).
  el.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tab);
      el.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((b) =>
        b.classList.toggle('active', b === btn),
      );
      el.querySelectorAll<HTMLElement>('.chart-card').forEach((card) => {
        card.hidden = card.dataset.tabpanel !== String(idx);
      });
      // Shareable URL without a full re-route (replaceState skips hashchange).
      history.replaceState(null, '', `#/c/${meta.slug}/t/${idx}`);
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  });
  window.addEventListener(
    'hashchange',
    () => {
      for (const chart of instances) void chart.destroy();
    },
    { once: true },
  );
}
