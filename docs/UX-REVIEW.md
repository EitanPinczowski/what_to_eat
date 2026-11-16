# UX review: her quiz and the owner's app (2026-11-17)

Review only, no code changed. Walked at 375×812 and 320×640 with `?store=local`. Covered light, dark and night (the review ran at 00:00, so her quiz was in the night look), big text, her flow and the owner's screens. Contrast was measured from `css/tokens.css`. Colour-blind views used SVG `feColorMatrix` filters for deuteranopia, protanopia and tritanopia.

**What was seen live:** button, art and "not this" grid questions; the duel; the pick screen with refine nudges; the result; owner home, the "עוד ⋯" sheet, send screen, picker and settings.

**What was read in code only:** slider, thermometer, mood colour, magnets, face-off and swipe. The variety rule allows at most 2 of these per quiz, so one run doesn't show them all. Findings about them are marked *(code)*.

Ranking:
- **P1:** hurts her experience, or breaks a hard rule.
- **P2:** a clear flaw with a cheap fix.
- **P3:** polish.

Each suggestion has an id (S1…) that the approval page uses.

---

## P1 findings

| # | Screen | Problem | Why it matters | Fix (suggestion) |
|---|---|---|---|---|
| P1-1 | Quiz → result | The countdown said "עוד 3 שאלות". The very next tap ended the quiz, and the result screen still showed "עוד 3 שאלות". After 4 answers it still read "עוד כמה שאלות". | A progress promise that breaks feels like a bug and costs trust in the guess itself. Survey research links honest, steady progress to lower drop-off; a bar that jumps backwards or lies does the opposite. | S3: progress only ever moves forward. Use segments, or "כמעט שם" once the engine is near the end, never a count it can't keep. Hide the craving card on the result. |
| P1-2 | Quiz (every question) | The brand title, the back/chef row, the craving card and the moment line come before the question. They take about 40% of a 812 px screen, and the question starts at about y=430 px. With big text at 320 px only 2 of 3 answers fit, and the escape link is off-screen. | The question and answers are the job. Thumb reach on a phone is the bottom half. Big text, made for her, makes this worse. | S1: compact quiz header. Drop the h1 during the quiz. Put back, the chef and progress in one 48 px row. The craving tags shrink to one inline line under the question. |
| P1-3 | Quiz, craving card | The read-only craving tags look like buttons: 48 px tall, bordered and pill-shaped, the same as the back button. The empty "נגלה ביחד…" also looks tappable. Cause: `.chip` is defined twice in `css/style.css` (line 42 is an accent pill, line 82 is a tappable 48 px chip), and the later rule wins. | First-time users tap them and nothing happens. Tags and controls must look different. | S4: a separate non-interactive `.tag` style (small, filled, no border, no shadow). Keep `.chip` for controls only. |
| P1-4 | Pick / result | The pick screen ("אחת מאלה?") shows 3 equal food tiles, 3 refine buttons, "אף אחת מאלה" and a free-text link: 8 equal-weight choices and no "I guessed!" moment. On the result, "שמירה" appears twice (save the image vs the final save). The share buttons come before the mode/price choices, and the real primary action is below the fold. | The reveal is the emotional peak of the app (peak-end rule): it should feel like a magic trick, not a form. Two buttons with the same label is a classic slip. | S2: reveal screen. The top guess is big with "אני חושב שבא לך…". The other two are small under "או אולי…". Refine nudges become small chips. One sticky primary at the bottom ("שליחה לאיתן 💌"). Image save/share go to a quiet row with distinct labels ("שמירת תמונה", "שיתוף"). |
| P1-5 | Her side, copy | Commands instead of questions break a hard rule in CLAUDE.md: "גררי ובחרי", "גררי את הכספית", "בחרי אחת" (answers), "ספרי לי מה לא עבד…" (feedback), "בחרי מאכל או רכיב" (profile), "בחרי מתכון להצגה" (recipes). | A stated product rule; her voice must stay gentle and asking. | S5: the copy table below. |

## P2 findings

