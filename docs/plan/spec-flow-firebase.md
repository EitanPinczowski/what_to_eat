### 2.1 Noga's flow (approved)
WhatsApp link → intro "היי נגה… [יאללה, תנחש]" → one question per screen, **tap = answer**, with a "כמה אני בטוח"
meter (= the engine's top probability, starts ~15%) → guess "אני חושב שבא לך… סושי?" (בול / קרוב / ממש לא) → finish:
result + mood title, how (sit/takeout/delivery/cook/your call), budget, optional note → one **"שליחה לאיתן"** button →
saved; she sees "איתן קיבל!" → you get an ntfy alert and a result card in History with "בוא נבחר מקום".
Escapes: 🤫 type it · ↩︎ undo · 🤷‍♀️ skip (no scoring) · pick list after 4 misses, framed as a joke.
**"She opened it" + resume:** her client keeps one doc `rooms/{id}/live/quiz` (opened / step n / finished + answer log).
You see "נגה פתחה · שאלה 5". If she leaves and reopens the link, in any browser, she continues where she stopped.

### 2.2 Firebase design
- `rooms/{roomId}` (random 128-bit id, created on your first run): doc = settings, ratings, custom foods, inbox, learned
  weights. Subcollections: `history`, `places`, `live`, `feedback`, `errors`.
- Anonymous Auth. `firestore.rules`: signed-in users may read/write only inside a room whose id they hold; **listing
  rooms is denied**; only the collections above are writable; guest-written docs have capped field counts and string lengths.
- Modular SDK from `gstatic.com`, **version pinned**, cached by the service worker. `js/firebase-config.js` holds the
  public web config (safe to commit; the rules protect the data). Firestore offline cache on.
- **Store interface (PLAN.md §5.3) with three implementations:** `firebase.js` (live), `local.js` (localStorage +
  `storage` events: the no-Firebase fallback and the e2e mode `?store=local`), `memory.js` (unit tests only).
- ntfy.sh push: the app generates a random topic on your first run; Settings shows a subscribe link. Her client POSTs a
  minimal message ("נגה סיימה 🎉 — פתח את האפליקציה"), with no food or notes, because ntfy.sh is public.
- Error log: a global handler on her phone writes crashes to `errors` (message, stack, screen, user agent; last 50).
- Feedback: "💬 משהו לא עבד?" on guest screens → `feedback`; shown in your inbox.

