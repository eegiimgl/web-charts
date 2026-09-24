import type { CaseMeta } from '../types';
import cover from './cover.png';

export const meta: CaseMeta = {
  slug: 'mse-brokers',
  title: 'МХБ-ийн гишүүд — сарын арилжаа',
  tagline: 'Гишүүн брокеруудын сарын арилжааны дүн (₮), 2014–2026',
  description:
    'Монголын Хөрөнгийн Биржийн гишүүн компани бүрийн сарын "Нийт арилжаа" (төгрөгөөр) — сарын тайлангуудаас татан авч боловсруулсан. 94 брокер, 151 сар.',
  tags: ['mse', 'brokers', 'mongolia', 'monthly'],
  chartTypes: ['area', 'line', 'column', 'bar', 'treemap'],
  dateAdded: '2026-09-19',
  sourceUrl: 'https://www.mse.mn/report-and-research',
  sourceLabel: 'МХБ — гишүүдийн арилжааны тайлан',
  cover,
  tint: '#1e3a8a',
};
