# מה בא לך? — Project Plan

> A free web app that figures out what Noga wants to eat when she says "I'm down for anything":
> she answers a guessing quiz, the answer comes back to Eitan, and the app helps pick a specific place.

---

## 0. Goals & constraints

| # | Requirement | How the plan meets it |
|---|---|---|
| G1 | Figure out **what kind of food** she wants | Akinator-style adaptive quiz (§6) |
| G2 | Then pick **a specific place** (sit / takeout / delivery) | Places DB + scorer + random draw (§7.4) |
| G3 | **Database** of what she likes, snacks → full meals | 80+ tagged seed foods + her ratings, notes, history (§4) |
| G4 | Something to **send her** with questions that make her spill / eliminate | Quiz link + "get-to-know-you" rating link, results return via WhatsApp (§5) |
| G5 | **Completely free** | Static site on GitHub Pages, no paid APIs, no server, no accounts |

Non-goals (v1): login, live sync between phones, automatic restaurant data, native app.

---

## 1. Decisions

| ID | Decision | Default (v1) | Alternative (later) |
|---|---|---|---|
| D1 | How her answers reach you | **WhatsApp link**: result encoded in URL → you open it → imported into your local DB | Firebase Firestore free tier (live shared DB) — Phase 6 |
| D2 | Who picks the place | **You** (owner) | She gets a place vote in the result screen — Phase 6 |
| D3 | Place data | **Manual entry** + Google Maps search link fallback | Google Places API (free tier needs a credit card → rejected) |
| D4 | UI language / tone | **Hebrew, RTL, teasing-but-sweet** | — |
| D5 | Tech stack | **Vanilla JS, ES modules, no build step**, tests with `node --test` (zero deps) | — |

> Storage sits behind a `Store` interface (§5.3), so switching D1 to Firebase later touches one file.

---

## 2. Architecture

```
            ┌─────────────────────── GitHub Pages (static, free) ───────────────────────┐
            │  index.html + css + js modules — same code serves both roles              │
            └───────────────────────────────────────────────────────────────────────────┘

  EITAN (owner, localStorage DB)                         NOGA (guest, stateless)
  ─────────────────────────────                         ────────────────────────
  Home ─▶ "Send quiz" ──── #q=<payload> via WhatsApp ──▶ Quiz (engine runs on her phone)
                            (her ratings + recent meals)        │
                                                                ▼
  Import view ◀── #r=<result> link inside WhatsApp msg ◀── Finish: mode/budget/note ─▶ wa.me
      │
      ▼
  History + "Pick a place" ─▶ Picker (places DB) ─▶ Google Maps / "we're going here" ✅

  Home ─▶ "Send sweep" ───── #s=<payload> ───────────────▶ Rate foods 😍🙂😐🤢 + notes + extras
  Import view ◀────────────── #r=<ratings> ◀────────────── Send via wa.me
```

Key idea: **the URL hash is the transport.** Everything she needs travels in the link, everything she answers comes back in a link. Hash (`#`) is never sent to the server, so no backend is needed.

---

## 3. File tree

