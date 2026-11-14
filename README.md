# מה בא לך?
A small Hebrew web app: a guessing quiz figures out what she wants to eat, the answer reaches him live, and a picker helps choose a place.

Static site (vanilla JS, no build step) + Firebase Firestore. Published with GitHub Pages by GitHub Actions when tests pass.

## Run locally
```bash
npm install
npx playwright install chromium webkit
npm run serve      # http://localhost:8000
npm test           # unit tests, accuracy sim, end-to-end tests
```

## Useful
- `node tools/fetch-photos.mjs` downloads food photos from Wikimedia Commons (credits in `img/foods/credits.json`, contact sheet at `/photos.html`).
- `node tools/make-icons.mjs` redraws the app icons in `img/icons/`.
- `node tools/check-firebase.mjs` checks the deployed Firestore rules against the real project.
- Installable as a PWA (`manifest.webmanifest`, `sw.js`; the service worker is off on localhost unless the URL has `?sw`). Each deploy stamps a new worker version, so open apps offer "גרסה חדשה — לרענן?".

Docs: `PLAN.md` (original spec), `docs/plan/` (final plan), `docs/PROGRESS.md`, `docs/REVIEW.md`.
