import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';

/**
 * A single chart block inside a use-case.
 * Keep each use-case focused: 1–4 charts max.
 */
export interface ChartSpec {
  /** Unique within the case, used as DOM id: `chart-<caseSlug>-<id>` */
  id: string;
  title: string;
  description?: string;
  /** Full ApexCharts options object. Required unless `customBody` is set. */
  options?: ApexOptions;
  /** Optional fixed height, defaults to 350 */
  height?: number;
  /**
   * Tab this chart belongs to (rendered as a tab bar when >1 distinct tab).
   * Charts without a tab join the first tab. E.g. 'Auto generated' / 'My charts'.
   */
  tab?: string;
  /** Optional HTML (e.g. a <select>) rendered above the chart. */
  controls?: string;
  /** Called after the chart renders — wire `controls` events here. */
  onMounted?: (card: HTMLElement, chart: ApexCharts) => void;
  /**
   * Custom non-chart body (directory, tables…). Rendered INSTEAD of a chart.
   * Pair with `onCustomMounted` for interactivity.
   */
  customBody?: string;
  /** Called after a `customBody` renders. */
  onCustomMounted?: (card: HTMLElement) => void;
}

export interface CaseMeta {
  /** URL slug: lowercase, dashes. Folder name must match. e.g. `saas-revenue` */
  slug: string;
  title: string;
  tagline: string;
  description: string;
  /** Tags for filtering on home, e.g. ['finance', 'line'] */
  tags: string[];
  /** ApexCharts demo types used, e.g. ['line', 'donut'] — for badge display */
  chartTypes: string[];
  /** ISO date string of when the case was added */
  dateAdded: string;
  /** Optional data-source link, e.g. the scraped page. */
  sourceUrl?: string;
  /** Label for the source link. Defaults to 'Өгөгдлийн эх сурвалж'. */
  sourceLabel?: string;
}

export interface UseCase {
  meta: CaseMeta;
  charts: ChartSpec[];
  /** Optional raw data table rendered below charts (useful for "show the data" cases) */
  dataTable?: {
    columns: string[];
    rows: (string | number)[][];
  };
}

/**
 * Registry entry: metadata is bundled with the home page (light),
 * the full case (charts + datasets) lazy-loads only when opened.
 */
export interface CaseEntry {
  meta: CaseMeta;
  load: () => Promise<UseCase>;
}