```
what_to_eat/
├── index.html                 # shell, loads js/main.js as module
├── manifest.webmanifest       # PWA: add to home screen (Phase 5)
├── sw.js                      # service worker: offline cache (Phase 5)
├── css/
│   └── style.css              # mobile-first, RTL, Rubik font
├── js/
│   ├── main.js                # boot: parse hash → route
│   ├── router.js              # hash routes (#q= #s= #r=) + owner view stack
│   ├── data/
│   │   ├── tags.js            # TAGS (id → Hebrew label), KINDS
│   │   ├── foods.js           # FOODS seed  [id, name, emoji, "tags…"]
│   │   ├── questions.js       # QUESTIONS bank
│   │   └── constants.js       # MODES, RATING, CUISINE tags
│   ├── engine/
│   │   ├── foods.js           # buildFoods(seed, custom) → Food[]
│   │   ├── similarity.js      # jaccard(a, b)
│   │   ├── prior.js           # priorFrom(ratings, recentIds)
│   │   └── quiz.js            # class FoodQuiz (the guessing engine)
│   ├── store/
│   │   ├── store.js           # Store interface + migrations
│   │   ├── local.js           # localStorage implementation (v1)
│   │   └── firebase.js        # Phase 6 (optional)
│   ├── share/
│   │   ├── codec.js           # encode/decode payload ⇄ base64url
│   │   ├── links.js           # buildQuizLink, buildSweepLink, buildResultLink
│   │   └── whatsapp.js        # waUrl(text, phone), normPhone
│   ├── places/
│   │   └── picker.js          # scorePlaces(), weightedPick()
│   └── ui/
│       ├── dom.js             # render(), delegate clicks, esc(), toast(), confetti()
│       ├── owner/
│       │   ├── home.js
│       │   ├── send-quiz.js
│       │   ├── send-sweep.js
│       │   ├── import.js
│       │   ├── brain.js       # foods DB view
│       │   ├── food-form.js
│       │   ├── places.js
│       │   ├── place-form.js
│       │   ├── picker.js
│       │   ├── history.js
│       │   └── settings.js
│       └── guest/
│           ├── quiz.js        # also used for "she's next to me" local mode
│           └── sweep.js
├── tests/
│   ├── codec.test.js
│   ├── engine.test.js
│   ├── picker.test.js
│   ├── store.test.js
│   └── sim.js                 # accuracy simulation for the engine (§6.5)
├── PLAN.md
└── README.md                  # run locally + deploy to GitHub Pages
```

---

## 4. Data model

```js
/** @typedef {'snack'|'meal'|'dessert'} Kind */
/** @typedef {'sit'|'take'|'delivery'|'home'|'any'} Mode */

/**
 * @typedef Food
 * @property {string}   id      stable, never renamed (ratings/history key on it)
 * @property {string}   name    'קליק אדום'
 * @property {string}   emoji   '🔴'
 * @property {string[]} tags    first tag = Kind, e.g. ['snack','sweet','crunchy','choco','kiosk',…]
 * @property {boolean} [custom] added by the owner
 */

/** Tag vocabulary (~45 tags), grouped:
 *  kind:     snack meal dessert
 *  flavor:   salty sweet spicy sour
 *  vibe:     hot cold heavy light healthy junk fancy home
 *  texture:  crunchy creamy saucy doughy bread rice noodles cheesy fried
 *  protein:  meaty fish veg egg   | sweets: choco fruit
 *  cuisine:  israeli middle street italian asian japanese american mexican indian breakfast
 *  eating:   messy hands couch quick
 *  source:   kiosk cook resto
 */

/** @typedef {{ r: 0|1|2|3|4, n?: string }} Rating   // 4 😍 · 3 🙂 · 2 😐 · 1 🤢 · 0 unknown */

/**
 * @typedef Place
 * @property {string}   id
 * @property {string}   name
 * @property {string}   city        'רעננה' | 'באר שבע' | …
 * @property {Mode[]}   modes       subset of ['sit','take','delivery']
 * @property {string[]} foods       Food ids served there
 * @property {0|1|2|3}  price       ₪ … ₪₪₪
 * @property {0|1|2|3|4|5} rating   how much she likes the place
 * @property {string}   link        optional (Maps / Wolt / site)
 * @property {string}   note        'her dish: …'
 * @property {string[]} visits      ISO dates
 */

/**
 * @typedef HistoryEntry
 * @property {string} id         = result payload id (dedupe)
 * @property {string} at         ISO
 * @property {string|null} f     Food id (null if free text)
 * @property {string} fn         food name   @property {string} fe  emoji
 * @property {Mode}   m          @property {1|2|3|null} price
 * @property {string} note       @property {string[]} trail  her Q→A log
 * @property {'link'|'local'} src
 */

/**
 * @typedef DB   (localStorage key: 'mabalach_v1')
 * @property {number} v                                  schema version (migrations)
 * @property {{her,me,herPhone,myPhone,base,city}} settings
 * @property {Object<string,Rating>} ratings
 * @property {Food[]}         custom
 * @property {Place[]}        places
 * @property {HistoryEntry[]} history   newest first
 * @property {string[]}       inbox     free-text foods she mentioned, not yet in DB
 * @property {string[]}       imported  result ids already imported
 */
```

