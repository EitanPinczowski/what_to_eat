# Design system: מה בא לך?

Read this before any UI work. Source of truth:
- `css/tokens.css` for values;
- `css/style.css` for components;
- `js/data/strings*.js` for words.

Any proposed change is in `docs/UX-REVIEW.md` (ids S1…). Until one is approved and built, this file describes **what is**. Lines marked → are the agreed direction.

## 1. Look in one line
Warm, playful, "sticker" style: thick 2 px ink borders, a hard offset shadow (3px 4px, no blur), big radii, 3D Fluent emoji art and a little chef mascot. Rubik, heavy 800 for titles. Hebrew, RTL, mobile first (375 px design width; must hold at 320 px).

## 2. Tokens (`css/tokens.css`)
| Token | Light | Dark | Night (her quiz 20:00–05:00) | Use |
|---|---|---|---|---|
| `--bg` | #FBF6FA | #1F0F1B | #1E1410 | page |
| `--fg` | #3A1630 | #FBE8F2 | #F6E3D3 | text |
| `--card` | #FFFFFF | #2D1828 | #2B1E18 | cards, buttons |
| `--muted` | #7A4F68 | #C9A0B8 | #D2B5A2 | secondary text (≥6:1 everywhere) |
| `--accent` | #B0306E | #E8629A | #EE9A6E | primary, focus ring, title |
| `--on-accent` | #FFF | #2A0A1C | #2A140A | text on accent. **Always use this; never `#fff`.** |
| `--accent2` / `--on-accent2` | #F3D7E6 | #5A2745 | #4A2E22 | soft fills |
| `--line` / `--ink` | #3A1630 | #A8789A / #000 | #A9836E / #000 | border / shadow |
| `--ok` | #2FA86B | | | success. 3.0:1 on white, so use it for icons only (→ #1E7D4F for text) |
| `--danger` | #D63B3B | | | veto, delete. White on it is 4.6:1 |

Rules:
- Theme order: system dark → `data-theme` → `.night`, which comes last and wins.
- Never hard-code a colour in a component; add a token instead.
- Every new text/background pair must reach 4.5:1 in **all three** themes. Check it with the snippet in UX-REVIEW (contrast table).

Shape and space:
- `--radius` 20px for cards and buttons; `--radius-sm` 12px for inputs and toasts; pills use 99px.
- `--gap` 12px.
- The page has 16px side padding.

## 3. Type scale
| Token | rem | Use |
|---|---|---|
| `--t1` | .75 | meta: food kind, why-line, savemark. Never for anything she must read to act. |
| `--t2` | .875 | sub-labels, craving card, grid tiles |
| `--t3` | 1 | body, buttons |
| `--t4` | 1.25 | primary button, back arrow |
| `--t5` | 1.6 | question `.q`, emoji in buttons |
| `--t6` | 2 | page title h1, result name |

- Weight: 800 (`--heavy`) for titles, the question and the primary button; 500 for meta; 400 otherwise.
- Big text (`.big-text` on root, her profile toggle) bumps `.q` to t6, `.btn` to t4 and 1.3× height, `.qpic` to 52px and `.sub` to t3. → Tags, progress and ghost links must scale too (S9).

## 4. Components
- **Card `.card`:** `--card` fill, 2px border, `--radius`, 24/16 padding, hard shadow. One idea per card. Its title is optional (`h3.sub`, start-aligned).
- **Button `.btn`:**
  - full width, min-height 48px (`--tap`), icon first (on the right in RTL), text start-aligned;
  - press state: translate 2px/3px and shrink the shadow;
  - variants:
    - `.btn-primary`: accent fill, centred, t4, heavy. **One per screen.**
    - `.btn-ghost`: muted text, no border or shadow. For escape and back-style secondary links.
    - `.btn.food` / `.btn.art`: column layout, art on top.
    - `.tile`: 92px home tile.
- **Chip `.chip`:** an interactive pill, ≥48×48, bordered. Used for filters, rates and refine nudges.
  - Known bug: `.chip` is also defined at line 42 as an accent pill with `#fff`. The later rule wins, so read-only craving tags look tappable.
  - → Split into `.chip` (control) and `.tag` (read-only: small, filled `--accent2`, no border, no shadow, not focusable) (S4).