| # | Screen | Problem | Fix |
|---|---|---|---|
| P2-1 | Owner side, copy | The owner (Eitan) is addressed in the feminine: `settings.saveFail` "בדקי חיבור ונסי שוב", `settings.offline` "נסי שוב", `rejoinHelp` "הדביקי". `push.testFail` uses plural "נסו". | S5: masculine or neutral for owner strings. |
| P2-2 | Copy | Names are hard-coded instead of passed in from settings: "איתן" in `vote.sub`, `vote.pickedNone` and `errors.moved` (her side), and "נגה" in `settings.push.help` and `openedLabel`. | S5: pass `me` / `her` like the other strings do. |
| P2-3 | Quiz | Two back controls on every question: the → in the header and "↪︎ רגע, אחורה" under the answers. | S1: keep the header one only. |
| P2-4 | Night and dark contrast | `.chip` (line 42) hard-codes `color:#fff` on `--accent`. That gives **2.21:1** in the night look and **3.16:1** in dark, below 4.5:1. The 🕳️ emoji on "זה היה מזמן" almost disappears on the night background. | S16: use `--on-accent`. Give dark emoji art a light halo, or swap the emoji. |
| P2-5 | Result | The 4th mode "לבשל" wraps alone onto a second row. Its icon is a chef, which looks like the mascot. The why-line ends with a dangling "—". | S17: 2×2 mode grid, a pot icon, and drop the trailing dash. |
| P2-6 | Owner home | 3 tiles leave an orphan gap. History, places, brain, insights and the monthly recap are all hidden behind "עוד ⋯". That sheet repeats "לשלוח שאלון", and its title is just "עוד ⋯". | S6: home shows the live result card plus 4 tiles (2×2). "עוד" becomes a titled list ("כל הכלים"). |
| P2-7 | Global | The "נשמר ✓" mark flashes on first load before anything was saved. | S12: show it only after a real write. |
| P2-8 | Send screen | Couple mode ("גם אני עונה") is a plain button with no on/off look. The raw room URL is printed. The live status sits mid-page. | S8 (a real switch) and S18 (hide the URL; status pill at the top). |
| P2-9 | Big text | Only `.q`, `.btn`, `.qpic` and `.sub` scale. Tags, the countdown and the escape link stay small, and the craving card grows the header. | S9. |
| P2-10 | Accessibility | Price buttons read as "₪ / ₪₪ / ₪₪₪" to a screen reader. Mode and price are single-choice groups but have no radiogroup/aria-checked semantics *(to confirm)*. Micro-reactions are not in a live region. Focus is not moved to the new question heading after an answer. | S10. |
| P2-11 | Swipe *(code)* | The hint "אפשר גם להחליק ימינה או שמאלה 👉" names both directions with a right-pointing emoji. In RTL it is unclear which side picks which card. | S13: show the direction with a small card wiggle instead of words. |
| P2-12 | Picker, empty | "אין מקום שמור שמתאים." shows above three search links, with no "add your first place" action. | S19: an empty state with one clear action. |

## P3 findings