### Link payloads (all carry `v: 1`)

```js
// #q=  owner → her (quiz)
{ v, h: 'נגה', m: 'איתן', p: '9725…',          // names + owner phone for the reply
  r: { bamba: 4, sushi: 1, … },                 // her ratings (compact)
  c: [ {id,name,emoji,tags} ],                  // custom foods
  x: ['shawarma'] }                             // eaten in last 3 days

// #s=  owner → her (taste sweep)
{ v, h, m, p, ids: string[] | null, c }        // null = all foods

// #r=  her → owner (quiz result)
{ v, t: 'quiz', id, at, f, fn, fe, m, price, note, trail: string[], top: string[] }

// #r=  her → owner (sweep result)
{ v, t: 'rate', id, at, r: {id: 1..4}, n: {id: 'note'}, x: string[] }
```

---

## 5. Module interfaces

### 5.1 `share/codec.js`
```js
export function encode(obj)  // JSON → UTF-8 → base64url (Hebrew-safe)
export function decode(str)  // inverse; throws on corrupt link → "the link broke" screen
```

### 5.2 `share/links.js` + `share/whatsapp.js`
```js
export function buildQuizLink(base, db)          // → `${base}#q=…`
export function buildSweepLink(base, db, onlyUnrated)
export function buildResultLink(base, payload)
export function normPhone('050-123-4567')        // → '972501234567'
export function waUrl(text, phone?)              // → 'https://wa.me/972…?text=…'  (no phone = contact picker)
```

### 5.3 `store/store.js`
```js
export interface Store {
  get(): DB
  update(fn: (db) => void): void      // mutate + persist
  importResult(payload): {fresh: boolean}   // dedupe by payload.id
  exportJSON(): string
  importJSON(json: string): void
}
// local.js implements it with localStorage; firebase.js later with Firestore.
```

### 5.4 `engine/quiz.js`
```js
/** @typedef {
 *   {type:'q', q:Question} |
 *   {type:'duel', a:Food, b:Food} |
 *   {type:'grid', items:Food[]} |
 *   {type:'guess', f:Food, p:number} |
 *   {type:'pick', items:Food[]}
 * } Step */

export class FoodQuiz {
  constructor(foods, questions, prior = {})
  next(): Step
  answer(question, answerIndex)
  duel(a, b, choice /* 'a'|'b'|'both'|'none' */)
  grid(items, vetoIds)
  guessResult(food, res /* 'yes'|'close'|'no' */)
  match(freeText): Food | null
  ranked(): {f: Food, p: number}[]
  undo(): boolean          // snapshot stack
  trail: string[]          // human-readable log sent back to you
}
```

### 5.5 `places/picker.js`
```js
export function scorePlaces(places, foods, { food, mode, city, now })
  // → [{ place, score, reason }] sorted desc, filtered by mode/city
