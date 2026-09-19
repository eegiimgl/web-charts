import type { CaseEntry } from '../cases/types';

export function renderHome(el: HTMLElement, cases: CaseEntry[]): void {
  const cards =
    cases.length === 0
      ? `<section class="empty">
           <h1>Одоогоор кейс байхгүй</h1>
           <p>Эхний кейсээ нэмнэ үү — <code>src/cases/_template</code> хавтсыг хуулж <code>registry.ts</code>-д бүртгэнэ.</p>
         </section>`
      : `<div class="grid">${cases.map(card).join('')}</div>`;

  el.innerHTML = `
    <section class="hero">
      <h1>График дүрслэлийн кейсүүд</h1>
      <p>Карт бүр тусдаа кейс юм: өөрийн өгөгдөл + өөрийн ApexCharts графикууд.
         График болон тоон мэдээллийг үзэхийн тулд нэгийг сонгоно уу.</p>
    </section>
    ${cards}
  `;
}

function card(c: CaseEntry): string {
  const badges = c.meta.chartTypes.map((t) => `<span class="badge">${t}</span>`).join('');
  return `
    <a class="card" href="#/c/${c.meta.slug}">
      <div class="card-top">${badges}</div>
      <h2>${c.meta.title}</h2>
      <p class="tagline">${c.meta.tagline}</p>
      <span class="card-link">График үзэх →</span>
    </a>
  `;
}
