import { cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];

if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run new:case -- <slug>\n  slug: lowercase letters, numbers, dashes. e.g. saas-revenue');
  process.exit(1);
}

const dest = join(root, 'src', 'cases', slug);
if (existsSync(dest)) {
  console.error(`Case "${slug}" already exists at src/cases/${slug}`);
  process.exit(1);
}

cpSync(join(root, 'src', 'cases', '_template'), dest, { recursive: true });

// Patch slug in meta.ts
const metaPath = join(dest, 'meta.ts');
const meta = readFileSync(metaPath, 'utf8').replaceAll('my-first-case', slug);
writeFileSync(metaPath, meta);

// Remove template index (each case defines its own index.ts)
console.log(`Created src/cases/${slug}/`);
console.log(`Next:`);
console.log(`  1. Implement scraping/scrape.py → writes data/raw/ (or drop input there directly)`);
console.log(`  2. Implement scraping/process.py → writes chart-ready JSON to data/processed/`);
console.log(`  3. Expose it via data/processed/*.ts, build charts in charts/`);
console.log(`  4. Register in src/cases/registry.ts:`);
console.log(`       import { ${toVar(slug)} } from './${slug}';`);
console.log(`       export const cases = [${toVar(slug)}];`);

function toVar(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '') + 'Case';
}
