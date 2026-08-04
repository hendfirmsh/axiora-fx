/**
 * Build environment resolution.
 *
 * Authority: 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md Section 6,
 *            route build-out decision items 2, 3, 5, 6.
 *
 * AXIORA_ENV separates a local development build from a production release
 * build. It changes only STRICTNESS, never content or layout:
 *
 *   development (default) - unapproved legal regions and an under-strength corpus
 *                           are reported but tolerated; development-only markers
 *                           render; incomplete pages are noindex.
 *   production            - the same conditions FAIL the build. No development
 *                           marker may render.
 *
 * Defaulting to development is deliberate: a forgotten variable must not silently
 * relax a production gate, and it must not silently publish an unapproved page
 * either. Production strictness is opt-in, and the production release script sets
 * it explicitly.
 */

export type BuildEnvironment = 'development' | 'production';

/**
 * Read AXIORA_ENV. Resolved at build time in Node; there is no client runtime.
 * An unrecognised value is a configuration error and is refused rather than
 * quietly coerced, because coercion could downgrade a production build.
 */
export function buildEnvironment(): BuildEnvironment {
  const raw =
    typeof process !== 'undefined' && process.env ? process.env.AXIORA_ENV : undefined;

  if (raw === undefined || raw === '') return 'development';
  if (raw === 'production' || raw === 'development') return raw;

  throw new Error(
    `AXIORA_ENV has unrecognised value "${raw}". Use "development" or "production". ` +
      'Refusing to guess, because guessing could relax a production gate.',
  );
}

/** True when this build is a production release build. */
export function isProductionBuild(): boolean {
  return buildEnvironment() === 'production';
}

/**
 * Whether development-only affordances may render.
 *
 * Governs unavailable-route states and legal region status markers. Decision:
 * "Marker development tidak boleh muncul pada production release."
 */
export function showDevelopmentMarkers(): boolean {
  return !isProductionBuild();
}
