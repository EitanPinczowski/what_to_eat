# Progress
**Next step: round 3, R1c-2** (see "Round 3" below).

## W6 done (1d learning, check-in feed, self-pruning): see REVIEW.md. Next: W7 (1e couple mode).
## W7 done (couple mode 1e): see REVIEW.md. firestore.rules changed (live/couple), needs the owner deploy.

## Round 3 (2026-11-17) — next step: R1c-2
Plan (read only the step's section): `C:/Users/eitan/.claude/plans/build-the-next-improvement-iridescent-pebble.md`. Queue and status: `C:/dev/boss/ideas.md` (R-items).
- Done: R0 hotfix (2653691, rules deployed), R1c-1 food types (938abdb..1c07353, CI green). Log: docs/REVIEW.md "Round 3".
- Next, in order: **R1c-2** category first, then the food (plan §C) → R1c-3 more foods (thai/chinese/indian < 4, `tests/cuisines.test.js` lists them) → R1 question meaning (§A, A6) → R1b → R2 → R3–R5 (her screens, copy) → R6–R7 (owner's 14 ticked UX picks, approval page `picks`).
- Open: Noga's first real send since R0 is unconfirmed (no history doc after 15 Nov yet). First real cron check-in today 09:00 UTC (`vercel logs` in C:/dev/wte-push).
- Gotchas: start-up budget 194 KB (≈1 KB headroom). CI runs `--fail-on-flaky-tests`; e2e quiz loops must call `magnets(page)` (e2e/helpers.js). Changed screenshots: delete the stale `*-linux.png`, push, take the regenerated file from the CI artifact `screenshot-baselines-linux`.

## Steps (budget in minutes · spec to read)
- [x] S0 scaffolding (25)
- [x] 1.1 data: tags, foods, questions, strings (40) · spec-questions.md, spec-foods.md, PLAN.md §4
- [x] 1.2 engine + unit tests (50) · spec-questions.md rules R1–R12, PLAN.md §5.4 and §6
- [x] 1.3 sim + tuning, max 3 rounds (40) · PLAN.md §6.5
- [x] 1.4 share: codec, links, whatsapp + tests (15) · overview.md (Links row), PLAN.md §5.1–5.2
- [x] 1.5 mockup, pick direction, tokens.css (40) · spec-loops-places-design.md §2.8 → tag phase-1
- [x] 1.6 design revision from Eitan (40) — DO FIRST, retrofit onto the existing UI (steps 2.2–5.1 are already built and 3.4 photos exist): (a) LESS ORANGE: replace the coral accent and the cream background with a palette that is not orange (fresh green or berry accent on a near-white background; keep the Rubik pop shapes), update css/tokens.css, dark theme and design/mockup.html; (b) CLEARER FOOD ICONS: emoji alone does not say what a food is, so pull step 3.4 (Wikimedia photo script, credits, contact sheet) forward into this step; every food card (guess, grid, duel, pick list, sweep, brain) shows photo + name + a small category label (חטיף / מתוק / ארוחה / אוכל רחוב / ארוחת בוקר / בישול ביתי / טרי); emoji stays only on question answers and as the fallback when a photo is missing. Log choices in REVIEW.md and tick 3.4 as done here. (c) NO SKIP FOR HER: remove every "🤷‍♀️ לא משנה לי" option from guest screens: the skip link on questions (STR.skip) and the "any" mode chip on the finish screen (strings.js line ~57); the finish screen offers only sit / take / delivery / cook. Engine skip support may stay but the guest UI never calls it; update tests and the sim user model accordingly (sim must not skip). See spec-questions.md R5. OWNER PICKED PALETTE B berry (2026-11-14): light: background #FBF6FA, ink #3A1630, accent #B0306E, soft #F3D7E6; derive the dark theme from these (dark plum background, light pink ink, brighter berry accent). Keep Rubik pop shapes (2px ink borders, offset shadows).
- [x] 2.1 stores + rules + tests (50) · spec-flow-firebase.md §2.2, PLAN.md §5.3
- [x] 2.2 dom, router, guest quiz screens (60) · spec-flow-firebase.md §2.1
- [x] 2.3 finish/send, live doc, ntfy, feedback, error log, fallback (40) · spec-flow-firebase.md
- [x] 2.4 owner home, send-quiz, toast, history, next-to-me mode (45) · PLAN.md §7.4
- [x] 2.5 e2e quiz spec, code review, tag phase-2 (30)
- [x] 3.1 brain + food form (45) · PLAN.md §7.4
- [x] 3.2 guest sweep, send-sweep, e2e (45) · PLAN.md §7.3
- [x] 3.3 learning, stats, "how was it?" (40) · spec-loops-places-design.md §2.6
- [x] 3.4 photo script, credits, contact sheet (30) · spec-foods.md
- [x] 4.1 picker logic + tests (25) · spec-loops-places-design.md §2.7, PLAN.md §5.5
- [x] 4.2 places UI, quick-add, picker UI, e2e, tag phase-4 (50)
- [x] 5.1 settings, backup, reminder (35)
- [x] 5.2 PWA, sw, update toast, iOS help (35)
- [x] 5.3 polish, accessibility review, Hebrew copy pass (45)
- [x] 5.4 code review, docs, final REVIEW.md, tag phase-5, notify done, disable the nightly task (25)

## Owner how-to: food photos (items 21–23)
1. `npm run serve`, open http://localhost:8000/photos.html. Tap the photo you like for each food, or the emoji to keep the emoji. Picks are saved in the browser as you go.
2. "Download picks.json" (or "Copy" and save it as picks.json).
3. `node tools/apply-picks.mjs picks.json` (downloads only the picked files, makes img/foods/<id>-160.webp and -400.webp, updates js/data/photos.json and photo-credits.json).
4. Commit the new webp files and the two json files. Candidates can be refreshed with `node tools/candidates.mjs --force`.

## Run log (date · steps done · minutes · 5h% start→end · weekly% start→end · notes)
- 2026-11-14 · S0 · interactive session · scaffolding. Firebase project ready: config in js/firebase-config.js, rules published and verified with tools/check-firebase.mjs (7/7 pass)
- 2026-11-14 · dry run · model: claude-opus-5-5 · cwd at start: C:\Users\eitan\OneDrive\Desktop\what_to_eat · 5h 82% · weekly 42% · unit tests pass · usage tool worked
- 2026-11-14 · 1.1–5.1 (16 steps; phases 1, 2, 4 tagged) · ~34 min (17:04–17:38) · 5h 7%→45% · weekly 46%→51% · claude-opus-5-5 · daytime run, stopped at the 45% line. Sim 84% exact/96% found/11.8 steps (step target WARN). Not done unattended: photo download, rules string caps (see REVIEW.md)
- 2026-11-14 · 1.6, 5.2, 5.3, 5.4 (phase-5 tagged, CI + Pages green) · ~15 min (17:48–18:03) · 5h 50%→61% · weekly 52%→54% · claude-opus-5-5 · owner 80% day cap (task prompt). Sim no-skip: exact 77%, found 94.95% → found gate 94.5%. Not done: photo download, rules deploy (need owner in a live session)

## W1 (feelings quiz) done
Bank, staged engine, lazy retired questions, tests, sim floors: all green, see docs/REVIEW.md "W1: feelings quiz". Left: show `cravingSummary` on the result screen (helper and strings exist, not wired); regenerate Linux screenshot baselines only if CI shows a diff.
