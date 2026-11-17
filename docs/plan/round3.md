# Next improvement plan: what_to_eat round 3 (UX + question meaning)

## Context
The UX review (587871e, `docs/UX-REVIEW.md`) found 5 P1s on Noga's side, 12 P2s and 18 ranked suggestions (S1–S20). Eitan asked for:
1. the build plan for what comes next;
2. a second review of the questions: what each answer actually tells the engine, and what it tells her.

This plan adds that question review (part A) and turns both reviews into an ordered build queue (part B). It follows the usual rules: one Sonnet worker at a time, one commit per step, push and CI after each, and a ledger line each.

**Method for part A.** I read `js/data/questions.js`, `js/engine/quiz.js` (`delta`, `lik`, `value`), `js/engine/mood.js` (`cravingSummary`) and `js/engine/learn.js`. For each of the 111 foods I scored every answer (sum of the answer's `fx` over the food's tags plus `c:` cuisines) and counted which answer is that food's best match.
- An answer that is the best match for 0 foods says almost nothing to the engine.
- Two answers that win the same foods say the same thing.

## A6. Second pass: what a real quiz looks like to her (666 simulated quizzes)
Method: the real `FoodQuiz` engine was driven for every food 6 times, answering by the target food's tags with 15% noise. There was no history and no mood pull, so history-based questions are under-counted.
- Average **5.6 questions**.
- 11% of quizzes are just 3 button questions and then the pick screen.

| Q | Finding | Numbers | Proposal |
|---|---|---|---|
| Q17 | **10 of 38 question variants never appear.** The whole "after" axis (including the nice "ומחר בבוקר, מה תרצי להגיד…"), the whole "novel" axis and the hunger slider. "kick" (spicy) appears in 1% of quizzes. | asked per 100 quizzes: hunger 100 · mood 92 · vibe 90 · body 85 · family 55 · bite 55 · world 33 · warmth 33 · sweets 14 · kick 1 · after 0 · novel 0 | See Q19. "novel" depends on her history (`~familiar/~fresh`), so check it against real history before retiring it. |
| Q18 | **Every quiz opens the same way.** The first question is always hunger; then body (avg position 2.0), then mood/vibe (3.3). She'll feel the script after a few quizzes. | first question: hunger 100% (3 wordings rotate) | Pick the opener by moment from {hunger, body, mood}, still a 3-button question: morning → hunger, evening → mood, after work → body. A unit test checks each moment's opener; the sim must not drop. |
| Q19 | **She is asked "light or heavy" again and again.** hunger, body and vibe all carry `light`/`heavy`, so in **85%** of quizzes 3 or more questions probe the same thing, and "after" (the question that is *about* it) never gets a turn. | ≥3 light/heavy questions: 85% · ≥2: 95% | **One question, one job:** hunger keeps only snack ↔ meal; body keeps only effort (quick/couch ↔ fancy) and indulgence; vibe keeps comfort/junk/fresh, without `light`. "after" owns light ↔ heavy. Sim gate: first-guess not lower, and the ≥3 light/heavy share under 30%. |
| Q20 | **Middle stops are almost never chosen.** On the warmth slider/thermometer 89% pick an end. The mood slider's "רגועה" got 0%. | warmth3 ends 89% · warmth4 88% | Supports Q5. Sliders stay for fun, and nothing should rely on the middle. |
| Q21 | **Answer balance.** vibe3 "ביתי ומחבק" 61%, world "home" answers 55–62%, sweets "מאפה" 10%, family4 "חריף/קרמי" 7% each. | — | Lopsided answers are fine when they match real cravings. Re-check these with real history after a month (the R2 learning data), not now. |

These change R1: Q19 is added to R1, and Q18 is added to R1 as a small engine change in `variant()`/opener choice in `js/engine/quiz.js`.

## 0. Urgent: Noga's result can't be sent (do first, before anything else)
**What happened.** At 00:38 Israel time on 17 Nov her room's own error log (`rooms/<room>/errors`) recorded:
- message: "save failed: Missing or insufficient permissions";
- screen: "history".

Firestore refused the result write. Seconds later `live/quiz` was reset to an empty quiz (00:38:56). The last result that was ever saved is from 15 Nov 15:32, **before** the rules were tightened (a3ee60c, 15 Nov 20:31). Since then, no result has been saved.

**Cause (very likely).** `resultEntry()` in `js/ui/guest/session.js` writes `price: null` when she skips "וכמה להשקיע?" and `f: null` when the result is free text. In `firestore.rules`:
- `num('price')` is `!(f in d) || d[f] is number`;
- `str('f', 40)` is the same shape for strings.