export function weightedPick(scored, rnd = Math.random)
```

### 5.6 `ui/dom.js`
```js
export function render(html, handlers)  // innerHTML + click delegation via data-on / data-arg
export const esc, toast, confetti, copy, share
```

---

## 6. The guessing engine

### 6.1 Questions
```js
{
  id: 'texture',
  q: 'מה המרקם של החלום שלך עכשיו?',
  a: [
    { t: '🥨 קראנצ׳י! שיישמע כשאני נוגסת', e: { crunchy: 3, fried: 0.5 } },
    { t: '☁️ רך, קרמי, נימוח',             e: { creamy: 3, crunchy: -1.5 } },
    { t: '🫓 עם רוטב שצריך לנגב',          e: { saucy: 3.5 } },
    { t: '🧀 גבינה נמתחת',                 e: { cheesy: 3.5 } },
  ],
  start?: 1,            // forced order at the beginning (hunger, mood)
  need?: ['meal'],      // only ask if ≥15% of probability mass has one of these tags
}
```
Bank (~19): hunger 🐭→🐻, vibe, salty/sweet, spice level, hot/cold, texture, how-to-eat (hands / fork / couch),
protein, base (bread / dough / rice-noodles / no carbs), "if the food were a flight", fried?, energy to move,
breakfast-anytime, sour, street stand, chocolate/fruit, bag-or-fresh, **veto** ("what do you least want"),
**regret** ("something you'll regret tomorrow?").

### 6.2 Scoring
```
score[f] = prior[f]                      // ratings: 😍 +2.5, 🙂 +1, 😐 −0.8, 🤢 −8 ; eaten ≤3 days: −1.5
on answer a:  score[f] += Σ_{tag ∈ a.e ∩ f.tags} a.e[tag]
P(f) = softmax(score / T),  T = 1.6      // rejected foods excluded
```

### 6.3 Choosing the next question
For each unasked question, over the top-14 candidates (renormalised):
```
value(q) = mean over answers a of  Var_P( delta(f, a) )
```
High value = the answers would reorder the current front-runners. Pick the best (random among ≥85% of best for variety). Drop questions with value < 0.15.

### 6.4 Step schedule
```
1. starters (hunger, mood) in order
2. n ≥ 5 and not done            → elimination grid (top 9, tap ✕ to veto: −6 and −0.9×similarity spread)
3. confident and ≥2 steps since last guess → GUESS top food
      confident = p1 ≥ .5  or  (n ≥ 6 and p1 ≥ .25 and p1 ≥ 1.8·p2)  or  n ≥ 16  or  no useful questions
4. n % 4 == 3 and duels < 3      → DUEL top-1 vs the most *different* of top 2–7
5. else                          → best question
guess: 'yes' → finish · 'close' → reject, similar foods +1.5·sim · 'no' → reject, similar −2·sim
after 4 wrong guesses            → PICK list (top 8) + free text
always available: "🤫 I already know what I want" (free text + autocomplete) · undo
```

### 6.5 Tuning targets (`node tests/sim.js`)
Simulated user answers consistently with a hidden target food (± 15% noise):
- exact guess ≥ 75% of foods · exact-or-in-final-list ≥ 95% · average ≤ 10 steps
- Foods with identical tags are indistinguishable → the sim reports them; add a distinguishing tag.

---

## 7. Screens & flows

### 7.1 Routes
| Hash | Who | View |
|---|---|---|
| *(none)* | owner | Home |
| `#q=…` | her | Quiz intro → quiz → finish → send |
| `#s=…` | her | Sweep intro → cards → extras → send |
| `#r=…` | owner | Import (auto-save, dedupe) → result card → "pick a place" |

### 7.2 Guest — quiz
`Hi Noga 👋 → [Go, guess 😏]` → steps (§6.4) → 🎉 `"You want: 🍣 sushi"` →
mode chips (🍽️ sit · 🥡 takeout · 🛵 delivery · 👩‍🍳 cook · 🤷‍♀️ your call) → budget (₪/₪₪/₪₪₪) → note →
**[📲 Send to Eitan on WhatsApp]** (message = summary + result link).

### 7.3 Guest — taste sweep
One card per food (shuffled, resumable via localStorage): 😍 / 🙂 / 😐 / 🤢 / skip, optional note,
"finished, send" anytime → "anything you love that I didn't ask?" → WhatsApp.

### 7.4 Owner
- **Home**: last meal card, tiles: send quiz · she's next to me (local quiz) · pick a place · Noga's brain · places · get-to-know-you · history · settings.
- **Brain**: stats (😍/🙂/🤢/unknown), inbox of her free-text extras → "add with tags", search, filters, tap-to-rate, notes, add custom food (name, emoji, kind, tag chips).
- **Places**: grouped by city; form: name, city, modes, foods served (searchable chips), price, her rating ❤️×5, link, note.
- **Picker**: food (from result or chosen) + mode + city filters →
  `score = 10 if serves food | 2×shared-cuisine-tags · + 0.8×rating · −3 if visited this week` →
  list + 🎲 weighted random slot-machine → "✅ we're going" (logs visit) ·
  fallbacks: Google Maps search `"<food> <city>"`, 🏪 nearest kiosk for snacks, ▶️ YouTube recipe for "cook at home".
