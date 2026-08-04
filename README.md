# AXIORA FX

AXIORA Financial Intelligence Workspace, a static Astro website and private Console workspace currently in development.

## Development

Requirements:

- Node.js `>=22.12.0`
- npm

Install dependencies and start the local server:

```bash
npm install
npm run dev
```

Run the complete verification gate before publishing:

```bash
npm run verify:gate
```

The build is static and emitted to `dist/`.

## Deployment

The production site is hosted on Firebase Hosting under project `axiora-fx-hendfirmsh`.

```bash
firebase deploy --only hosting --project "axiora-fx-hendfirmsh" --non-interactive
```

## Status

This repository is private while AXIORA FX is under development. Market data, Console metrics, activity, usage, and workspace records are currently demo data. Firebase Authentication and Firestore integrations remain subject to project configuration.
