import type { ChartSpec } from '../../types';
import { brokerProfiles, type BrokerProfile } from '../data/processed/brokerProfiles';
import { staffCategories } from '../data/processed/employeeStats';

/** Broker directory: searchable list, click a row for the full profile. */

const categoryLabel = new Map(staffCategories.map((c) => [c.category, c.label]));

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

const rows = [...brokerProfiles].sort((a, b) => a.symbol.localeCompare(b.symbol));

function websiteUrl(raw: string): string {
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function detailHtml(b: BrokerProfile): string {
  const contactEntries: [string, string | null][] = [
    ['Хаяг', b.contact.address],
    ['Утас', b.contact.phone],
    ['И-мэйл', b.contact.email],
    ['Цагийн хуваарь', b.contact.timetable],
  ];
  const contact = contactEntries
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`)
    .join('');
  const website = b.contact.website
    ? `<div class="kv"><span>Цахим хуудас</span><span><a href="${esc(websiteUrl(b.contact.website))}" target="_blank" rel="noreferrer">${esc(b.contact.website)}</a></span></div>`
    : '';

  const activities = Object.entries(b.activities)
    .map(([k, v]) => `<span class="chip${v ? ' on' : ''}">${v ? '✓' : '—'} ${esc(k)}</span>`)
    .join('');

  const staff = Object.entries(b.staff_by_category)
    .sort(([, a], [, z]) => z - a)
    .map(([k, v]) => `<span class="chip on">${esc(categoryLabel.get(k) ?? k)}: ${v}</span>`)
    .join('');

  const holders = (list: { fullName: string; position?: string; share: number | null }[]) =>
    list.length
      ? `<ul class="person-list">${list
          .map(
            (h) =>
              `<li><b>${esc(h.fullName)}</b>${h.position ? ` · ${esc(h.position)}` : ''}${
                h.share != null ? ` — <b>${h.share}%</b>` : ''
              }</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">Мэдээлэл алга</p>';

  const staff_list =
    b.employees.length > 0
      ? `<ul class="person-list">${b.employees
          .map((e) => `<li><b>${esc(e.fullName)}</b>${e.position ? ` · ${esc(e.position)}` : ''}</li>`)
          .join('')}</ul>`
      : '<p class="muted">Мэдээлэл алга</p>';

  const board =
    b.board.length > 0
      ? `<ul class="person-list">${b.board
          .map((m) => `<li><b>${esc(m.fullName)}</b> · ${esc(m.position)}</li>`)
          .join('')}</ul>`
      : '<p class="muted">Мэдээлэл алга</p>';

  return `
    <div class="profile-head">
      <h3>${esc(b.symbol)} · ${esc(b.name)}</h3>
      <span class="tag">Ажилтан: ${b.staff_total}</span>
    </div>
    <h4>Үйл ажиллагааны чиглэл</h4>
    <div class="chips">${activities}</div>
    <h4>Холбоо барих</h4>
    <div class="kv-list">${website}${contact || '<p class="muted">Мэдээлэл алга</p>'}</div>
    <h4>Ажилтны бүтэц (${b.staff_total})</h4>
    <div class="chips">${staff || '<p class="muted">Мэдээлэл алга</p>'}</div>
    <h4>Хувьцаа эзэмшигчид — иргэн</h4>
    ${holders(b.shareholders_individual)}
    <h4>Хувьцаа эзэмшигчид — байгууллага</h4>
    ${holders(b.shareholders_org)}
    <h4>ТУЗ</h4>
    ${board}
    <h4>Боловсон хүчин (${b.employees.length})</h4>
    ${staff_list}`;
}

export function brokersChart(): ChartSpec {
  const body = `
    <label class="control-label" for="brokers-search">Хайх
      <input id="brokers-search" type="search" placeholder="Симбол эсвэл нэр…" />
    </label>
    <div class="table-wrap broker-list">
      <table>
        <thead><tr><th>№</th><th>Симбол</th><th>Нэр</th><th>Ажилтан</th></tr></thead>
        <tbody id="brokers-rows">
          ${rows
            .map(
              (b, i) =>
                `<tr data-symbol="${esc(b.symbol)}"><td>${i + 1}</td><td><b>${esc(b.symbol)}</b></td><td>${esc(b.name)}</td><td>${b.staff_total}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div id="broker-detail" class="broker-detail"></div>`;

  return {
    id: 'brokers',
    title: 'Брокерууд',
    tab: 'Брокерүүд',
    description: 'Гишүүн брокеруудын жагсаалт — мөр дээр дарж дэлгэрэнгүй мэдээллийг харна уу.',
    customBody: body,
    onCustomMounted: (card) => {
      const detail = card.querySelector<HTMLElement>('#broker-detail')!;
      const search = card.querySelector<HTMLInputElement>('#brokers-search')!;
      const rowEls = [...card.querySelectorAll<HTMLTableRowElement>('#brokers-rows tr')];
      const bySymbol = new Map(rows.map((b) => [b.symbol, b]));

      const select = (symbol: string) => {
        const b = bySymbol.get(symbol);
        if (!b) return;
        detail.innerHTML = detailHtml(b);
        rowEls.forEach((r) => r.classList.toggle('selected', r.dataset.symbol === symbol));
        detail.scrollIntoView({ block: 'nearest' });
      };

      rowEls.forEach((r) =>
        r.addEventListener('click', () => select(r.dataset.symbol ?? '')),
      );
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        rowEls.forEach((r) => {
          const b = bySymbol.get(r.dataset.symbol ?? '');
          const hay = `${b?.symbol ?? ''} ${b?.name ?? ''}`.toLowerCase();
          r.hidden = q !== '' && !hay.includes(q);
        });
      });

      select(rows[0]?.symbol ?? '');
    },
  };
}
