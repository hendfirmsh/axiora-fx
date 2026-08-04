# AXIORA Sidebar Refinement

## Scope

This pass refines the existing AXIORA sidebar without changing branding, color
roles, routes, or product behavior. The objective is a consistent enterprise
SaaS composition across desktop, tablet, collapsed, and mobile states.

## System Contract

- Expanded width: `--axf-sidebar-width` (`15.5rem`).
- Collapsed width: `--axf-sidebar-collapsed-width` (`4.5rem`).
- Minimum interactive row: `--axf-sidebar-item-height` (`44px`).
- Icon virtual box: `--axf-sidebar-icon-size` (`20px`).
- Outer padding, content inset, section rhythm, row gaps, radius, type roles,
  and tracking use sidebar component tokens from `src/styles/tokens.css`.
- Brand and search form the orientation region.
- Knowledge navigation is the only independently scrolling region on tablet
  and desktop.
- Workspace, settings, appearance, support, feedback, and version form one
  pinned footer with a single structural divider.
- Mobile retains the native `details`/`summary` progressive-enhancement path.

## Refinements

- Reduced expanded width from `17.5rem` to `15.5rem`.
- Replaced unrelated margins with a shared 4px/8px-derived component rhythm.
- Standardized every sidebar row to the same height, radius, horizontal inset,
  icon column, label baseline, hover state, and active state.
- Rebuilt search as a compact reusable control aligned to the navigation grid.
- Reduced workspace-card height and aligned workspace name, username, and role.
- Grouped Settings and Appearance under Workspace; grouped Help center and
  Feedback under Support.
- Added current-page semantics to the Console workspace card.
- Removed redundant middle dividers and obsolete divider/badge primitives.
- Corrected collapsed-rail scrollbar and workspace-height alignment.

## QA Matrix

- Desktop expanded at `1440x900`: aligned and pinned; no horizontal overflow.
- Desktop short height at `1280x700`: footer remains pinned and navigation
  becomes the only scrolling region.
- Tablet at `768x1024`: expanded and collapsed states remain within viewport.
- Collapsed rail: `72px` wide, fixed icon boxes, labels hidden, actions retained.
- Mobile at `390x844`: no wrapping or horizontal overflow; Escape closes the
  drawer and returns focus to the trigger.
- Dark and light themes: Appearance label and persisted state update correctly.
- Keyboard focus, active semantics, native disclosure behavior, and minimum
  target dimensions remain intact.

## Verification

Run before deployment:

```powershell
npm run verify:gate
firebase deploy --only hosting --project "axiora-fx-hendfirmsh" --non-interactive
```
# Navigation Architecture Update

- Collapse control now lives beside the AXIORA logo inside the sidebar header; the application header retains only the mobile drawer control.
- The navigation tree is the sidebar's only scrollable region. The AXIORA FX workspace card is pinned below it as the account entry point.
- Settings, Appearance, Support, Feedback, and version actions no longer occupy permanent sidebar space.
- The workspace card opens an accessible account menu with workspace, profile, management, preferences, help, documentation, feedback, and sign-out actions.
- Account menu interaction supports outside click, `Escape`, Home/End, arrow-key navigation, focus return, and mobile viewport containment.
- Console and Settings routes no longer render the public marketing/trust footer.
- Mobile navigation remains progressively enhanced from native open `<details>` markup and is operable from the sticky application header.
