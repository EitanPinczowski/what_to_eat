# Review log
Every decision made without asking, newest last. Format: **what** — why — how to change it.

## Decisions
- **Food seed v1: 94 foods** (js/data/foods.js) — drafted per spec-foods; seasons on krembo (Nov–Mar), artik (May–Sep), sufganiya (Nov–Dec), watermelon-feta (Jun–Sep) — edit the array; ids must stay stable.
- **Food format adds an optional 5th field** (season months) to `[id, name, emoji, tags]` — keeps the seed compact — engine reads it.
- **No "fresh" tag**; fresh foods use light+healthy+cold — vocab = PLAN §4 + comfort, thai — add tags in js/data/tags.js.
- **regret answer shortened** to "לא, שיהיה טוב גם מחר" (R9: ≤5 words) — js/data/questions.js.
- **Free-text pick placeholder** "משהו אחר? מה בא לך?" (question, R7) — js/data/strings.js.
- **Mood titles**: 9 tag-based titles + default in STR.moods — js/data/strings.js.
- **Duel scoring** (not in PLAN): winner +2.5, loser −1.5, +1·similarity to winner; both +1.5 each; none −3 each and −1·similarity — js/engine/quiz.js `duel()`.
- **🦖 early guess**: confident when n≥4, p1≥.2, p1≥1.5·p2, or n≥10 — `confident()` in js/engine/quiz.js.
- **Time-of-day prior**: breakfast foods +0.5 at 06–11 and −0.5 otherwise; snacks/desserts +0.5 at 22–03 — js/engine/prior.js.
- **Step count n includes every step** (questions, skips, grid, duels, guesses) — affects grid-at-5 and duel timing.
- **Answers are shuffled** via a returned `order` array; `answer(q, i)` takes the original index; −1 = skip.

## Skipped or unfinished

## Final checklist for Eitan (filled in at step 5.4)