- **Selected state:** `[aria-pressed="true"]` or `.is-selected` gets the ✓ badge (top, inline-end). Veto uses `--danger` fill plus a ✕ badge. Never use colour alone.
- **List row `.row`:** min-height 48, 1px muted divider, `.linkish` as the tappable part.
- **Inputs:** full width, 48px, `--radius-sm`, accent border on focus.
- **Toast `.toast`:** bottom 24px, inverted colours (fg on bg). One at a time (deduped). → It must not cover the sticky primary (S2).
- **Back:** `.qbar .btn.back`, 56×56, "→" (RTL back points right), Hebrew aria-label "חזרה למסך הקודם". → One back control per screen (S1).

## 5. Answer types (her quiz)
| Type | Module | Interaction | A11y now |
|---|---|---|---|
| buttons | quiz.js | tap a 68px row with art | native buttons |
| art | answers/art.js | 2×2 picture grid | text label under the art |
| slider | answers/slider.js | range input, 5 stops, tick haptic | `aria-label` = question, `aria-valuetext` = stop text, live "now" line |
| thermo | answers/thermo.js | the same range drawn as a thermometer | as slider |
| color | answers/color.js | round swatches with a text label | the label carries the meaning (colour-blind safe). → add the emoji (S14) |
| magnets | answers/magnets.js | pick 2 onto the fridge door | `aria-pressed` per magnet |
| face-off | answers/faceoff.js | knockout of pairs, then a final | `aria-live` round title |
| duel / swipe | quiz.js + swipe.js | 2 foods, tap or swipe | buttons work without swiping |
| grid veto | quiz.js | "מה מכל אלה ממש לא?", multi-toggle | `aria-pressed`, red + ✕ |

Rules:
- **Variety** (`varietyFilter` in `js/engine/quiz.js`): at most **2 non-button questions** per quiz, never the same non-button type twice in a row. If nothing passes, everything is allowed again.
- At most 7 questions (`MAX_Q`), 1 duel (`MAX_DUELS`). The first screen has 3 answers.
- **No "don't know" / skip answer on her quiz, ever.** The escape "אני כבר יודעת מה בא לי" is the only way out.
- Every type must work by tap alone. Drag and swipe are extras.
- New types must lazy-load: the start-up budget is 192 KB.

## 6. Illustration
- **Food and answer art:** Fluent Emoji 3D PNGs (MIT, credits in Settings → קרדיטים). The text emoji is the fallback when the image is missing.
- **Mascot:** the chef (`chef.js`). States are idle, nod, drool and cheer, with `role="img"` and aria-label "השף הקטן". Don't reuse the chef image for other meanings: the "לבשל" mode → a pot (S17).
- Decorative art gets `alt=""` / `aria-hidden`; meaning always lives in text next to it.
- Dark emoji (🕳️, ⚫, 🖤) disappear in dark and night. Avoid them, or add a light halo.

## 7. Motion
- Easing is `--ease` (a slight overshoot). Durations: press .08s, chips .3s, screen-in fade+6px, reaction float, card flip, confetti 2.2s, chef keyframes.
- `prefers-reduced-motion: reduce` turns off **all** animations and transitions (global rule). `still()` in quiz.js also skips JS motion under webdriver.
- Haptics: `navigator.vibrate` 6–10 ms ticks only, never long buzzes.
- Motion is never the only signal: the state must also show in text, a badge or focus.

## 8. Night look
`.night` on `<html>`, set by `startGuestQuiz` from 20:00 to 05:00, her quiz only: warm brown, peach accent. The `night.lead` line ("כבר ערב מאוחר… בא לך משהו קליל יותר?") replaces the moment line unless it is late or Shabbat. All text pairs pass 4.5:1. The known failure is `#fff` on accent chips (2.2:1), S16.

## 9. Words
- Her side: feminine 2nd person, **questions not commands**, the app speaks as Eitan.
- Owner side: masculine or neutral infinitive (not feminine).
- Names are always `her` / `me` from settings, never typed into a string.
- Emoji at moments (greeting, reaction, result, sent), not at the end of every line.
- All strings live in `js/data/strings*.js`. Lazy strings: `strings-play`, `-checkin`, `-couple`, `-insights`.

## 10. Layout and reach
- One column, max ~448px, centred.
- The primary action goes in the bottom third (thumb zone). → Sticky bottom primary on her result (S2).
- On her quiz the question must start above the middle of the screen at 375×812, even with big text (S1).
- RTL: icons with direction mirror (back →). Progress fills right to left. Swipe hints show direction by motion, not by "ימינה/שמאלה" (S13).
