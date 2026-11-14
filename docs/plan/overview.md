# Build plan — מה בא לך? (v1)

## 1. Context
`what_to_eat/PLAN.md` is the original spec for a free, static, Hebrew/RTL web app: an Akinator-style quiz guesses what
Noga wants to eat, the answer reaches Eitan, and the app helps pick a place. This file is the **single, final plan**:
it folds in every decision approved during planning and replaces the layered drafts. `PLAN.md` stays as the reference
for the data model, engine math and screen list (§ refs point into it); where the two disagree, this file wins, and
step 5.4 updates `PLAN.md` to match.

### Final decisions
| Area | Decision |
|---|---|
| Scope | Phases 0–5, built unattended. You review once at the end |
| Data transport | **Firebase Firestore (free Spark plan).** Quiz results and ratings save straight to a shared DB, live. Not over WhatsApp; WhatsApp is only how you send the link, plus an automatic `#r=` fallback if saving fails |
| Links | **Short**: `<site>#q=<roomId>` (quiz), `#s=<roomId>` (sweep), `#join=<roomId>` (your other devices). Her phone reads ratings/custom foods/recent meals live from the room |
| Hosting | Public repo `EitanPinczowski/what_to_eat`; GitHub Pages published **by GitHub Actions only when tests pass** |
| Privacy | No phone numbers or her data in the repo. Names appear only as defaults. Room id and ntfy topic live in the DB/browser, never in code |
| Stack | Vanilla JS ES modules, no build step, nothing shipped from npm. Dev-only: Node LTS + `@playwright/test` |
| Voice | The app speaks as Eitan, lightly teasing, feminine 2nd person, questions not commands. **All Hebrew strings in `js/data/strings.js`** |
| Project folder | **`C:\dev\what_to_eat`** (moved out of OneDrive). The old Desktop folder keeps `PLAN.md` + a pointer note |
| Her phone | iPhone: tested with Playwright WebKit "iPhone 14"; iOS install help in Settings |
| Declined for v1 | Hard food rules (kosher/allergy), her own start screen, "surprise me", your vetoes, a "what did you eat today" question |

