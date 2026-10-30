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

## Intelligence News

`/news/` renders the static feed at `public/data/news/latest.json`. The feed is
refreshed by `.github/workflows/news.yml` every 30 minutes using the
`MARKETAUX_API_TOKEN` Actions secret, then validated, built, committed only when
it changed, and deployed through `deploy-pages.yml`.

See [NEWS.md](NEWS.md) for the data contract, provider limits, local commands,
failure policy, retention, and the current noindex/licensing caveat.

## Deployment

The production site is hosted on GitHub Pages at `https://axiora.my.id/`. Pushing
`main` runs `.github/workflows/deploy-pages.yml`, which builds, verifies, and
deploys `dist/`.

## Status

This repository is private while AXIORA FX is under development. Market data, Console metrics, activity, usage, and workspace records are currently demo data. Firebase Authentication and Firestore integrations remain subject to project configuration.
