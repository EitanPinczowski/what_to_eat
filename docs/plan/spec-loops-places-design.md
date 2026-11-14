### 2.6 Learning and feedback loops
- **Learn from her picks:** after ≥5 quizzes, a learned bonus per (answer, tag) = `0.5 × (P(tag | answer) − P(tag))`,
  capped ±1.5. The sim checks it never lowers accuracy.
- **Accuracy stats:** history stores guesses-until-hit, steps, escape-hatch use; a stats card shows hit rate, average
  steps and the most confusing question.
- **"How was it?"** On your home screen, ≥2 hours after "✅ הולכים": one tap 👍/👎. It nudges an experience score for
  the food (±0.5, never overriding her own rating) and the place's rating.

### 2.7 Places and picker (additions to PLAN.md §7.4)
- Place gets `shabbat: boolean`. From Friday evening to Saturday evening the picker hides places closed on Shabbat.
- Scoring also uses her **budget**: −2 per price step above it.
- **Quick-add:** your list starts empty, so after "✅ הולכים" through the Maps fallback the app asks "לאן הלכתם?".
  Name + pre-filled food, mode and city save a place in two taps.

### 2.8 Design rules
One question per screen, 2–4 big tap targets, no typing except the escape hatch · no step counter, only the confidence
meter · most polish goes to the guess reveal and the end screen (peak-end rule) · sweep = swipe **and** visible buttons,
undo, a "skipped" pile · light and dark themes · mockup of 4 screens × 3 directions (Rubik "pop", Varela Round "soft",
Assistant "clean") saved as `design/mockup.html`; the run picks one (default Rubik pop) and logs it in REVIEW.md.

