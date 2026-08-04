/**
 * Drawer behaviour regression tests.
 *
 * Authority: 04_Workspace_Architecture/11_Interaction_Specification.md:13,14,29,57
 *            04_Workspace_Architecture/12_Responsive_Workspace.md:11,13
 *            04_Workspace_Architecture/13_Accessibility_Workspace.md:19
 *
 * WHAT THESE TESTS ARE, AND WHAT THEY ARE NOT
 *
 * They execute the REAL shipped file (public/scripts/drawer.js) inside node:vm
 * against a minimal DOM stub. That is genuine coverage of the script's decision
 * logic: breakpoint sync, Escape scoping, focus return, and the forbidden state.
 *
 * They are NOT proof of rendered browser behaviour. The stub implements only the
 * DOM surface the script touches; it does not do layout, CSS cascade, or native
 * <details> semantics. The CSS invariant that actually prevents the breakpoint
 * trap is asserted separately below by reading shell.css, and both were verified
 * in Chrome 150 via Playwright. Do not cite this file as evidence that the drawer
 * renders correctly.
 *
 * No dependency is added: node:vm and node:test are built in. A DOM library
 * (jsdom) or a browser runner (vitest/playwright test) would be a dependency
 * decision outside implementation authority.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRAWER_SCRIPT = join(ROOT, 'public', 'scripts', 'drawer.js');
const SHELL_CSS = join(ROOT, 'src', 'styles', 'shell.css');
const LAYOUT = join(ROOT, 'src', 'layouts', 'WorkspaceLayout.astro');

/* ---------------------------------------------------------------------------
 * Minimal DOM stub
 * ------------------------------------------------------------------------ */

interface StubEvent {
  type?: string;
  key?: string;
  matches?: boolean;
}

type StubHandler = (event: StubEvent) => void;

interface StubDocument {
  activeElement: StubElement | null;
  listeners: Map<string, StubHandler[]>;
  addEventListener(type: string, handler: StubHandler): void;
  dispatch(type: string, event: StubEvent): void;
  getElementById(id: string): StubElement | null;
  querySelector(selector: string): StubElement | null;
}

class StubElement {
  tagName: string;
  className: string;
  children: StubElement[];
  parent: StubElement | null;
  attributes: Map<string, string>;
  listeners: Map<string, StubHandler[]>;
  focusCount: number;
  open: boolean;
  ownerDocument: StubDocument | null;

  constructor(tag: string, className?: string) {
    this.tagName = tag.toUpperCase();
    this.className = className ?? '';
    this.children = [];
    this.parent = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.focusCount = 0;
    this.open = false;
    this.ownerDocument = null;
  }

