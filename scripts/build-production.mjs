/**
 * Production release build.
 *
 * Authority: route build-out decision items 3, 4, 5, 6, 8,
 *            01_Product/Product_Requirements.md:176-199 (minimum corpus, release acceptance),
 *            04_Workspace_Architecture/06_Page_Inventory.md:19 (legal state blocks release),
 *            04_Workspace_Architecture/14_Implementation_Acceptance_Criteria.md,
 *            05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 6,
 *            IMPLEMENTATION_CONTRACT.md.
 *
 * PURPOSE
 *
 * `npm run build` produces a development build. This script produces a RELEASE
 * build, and refuses to produce one whenever any of the eleven mandatory failure
 * conditions holds.
 *
 * THE ELEVEN MANDATORY FAILURE CONDITIONS
 *
 *    1. minimum corpus unmet
 *    2. the three cornerstone Market Briefs are missing
 *    3. linked concept explainers are missing
 *    4. a test fixture leaked into the production corpus
 *    5. a dead internal link is present
 *    6. a required route is missing
 *    7. a Legal & Risk region is not Approved
 *    8. the correction mailbox is unvalidated
 *    9. a canonical URL is wrong
 *   10. a content record has an invalid source, status, owner, or relationship
 *   11. a future-gated route is published as MVP
 *
 * DESIGN RULES
 *
 * A CHECK THAT DID NOT RUN COUNTS AS FAILED. Every condition starts as failed and
 * becomes passed only when its check actually executes and returns a result. A
 * crashed or skipped check therefore blocks the release instead of vanishing.
 * This mirrors the integrity-gate invariant in decision item 4.
 *
 * NO CONDITION IS WAIVABLE. There is no --force flag and no environment variable
 * that downgrades a failure to a warning. A release gate with an override is not
 * a gate.
 *
 * THE BUILD OUTPUT IS DELETED ON FAILURE. A dist/ produced by a failed release run
 * must never be publishable by accident, and a partial dist/ is exactly what
 * fooled an earlier version of verify-static.mjs.
 *
 * WHAT THIS SCRIPT DOES NOT DO
 *
 * It does not deploy, enable GitHub Pages, change DNS, or commit anything. Those
 * remain unauthorized. A successful run means "this build would be publishable",
 * not "this build was published".
 */

