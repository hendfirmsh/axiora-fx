/**
 * Static output verification - compatibility gate checks 6, 7, and 8.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 6.
 *
 *   Check 6: output is truly static (pre-rendered HTML, no server entry point)
 *   Check 7: no server adapter present
 *   Check 8: no default client JavaScript beyond approved enhancements
 *
 * Exits non-zero on failure so it can gate a commit or CI run.
 */

import { readFile, readdir, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

import { mvpRoutePaths, pathsWithState } from '../src/lib/route-readiness.ts';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

/**
 * Server-side build intermediates.
 *
 * Astro writes these while pre-rendering and removes them on a successful static
 * build. They are NOT client JavaScript. Counting them as shipped client JS
 * produced a misleading "unapproved client script" failure on an aborted build,
 * which pointed at the wrong defect. They are instead evidence that the build did
 * not finish, and are reported as such by the completeness check.
 */
const BUILD_INTERMEDIATE_DIRS = ['.prerender', '.vercel', '.netlify'];

function isBuildIntermediate(relPath) {
  return BUILD_INTERMEDIATE_DIRS.some((dir) => relPath === dir || relPath.startsWith(`${dir}/`));
}

/**
 * Build evidence emitted by src/pages/content-integrity.json.ts.
 * Its absence means the Layer 2 gate did not run, so the build passed vacuously.
 */
const INTEGRITY_ARTEFACT = 'content-integrity.json';

/** Must match EXPECTED_CHECK_COUNT in src/pages/content-integrity.json.ts. */
const EXPECTED_CHECK_COUNT = 9;

/** Production release builds apply the strict gates. */
const IS_PRODUCTION = process.env.AXIORA_ENV === 'production';

/** Approved client scripts. Anything else shipped as JS is a violation. */
const APPROVED_SCRIPTS = [
  'drawer',
  'theme',
  'sidebar-group',
  'account-menu',
  'search-filter',
  'calendar',
  'news',
  // Firebase Auth is isolated to the explicitly approved private Console route.
  'ConsoleApp.astro_astro_type_script',
];

/** Server artefacts that must never appear in a static build. */
const SERVER_ARTEFACTS = ['entry.mjs', 'server', '_worker.js', 'functions', '_routes.json'];

const results = [];
let failed = false;

function record(check, name, ok, detail) {
  results.push({ check, name, ok, detail });
  if (!ok) failed = true;
}

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

async function main() {
  if (!existsSync(DIST)) {
    record(6, 'Output is truly static', false, 'dist/ does not exist. Run `npm run build` first.');
    report();
    return;
  }

  const files = await walk(DIST);
  const rel = files.map((f) => relative(DIST, f).replace(/\\/g, '/'));

  // --- Check 6: pre-rendered HTML present, no server entry point ----------
  const htmlFiles = rel.filter((f) => f.endsWith('.html'));
  const serverEntries = rel.filter((f) =>
    SERVER_ARTEFACTS.some((a) => f === a || f.startsWith(`${a}/`) || f.endsWith(`/${a}`)),
  );

  record(
    6,
    'Output is truly static',
    htmlFiles.length > 0 && serverEntries.length === 0,
    htmlFiles.length === 0
      ? 'No pre-rendered .html found in dist/.'
      : serverEntries.length > 0
        ? `Server entry artefact(s) present: ${serverEntries.join(', ')}`
        : `${htmlFiles.length} pre-rendered HTML file(s), no server entry point.`,
  );

  // --- Check 7: no server adapter installed ------------------------------
  const pkgRaw = await readFile(join(ROOT, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const adapters = Object.keys(allDeps).filter(
    (d) =>
      /^@astrojs\/(node|vercel|netlify|cloudflare|deno)$/.test(d) ||
      /adapter/i.test(d),
  );

  let configHasAdapter = false;
  const configPath = join(ROOT, 'astro.config.mjs');
  if (existsSync(configPath)) {
    const configRaw = await readFile(configPath, 'utf8');
    const withoutComments = configRaw
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    configHasAdapter = /\badapter\s*:/.test(withoutComments);
  }

  record(
    7,
    'No server adapter present',
    adapters.length === 0 && !configHasAdapter,
    adapters.length > 0
      ? `Adapter dependency found: ${adapters.join(', ')}`
      : configHasAdapter
        ? 'astro.config.mjs declares an adapter.'
        : 'No adapter dependency and no adapter in config.',
  );

  // --- Check 8: no unapproved client JavaScript --------------------------
  // Build intermediates are excluded deliberately: they are not served to a
  // reader. Their presence is a build-completeness defect and is reported by the
  // completeness check below, where the diagnosis is accurate.
  const jsFiles = rel.filter(
    (f) => ['.js', '.mjs'].includes(extname(f)) && !isBuildIntermediate(f),
  );
  const unapproved = jsFiles.filter(
    (f) => !APPROVED_SCRIPTS.some((name) => f.includes(name)),
  );

  let totalJsBytes = 0;
  for (const f of jsFiles) {
    const s = await stat(join(DIST, f));
    totalJsBytes += s.size;
  }

  record(
    8,
    'No default client JS beyond approved enhancements',
    unapproved.length === 0,
    jsFiles.length === 0
      ? 'Zero client JavaScript shipped.'
      : unapproved.length > 0
        ? `Unapproved client script(s): ${unapproved.join(', ')}`
        : `${jsFiles.length} approved script(s), ${totalJsBytes} bytes total.`,
  );

  // --- Credential scan: no Marketaux token may reach static output -------
  // The feed is public JSON and the page is public HTML. A token in either is a
  // leak, so this gate fails the build rather than trusting the fetch script.
  const textExtensions = new Set([
    '.html',
    '.js',
    '.mjs',
    '.json',
    '.css',
    '.xml',
    '.txt',
    '.svg',
    '.webmanifest',
  ]);
  const tokenValue = process.env.MARKETAUX_API_TOKEN?.trim();
  const credentialMarkers = [/MARKETAUX_API_TOKEN/, /[?&]api_token=/i];
  const credentialHits = [];

  for (const f of rel) {
    if (!textExtensions.has(extname(f))) continue;
    const content = await readFile(join(DIST, f), 'utf8');
    const markerHit = credentialMarkers.some((marker) => marker.test(content));
    const tokenHit = Boolean(tokenValue && tokenValue.length >= 8 && content.includes(tokenValue));
    if (markerHit || tokenHit) credentialHits.push(f);
  }

  record(
    9,
    'No Marketaux credential in static output',
    credentialHits.length === 0,
    credentialHits.length === 0
      ? tokenValue
        ? 'Scanned emitted HTML/JS/JSON/CSS; no token value or credential marker found.'
        : 'Scanned emitted HTML/JS/JSON/CSS; no credential marker found (no token configured locally).'
      : `Credential material found in: ${credentialHits.join(', ')}`,
  );

  // --- Completeness: every required route was emitted --------------------
  /*
   * WHY THIS EXISTS
   *
   * Every other check in this script, and the whole of verify-links.mjs, reasons
   * about routes that WERE emitted. None of them can see a route that is absent.
   *
   * That was a real hole, not a hypothetical one: an aborted production build left
   * a dist/ containing only 404.html, and check 6 passed it, because "some HTML
   * exists and no server entry point exists" was true. Link validation also
   * passed, because the one emitted page had no dead links.
   *
   * A partially written dist/ must never be publishable. The required route list
   * comes from the readiness registry, which is the same source the pages and the
   * sitemap use, so this cannot drift from the routes actually claimed.
   *
   * A future-gated route (Research) must be ABSENT. Emitting it would advertise a
   * phase that is not part of the Website MVP.
   *
   * Route form here is deliberately base-independent. Astro emits the same dist/
   * tree at both bases (the base prefix appears in emitted URLs, not in output
   * paths), and the readiness registry is keyed by application-relative path.
   * Verified by building at AXIORA_BASE=/axiora-fx/ and re-running this check.
   */
  const emittedRoutes = new Set(
    htmlFiles.map((f) => {
      if (f === 'index.html') return '/';
      if (f.endsWith('/index.html')) return `/${f.slice(0, -'index.html'.length)}`;
      // 404.html is emitted flat by design; express it as its route form.
      return `/${f.replace(/\.html$/, '')}/`;
    }),
  );

  const requiredRoutes = mvpRoutePaths();
  const missingRoutes = requiredRoutes.filter((r) => !emittedRoutes.has(r));

  const futureGated = pathsWithState('future-gated');
  const leakedFutureRoutes = futureGated.filter((r) => emittedRoutes.has(r));

  const intermediates = rel.filter(isBuildIntermediate);

  let completenessDetail;
  if (intermediates.length > 0) {
    completenessDetail =
      `Build did not finish: ${intermediates.length} server intermediate file(s) remain ` +
      `(e.g. ${intermediates[0]}). A successful static build removes these. ` +
      'Treat dist/ as incomplete and rebuild; do not verify or publish it.';
  } else if (missingRoutes.length > 0) {
    completenessDetail =
      `${missingRoutes.length} required route(s) were not emitted: ${missingRoutes.join(', ')}. ` +
      'A partial dist/ must never be published. Rebuild and resolve the build failure.';
  } else if (leakedFutureRoutes.length > 0) {
    completenessDetail =
      `Future-gated route(s) emitted as MVP content: ${leakedFutureRoutes.join(', ')}. ` +
      'A future-gated route must not appear as an active destination.';
  } else {
    completenessDetail =
      `All ${requiredRoutes.length} required route(s) emitted; ` +
      `${futureGated.length} future-gated route(s) correctly absent; no build intermediates left behind.`;
  }

  record(
    1,
    'Build is complete and emits every required route',
    intermediates.length === 0 && missingRoutes.length === 0 && leakedFutureRoutes.length === 0,
    completenessDetail,
  );

  // --- Check 4/5 evidence: the Layer 2 integrity gate actually ran --------
  // Guards against the gate being silently skipped (e.g. an underscore-prefixed
  // filename excluding it from routing). No evidence means no validation.
  let integrityDetail;
  let integrityOk = false;
  if (!rel.includes(INTEGRITY_ARTEFACT)) {
    integrityDetail =
      `${INTEGRITY_ARTEFACT} was not emitted. The cross-record integrity gate did not run, ` +
      'so checks 4 and 5 have no evidence. Verify src/pages/content-integrity.json.ts is ' +
      'routable (no leading underscore) and prerendered.';
  } else {
    try {
      const evidence = JSON.parse(await readFile(join(DIST, INTEGRITY_ARTEFACT), 'utf8'));
      if (evidence.checksRun !== EXPECTED_CHECK_COUNT) {
        integrityDetail =
          `Contract requires ${EXPECTED_CHECK_COUNT} checks, evidence reports ${evidence.checksRun}. ` +
          'A check that did not run counts as failed.';
      } else if (evidence.failures !== 0) {
        integrityDetail = `Evidence reports ${evidence.failures} unresolved failure(s).`;
      } else if (!Number.isInteger(evidence.checkedRecords)) {
        integrityDetail = 'Evidence does not report a record count.';
      } else if (IS_PRODUCTION && evidence.checkedRecords < 1) {
        integrityDetail =
          'Production build with an empty corpus. No check could be exercised and there ' +
          'is nothing to publish.';
      } else if (IS_PRODUCTION && evidence.environment !== 'production') {
        integrityDetail =
          `AXIORA_ENV=production but the gate ran as "${evidence.environment}". ` +
          'Production-only checks were therefore skipped.';
      } else if (IS_PRODUCTION && evidence.corpusSatisfied !== true) {
        integrityDetail =
          `Production build with ${evidence.corpusShortfalls} unmet corpus requirement(s). ` +
          'Product_Requirements.md:176 forbids releasing a hollow shell.';
      } else {
        integrityOk = true;
        const corpusNote = evidence.corpusSatisfied
          ? 'corpus minimum satisfied'
          : `corpus minimum NOT met (${evidence.corpusShortfalls} shortfall(s)) - blocks production`;
        const emptyNote =
          evidence.checkedRecords === 0
            ? ' Corpus is empty: validator evidence comes from `npm run test:content`.'
            : '';
        integrityDetail =
          `Gate ran as "${evidence.environment}": ${evidence.checkedRecords} record(s) checked, ` +
          `${evidence.publishableRecords} publishable, ${EXPECTED_CHECK_COUNT} checks, 0 failures; ` +
          `${corpusNote}.${emptyNote}`;
      }
    } catch (error) {
      integrityDetail = `${INTEGRITY_ARTEFACT} is unreadable or malformed: ${error.message}`;
    }
  }

  record(45, 'Cross-record integrity gate executed', integrityOk, integrityDetail);

  // The artefact is build evidence, not publishable content. Remove it either way
  // so it is never deployed; the pass/fail decision above is already recorded.
  if (rel.includes(INTEGRITY_ARTEFACT)) {
    await rm(join(DIST, INTEGRITY_ARTEFACT), { force: true });
  }

  // --- Supporting evidence: required static assets -----------------------
  const hasCname = rel.includes('CNAME');
  const hasNojekyll = rel.includes('.nojekyll');
  record(
    0,
    'Required GitHub Pages assets emitted',
    hasCname && hasNojekyll,
    `CNAME: ${hasCname ? 'present' : 'MISSING'}, .nojekyll: ${hasNojekyll ? 'present' : 'MISSING'}`,
  );

  report();
}

function report() {
  console.log('\nAXIORA static output verification\n');
  for (const r of results) {
    const label =
      r.check === 0
        ? 'assets'
        : r.check === 1
          ? 'completeness'
          : r.check === 45
            ? 'checks 4+5'
            : `check ${r.check}`;
    console.log(`  [${r.ok ? 'PASS' : 'FAIL'}] ${label}: ${r.name}`);
    console.log(`         ${r.detail}`);
  }
  console.log('');
  if (failed) {
    console.error('Static verification FAILED.\n');
    process.exit(1);
  }
  console.log('Static verification passed.\n');
}

await main();