| # | Problem | Fix |
|---|---|---|
| P3-1 | Mood colour swatches *(code)*: brown, red and yellow merge into olive tones under deuteranopia and protanopia. The text labels carry the meaning, so it's not blocking. | S14: add the emoji to each swatch. |
| P3-2 | The red veto tile turns olive under red/green blindness; the ✕ badge still carries the meaning. | None needed; keep the ✕. |
| P3-3 | `--ok` (#2fa86b) on white is 3.03:1 if ever used as text. | Darken to #1e7d4f for text use. |
| P3-4 | Nearly every string ends in an emoji, so the emoji stop meaning anything. | S15: emoji only at moments (greeting, result, sent). |
| P3-5 | Food tiles show the kind in small muted text ("גלידה · אוכל רחוב"). Some labels read oddly, and at 12 px they're hard to read. | Drop the kind on quiz tiles. |
| P3-6 | `progress` ("שאלה 3 מתוך ~7") uses a tilde, which reads oddly in Hebrew. | Remove it if unused; otherwise use "בערך". |
| P3-7 | Settings is one long column of inputs and long help paragraphs, and shows the "blocked" Chrome how-to inline. | S20: grouped cards, help behind a "איך?" disclosure. |
| P3-8 | The local "היא לידי" flow skips the greeting, note, weather and "like last time". That may be fine, but it isn't the same experience as the link. | Decide: keep it, or show a 1-line greeting. |

## What already works well (keep)
- Big, 68 px answer buttons with 3D Fluent art; the art grid reads well in the night look.
- The veto grid: an aria-pressed toggle, a red tile plus a ✕ badge, and a clear "זהו, אלה" primary.
- Decorative images have `alt=""`. The chef has a Hebrew `aria-label`. The slider has `aria-valuetext` per stop.
- A global `prefers-reduced-motion` kill-switch and a `:focus-visible` ring on every control.
- No horizontal overflow at 320 px.
- Night-look tokens all pass 4.5:1 for text (muted on bg 9.35:1).

---

## Copy and tone table (current → suggested)

| Key | Current | Suggested | Why |
|---|---|---|---|
| `answers.slider` | גררי ובחרי | איפה את על הסקאלה? | question, not command |
| `answers.thermo` | גררי את הכספית | כמה חם בא לך? | question |
| `answers.pickOne` | בחרי אחת | איזו מהן? | question |
| `feedback.placeholder` | ספרי לי מה לא עבד… | מה לא עבד? | question |
| `profile.pickPlaceholder` | בחרי מאכל או רכיב | איזה מאכל או רכיב? | question |
| `picker.recipesPick` | בחרי מתכון להצגה | איזה מתכון להראות? | question |
| `swipeHint` | אפשר גם להחליק ימינה או שמאלה 👉 | אפשר גם להחליק את הכרטיס 🙂 | no ambiguous direction |
| `left(n≥4)` | עוד כמה שאלות | (segments, no words) | honest progress (S3) |
| `card.save` | שמירה | שמירת תמונה | not the same as the final "שמירה" |
| `vote.sub` | איתן הציע כמה מקומות | `${me} הציע כמה מקומות` | no hard-coded name |
| `vote.pickedNone` | אמרת לאיתן… | `אמרת ל${me}…` | same |
| `errors.moved` | …לבקש מאיתן… | `…לבקש מ${me}…` | same |
| `settings.saveFail` | …בדקי חיבור ונסי שוב | …כדאי לבדוק חיבור ולנסות שוב | owner is male; neutral infinitive |
| `settings.offline` | …נסי שוב כשהאינטרנט חוזר | …ננסה שוב כשהאינטרנט יחזור | same |
| `settings.rejoinHelp` | …הדביקי כאן קישור… | …אפשר להדביק כאן קישור… | same |
| `settings.push.testFail` | …נסו להפעיל מחדש | …כדאי להפעיל מחדש | consistent person |
| `settings.push.help` / `openedLabel` | כשנגה… | `כש${her}…` | no hard-coded name |
| `result.note` | משהו להוסיף? (לא חובה) | משהו להוסיף? | the field is plainly optional |
| `moods` / `react` | emoji on every line | keep the emoji on `react`; drop it from the why-line pills | emoji diet (S15) |
| `craving.line` | בא לך משהו …, … ו… — | בא לך משהו … | no dangling dash |

Checked and fine:
- The intro ("את עונה, ואני מנחש").
- The escape ("אני כבר יודעת מה בא לי").
- Errors phrased as questions ("אולי תבקשי ממני חדש?").
- The check-in ("רוצה שאזכיר לך מחר…").
- The couple-mode lines, which are Eitan's own masculine voice on purpose.

The sweep's "לא מכירה · דילוג" is a skip, but the sweep is a rating pass, not the quiz, so the no-"don't know" rule does not apply.

---

## Ranked suggestions

Effort: S = under 1 step, M = 1 step, L = 2+ steps. Impact is on her experience unless marked owner. The size budget matters: start-up is 192 KB and almost full, so anything new on her first screen must be CSS-only or lazy.

| Rank | Id | Suggestion | Effort | Impact | Mockup |
|---|---|---|---|---|---|
| 1 | S2 | **Reveal screen**: hero guess plus "או אולי…", nudges as small chips, one sticky primary, distinct image save/share labels | M | High | ✔ |
| 2 | S1 | **Compact quiz header**: no h1 during the quiz; back, chef and progress in one row; one back control; tags inline | S–M | High | ✔ |
| 3 | S3 | **Honest progress**: forward-only segments, "כמעט שם" at the end, never a count that can break; hidden on the result | S | High | ✔ |
| 4 | S5 | **Copy fixes**: questions-not-commands, owner gender, names passed in (table above) | S | Medium (rule) | ✔ |
| 5 | S4 | **Tag vs chip**: a non-interactive `.tag` style; remove the duplicate `.chip` rule | S | Medium | ✔ |
| 6 | S6 | **Owner home**: live result card on top, 2×2 main tiles, titled "כל הכלים" list | S–M | Medium (owner) | ✔ |
| 7 | S10 | **Screen-reader pass**: radiogroup for mode/price, price labels ("זול / בינוני / מפנק"), live region for reactions, focus the new question heading | S | Medium | — |
| 8 | S16 | **Night/dark contrast**: `--on-accent` on chips, halo behind dark emoji art | S | Medium | — |
| 9 | S9 | **Big text everywhere**: scale tags, progress and the escape link; collapse the craving card at ≤360 px | S | Medium | — |
| 10 | S17 | **Result modes 2×2**: pot icon for "לבשל", no orphan tile, no dangling dash | S | Low–Med | — |
| 11 | S8 | **Couple mode as a real switch** (`role="switch"`, on/off look) | S | Low (owner) | — |
| 12 | S18 | **Send screen**: hide the raw URL, live status pill at the top | S | Low (owner) | — |
| 13 | S13 | **Swipe hint by motion**: the first duel card wiggles once (off under reduced motion) | S | Low | — |
| 14 | S19 | **Picker empty state** with one "להוסיף מקום ראשון" action | S | Low (owner) | — |
| 15 | S12 | **"נשמר" only after a real write** | S | Low | — |
| 16 | S14 | **Colour swatches carry their emoji** (colour-blind safe) | S | Low | — |
| 17 | S15 | **Emoji diet** in strings | S | Low | — |
| 18 | S20 | **Settings in grouped cards**, help behind disclosures | M | Low (owner) | — |

### Research behind the ranking
- **One question per screen, big targets, single column** are the main mobile-survey levers. Vendor data puts mobile drop-off for unoptimised surveys at 15–25%, against 3–7% when optimised. The app already does this well; S1 removes what's left above the question.
- **Progress:** sources warn against exact totals that can't be kept ("3 of 25"). Forward-only progress, optionally starting above zero (the endowed-progress effect), works better. That is S3.
- **RTL:** directional icons and gestures must mirror (Material bidirectionality, Apple HIG RTL, Mozilla RTL guidelines). Progress fills right to left. That supports S13 and an RTL progress bar in S3.
- **Thumb zone:** primary actions go in the bottom third (Hoober's thumb-zone studies; Material 3 bottom action bars). That supports the sticky primary in S2.
- **WCAG 2.2:** 1.4.3 contrast 4.5:1 (S16); 2.5.8 target size (already met with 48 px); 4.1.2 name/role/value for toggles and switches (S8, S10).

Sources:
- [Enalyzer, smartphone-optimized survey design](https://www-webflow.enalyzer.com/articles/smartphone-optimized-survey-design)
- [Heyflow, progress indicators](https://heyflow.com/blog/reduce-form-abandonment-progress-indicators/)
- [RevenueHunt, reduce drop-off](https://docs.revenuehunt.com/customer-success/reduce-dropoff/)
- [G2 discussion on long surveys](https://www.g2.com/discussions/which-survey-platforms-keep-response-quality-high-even-when-the-questionnaire-has-more-than-ten-questions)
- [Material bidirectionality](https://m2.material.io/go/design-bidirectionality)
- [Apple HIG, right to left](https://developer-rno.apple.com/design/human-interface-guidelines/foundations/right-to-left)
- [Mozilla RTL guidelines](https://firefox-source-docs.mozilla.org/code-quality/coding-style/rtl_guidelines.html)
- [user-a.co.il, rule 12: mirroring](https://user-a.co.il/en/ux-ui/כלל-מספר-12-שיקוף)

## Not covered / to confirm on a real phone
- Swipe direction and haptics; the result-card share sheet (also open in the handover).
- Magnets, face-off, thermometer and colour seen in code only. One quiz run in the browser didn't reach them.
- The live owner status and push receipts need a second device or Firestore, not `?store=local`.
- Screen-reader output was read from the DOM, not heard with TalkBack or VoiceOver.
