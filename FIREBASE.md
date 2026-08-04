# AXIORA Firebase Runbook

## Scope

AXIORA uses the Firebase Spark project `axiora-fx-hendfirmsh` (project number
`160510298004`). All commands in this runbook specify that project explicitly.
Do not run AXIORA deployments against any Anamiroh project.

The public site is hosted at <https://axiora-fx-hendfirmsh.web.app>. The current
application is a statically generated Astro site. Firebase Authentication and
Cloud Firestore are client-side services; no server runtime or billing upgrade
is required for the planned MVP.

## Current Status

- Firebase Hosting: deployed.
- Web app `AXIORA FX Web`: active.
- Google sign-in: implemented in the client, but the provider must still be
  enabled in Firebase Authentication.
- Cloud Firestore: local rules and indexes are ready, but the Firestore API and
  `(default)` database are not active yet.
- Console usage, activity, and workspace values: simulated demo data.

## Verify and Deploy Hosting

Run the complete local gate before every production release:

```powershell
npm run verify:gate
firebase deploy --only hosting --project "axiora-fx-hendfirmsh" --non-interactive
```

The Hosting deployment must report `hosting[axiora-fx-hendfirmsh]`. Verify the
homepage and `/console/` on the production URL after release.

## Activate Authentication

In Firebase Console, select only `axiora-fx-hendfirmsh`, then open
**Build > Authentication > Sign-in method** and enable Google. Choose the
project support email and save. Do not add private OAuth secrets to this repo.

The Firebase Web SDK configuration in `src/lib/firebase.ts` contains public
application identifiers, not server credentials.

## Activate Firestore

In Google Cloud Console, select only `axiora-fx-hendfirmsh` and enable the
Cloud Firestore API. Then create the native `(default)` database in `nam5`:

```powershell
firebase firestore:databases:create "(default)" --location "nam5" --project "axiora-fx-hendfirmsh"
firebase deploy --only firestore --project "axiora-fx-hendfirmsh" --non-interactive
```

Validate `firestore.rules` with the Firebase rules validator or the Firestore
Emulator before deploying. The currently installed Firebase CLI does not expose
a standalone `firestore:rules:test` command. Never deploy permissive test-mode
rules. Firestore rules are not automatically rolled back with Hosting.

## Rollback

Hosting retains previous releases. To roll back without rebuilding:

1. Open Firebase Console for `axiora-fx-hendfirmsh`.
2. Open **Build > Hosting**.
3. Find the last known-good release in release history.
4. Use its overflow menu and select **Rollback**.
5. Verify `/` and `/console/` on the production URL.

For a source-level rollback, restore from the pre-Firebase backup at
`..\backups\axiora-fx-pre-firebase-20260804-033750`, rebuild, run the complete
verification gate, and deploy Hosting explicitly to `axiora-fx-hendfirmsh`.

Firestore rules require a new deployment of a known-good rules file; Firebase
does not support rolling Security Rules back as part of a Hosting rollback.