import { spawnSync } from 'node:child_process';
import { readFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';

import { mvpRoutePaths, pathsWithState } from '../src/lib/route-readiness.ts';
import {
  LEGAL_REGIONS,
  unapprovedLegalRegions,
  ownerlessApprovedRegions,
  CORRECTION_MAILBOX_VERIFIED,
} from '../src/lib/legal-regions.ts';
import { CORRECTIONS_EMAIL } from '../src/lib/routes.ts';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');

/** Production site origin and base. Decision K-12. */
const SITE = process.env.AXIORA_SITE ?? 'https://axiora.my.id';
const BASE = process.env.AXIORA_BASE ?? '/';

/**
 * The eleven conditions. Each begins as failed with an explicit "did not run"
 * detail, so an aborted script cannot leave a condition looking satisfied.
 */
const CONDITIONS = [
  [1, 'Minimum corpus met'],
  [2, 'Three cornerstone Market Briefs present'],
  [3, 'Linked concept explainers present'],
  [4, 'No test fixture in the production corpus'],
  [5, 'No dead internal links'],
  [6, 'No required route missing'],
  [7, 'Every Legal & Risk region Approved'],
  [8, 'Correction mailbox validated'],
  [9, 'Canonical URLs correct'],
  [10, 'No content record with invalid source/status/owner/relationship'],
  [11, 'No future-gated route published as MVP'],
];

const state = new Map(
  CONDITIONS.map(([id, name]) => [
    id,
    { id, name, passed: false, detail: 'Check did not run. A check that did not run counts as failed.' },
  ]),
);

function pass(id, detail) {
  state.get(id).passed = true;
  state.get(id).detail = detail;
}

function fail(id, detail) {
  state.get(id).passed = false;
  state.get(id).detail = detail;
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

/**
 * Astro's own entry point.
 *
 * Invoked directly with the current Node binary rather than through `npx` and a
 * shell. Spawning with `shell: true` and separate args concatenates them into a
 * command line (Node DEP0190) instead of escaping them, and depends on PATH
 * resolution. Neither is acceptable in a release gate.
 */
const ASTRO_BIN = join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

/** Run a command with AXIORA_ENV=production. Returns {ok, stdout, stderr}. */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, AXIORA_ENV: 'production', AXIORA_SITE: SITE, AXIORA_BASE: BASE },
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/* ======================================================================
 * PRE-BUILD CHECKS
 *
 * Conditions 7 and 8 are governance state, not build output. They are evaluated
 * before spending time on a build that could not be released anyway.
 * ================================================================== */

function checkLegalRegions() {
  const unapproved = unapprovedLegalRegions();
  const ownerless = ownerlessApprovedRegions();

  if (LEGAL_REGIONS.length !== 8) {
    fail(
      7,
      `Legal registry holds ${LEGAL_REGIONS.length} region(s); the approved structure requires 8. ` +
        'A missing region cannot be reviewed and must not be silently dropped.',
    );
    return;
  }

  if (unapproved.length > 0) {
    const lines = unapproved.map(
      (r) => `      - ${r.id} (${r.status}): ${r.blockedReason ?? 'no reason recorded'}`,
    );
    fail(
      7,
      `${unapproved.length} of 8 Legal & Risk region(s) are not Approved. ` +
        'Page_Inventory.md:19: an unavailable legal state blocks release rather than silently ' +
        `disappearing.\n${lines.join('\n')}`,
    );
    return;
  }

  if (ownerless.length > 0) {
    fail(
      7,
      `Approved region(s) without an accountable owner: ${ownerless.map((r) => r.id).join(', ')}. ` +
        'An approval nobody owns cannot be maintained or corrected.',
    );
    return;
  }

  pass(7, 'All 8 Legal & Risk regions are Approved and owned.');
}

function checkCorrectionMailbox() {
  if (!CORRECTION_MAILBOX_VERIFIED) {
    fail(
      8,
      `Correction mailbox ${CORRECTIONS_EMAIL} is not verified as reachable. ` +
        'Decision K-03 requires a working correction route before release; publishing an ' +
        'unreachable correction address would make the correction policy false.',
    );
    return;
  }
  pass(8, `Correction mailbox ${CORRECTIONS_EMAIL} recorded as verified.`);
}

/* ======================================================================
 * BUILD-OUTPUT CHECKS
 * ================================================================== */

/**
 * Conditions 1, 2, 3, 4 and 10 are enforced inside the build itself, by the
 * content integrity gate and the corpus evaluator. This function does not
 * re-implement them; it reads the evidence artefact they emit and refuses to
 * infer success from a silent build.
 */
async function checkCorpusEvidence(buildOk) {
  const artefact = join(DIST, 'content-integrity.json');

  if (!existsSync(artefact)) {
    const reason = buildOk
      ? 'The build completed but emitted no integrity evidence. The gate did not run, so ' +
        'conditions 1, 2, 3, 4 and 10 have no evidence and are treated as failed.'
      : 'The build failed before emitting integrity evidence, so conditions 1, 2, 3, 4 and 10 ' +
        'have no evidence and are treated as failed. The build failure extract is printed above.';

    for (const id of [1, 2, 3, 4, 10]) fail(id, reason);
    return;
  }

  let evidence;
  try {
    evidence = JSON.parse(await readFile(artefact, 'utf8'));
  } catch (error) {
    for (const id of [1, 2, 3, 4, 10]) {
      fail(id, `Integrity evidence is unreadable or malformed: ${error.message}`);
    }
    return;
  }

  if (evidence.environment !== 'production') {
    const reason =
      `Integrity gate ran as "${evidence.environment}", not "production". ` +
      'Production-only checks were skipped, so the evidence does not support a release.';
    for (const id of [1, 2, 3, 4, 10]) fail(id, reason);
    return;
  }

  // --- Condition 10: cross-record validity -------------------------------
  if (evidence.checksRun !== 9) {
    fail(
      10,
      `Contract requires 9 cross-record checks; evidence reports ${evidence.checksRun}. ` +
        'A check that did not run counts as failed.',
    );
  } else if (evidence.failures !== 0) {
    fail(10, `Integrity gate reports ${evidence.failures} unresolved cross-record failure(s).`);
  } else {
    pass(
      10,
      `All 9 cross-record checks passed over ${evidence.checkedRecords} record(s) ` +
        '(source, status, owner, and relationship validity).',
    );
  }

  // --- Condition 4: no test fixture in the production corpus --------------
  // The gate counts publishable records as production-state only, so a fixture
  // can never inflate the corpus. Verified here against the emitted counts.
  if (!Number.isInteger(evidence.checkedRecords) || !Number.isInteger(evidence.publishableRecords)) {
    fail(4, 'Evidence does not report record counts, so fixture leakage cannot be ruled out.');
  } else if (evidence.publishableRecords > evidence.checkedRecords) {
    fail(
      4,
      `Evidence reports ${evidence.publishableRecords} publishable of ${evidence.checkedRecords} ` +
        'checked. A publishable count above the checked count indicates corrupt evidence.',
    );
  } else {
    pass(
      4,
      `${evidence.publishableRecords} publishable of ${evidence.checkedRecords} checked; ` +
        'test-fixture records are excluded from the publishable set by publicationState.',
    );
  }

  // --- Conditions 1, 2, 3: corpus sufficiency -----------------------------
  // The build fails outright when the corpus is unmet under AXIORA_ENV=production,
  // so reaching this point with shortfalls means the evidence contradicts itself.
  if (evidence.corpusSatisfied === true && evidence.corpusShortfalls === 0) {
    pass(1, 'Minimum production corpus satisfied.');
    pass(2, 'Cornerstone Market Brief floor satisfied (Product_Requirements.md:181).');
    pass(3, 'Every concept explainer referenced by a published brief exists (Product_Requirements.md:182).');
  } else {
    const detail =
      `Corpus not satisfied: ${evidence.corpusShortfalls} shortfall(s). ` +
      'Product_Requirements.md:176 forbids releasing a hollow shell. ' +
      'Build output records which floor was unmet.';
    fail(1, detail);
    fail(2, detail);
    fail(3, detail);
  }
}

/** Conditions 6 and 11: route completeness and future-gate containment. */
async function checkRoutes() {
  if (!existsSync(DIST)) {
    fail(6, 'dist/ does not exist; no route could be verified.');
    fail(11, 'dist/ does not exist; future-gate containment could not be verified.');
    return;
  }

  const files = await walk(DIST);
  const htmlFiles = files
    .map((f) => relative(DIST, f).replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.html'));

  const emitted = new Set(
    htmlFiles.map((f) => {
      if (f === 'index.html') return '/';
      if (f.endsWith('/index.html')) return `/${f.slice(0, -'index.html'.length)}`;
      return `/${f.replace(/\.html$/, '')}/`;
    }),
  );

  const required = mvpRoutePaths();
  const missing = required.filter((r) => !emitted.has(r));

  if (missing.length > 0) {
    fail(6, `${missing.length} required route(s) not emitted: ${missing.join(', ')}.`);
  } else {
    pass(6, `All ${required.length} required route(s) emitted.`);
  }

  const gated = pathsWithState('future-gated');
  const leaked = gated.filter((r) => emitted.has(r));

  /*
   * Absence is only meaningful in a COMPLETE build.
   *
   * On an aborted build, dist/ held one page and no /research/ route, so this
   * condition passed — "correctly absent" was true only because almost nothing
   * had been emitted at all. A containment check that passes on an empty tree
   * gives false assurance, so route completeness is a precondition for it.
   */
  if (missing.length > 0) {
    fail(
      11,
      'Not assessable: the build is incomplete (condition 6 failed), so the absence of a ' +
        'future-gated route proves nothing. Absence is only meaningful once every required ' +
        'route was emitted.',
    );
    return;
  }

  if (leaked.length > 0) {
    fail(
      11,
      `Future-gated route(s) emitted as MVP content: ${leaked.join(', ')}. ` +
        'A future-gated route must not appear as an active MVP destination.',
    );
  } else {
    pass(
      11,
      `${gated.length} future-gated route(s) correctly absent from a complete build: ${gated.join(', ')}.`,
    );
  }
}

/** Condition 9: canonical URLs are absolute, correctly based, and never doubled. */
async function checkCanonicals() {
  if (!existsSync(DIST)) {
    fail(9, 'dist/ does not exist; canonical URLs could not be verified.');
    return;
  }

  const files = await walk(DIST);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));

  if (htmlFiles.length === 0) {
    fail(9, 'No HTML emitted; canonical URLs could not be verified.');
    return;
  }

  /*
   * Every required route must be present before canonical correctness means
   * anything. An aborted build left a single page whose canonical happened to be
   * well-formed, and this condition passed — asserting correctness over 1 of 18
   * routes. Coverage is therefore part of the assertion, not an assumption.
   */
  const required = mvpRoutePaths();
  if (htmlFiles.length < required.length) {
    fail(
      9,
      `Only ${htmlFiles.length} page(s) emitted but ${required.length} route(s) are required. ` +
        'Canonical correctness is not assessable on an incomplete build; resolve condition 6 first.',
    );
    return;
  }

  const origin = SITE.replace(/\/$/, '');
  const basePath = BASE.endsWith('/') ? BASE : `${BASE}/`;
  const expectedPrefix = `${origin}${basePath}`;
  const doubledSegment = basePath === '/' ? null : `${basePath}${basePath.slice(1)}`;

  const problems = [];

  for (const file of htmlFiles) {
    const rel = relative(DIST, file).replace(/\\/g, '/');
    const html = await readFile(file, 'utf8');
    const match = html.match(/<link rel="canonical" href="([^"]*)"/);

    if (!match) {
      problems.push(`${rel}: no canonical link element.`);
      continue;
    }

    const href = match[1];

    if (!href.startsWith(expectedPrefix)) {
      problems.push(`${rel}: canonical "${href}" does not start with "${expectedPrefix}".`);
      continue;
    }
    if (doubledSegment && href.includes(doubledSegment)) {
      problems.push(`${rel}: canonical "${href}" contains a doubled base segment.`);
      continue;
    }
    if (!href.endsWith('/')) {
      problems.push(`${rel}: canonical "${href}" lacks a trailing slash (trailingSlash: always).`);
    }
  }

  if (problems.length > 0) {
    fail(
      9,
      `${problems.length} canonical URL problem(s):\n` +
        problems.slice(0, 10).map((p) => `      - ${p}`).join('\n'),
    );
    return;
  }

  pass(9, `${htmlFiles.length} canonical URL(s) correct under ${expectedPrefix} with no doubled base.`);
}

