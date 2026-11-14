# Progress
**Next step: 4.1** · Resume note: —

## Steps (budget in minutes · spec to read)
- [x] S0 scaffolding (25)
- [x] 1.1 data: tags, foods, questions, strings (40) · spec-questions.md, spec-foods.md, PLAN.md §4
- [x] 1.2 engine + unit tests (50) · spec-questions.md rules R1–R12, PLAN.md §5.4 and §6
- [x] 1.3 sim + tuning, max 3 rounds (40) · PLAN.md §6.5
- [x] 1.4 share: codec, links, whatsapp + tests (15) · overview.md (Links row), PLAN.md §5.1–5.2
- [x] 1.5 mockup, pick direction, tokens.css (40) · spec-loops-places-design.md §2.8 → tag phase-1
- [ ] 1.6 design revision from Eitan (40) — do this before 2.2: (a) LESS ORANGE: replace the coral accent and the cream background with a palette that is not orange (fresh green or berry accent on a near-white background; keep the Rubik pop shapes), update css/tokens.css, dark theme and design/mockup.html; (b) CLEARER FOOD ICONS: emoji alone does not say what a food is, so pull step 3.4 (Wikimedia photo script, credits, contact sheet) forward into this step; every food card (guess, grid, duel, pick list, sweep, brain) shows photo + name + a small category label (חטיף / מתוק / ארוחה / אוכל רחוב / ארוחת בוקר / בישול ביתי / טרי); emoji stays only on question answers and as the fallback when a photo is missing. Log choices in REVIEW.md and tick 3.4 as done here. (c) NO SKIP FOR HER: remove every "🤷‍♀️ לא משנה לי" option from guest screens: the skip link on questions (STR.skip) and the "any" mode chip on the finish screen (strings.js line ~57); the finish screen offers only sit / take / delivery / cook. Engine skip support may stay but the guest UI never calls it; update tests and the sim user model accordingly (sim must not skip). See spec-questions.md R5.
- [x] 2.1 stores + rules + tests (50) · spec-flow-firebase.md §2.2, PLAN.md §5.3
- [x] 2.2 dom, router, guest quiz screens (60) · spec-flow-firebase.md §2.1
- [x] 2.3 finish/send, live doc, ntfy, feedback, error log, fallback (40) · spec-flow-firebase.md
- [x] 2.4 owner home, send-quiz, toast, history, next-to-me mode (45) · PLAN.md §7.4
- [x] 2.5 e2e quiz spec, code review, tag phase-2 (30)
- [x] 3.1 brain + food form (45) · PLAN.md §7.4
- [x] 3.2 guest sweep, send-sweep, e2e (45) · PLAN.md §7.3
- [x] 3.3 learning, stats, "how was it?" (40) · spec-loops-places-design.md §2.6
- [x] 3.4 photo script, credits, contact sheet (30) · spec-foods.md
- [ ] 4.1 picker logic + tests (25) · spec-loops-places-design.md §2.7, PLAN.md §5.5
- [ ] 4.2 places UI, quick-add, picker UI, e2e, tag phase-4 (50)
- [ ] 5.1 settings, backup, reminder (35)
- [ ] 5.2 PWA, sw, update toast, iOS help (35)
- [ ] 5.3 polish, accessibility review, Hebrew copy pass (45)
- [ ] 5.4 code review, docs, final REVIEW.md, tag phase-5, notify done, disable the nightly task (25)

## Run log (date · steps done · minutes · 5h% start→end · weekly% start→end · notes)
- 2026-11-14 · S0 · interactive session · scaffolding. Firebase project ready: config in js/firebase-config.js, rules published and verified with tools/check-firebase.mjs (7/7 pass)
- 2026-11-14 · dry run · model: claude-opus-5-5 · cwd at start: C:\Users\eitan\OneDrive\Desktop\what_to_eat · 5h 82% · weekly 42% · unit tests pass · usage tool worked