- **History**: date, food, mode, note, her Q→A trail, re-open picker.
- **Settings**: names, phones, site URL, export / import JSON backup, reset, **📥 paste a result link** (fallback import).

---

## 8. Link protocol details
- Format: `<site>#<q|s|r>=<base64url(JSON)>`; payload version `v` for future changes.
- Size budget: keep < 4 KB (ratings for ~85 foods ≈ 1.6 KB) — fine for WhatsApp.
- Dedupe: every result has a random `id`; owner stores imported ids.
- After import the hash is cleared (`history.replaceState`) so refresh doesn't re-import.
- Phone: `05x…` → `9725x…`; empty phone → `wa.me/?text=` opens the contact picker.

---

## 9. Phases

| Phase | Scope | Done when |
|---|---|---|
| **0 · Setup** | Repo `what_to_eat`, GitHub Pages on `main`, README, `index.html` hello world | `https://<user>.github.io/what_to_eat/` loads on your phone |
| **1 · Engine** | `data/*`, `engine/*`, `codec.js`, tests + `sim.js` | `node --test` green; sim meets §6.5 targets |
| **2 · Guest quiz + return trip** | `ui/dom.js`, router, guest quiz, finish screen, WhatsApp send, owner import + history | Full loop on two phones: you send → she answers → you open link → entry in history |
| **3 · Brain** | Brain view, food form, ratings, sweep (guest), sweep import, inbox, priors fed into quiz link | Her ratings visibly change quiz results (hated food never guessed) |
| **4 · Places** | Places CRUD, picker scoring, random draw, Maps / recipe fallbacks, visits | From a result to "we're going here" in ≤ 3 taps |
| **5 · Polish** | Settings, backup/restore, paste-link import, PWA (manifest + service worker), confetti/animations, empty states | Installed on home screen, works offline (except sending) |
| **6 · Optional** | Firebase sync (D1-B), her place vote (D2), stats page ("her top 10", "most chosen"), seasonal foods | — |

---

## 10. Testing
- **Unit** (`node --test`, zero dependencies): codec round-trip with Hebrew/emoji; engine — hated food never guessed, undo restores state, veto removes; picker — mode/city filters, recency penalty; store — dedupe import, migrations.
- **Simulation**: `node tests/sim.js` prints exact / in-list / avg-steps / misses.
- **Manual on real phones**: Android (your Pixel, Chrome) and her phone; open links from inside WhatsApp; RTL layout; long Hebrew notes; very long link; broken link.

---

## 11. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Your DB lives in one browser; WhatsApp might open links in a different one | Use Chrome (Android WhatsApp opens Chrome Custom Tabs, which share Chrome's storage) / install as PWA; **paste-link import** in settings; export backup |
| Phone lost → DB lost | Export JSON regularly; Phase 6 Firebase |
| Link truncated when copied | Decode error screen + "send again"; keep payload small |
| Quiz feels repetitive | Random tie-break among near-best questions; grow the bank; she can always skip with free text |
| Custom foods with few tags never get guessed | Food form nudges "more tags = better guesses"; they still appear via free-text autocomplete |
| Seed food names/brands wrong for her | She fixes it in the sweep's "anything I didn't ask?" → inbox |

---

## 12. Deploy (free)
```bash
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin https://github.com/EitanPinczowski/what_to_eat.git
git push -u origin main
# GitHub → repo → Settings → Pages → Source: Deploy from branch → main / (root)
# Paste https://eitanpinczowski.github.io/what_to_eat/ into the app's Settings
```
Local dev: `python -m http.server 8000` → `http://localhost:8000` (ES modules don't load from `file://`).
