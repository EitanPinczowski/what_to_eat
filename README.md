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

Docs: `PLAN.md` (original spec), `docs/plan/` (final plan), `docs/PROGRESS.md`, `docs/REVIEW.md`.
