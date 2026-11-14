## 4. Steps and work times (estimates; cap = 2×)
| Step | Work | Budget |
|---|---|---|
| **P** | Preflight with you | 15 min |
| **S0** | Scaffolding + dry run (this session) | 25 min |
| **1.1** | `js/data/`: tags, ~90 foods with seasons, questions, `strings.js` | 40 min |
| **1.2** | `js/engine/`: similarity, prior, `FoodQuiz` (softmax, question choice, schedule, grid/duel/guess/pick, undo, skip, shuffle, mood title) + unit tests | 50 min |
| **1.3** | `tests/sim.js` + tuning: exact ≥75%, in final list ≥95%, ≤10 steps, coverage report | 40 min |
| **1.4** | `js/share/`: codec (fallback `#r=` only), links, whatsapp + tests | 15 min |
| **1.5** | `design/mockup.html`, pick direction, `css/tokens.css`, base components | 40 min |
| **2.1** | Store interface, `memory.js`, `local.js`, `firebase.js`, rules, store tests | 50 min |
| **2.2** | `ui/dom.js`, router, `main.js`, guest quiz screens | 60 min |
| **2.3** | Finish + send, `live` doc (opened/resume), ntfy, feedback, error log, `#r=` fallback | 40 min |
| **2.4** | Owner: home, send-quiz, live toast, history, fallback import, "she's next to me" mode | 45 min |
| **2.5** | `e2e/quiz.spec.js` (Pixel + iPhone), `/code-review low --fix`, tag `phase-2` | 30 min |
| **3.1** | Brain (stats, search, rate, notes, inbox) + food form | 45 min |
| **3.2** | Guest sweep (saves each rating live), send-sweep, `e2e/sweep.spec.js` | 45 min |
| **3.3** | Learning from picks, accuracy stats, "how was it?" | 40 min |
| **3.4** | Photo script, credits, contact sheet | 30 min |
| **4.1** | `places/picker.js` (budget, Shabbat, recency) + tests | 25 min |
| **4.2** | Places UI, place form, quick-add, picker UI, `e2e/picker.spec.js`, tag `phase-4` | 50 min |
| **5.1** | Settings: names, phones, connect device, rotate key, backup export/import, monthly backup reminder, reset | 35 min |
| **5.2** | PWA: manifest, icons, versioned `sw.js`, "גרסה חדשה — לרענן?" toast, iOS install help | 35 min |
| **5.3** | Confetti, transitions, empty states, broken-link screen, accessibility review, Hebrew copy pass (`design:ux-copy`) | 45 min |
| **5.4** | `/code-review low --fix`, update README + PLAN.md, final REVIEW.md, tag `phase-5`, push-notify "done" | 25 min |
Total ≈ 13.5 hours of work across the nights.

## 5. Verification
- **Every push:** GitHub Actions runs unit tests, the sim and e2e on Chromium + WebKit, and publishes Pages only if green.
- **Engine:** hated food is never guessed; undo restores state; veto removes; skip doesn't score; sim meets its targets.
- **End to end (`?store=local`):** owner sends a link → guest finishes → owner gets the toast and a history entry;
  leave mid-quiz and resume; sweep ratings appear in the brain; picker → "הולכים" → quick-add → "how was it?".
- **Firebase (real project, step 2.1):** a script proves listing `rooms` is refused, a room is unreadable without its
  id, and an oversized guest write is rejected.
- **Final review, with you (in `docs/REVIEW.md`):** every decision I made alone and how to change it; the Hebrew in
  `strings.js`; the photo contact sheet; a real-phone checklist (your Pixel + her iPhone: open from WhatsApp, finish a
  quiz, ntfy alert, install to home screen, dark mode); subscribing to the ntfy topic; adding your first places.
