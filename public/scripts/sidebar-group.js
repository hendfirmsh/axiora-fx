/**
 * AXIORA — approved enhancement script 2 of 3: sidebar-group.
 *
 * Authority: 04_Workspace_Architecture/11_Interaction_Specification.md:12,57
 *            04_Workspace_Architecture/04_Knowledge_Navigation.md:63-67
 *            04_Workspace_Architecture/10_Component_Inventory.md:9
 *            05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md:38
 *
 * Group expansion is ALREADY fully functional without this file: each group is a
 * native <details>/<summary>, and the group holding the current route is emitted
 * with `open` at build time (NavigationTree.astro). Keyboard, touch, and ARIA
 * expanded state come from the browser.
 *
 * This script adds exactly one thing: expansion state persists across
 * navigations, so a reader who opened a group does not lose it on every page
 * load. Interaction_Specification.md:12 requires expanding a group to reveal
 * children "without changing page"; static pages cannot remember that.
 *
 * DELIBERATE NON-GOALS
 *
 * - No accordion. Collapsing a sibling the reader opened would be an unrequested
 *   UX change, and nothing in the contract asks for one-at-a-time groups.
 * - The group containing the current route is never collapsed from storage. It is
 *   open because "the current path requires it" (Knowledge_Navigation.md:63);
 *   stored state must not override the active path.
 * - sessionStorage, not localStorage: navigation state is per visit, and this
 *   avoids indefinite client-side persistence. No analytics, no profiling (K-04).
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'axf.nav.expanded';

  var nav = document.querySelector('.axf-drawer-content');
  if (!nav) return;

  var groups = nav.querySelectorAll('.axf-nav-group');
  if (!groups.length) return;

  /*
   * Storage is a progressive enhancement, not a requirement. It throws in
   * private modes and when cookies/storage are blocked, so every access is
   * guarded and failure degrades to build-time open state.
   */
  function readStored() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return Object.prototype.toString.call(parsed) === '[object Array]' ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeStored(labels) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    } catch (error) {
      /* Storage unavailable or full: expansion still works for this page. */
    }
  }

  /* Identity is the group label: stable across pages and already in the DOM. */
  function labelOf(group) {
    var el = group.querySelector('.axf-nav-group-label');
    var text = el && el.textContent ? el.textContent : '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /* True when the group holds the current route; such a group stays open. */
  function holdsCurrent(group) {
    return !!group.querySelector('[aria-current="page"]');
  }

  function currentlyExpanded() {
    var out = [];
    for (var i = 0; i < groups.length; i += 1) {
      if (groups[i].open) {
        var label = labelOf(groups[i]);
        if (label) out.push(label);
      }
    }
    return out;
  }

  var stored = readStored();

  if (stored) {
    for (var i = 0; i < groups.length; i += 1) {
      var group = groups[i];
      if (holdsCurrent(group)) continue;
      var label = labelOf(group);
      if (!label) continue;
      /*
       * Restores the reader's own state in both directions. Assigning .open
       * directly fires `toggle`, so the listener below re-persists — harmless,
       * because it writes the state we just applied.
       */
      group.open = stored.indexOf(label) !== -1;
    }
  }

  for (var j = 0; j < groups.length; j += 1) {
    groups[j].addEventListener('toggle', function () {
      writeStored(currentlyExpanded());
    });
  }
})();
