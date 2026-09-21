import './styles.css';
import { cases, getCase } from './cases/registry';
import { renderHome } from './pages/home';
import { renderCaseDetail } from './pages/case';

const app = document.getElementById('app')!;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** SPA page-view: every hash route (home, case, tab) is a distinct view. */
function trackPageView(): void {
  window.gtag?.('event', 'page_view', {
    page_path: `${window.location.pathname}${window.location.hash || '#/'}`,
    page_title: document.title,
  });
}

function shell(inner: string): string {
  return `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="#/">
          <span class="brand-mark">◧</span>
          <span class="brand-text">web-charts <em>· eegii.dev</em></span>
        </a>
        <nav class="nav">
          <a href="#/">Бүх кейс</a>
          <a href="https://apexcharts.com/javascript-chart-demos" target="_blank" rel="noreferrer">ApexCharts демо ↗</a>
        </nav>
      </div>
    </header>
    <main class="container">${inner}</main>
    <footer class="site-footer">
      <div class="container">
        <span>${cases.length} кейс · ApexCharts ашиглан бүтээв</span>
      </div>
    </footer>
  `;
}

async function route(): Promise<void> {
  const hash = window.location.hash || '#/';
  const match = hash.match(/^#\/c\/([\w-]+)(?:\/t\/(\d+))?/);

  if (match) {
    const entry = getCase(match[1]);
    if (!entry) {
      app.innerHTML = shell(`
        <section class="empty">
          <h1>Кейс олдсонгүй</h1>
          <p><code>${match[1]}</code> slug-тай кейс байхгүй байна.</p>
          <a class="btn" href="#/">← Бүх кейс рүү буцах</a>
        </section>`);
      trackPageView();
      return;
    }
    app.innerHTML = shell(`<div id="page"></div>`);
    const page = document.getElementById('page')!;
    page.innerHTML = `<section class="empty"><p>Графикууд ачааллаж байна…</p></section>`;
    try {
      renderCaseDetail(page, await entry.load(), Number(match[2] ?? 0));
    } catch (err) {
      console.error(err);
      page.innerHTML = `<section class="empty">
        <h1>Кейс ачааллахад алдаа гарлаа</h1>
        <p>Дахин оролдоно уу.</p>
        <a class="btn" href="#/">← Бүх кейс рүү буцах</a>
      </section>`;
    }
    trackPageView();
    return;
  }

  app.innerHTML = shell(`<div id="page"></div>`);
  renderHome(document.getElementById('page')!, cases);
  trackPageView();
}

window.addEventListener('hashchange', () => {
  void route();
});
void route();