In Firestore rules `null is number` is false, so a present `null` fails, and every send without a budget is denied.

Nothing caught it:
- `tests/rules.test.js` has no case with a null field;
- the e2e tests run on the local store, which has no rules;
- e2e fixtures even use `price: null`.

When the write fails, `finishScreen` falls back to the "send by WhatsApp" link, which needs `myPhone` set in settings.

**Fix (R0, hotfix, ~30 min, ship alone):**
1. **Client:** `resultEntry` and every other `store.put` payload drop `null`/`undefined` keys (one `compact()` helper in the store's `put`, so places, live and shopping are covered too). This works with the rules already deployed.
2. **Rules:** `str/num/flag/obj/lst` also accept `null` (`d[f] == null || …`). Republish with the existing deploy path (`tools/check-firebase.mjs`).
3. **Tests:**
   - `tests/rules.test.js` gets an emulator test: a history doc with `price: null` and `f: null` is allowed.
   - A unit test checks that `resultEntry` drops nulls.
   - An e2e test checks a send without a budget reaches the "sent" screen.
4. **Check after deploy:** one real send from Eitan's phone without a budget. The `history` collection gets a new doc, and `errors` stays quiet.
5. **Also look at:**
   - A new room was created at 00:39, right after the failure. Did Noga reset, or open the app without her link? Ask Eitan; don't touch it.
   - A second new room was created at 00:00:32, the minute this session's `?store=local` test started. Check whether local mode creates a remote room doc. If it does, that's a bug: local mode must never write to Firestore.

## A. Question review: what the answers tell

### A1. Answers whose words and meaning don't match (she says one thing, the engine hears another)
| Q | Question / answer | Engine hears | Problem | Fix |
|---|---|---|---|---|
| Q1 | vibe2 "איזה סוג של ארוחה זו?" → 🎁 "פינוק קטן לעצמי" | junk 3, fried, cheesy, healthy −2 (shared with "ג׳אנק בלי רגשות אשם") | A small treat reads as sweet or fancy, not junk | Reword to "😈 משהו שמנוני בלי רגשות אשם". Variants must share the axis effects. |
| Q2 | body2 "כמה אנרגיה נשארה לך?" → 🔋 "חצי סוללה" | light, fancy, resto | Half a battery ≠ a nice restaurant | "🔋 מספיק כדי לאכול משהו טוב" |
| Q3 | body2 → 🪫 "כמעט אפס" vs 😮‍💨 "אין לי, מגיע לי פינוק" | quick/couch vs heavy/sweet | Both say "no energy", so she can't tell them apart | "🪫 כמעט אפס, שיביאו לי" |
| Q4 | body1 → 🪫 "עייפה, בא לי משהו קל" | quick, couch, home (no `light`) | "קל" also means light food, so the chips then say "מהיר, ביתי" (seen live) | "עייפה, בא לי משהו בלי מאמץ" |
| Q5 | mood4 slider, middle stop 😌 "רגועה" | half comfort + half fancy | In the colour and face-off variants, calm means light/healthy. One feeling, two meanings on the same axis | Stops: צריכה חיבוק · קצת עייפה · בסדר · טוב לי · בא לחגוג |
| Q6 | bite2 "איזה צליל עושה האוכל הזה?" | — | "האוכל הזה" assumes she already has a food in mind | "איזה צליל בא לך לשמוע בביס?" |

### A2. Answers that tell the engine (almost) nothing
| Q | Where | Measured | Fix |
|---|---|---|---|
| Q7 | mood6 art: ☁️ "ענן רך" vs 🌧️ "גשם" | The cloud is the best match for **4** foods, the rain for 43. Both are comfort + home, so they say the same thing | Cloud = soft/sweet: `creamy:2.5 sweet:1.5 dessert:1 light:0.5` |
| Q8 | kick: 🌸 "עדין" / 🌶️ "עם עקיצה" | Each is the best match for 0 foods. "עם עקיצה" is spicy +0.5, which is noise | "עם עקיצה" → `spicy:1.5`. "עדין" (−3) is still useful as a veto |
| Q9 | All 5-stop sliders and the thermometer | The middle 3 stops are the best match for 0 foods: a slider is really 2 ends plus a neutral middle | **By design**, so no change. For warmth, after and novel the middle is a true neutral. Note it in DESIGN-SYSTEM.md so nobody adds a "middle means X" answer. Q5 fixes the one slider where the middle isn't neutral. |

### A3. What she sees back
- **Q10, craving chips speak engine words.** `cravingSummary` (`js/engine/mood.js`) labels the top `fx` tags. "עייפה" becomes "מהיר, ביתי", which reads as a misunderstanding. Fix: tags about effort, not taste (`quick`, `couch`, `resto`) never become chips. An answer slot may carry its own `say` label (e.g. body slot 0 → "בלי מאמץ"), and `cravingSummary` prefers it.
- **Q11, light/heavy is asked up to 4 times** (hunger, body, vibe, after), so she may answer "קליל" again and again. First measure it in the sim: the share of runs where 3 or more asked questions probe `light` or `heavy`. Only if it's over 25%, raise the probe-cost term in `bestOf` (`js/engine/quiz.js`, "minus a small cost for probing tags already probed").

### A4. Learning hears each wording separately
- **Q12.** `learnFrom` (`js/engine/learn.js`) keys bonuses by `"qid:i"`, i.e. per variant. Variants of one axis share their effects by design, and rotation means each variant is seen about a third as often. Each key needs ≥2 sightings after ≥5 quizzes, so learning starts roughly 3× slower than it could.
- Fix: key by `axis:slot` for button variants (slot = answer index, which is the same across variants). Sliders map stops 0–1 → slot 0 and 3–4 → last slot, and skip the middle. Special types (colour, art, face-off, magnets) keep their own `qid:i` because their effects differ.
- `delta()` in quiz.js looks up both keys (old `qid:i` first, for history already stored).
- Old history keys keep working because the axis comes from `findQuestion`, including retired ids.

### A5. What the questions never ask (coverage)
Measured with `npm run sim` (111 foods × 5, mood persona, noise 0.15):
- first guess **35%** (product goal 45%);
- top 3 **94%**;
- 5.2 questions, **8.5 screens** (goal ≤9).

The sim flags the "abroad" answers (world1–3) as low-coverage: chosen in under 5% of runs.

| Q | Finding | Evidence | Proposal (sim-gated) |
|---|---|---|---|
| Q13 | **The main dish is never asked.** `veg` (28 foods), `meaty` (22), `fish` (5), `egg` (9) and `rice` (10) are on foods, but no answer ever touches them. "Meat or not" is one of the first cuts people make. | Tags missing from every answer's `fx` | A new stage-3 axis "מה יעשה לך טוב במרכז הצלחת?": 🍗 "משהו בשרי" · 🥦 "ירקות או קטניות" · 🐟 "דג או ביצה" · 🧀 "גבינה או בצק". It has no neutral answer (the no-"don't know" rule holds). `need: ["meal"]`, so snack-only runs never see it. Keep it only if first-guess rises ≥3 points. |
| Q14 | **"Abroad" lumps 4 cuisines together.** "משהו מחו״ל" gives +2 equally to Italian, Asian, American and Mexican, so sushi, pizza and tacos stay tied. | Low-coverage warning; `c:*` tags aren't split by any answer | A follow-up art question "לאן הטעם לוקח אותך?" with 🍝 איטליה · 🥢 אסיה · 🍔 אמריקה · 🌮 מקסיקו. Use `need` on the `c:*` mass (≥ NEED_MASS) so it only appears after "abroad" won. Keep it if first-guess for foreign foods rises ≥5 points. |
| Q15 | **Two foods can never be told apart:** קארי ירוק = באטר צ׳יקן on every asked tag. | Identical asked-tag signature | Food data: green curry gets `spicy`, butter chicken gets `creamy` (check each first). |
| Q16 | **Even ideal answers miss.** If she answers every axis perfectly for her food, a simple additive score still puts 52 of 111 foods outside the top 3 (e.g. סביח #34, טוסט #25, פלאפל #15). The engine rescues many of these with its duel and pick screens, but it shows where Q13/Q14 would help most. | Additive proxy, not the real posterior | No change of its own. Re-measure after Q13/Q14 and report the number in REVIEW.md. |

## C. Categories (what the label under each food says)
`category()` in `js/ui/pics.js` guesses the label from tags in a fixed order: breakfast > street > sweet > snack > home > fresh > meal. The results she sees under foods in the grid, duel, pick and result:
- **Desserts labelled "אוכל רחוב":** גלידה, מלבי, קרפ, צ׳ורוס, because `street` beats `sweet`. Seen live: "גלידה · אוכל רחוב".
- **Things labelled "חטיף" that aren't snacks:** סלט ישראלי, אבטיח ובולגרית, אדממה, ספרינג רול, בורקס, נודלס אינסטנט.
- **Drinks and coffee labelled "מתוק":** קפה ומאפה, אייס קפה, שייק פירות, יוגורט, חטיף אנרגיה. There is no café or drink label, though the picker has "☕ בית קפה".
- **Other odd labels:** כריך as "בישול ביתי". "טרי" has only 5 foods while salads sit under snack.
- **Two category systems with different words for the same thing:**
  - food labels (7): חטיף, מתוק, ארוחה, אוכל רחוב, ארוחת בוקר, בישול ביתי, טרי;
  - picker cuisines (8): נשנוש, משהו מתוק, בית קפה…
  - So "חטיף" and "נשנוש", "מתוק" and "משהו מתוק" name the same thing.
- **Thin picker cuisines:** מקסיקני has 3 foods (`c:mexican`), איטלקי has 6.

**Eitan's decision (2026-11-17): categories = types of food (cuisines).**
- Split Asian into its countries.
- Sweets and snacks get their origin cuisine.
- Add a cuisine question to the quiz.
- Add foods to the thin cuisines.

**New cuisine list** (`js/data/cuisines.js`, 10 ids):
- ישראלי `israeli`
- מזרחי `middle` (Middle-Eastern, Arab and Turkish: knafeh, baklava, malabi, arayes, kubbeh)
- איטלקי `italian`
- מקסיקני `mexican`
- אמריקאי `american`
- יפני `japanese`
- תאילנדי `thai`
- סיני `chinese`
- הודי `indian`
- בית קפה `cafe`

`sweet` and `snack` stop being cuisines. They stay as tags (`dessert`, `snack`, `kiosk`), which the engine already uses.

**R1c-1, food types (~60 min):**
1. Every seed food in `js/data/foods.js` gets one **main cuisine** first in its `cuisine` list, plus optional extras. Examples:
   - פאד תאי → thai; סושי, ראמן, גיוזה, אדממה → japanese; עוף חמוץ מתוק, נודלס מוקפצים → chinese; באטר צ׳יקן → indian.
   - טירמיסו, פנקוטה → italian; צ׳ורוס → mexican; כנאפה, בקלאווה, מלבי → middle.
   - במבה, ביסלי, קרמבו → israeli; גלידה, עוגת גבינה, בראוניז → american or cafe; קפה ומאפה → cafe.
   - Drop instant noodles' "asian" (→ japanese or chinese).
2. The label under each food shows its main cuisine. In `js/ui/pics.js`, `category()` and `catLabel()` read the main cuisine and fall back to today's tag rule for custom foods with no cuisine. Then delete `STR.cats`, or keep it only for that fallback.
3. **Picker** (`js/ui/owner/*` picker, `STR.cuisine.options`, `STR.picker.search` for Tabit/Ontopo search words):
   - the chips become the 10 cuisines plus "🍰 משהו מתוק" and "🥨 נשנוש" as kind filters (by tag, not cuisine), so Eitan can still pick dessert places;
   - **migration:** saved places and custom foods with `asian` match all four Asian ids (a read-time alias in `cuisines.js`; no data rewrite). `sweet`/`snack` on old places map to the kind filters.
   - The rules allow up to 8 cuisines per place, which is enough.
4. The engine's `c:<id>` tags follow automatically. Re-run the sim: the hit rate may move a little, because `world` "abroad" now adds +2 to more ids. Keep the world answer effects aimed at the foreign ids (italian, mexican, american, japanese, thai, chinese, indian).

**R1c-2 (REPLACED 2026-11-17 by Eitan: category first, then the food).** The quiz opens by narrowing to a category, then asks feelings questions inside it, then the food:
1. **Screen 1, "מה בא לך הערב?"** A picture grid of 6 categories. They're chosen per moment from the prior (time, weather, her history) out of the 10 cuisines plus "🍰 משהו מתוק" and "🥨 נשנוש". There's an "עוד סוגים…" tile that opens the rest, which is more choices, not a skip. The moment line and the weather line stay above it.
2. **Engine:** a new step type `cat` in `FoodQuiz.next()` (`js/engine/quiz.js`), asked once before the first question.
   - Picking a category multiplies foods in it by a strong factor and keeps a small residual for the rest, so a near-miss can still come back through "close, but…".
   - "מתוק" and "נשנוש" filter by the `dessert`/`snack` tags; cuisines filter by `c:<id>`.
   - It's stored in `ans` as `cat:<id>`, so learning and history see it.
3. **Then the feelings questions,** ranked by info gain inside the category: hunger → body → mood/vibe → family/bite. Q18's opener-by-moment becomes the first question **after** the category. The `world` axis is skipped when a cuisine was picked, because the category already answered it.
4. **Then the specific food** (duel / pick / reveal as today, R4 later).
5. **UI:** `js/ui/guest/quiz.js` renders the step with the existing art grid (`answers/art.js` pattern, 2×3) and lazy art. The craving card shows the category as its first tag.
6. **Owner side:** the trail ("איך הגענו לזה") starts with the category.
7. **Sim:** the persona picks the target's main cuisine (or sweet/snack) with 15% noise.
   - Gates: first-guess must rise. The goal is ≥45%, and it must not drop below today's 35%. Screens ≤9.
   - Record before/after in REVIEW.md.

R1c-1 (food types) must land first. R1c-3 (more foods) helps thin categories like Mexican and Indian.

~~Old R1c-2, cuisine question in the quiz (~45 min, replaces Q14):~~ a stage-3 art question "לאן הטעם לוקח אותך?":
- 🍝 איטליה (italian), 🌮 מקסיקו (mexican), 🍣 יפן (japanese), 🍜 תאילנד או סין (thai + chinese), 🍛 הודו (indian), 🍔 אמריקה (american).
- Six answers fit the 2×3 art grid, and there's no "doesn't matter".
- `need` is set on the foreign `c:*` mass, so it only appears after "abroad" won or the prior points abroad. It counts toward the variety rule's limit of 2.
- Keep it if first-guess for foreign foods rises ≥5 points and overall doesn't drop.

**R1c-3, more foods (~45 min):** about 5 each for the thin cuisines, with tags, a main cuisine and Fluent art where it exists (emoji fallback otherwise). New ids are stable and never renamed.
- **Mexican** (now 3): קסדייה, גואקמולה וצ׳יפס, אנצ׳ילדות, טוסטדה / קערת בוריטו.
- **Italian** (6 + tiramisu and panna cotta): פסטה קרבונרה, פוקאצ׳ה, ברוסקטה, פסטה פסטו, קלצונה.
- **Indian** (1): צ׳יקן טיקה מסאלה, סמוסה, דאל, ביריאני.
- **Thai and Chinese** (2 each): טום יאם, קארי אדום / אורז מטוגן, באן בשר.

Update the size check: food data is in the start-up budget, so check `tests/startup.test.js` and lazy-load the new foods' art. Then re-run the sim.

**Tests:**
- every seed food has a main cuisine from the list;
- no `dessert` food is labelled street;
- an old place with `asian` still matches sushi and pad thai in the picker;
- the picker's chips each find ≥4 foods.

## B. Build queue (one step = one Sonnet worker, one commit)
The order is her biggest wins first, cheapest first. The approval page (https://claude.ai/artifact/6SzQHTXw33ydopKp3WXcoZ, collection `picks`) gates the UX steps: the boss reads the ticks with `ArtifactData list` before each step and skips unticked S-items. Q-items come from this review; Eitan approves them via this plan.

| Step | Contents | Main files | Budget |
|---|---|---|---|
| **R0** Hotfix: result can't be sent | Section 0. Ship alone; push, deploy rules, one real send. | `js/store/firebase.js` (put), `js/ui/guest/session.js`, `firestore.rules`, `tests/rules.test.js`, an e2e send without a budget | 30 min |
| **R1c-1** Food types (cuisines) | Section C: the 10-cuisine list, main cuisine per food, labels, picker chips, `asian` alias | `js/data/cuisines.js`, `js/data/foods.js`, `js/ui/pics.js`, picker in `js/ui/owner/`, `js/data/strings.js` | 60 min |
| **R1c-2** Category first, then the food | Section C (Eitan's flow: category screen opens the quiz, then feelings inside it, then the food), sim-gated | `js/engine/quiz.js` (new `cat` step), `js/ui/guest/quiz.js`, `js/data/strings.js`, `js/data/emoji-q.json`, `tests/sim.js`, e2e quiz specs | 90 min |
| **R1c-3** More foods | Section C: Mexican, Italian, Indian, Thai, Chinese | `js/data/foods.js`, `js/data/emoji-art.json` (Fluent art via the existing emoji map; never stage `img/foods/`) | 45 min |
| **R1** Question meaning | Q1–Q8 rewording and effects, Q10 chips (`say` + effort tags never become chips), Q19 one-job-per-question, Q18 opener by moment (each sim-gated) | `js/data/questions.js`, `js/engine/mood.js`, `js/data/strings.js`, `tests/sim.js` | 45 min |
| **R1b** Coverage experiments | Q15 (food data). Then try Q13 and Q14 one at a time behind the sim gates in A5. Keep only what passes; log the numbers in REVIEW.md. New answer art lazy-loads (`emoji-q.json`). | `js/data/questions.js`, `js/data/foods.js`, `js/data/emoji-q.json`, `tests/sim.js` | 60 min |
| **R2** Learning by axis | Q12, plus Q11 (measure, then tune only if over 25%) | `js/engine/learn.js`, `js/engine/quiz.js` (`delta`), `tests/learn*.test.js` | 45 min |
| **R3** Quiz header + progress + tags | S1, S3, S4 (P1-1, P1-2, P1-3, P2-3) | `js/ui/guest/quiz.js` (`backBar`, craving card ~l.172), `css/style.css` (duplicate `.chip` l.42/l.82 → `.tag`), `js/data/strings.js` (`left`, `almost`) | 60 min |
| **R4** Reveal screen | S2 (P1-4): hero + "או אולי…", nudges as chips, sticky primary, distinct save/share labels; mode/price after "זה!" | `js/ui/guest/quiz.js` (guess/pick/result steps), `js/ui/guest/card.js`, `css/style.css` | 75 min |
| **R5** Copy | S5 (P1-5, P2-1, P2-2): the copy table in UX-REVIEW.md; names via `me`/`her` | `js/data/strings*.js` | 30 min |
| **R6** A11y + contrast + big text | S10, S16, S9, S17 | `css/style.css`, `js/ui/guest/quiz.js`, `js/ui/guest/answers/color.js` | 45 min |
| **R7** Owner polish | S6, S8, S18, S19, S12 (only the ticked ones) | `js/ui/owner/app.js`, `couple.js`, `live-status.js`, `places.js` | 60 min |
| Later | S13, S14, S15, S20 | — | — |

**Eitan's decisions (2026-11-17):**
- **Scope:** this round is R0 (hotfix, first and alone), then R1c-1/2/3 and R1–R5. R6–R7 wait for ticks on the approval page.
- **Answers:** Q1–Q8 are approved as listed, wording and effects both.

Add R1–R5 to `C:\dev\boss\ideas.md` as `[approved]`.

R1 + R2 = phase 3a (engine). R3–R5 = phase 3b (her screens). R6–R7 = phase 3c, later. Each phase ends with `npm test`, tag `phase-3a/b/c`, push and an Actions check.

### Constraints every worker keeps
- Start-up budget is 192 KB and almost full (`tests/startup.test.js`). R3/R4 must stay CSS-first; new JS loads lazily. Any raise is logged in `docs/REVIEW.md`.
- No "don't know" or skip answers. Her side uses feminine 2nd person and questions; the app speaks as Eitan. All strings go in `strings*.js`.
- Never weaken a passing test. Update the e2e tests that assert the old countdown or result layout to assert the new behaviour, and log each one in REVIEW.md.
- Don't stage `img/foods/`.

## Verification
- **R1/R2:** run `npm run sim` before and after, and record the first-guess and top-3 hit rates in REVIEW.md. Neither may drop more than 1 point.
  - Re-run the answer-win table (the node one-liner from this review, saved to `tools/answer-wins.mjs` in R1). Expected: the cloud wins ≥15 foods; "עם עקיצה" wins >0.
  - Unit tests: `cravingSummary` never returns `quick`/`couch`/`resto`, and prefers `say`. `learnFrom` pools two variants of one axis under one key and still reads old `qid:i` keys.
- **R3/R4:** `npm run serve`, then in the browser pane at 375×812 and at 320 px with big text, in day and night: the question starts above mid-screen; tags are not focusable; the progress never shows a number the quiz breaks; the result has one primary in the bottom third.
  - `e2e/a11y.spec.js` stays green. Run the Pixel e2e via pre-push.
- **R5:** grep `strings*.js` for imperative feminine forms (`י\b` verbs such as גררי, בחרי, ספרי, נסי, הדביקי, בדקי) on her side and for hard-coded names (איתן, נגה). Expect none.
- **R6:** the contrast snippet passes 4.5:1 in all three looks; axe in `e2e/a11y.spec.js` passes.
- **After each step:** CI green on GitHub Actions, a ledger line in `C:\dev\boss\ledger.md`, and the item set to `[in recap]` in ideas.md.
