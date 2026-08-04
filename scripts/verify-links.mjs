/**
 * Internal link validation.
 *
 * Authority: route build-out decision item 5 (dead-link policy),
 *            01_Product/Product_Requirements.md:197 (link/canonical review).
 *
 * Decision item 5, enforced here:
 *   - internal-link validation runs after each route group;
 *   - before implementation acceptance, NO sidebar link may lead to a 404;
 *   - a future-gated route must not look like an active feature.
 *
 * Method: parse every emitted HTML file, collect internal hrefs, and resolve each
 * against the set of emitted routes. This inspects BUILD OUTPUT rather than source
 * intent, so a link that only appears to work in a template cannot pass.
 *
 * Exits non-zero when a dead link is found in a shell region (sidebar, footer,
 * header), because those appear on every page. Dead links in page body content are
 * reported as warnings during development and become fatal under AXIORA_ENV=production.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const IS_PRODUCTION = process.env.AXIORA_ENV === 'production';

/** Base path the build used. Must match AXIORA_BASE at build time. */
const BASE = process.env.AXIORA_BASE ?? '/';

/** Shell regions whose links appear on every page; a dead link here is always fatal. */
const SHELL_SELECTORS = [
  { name: 'sidebar', pattern: /<nav[^>]*aria-label="Navigasi pengetahuan"[\s\S]*?<\/nav>/g },
  { name: 'footer', pattern: /<footer[^>]*>[\s\S]*?<\/footer>/g },
  { name: 'header', pattern: /<header[^>]*>[\s\S]*?<\/header>/g },
];

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Convert an emitted HTML file path to its route URL. */
function fileToRoute(relPath) {
  const normalised = relPath.replace(/\\/g, '/');
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
  if (normalised === 'index.html') return base;
  if (normalised.endsWith('/index.html')) {
    return `${base}${normalised.slice(0, -'index.html'.length)}`;
  }
  return `${base}${normalised}`;
}

/** Extract hrefs, tagged with the shell region they sit in (or 'content'). */
function extractLinks(html) {
  const links = [];
  const regionOf = new Map();

  for (const { name, pattern } of SHELL_SELECTORS) {
    for (const match of html.matchAll(pattern)) {
      for (const href of match[0].matchAll(/href="([^"]+)"/g)) {
        regionOf.set(href[1], name);
      }
    }
  }

  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    links.push({ href, region: regionOf.get(href) ?? 'content' });
  }

  return links;
}

/** Internal document links only: skip anchors, mailto, external, and assets. */
function isInternalRoute(href) {
  if (!href.startsWith('/')) return false;
  if (href.startsWith('//')) return false;
  if (href.startsWith('#')) return false;
  // Emitted asset paths are not routes.
  if (/\.(css|js|mjs|png|jpe?g|svg|webp|avif|ico|woff2?|json|xml|txt)$/i.test(href)) return false;
  return true;
}

/** Strip a fragment or query so the route can be resolved. */
function routeOf(href) {
  return href.split('#')[0].split('?')[0];
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('\nInternal link validation FAILED: dist/ does not exist. Run `npm run build`.\n');
    process.exit(1);
  }

  const files = await walk(DIST);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));

  const knownRoutes = new Set(htmlFiles.map((f) => fileToRoute(relative(DIST, f))));
  // A route emitted as /x/index.html is reachable both as /x/ and /x/index.html.
  for (const route of [...knownRoutes]) {
    if (route.endsWith('/')) knownRoutes.add(`${route}index.html`);
  }

  const deadShell = [];
  const deadContent = [];
  let checked = 0;

  for (const file of htmlFiles) {
    const relPath = relative(DIST, file).replace(/\\/g, '/');
    const html = await readFile(file, 'utf8');

    for (const { href, region } of extractLinks(html)) {
      if (!isInternalRoute(href)) continue;
      checked += 1;

      const route = routeOf(href);
      const candidates = [route, route.endsWith('/') ? route : `${route}/`];
      if (candidates.some((candidate) => knownRoutes.has(candidate))) continue;

      const record = { page: relPath, href, region };
      if (region === 'content') deadContent.push(record);
      else deadShell.push(record);
    }
  }

  console.log('\nAXIORA internal link validation\n');
  console.log(`  Routes emitted:      ${htmlFiles.length}`);
  console.log(`  Internal links seen: ${checked}`);
  console.log(`  Base path:           ${BASE}`);
  console.log(`  Environment:         ${IS_PRODUCTION ? 'production' : 'development'}\n`);

  if (deadShell.length > 0) {
    console.error(`  [FAIL] ${deadShell.length} dead link(s) in a persistent shell region.`);
    console.error(
      '         A shell link appears on every page. Decision item 5: no sidebar link may lead to a 404.\n',
    );
    for (const { page, href, region } of deadShell) {
      console.error(`    - [${region}] ${href}`);
      console.error(`      seen on: ${page}`);
    }
    console.error('');
  } else {
    console.log('  [PASS] No dead links in sidebar, footer, or header.');
  }

  if (deadContent.length > 0) {
    const label = IS_PRODUCTION ? 'FAIL' : 'WARN';
    const stream = IS_PRODUCTION ? console.error : console.warn;
    stream(`  [${label}] ${deadContent.length} dead link(s) in page content.`);
    if (!IS_PRODUCTION) {
      stream('         Tolerated mid-build-out, but NOT accepted. Blocks production release.\n');
    } else {
      stream('         Production release requires every internal link to resolve.\n');
    }
    for (const { page, href } of deadContent) {
      stream(`    - ${href}`);
      stream(`      seen on: ${page}`);
    }
    stream('');
  } else {
    console.log('  [PASS] No dead links in page content.');
  }

  const failed = deadShell.length > 0 || (IS_PRODUCTION && deadContent.length > 0);
  if (failed) {
    console.error('Internal link validation FAILED.\n');
    process.exit(1);
  }

  console.log('\nInternal link validation passed.\n');
}

await main();
