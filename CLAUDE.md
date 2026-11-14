# מה בא לך? (what_to_eat)
Free static Hebrew/RTL web app: a quiz guesses what Noga wants to eat, the result reaches Eitan live, then a picker chooses a place.
Vanilla JS ES modules, no build step, nothing shipped from npm. Firebase Firestore for data. GitHub Pages via Actions.

## Read first (only what the step needs)
- `docs/PROGRESS.md` — next step, which spec file to read for it, the run log. Always read this first.
- `docs/plan/rules.md` — usage guard, stale checks, autonomy rules. Read once per run.
- `docs/plan/steps.md` — step list with time budgets. `docs/plan/spec-*.md` — product spec by topic.
- `PLAN.md` — original data model and engine math (§4–§7). Where it disagrees with `docs/plan/`, `docs/plan/` wins.
- `docs/REVIEW.md` — log every judgment call here with how to change it.

## Commands
- `npm run test:unit` (node --test, dot reporter) · `npm run sim` · `npm run e2e` (Playwright, phase end only) · `npm test` (all)
- `npm run serve` → http://localhost:8000 (tools/serve.mjs, zero deps). ES modules do not load from file://.
- Node lives at `C:\Program Files\nodejs`; add it to PATH in the shell if `node` is not found.

## Hard rules
- Unattended: decide alone, never ask mid-run, log decisions in REVIEW.md. Push-notify only when blocked on the owner's account or phone, on money, or by the usage/stale rules.
- Usage: follow `C:\Users\eitan\.claude\usage-budget.md` (shared with SplitSmart) and log every run in `C:\Users\eitan\.claude\usage-ledger.md`. In short: weekly 70% soft / 75% hard, always; 5-hour 70/75% by day (08:00–24:00), 90/95% at night (00:00–08:00); this project's weekly share is 40 points.
- Stale: update `.build/heartbeat.json` at every step boundary. Step cap = 2× its budget. Run cap = 3 hours. Every command gets a timeout.
- Each step: targeted tests → commit. Each phase: `npm test` → tag `phase-N` → push → check the Actions run.
- Never weaken or delete a passing test. Max 3 fix attempts per failure, then mark it todo and log it.
- No phone numbers, room ids, ntfy topics or personal data in the repo.
- Hebrew: feminine 2nd person, questions not commands, the app speaks as Eitan. All strings live in `js/data/strings.js`.
- UI and engine reach data only through the Store interface (`js/store/`).
- No `git push --force`, `reset --hard` or `clean`. No subagents, except the boss's one worker at a time (Sonnet to build, Opus to research; see `C:\Users\eitan\.claude\boss\BOSS.md`).
- Handover: a worker whose context passes 100k tokens or ~40 tool calls stops at a safe point, commits what passes the tests, and writes the "Resume note" in `docs/PROGRESS.md`.

## Tokens
Read one spec file at a time and only the range needed. Quiet test output. Check pages by text, not screenshots. Short log lines, no long chat.