  appendChild(child: StubElement): StubElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.has(name) ? (this.attributes.get(name) as string) : null;
  }

  addEventListener(type: string, handler: StubHandler): void {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    (this.listeners.get(type) as StubHandler[]).push(handler);
  }

  dispatch(type: string, event: StubEvent): void {
    const handlers = this.listeners.get(type) ?? [];
    for (const handler of handlers) handler({ type, ...event });
  }

  focus(): void {
    this.focusCount += 1;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  contains(node: StubElement): boolean {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  descendants(): StubElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelector(selector: string): StubElement | null {
    const want = selector.replace(/^\./, '');
    return this.descendants().find((el) => el.className.split(/\s+/).includes(want)) ?? null;
  }
}

/**
 * Builds the shell fragment the script expects, mirroring WorkspaceLayout.astro:
 * <details id="axf-drawer" open> <summary.axf-drawer-trigger> <nav.axf-drawer-content>
 *
 * `open` starts true because that is what the markup ships — the whole no-JS
 * fallback depends on it.
 */
function buildDom(): {
  doc: StubDocument;
  drawer: StubElement;
  trigger: StubElement;
  content: StubElement;
} {
  const doc: StubDocument = {
    activeElement: null,
    listeners: new Map<string, StubHandler[]>(),
    addEventListener(type: string, handler: StubHandler): void {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      (this.listeners.get(type) as StubHandler[]).push(handler);
    },
    dispatch(type: string, event: StubEvent): void {
      for (const handler of this.listeners.get(type) ?? []) handler({ type, ...event });
    },
    getElementById(): StubElement | null {
      return null;
    },
    querySelector(): StubElement | null {
      return null;
    },
  };

  const drawer = new StubElement('details', 'axf-drawer');
  const trigger = new StubElement('summary', 'axf-drawer-trigger');
  const content = new StubElement('nav', 'axf-drawer-content');

  drawer.open = true;
  drawer.appendChild(trigger);
  drawer.appendChild(content);

  for (const el of [drawer, trigger, content]) el.ownerDocument = doc;

  doc.getElementById = (id) => (id === 'axf-drawer' ? drawer : null);
  doc.querySelector = (sel) => drawer.querySelector(sel);

  return { doc, drawer, trigger, content };
}

/**
 * Runs the real drawer.js with a controllable matchMedia.
 * Returns handles plus setViewport(), which fires a matchMedia change event —
 * the only breakpoint signal the script is allowed to use.
 */
interface StubMediaQueryList {
  matches: boolean;
  query?: string;
  listeners: StubHandler[];
  addEventListener(type: string, handler: StubHandler): void;
}

function loadDrawer({ desktop }: { desktop: boolean }) {
  const { doc, drawer, trigger, content } = buildDom();

  const mql: StubMediaQueryList = {
    matches: desktop,
    listeners: [],
    addEventListener(_type: string, handler: StubHandler): void {
      this.listeners.push(handler);
    },
  };

  const window = {
    matchMedia(query: string): StubMediaQueryList {
      mql.query = query;
      return mql;
    },
  };

  const source = readFileSync(DRAWER_SCRIPT, 'utf8');
  vm.runInNewContext(source, { document: doc, window, console });

  return {
    doc,
    drawer,
    trigger,
    content,
    mql,
    /** Simulates a real user activating the native <details> control. */
    userToggle() {
      trigger.dispatch('click', {});
      drawer.open = !drawer.open;
      drawer.dispatch('toggle', {});
    },
    setViewport(isDesktop: boolean) {
      mql.matches = isDesktop;
      for (const handler of mql.listeners) handler({ matches: isDesktop });
    },
    pressEscape() {
      doc.dispatch('keydown', { key: 'Escape' });
    },
  };
}

/* ---------------------------------------------------------------------------
 * 1. Mobile initial state
 * ------------------------------------------------------------------------ */

test('mobile initial state: drawer is closed by the script', () => {
  const ui = loadDrawer({ desktop: false });
  assert.equal(ui.drawer.open, false, 'mobile must start with the drawer closed');
  assert.equal(ui.mql.query, '(min-width: 48em)', 'must use the 48em band from shell.css');
});

test('closing on load does not steal focus', () => {
  const ui = loadDrawer({ desktop: false });
  assert.equal(
    ui.trigger.focusCount,
    0,
    'Interaction_Specification.md:29 limits focus management to the drawer open lifecycle; ' +
      'a load-time sync must not move focus.',
  );
});

/* ---------------------------------------------------------------------------
 * 2. Desktop initial state
 * ------------------------------------------------------------------------ */

test('desktop initial state: drawer is open as a persistent sidebar', () => {
  const ui = loadDrawer({ desktop: true });
  assert.equal(ui.drawer.open, true, 'tablet and up must expose a persistent sidebar');
});

/* ---------------------------------------------------------------------------
 * 3 & 4. Breakpoint transitions
 * ------------------------------------------------------------------------ */

test('mobile -> desktop opens the drawer', () => {
  const ui = loadDrawer({ desktop: false });
  assert.equal(ui.drawer.open, false);
  ui.setViewport(true);
  assert.equal(ui.drawer.open, true, 'widening past 48em must restore the persistent sidebar');
});

test('desktop -> mobile closes the drawer', () => {
  const ui = loadDrawer({ desktop: true });
  ui.setViewport(false);
  assert.equal(ui.drawer.open, false, 'narrowing must return to explicit drawer opening');
});

test('breakpoint changes never move focus', () => {
  const ui = loadDrawer({ desktop: false });
  ui.setViewport(true);
  ui.setViewport(false);
  assert.equal(ui.trigger.focusCount, 0, 'a resize is not a drawer open/close interaction');
  assert.equal(ui.content.focusCount, 0);
});

/* ---------------------------------------------------------------------------
 * 5. THE BREAKPOINT TRAP: close, then resize
 * ------------------------------------------------------------------------ */

test('close on mobile then widen to desktop reopens the drawer', () => {
  const ui = loadDrawer({ desktop: false });
  ui.userToggle(); /* reader opens it */
  assert.equal(ui.drawer.open, true);
  ui.userToggle(); /* reader closes it */
  assert.equal(ui.drawer.open, false);

  ui.setViewport(true);

  assert.equal(
    ui.drawer.open,
    true,
    'THE REGRESSION: drawer closed on mobile then widened past 48em used to stay closed ' +
      'while CSS hid the trigger, leaving navigation unreachable with no control to restore it.',
  );
});

test('the forbidden state is unreachable across a transition sequence', () => {
  const ui = loadDrawer({ desktop: false });
  const sequence = [true, false, true, true, false];

  for (const isDesktop of sequence) {
    ui.setViewport(isDesktop);
    /*
     * The invariant: on desktop the trigger is hidden by CSS, so the drawer MUST
     * be open. Mobile may be closed because the trigger is visible there.
     */
    if (isDesktop) {
      assert.equal(ui.drawer.open, true, 'desktop must never present a closed drawer');
    }
  }
});

/* ---------------------------------------------------------------------------
 * 6. Escape
 * ------------------------------------------------------------------------ */

test('Escape closes the drawer on mobile', () => {
  const ui = loadDrawer({ desktop: false });
  ui.userToggle();
  assert.equal(ui.drawer.open, true);

  ui.pressEscape();
  assert.equal(ui.drawer.open, false, 'Interaction_Specification.md:14 requires Escape to close');
});

test('Escape does NOT close the persistent desktop sidebar', () => {
  const ui = loadDrawer({ desktop: true });
  assert.equal(ui.drawer.open, true);

  ui.pressEscape();

  assert.equal(
    ui.drawer.open,
    true,
    'Responsive_Workspace.md:13 makes the sidebar persistent at tablet and up; Escape must ' +
      'not remove primary navigation, and the trigger is hidden so it could not be reopened.',
  );
});

/* ---------------------------------------------------------------------------
 * 7. Focus return
 * ------------------------------------------------------------------------ */

test('Escape returns focus to the trigger', () => {
  const ui = loadDrawer({ desktop: false });
  ui.userToggle();
  const before = ui.trigger.focusCount;

  ui.pressEscape();

  assert.ok(
    ui.trigger.focusCount > before,
    'Accessibility_Workspace.md:19 requires focus to return to the trigger on close',
  );
  assert.equal(ui.doc.activeElement, ui.trigger);
});

test('opening on mobile moves focus into the navigation', () => {
  const ui = loadDrawer({ desktop: false });
  ui.userToggle();

  assert.ok(
    ui.content.focusCount > 0,
    'Interaction_Specification.md:13 requires opening to move focus into navigation',
  );
  assert.equal(
    ui.content.getAttribute('tabindex'),
    '-1',
    'the nav container needs a programmatic focus target',
  );
});

test('explicit close returns focus to the trigger', () => {
  const ui = loadDrawer({ desktop: false });
  ui.userToggle();
  const before = ui.trigger.focusCount;
  ui.userToggle();

  assert.ok(ui.trigger.focusCount > before, 'closing must return focus to the initiating control');
});

/* ---------------------------------------------------------------------------
 * 8. No-JavaScript fallback
 * ------------------------------------------------------------------------ */

test('markup ships the drawer open so navigation survives without JavaScript', () => {
  const layout = readFileSync(LAYOUT, 'utf8');

  assert.match(
    layout,
    /<details class="axf-drawer" id="axf-drawer" open>/,
    'the drawer must be open in the emitted HTML: with scripting disabled this is the only ' +
      'thing that keeps the navigation tree reachable (Interaction_Specification.md:57)',
  );
});

test('enhancement scripts are inline-referenced static files, never bundled', () => {
  const layout = readFileSync(LAYOUT, 'utf8');

  for (const name of ['drawer', 'sidebar-group', 'account-menu']) {
    const pattern = new RegExp(
      `<script is:inline defer src=\\{asset\\('/scripts/${name}\\.js'\\)\\}`,
    );
    assert.match(
      layout,
      pattern,
      `${name}.js must be referenced with is:inline (so Astro does not bundle it to a hashed ` +
        'name that fails verify-static.mjs check 8) and through asset() so it resolves at both bases',
    );
  }

  /*
   * REGRESSION: url() appends a trailing slash (trailingSlash: 'always'), which
   * turned the script src into '/axiora-fx/scripts/drawer.js/' and 404'd at the
   * preview base. Every verifier still passed, so only this assertion catches it.
   */
  assert.doesNotMatch(
    layout,
    /src=\{url\('\/scripts\//,
    'a static asset must use asset(), not url(): url() appends a trailing slash and 404s',
  );
});

test('search-filter is not wired while /search/ has no result markup', () => {
  const layout = readFileSync(LAYOUT, 'utf8');
  assert.doesNotMatch(
    layout,
    /search-filter\.js/,
    'search-filter ships with Group 10; wiring it now would load a script with nothing to filter',
  );
});

/* ---------------------------------------------------------------------------
 * The CSS invariant that makes the trap structurally impossible
 * ------------------------------------------------------------------------ */

test('shell.css hides the trigger only while the drawer is open', () => {
  const css = readFileSync(SHELL_CSS, 'utf8');

  /*
   * This is the real fix. The script keeps state coherent, but if it fails to
   * load the CSS must still never hide the only control that can reopen a closed
   * drawer. Asserted as source text because the failure mode is a CSS selector,
   * and a closed <details> cannot be reopened by author CSS at all: it hides
   * content via ::details-content { content-visibility: hidden } (verified in
   * Chrome 150 — checkVisibility() false, hit-test returns the ancestor, real
   * click times out).
   */
  assert.match(
    css,
    /\.axf-drawer\[open\]\s*>\s*\.axf-drawer-trigger\s*\{\s*display:\s*none/,
    'the trigger must be hidden only when the drawer is open',
  );

  const desktopBand = css.slice(css.indexOf('@media (min-width: 48em)'));
  assert.doesNotMatch(
    desktopBand.slice(0, desktopBand.indexOf('}\n}') + 3),
    /^\s*\.axf-drawer-trigger\s*\{\s*display:\s*none/m,
    'an unconditional `.axf-drawer-trigger { display: none }` in the 48em band is exactly the ' +
      'regression: it hid the control while the drawer could still be closed',
  );

  assert.doesNotMatch(
    css,
    /\.axf-drawer-content\s*\{\s*display:\s*block\s*!important/,
    'display:block !important on .axf-drawer-content cannot reveal a closed <details> and gave ' +
      'a false impression that the closed state was handled',
  );
});
