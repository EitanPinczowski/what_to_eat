## 3. How the build runs

### 3.1 Preflight (with you, ~15 min, then scaffolding by me in this session, ~25 min)
You: (1) install the two plugins from the card (frontend-design, firebase); (2) create a Firebase project on the Spark
plan, add a web app, paste me its config, and click "create Firestore" (`eur3`) and "enable Anonymous sign-in";
(3) approve the prompts for creating `C:\dev\what_to_eat` and its settings, and open that folder once in the app;
(4) leave the PC on with the Claude app open at night.
Me (**S0**, the only build work done in this 219k-token session): create the folder and copy `PLAN.md`; write memory
files; `CLAUDE.md` (≤40 lines); split this plan into `docs/plan/overview.md` + one file per phase; `docs/PROGRESS.md`
and `docs/REVIEW.md`; `.claude/settings.json` (allowlist, `model: sonnet`, unrelated plugins off); install Node LTS;
`package.json`, Playwright (Chromium + WebKit); `git init`, repo, Actions workflow (`npm test` → deploy Pages);
deploy `firestore.rules`; create the nightly task; **run it once as a 2-minute dry run** to prove it can read usage,
edit the folder, run tests and push without prompts. If the dry run can't work unattended, I tell you before you leave.

### 3.2 Nightly driver
A scheduled task, `0 1 * * *` (01:00 local), each run a fresh session with a self-contained prompt:
"In `C:\dev\what_to_eat`: check usage → run the stale check → read `CLAUDE.md`, `docs/PROGRESS.md` and the current
phase file → do the next steps → stop by the rules below." One run per night, so its 5-hour window resets by ~06:00 and
your daytime usage is untouched. When step 5.4 is done the task disables itself.
Fallback if scheduled runs can't work unattended: you send "continue the build" in a fresh session in that folder.

### 3.3 Usage guard — always leave ≥20% free, on the 5-hour window and the weekly limit
- First action of every run: `get_usage`. If either limit is ≥80%, exit at once.
- Re-check after every step. At ≥75% start no new step; at 80% commit WIP, write "resume at" in PROGRESS.md, stop.
- Weekly ≥80%: one push notification ("paused for weekly budget"); later runs exit silently until the weekly reset.
- At planning time you were on Pro at 36% (5-hour) and 36% (weekly), so expect the build to take **about 7–10 nights**.
  That is an estimate; PROGRESS.md records actual minutes and usage % per step so it gets sharper after night one.

### 3.4 Stale-session checks
- **Heartbeat:** `.build/heartbeat.json` (gitignored) holds run id, current step, step start and last-progress time,
  updated at every step boundary and after every test run.
- **Per-step time cap = 2× the step's work-time budget** (table in §4). Over the cap: stop retrying, commit WIP, log it
  in REVIEW.md, move to the next independent step.
- **Per-run cap: 3 hours** wall-clock. At the cap: commit WIP, write the resume point, end the run.
- **Every command has a timeout** (tests 5 min, installs 10 min); no interactive commands; no server left running
  (Playwright starts and stops its own).
- **At run start:** a heartbeat fresher than 30 min means another run is active → exit. An "in progress" heartbeat
  older than 30 min means the last run died: stop that session if the app allows, inspect `git status`, keep good WIP,
  resume from the last finished step.
- **Stuck detection:** the same step unfinished on 2 nights → skip it, log it, push-notify. No finished step for
  3 nights in a row → push-notify "build stalled" and disable the task.

### 3.5 Autonomy rules (in CLAUDE.md)
- Decide alone anything this plan covers or implies; never ask mid-run. Log each judgment call in `docs/REVIEW.md`
  with how to change it (design direction, wording changes, sim trade-offs, skipped items).
- Stop and push-notify only for: something needing your account, credentials or phone; anything that costs money;
  irreversible actions outside the plan; the usage and stale rules above.
- Failure budget: 3 fix attempts per failing test, then `todo` + REVIEW.md note. Never weaken or delete a passing test.
  Sim: best of 3 tuning rounds is accepted and logged. Flaky e2e: 1 retry, then `fixme` + log.
- Each step ends: targeted tests → commit. Each phase ends: `npm test` → tag `phase-N` → push → check the Actions run.
- Allowlist: edits inside the project; `node`, `npm`, `npx playwright`, `python -m http.server`, `git` (no
  `push --force`, `reset --hard`, `clean`), `gh` for this repo, usage/push/browser-preview/firebase tools. Anything else prompts.
- Token rules: one phase file at a time; read only the needed file or range; quiet test reporters; page checks by text,
  screenshots only for the mockup; e2e only at phase end; no subagents; short logs instead of chat.

