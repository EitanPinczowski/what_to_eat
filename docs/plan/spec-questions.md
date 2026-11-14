### 2.3 Question rules (from research)
| # | Rule |
|---|---|
| R1 | Every answer must match a real chunk of foods (~15–50%). `sim.js` reports coverage; answers under 5% get merged or retagged |
| R2 | Recent meals: −1.5 for a food eaten in the last 3 days, −0.8×similarity for foods like it |
| R3 | Core bank = taste, texture, temperature, heaviness. Answers are vivid sensory images |
| R4 | "What don't you want" comes early: veto is the 3rd starter; the ✕ grid stays at step 5 |
| R5 | 2–4 options, no "medium". **No skip or "לא משנה לי" anywhere on her screens** (owner rule, 2026-11-14: she knows what she wants, she just won't say it; every question needs a real answer). Her only way out is "🤫 אני כבר יודעת מה בא לי" |
| R6 | One idea per question and per answer |
| R7 | Feminine 2nd person, phrased as questions ("בא לך…?"), never commands |
| R8 | At most 2 playful questions (flight, regret), weight .7. The result gets a mood title ("פחמימה מחבקת 🫶") |
| R9 | Target ≤10 steps; answers ≤5 words + emoji |
| R10 | Shuffle answer order except on ordered scales (hunger, spice, day) |
| R11 | 🦖 hunger → guess earlier (≈6 steps) and `healthy` effects ×0.5 |
| R12 | Small priors: time of day ±0.5 (breakfast 06–11, snack/dessert 22–03); out of season −1.5 |

### 2.4 Question bank v1 (19 questions; ids stable; effects use PLAN.md §4 tags + new `comfort`, `thai`)
```
1  hunger  start:1   "כמה את רעבה עכשיו, בכנות?"
   🐭 סתם בא לנשנש            snack 3, dessert 1, meal -2
   🐱 משהו קטן ושמח           snack 1, light 1.5, quick 1
   🐻 רעבה. ארוחה.            meal 3, snack -2
   🦖 אני אוכלת את השולחן     meal 3, heavy 2.5, light -2, snack -3
2  vibe    start:2   "איזה וייב יש לערב הזה?"
   🛋️ ספה, שמיכה, לא זזה      couch 2.5, home 1, heavy 1
   ✨ בא לי להתפנק            fancy 2.5, resto 1.5
   🥗 קליל ונקי               light 2.5, healthy 2.5, junk -2
   😈 יום ג׳אנק, בלי שיפוטים   junk 3, fried 1.5, healthy -2
4  veto    start:3   "מה הכי *לא* בא לך עכשיו?"
   🍟 שום דבר שמנוני           fried -3, heavy -2, junk -1.5
   🍣 שום דבר אסייתי           asian -3, japanese -3, thai -3
   🧀 בלי גבינות               cheesy -3, creamy -1
   🥙 לא עוד פיתה              bread -2.5, middle -2
5  taste             "איזה טעם קורא לך?"
   🧂 מלוח                    salty 3, sweet -2
   🍬 מתוק                    sweet 3, dessert 1.5, salty -1.5
   🌶️ חריף!                   spicy 3
   🍋 חמצמץ ורענן              sour 3, light 1
6  spice   need:spicy "וכמה חריף מדובר?"
   🧊 אפס חריף, תודה           spicy -3
   🌶️ קצת עקיצה               spicy 0.5
   🔥 שישרוף                   spicy 3.5
7  temp              "חם או קר?"
   🔥 חם ומהביל                hot 3, cold -2
   🧊 קר ומרענן                cold 3, hot -2
8  texture           "איזה מרקם בא לך?"
   🥨 קראנצ׳י, שיישמע כשאני נוגסת   crunchy 3, fried 0.5
   ☁️ רך וקרמי                creamy 3, crunchy -1.5
   🫓 עם רוטב שצריך לנגב        saucy 3.5
   🧀 גבינה נמתחת              cheesy 3.5
9  how               "איך את רוצה לאכול את זה?"
   🤲 בידיים                   hands 3
   🍴 עם סכין ומזלג, כמו גברת   fancy 1, resto 1, hands -1
   📺 מול סדרה                 couch 3
   🤪 שיטפטף על הכל            messy 3
10 protein need:meal "מי הכוכב בצלחת?"
   🥩 בשר                     meaty 3
   🐟 דג                      fish 3.5
   🥚 ביצה                    egg 3
   🥦 בלי בשר היום             veg 2.5, meaty -2
11 base    need:meal "על מה כל זה יושב?"
   🥖 לחם או פיתה              bread 3
   🍕 בצק                     doughy 3
   🍚 אורז או נודלס            rice 2, noodles 2
   🙅‍♀️ בלי פחמימות             bread -2, doughy -2, rice -2, noodles -2, healthy 1
12 flight  w:.7      "אם האוכל הזה היה טיסה — לאן?"
   🇮🇹 רומא                    italian 3
   🇯🇵 טוקיו                   japanese 3, asian 2
   🇺🇸 ניו יורק                american 3
   🇮🇱 נשארת פה                israeli 2, middle 2
13 fried             "מטוגן?"
   🍟 כן, שיהיה זהוב           fried 3, junk 1
   🥗 לא היום                  fried -2.5, healthy 1
14 energy            "כמה כוח יש לך לזוז?"
   🪫 אפס. שיביאו לי            couch 2, quick 1
   🚶‍♀️ עד הקיוסק               kiosk 2, quick 1.5
   💃 יוצאים!                  resto 2.5, fancy 1
   👩‍🍳 בא לי לבשל               cook 3, home 2
15 brkfst            "ארוחת בוקר עכשיו?"
   🍳 תמיד!                   breakfast 3, egg 1.5
   🙅‍♀️ לא עכשיו                breakfast -2
16 street            "אוכל רחוב מדוכן?"
   🌯 כן, מהדוכן הכי מפוקפק     street 3, middle 1, hands 1
   🍽️ משהו מסודר               street -1.5, resto 1
17 sweets  need:sweet,dessert "איזה מתוק?"
   🍫 שוקולד                   choco 3.5
   🍓 פירות                    fruit 3.5
   🍦 קר וקרמי                 cold 2, creamy 2
   🥐 מאפה                     doughy 2.5
18 bag     need:snack "חטיף משקית או משהו טרי?"
   🛍️ משקית                    kiosk 3, junk 1.5
   🥪 טרי                     kiosk -1.5, cook 1
19 regret  w:.7      "משהו שתתחרטי עליו מחר?"
   😇 לא, שיהיה לי טוב גם מחר   healthy 2, light 2, junk -2.5
   😈 בדיוק בשביל זה            junk 3, heavy 2, healthy -2
20 day     w:.8      "איך היה היום?"
   😮‍💨 קשה. צריכה חיבוק        comfort 3, heavy 1, home 1
   🙂 רגיל                    (neutral)
   🥳 מעולה! חוגגים            fancy 2, resto 1.5, comfort -0.5
```
Other steps: duel "אם חייבים לבחור עכשיו:" A / B / `שניהם 😍` / `אף אחד 🙅‍♀️` · grid "מה מכל אלה ממש לא?" ·
guess → `בול! 🎯` / `קרוב…` / `ממש לא` · pick "טוב, ניצחת 😅 מה מאלה?" + free text · escape "🤫 אני כבר יודעת מה בא לי".

