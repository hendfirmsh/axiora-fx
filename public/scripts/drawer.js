/**
 * AXIORA — approved enhancement script 1 of 3: drawer.
 *
 * Authority: 04_Workspace_Architecture/11_Interaction_Specification.md:13,14,29,57
 *            04_Workspace_Architecture/02_Application_Shell.md:25,29
 *            04_Workspace_Architecture/12_Responsive_Workspace.md:11,13
 *            04_Workspace_Architecture/13_Accessibility_Workspace.md:19
 *            05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md:38
 *
 * WHY THIS IS A STATIC FILE IN public/ AND NOT AN ASTRO <script>
 *
 * scripts/verify-static.mjs check 8 whitelists client JavaScript by FILE NAME
 * (APPROVED_SCRIPTS). An Astro-processed script is bundled to a hashed name such
 * as _astro/hoisted.CxYz.js, which matches no approved name and would fail the
 * gate. A static file keeps the emitted name auditable and keeps the bundler out
 * of the zero-runtime-dependency guarantee.
 *
 * PROGRESSIVE ENHANCEMENT CONTRACT
 *
 * The markup ships <details open>, so with scripting disabled the full
 * navigation tree is present and the reader simply scrolls past it. This script
 * only refines the DEFAULT STATE and adds focus/Escape handling. It is never
 * required for navigation to work.
 *
 * THE FORBIDDEN STATE
 *
 * "closed drawer + hidden trigger" makes navigation unreachable. That state is
 * blocked in CSS, not here: shell.css hides the trigger only while the drawer is
 * open (.axf-drawer[open] > .axf-drawer-trigger). This script therefore cannot
 * create the forbidden state even if a transition is interrupted, and the
 * guarantee still holds if this file fails to load.
 *
 * A closed <details> hides content via ::details-content with
 * content-visibility: hidden, so author CSS cannot reveal it. Verified in
 * Chrome 150. That is why the control must stay reachable rather than the
 * content being force-shown.
 *
 * No dependency. No polling. No resize listener — breakpoint changes arrive
 * through matchMedia change events only.
 */
(function () {
  'use strict';

  /* Must stay in sync with the 48em band in src/styles/shell.css. */
  var DESKTOP_QUERY = '(min-width: 48em)';

  var drawer = document.getElementById('axf-drawer');
  if (!drawer) return;

  var shell = document.querySelector('.axf-shell');
  var sidebarToggle = document.querySelector('[data-sidebar-toggle]');
  var sidebarToggleLabel = document.querySelector('[data-sidebar-toggle-label]');

  var trigger = drawer.querySelector('.axf-drawer-trigger');
  var content = drawer.querySelector('.axf-drawer-content');
  var headerTrigger = document.querySelector('[data-drawer-toggle]');
  if (!trigger || !content) return;

  if (!window.matchMedia) return; /* No matchMedia: leave the open fallback. */
  var desktop = window.matchMedia(DESKTOP_QUERY);

  function setSidebarCollapsed(collapsed, persist) {
    if (!shell || !sidebarToggle) return;
    shell.setAttribute('data-sidebar-collapsed', String(collapsed));
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar');
    if (sidebarToggleLabel) sidebarToggleLabel.textContent = collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar';
    if (persist) {
      try { window.localStorage.setItem('axiora-sidebar-collapsed', String(collapsed)); } catch (_) { /* no-op */ }
    }
  }

  if (sidebarToggle) {
    var storedCollapsed = null;
    try { storedCollapsed = window.localStorage.getItem('axiora-sidebar-collapsed'); } catch (_) { storedCollapsed = null; }
    setSidebarCollapsed(storedCollapsed === 'true', false);
    sidebarToggle.addEventListener('click', function () {
      if (!isDesktop()) return;
      setSidebarCollapsed(shell.getAttribute('data-sidebar-collapsed') !== 'true', true);
    });
  }

  /*
   * Distinguishes a reader's toggle from a programmatic sync. Without this, a
   * breakpoint change would move focus, which 11_Interaction_Specification.md:29
   * forbids: focus is managed only for the drawer's own open lifecycle.
   */
  var userToggled = false;

  function isDesktop() {
    return !!desktop.matches;
  }

  function setOpen(open) {
    if (drawer.open === open) return false;
    drawer.open = open;
    if (headerTrigger) headerTrigger.setAttribute('aria-expanded', String(open));
    return true;
  }

  /* 11_Interaction_Specification.md:13 — opening moves focus into navigation. */
  function focusNavigation() {
    if (!content.getAttribute || content.getAttribute('tabindex') === null) {
      content.setAttribute('tabindex', '-1');
    }
    if (typeof content.focus === 'function') content.focus();
  }

  /* :14 and 13_Accessibility_Workspace.md:19 — focus returns to the trigger. */
  function returnFocusToTrigger() {
    if (typeof trigger.focus === 'function') trigger.focus();
  }

  function holdsFocus() {
    var active = document.activeElement;
    if (!active || !content.contains) return false;
    return content.contains(active);
  }

  /*
   * Closing must not orphan focus. If focus sits inside the tree being hidden,
   * it returns to the trigger; otherwise the reader's place is left untouched.
   */
  function close() {
    var hadFocus = holdsFocus();
    var changed = setOpen(false);
    if (changed && hadFocus) returnFocusToTrigger();
    return changed;
  }

  /*
   * Single source of truth for the default state at the current width.
   *
   * Desktop opens FIRST; the trigger is hidden by CSS as a consequence of being
   * open, so the ordering requirement ("open before the trigger disappears") is
   * satisfied structurally and cannot race.
   */
  function sync() {
    if (isDesktop()) {
      setOpen(true);
    } else {
      close();
    }
  }

  trigger.addEventListener('click', function () {
    userToggled = true;
  });

  if (headerTrigger) {
    headerTrigger.addEventListener('click', function (event) {
      if (isDesktop()) return;
      event.preventDefault();
      if (drawer.open) {
        setOpen(false);
        headerTrigger.focus();
      } else {
        setOpen(true);
        focusNavigation();
      }
    });
  }

  drawer.addEventListener('toggle', function () {
    if (!userToggled) return;
    userToggled = false;
    if (drawer.open) {
      /* Desktop never traps focus in a sidebar that is always visible. */
      if (!isDesktop()) focusNavigation();
    } else {
      returnFocusToTrigger();
    }
  });

  document.addEventListener('keydown', function (event) {
    if ((event.key || '') !== 'Escape') return;
    var accountTrigger = document.querySelector('[data-account-menu-trigger]');
    if (accountTrigger && accountTrigger.getAttribute('aria-expanded') === 'true') return;
    /*
     * Escape is mobile-only. On tablet and up the sidebar is persistent
     * (12_Responsive_Workspace.md:13) and must not have a dismiss action that
     * removes primary navigation.
     */
    if (isDesktop() || !drawer.open) return;
    setOpen(false);
    returnFocusToTrigger();
  });

  if (typeof desktop.addEventListener === 'function') {
    desktop.addEventListener('change', sync);
  } else if (typeof desktop.addListener === 'function') {
    desktop.addListener(sync); /* Legacy Safari MediaQueryList. */
  }

  sync();
})();