/** Condition 5: dead internal links, via the existing validator. */
function checkLinks() {
  const result = run(process.execPath, ['scripts/verify-links.mjs']);

  if (result.ok) {
    pass(5, 'Internal link validation passed with no dead links in shell or content.');
    return;
  }

  const summary = `${result.stdout}\n${result.stderr}`
    .split('\n')
    .filter((line) => /FAIL|dead link|- \//.test(line))
    .slice(0, 10)
    .map((line) => `      ${line.trim()}`)
    .join('\n');

  fail(5, `Internal link validation failed (exit ${result.status}).\n${summary}`);
}

/* ======================================================================
 * MAIN
 * ================================================================== */

async function main() {
  console.log('\nAXIORA production release build\n');
  console.log(`  Site: ${SITE}`);
  console.log(`  Base: ${BASE}`);
  console.log('  AXIORA_ENV: production (forced; not overridable)\n');

  // Governance conditions first — no point building an unreleasable tree.
  checkLegalRegions();
  checkCorrectionMailbox();

  // A release build never reuses a previous dist/.
  await rm(DIST, { recursive: true, force: true });

  console.log('  Building...\n');
  const build = run(process.execPath, [ASTRO_BIN, 'build']);

  if (!build.ok) {
    const reason = `${build.stdout}\n${build.stderr}`
      .split('\n')
      .filter((line) => /Error|error|CORPUS|INTEGRITY|Route "/.test(line))
      .slice(0, 8)
      .map((line) => `      ${line.trim()}`)
      .join('\n');
    console.log(`  Build failed (exit ${build.status}). Extract:\n${reason}\n`);
  } else {
    console.log('  Build completed.\n');
  }

  await checkCorpusEvidence(build.ok);
  await checkRoutes();
  await checkCanonicals();

  // Static verification runs for its own gate checks; its failures surface through
  // the conditions above, so its exit status is reported rather than duplicated.
  const staticResult = run(process.execPath, ['scripts/verify-static.mjs']);
  checkLinks();

  // --- Report -------------------------------------------------------------
  console.log('  Mandatory release conditions\n');

  const ordered = [...state.values()].sort((a, b) => a.id - b.id);
  for (const condition of ordered) {
    console.log(`  [${condition.passed ? 'PASS' : 'FAIL'}] ${condition.id}. ${condition.name}`);
    console.log(`         ${condition.detail}`);
  }

  const failures = ordered.filter((c) => !c.passed);

  console.log('');
  console.log(`  verify-static.mjs exit status: ${staticResult.status}`);
  console.log(`  Conditions passed: ${ordered.length - failures.length} of ${ordered.length}\n`);

  if (failures.length > 0) {
    // A dist/ from a failed release run must never be mistaken for publishable.
    await rm(DIST, { recursive: true, force: true });

    console.error(
      `PRODUCTION RELEASE BLOCKED: ${failures.length} mandatory condition(s) failed ` +
        `(${failures.map((f) => f.id).join(', ')}).\n`,
    );
    console.error('  dist/ has been removed so a blocked build cannot be published.\n');
    process.exit(1);
  }

  console.log('All mandatory conditions passed. Build is releasable.\n');
  console.log('NOT PERFORMED by this script and still unauthorized:');
  console.log('  deployment, GitHub Pages activation, DNS changes, publication of legal content.\n');
}

await main();
