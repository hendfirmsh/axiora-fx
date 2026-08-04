// AXIORA Website MVP - Astro configuration
//
// Authority: implements 05_Technical_Foundation/01_Technical_Foundation_Decision_Note.md
// Section 7 (static export, GitHub Pages, base path) under decision K-12.
//
// Base path is configuration-driven and MUST NOT be hardcoded permanently.
//   Production (custom domain root): AXIORA_BASE unset or '/'
//   Preview (project path):          AXIORA_BASE='/axiora-fx/'
//
// No adapter is installed. Server output is therefore not merely unused but
// unavailable, per Decision Note Section 14 (prohibited capability confirmation).

import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

const site = process.env.AXIORA_SITE ?? 'https://axiora.my.id';
const base = process.env.AXIORA_BASE ?? '/';

export default defineConfig({
  site,
  base,

  // Static build. No adapter, no server runtime.
  output: 'static',

  // Explicit so canonical URLs stay stable between local preview and GitHub Pages.
  trailingSlash: 'always',

  build: {
    format: 'directory',
  },

  integrations: [mdx()],

  // Interim identity policy (15_Workspace_Blueprint.md:18-23):
  // no typeface selection, no brand colour, no invented symbol.
  // Styling is hand-written CSS custom properties; no CSS framework is installed.

  // Progressive enhancement: the public knowledge workspace ships only its
  // approved shell scripts. Firebase Auth is isolated to the private Console route.
  devToolbar: {
    enabled: false,
  },
});
