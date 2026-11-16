// Question bank v2 (feelings quiz). Each AXIS has 2-4 variants (same feeling, other wording) that share the answer effects.
// id = axis + number · stage 1-4 (body, mood, craving, feel) · F = effects per answer slot ("tag:delta ..."; "~name" = a history effect, see js/engine/prior.js)
// o: ordered scale · multi: pair of answers allowed · need: ask only when one of these tags is in play · ks: what each slot means when it is known without asking
// A variant with 5 [emoji, label] stops is a slider: the 5 buckets interpolate between two slots (p). Retired questions: RETIRED, below.
import { lerpFx } from "../engine/quiz.js";

const P = (s) => {
  const fx = {}, dyn = {};
  for (const p of s.split(" ")) {
    const i = p.lastIndexOf(":"), k = p.slice(0, i);
    k[0] === "~" ? (dyn[k.slice(1)] = +p.slice(i + 1)) : (fx[k] = +p.slice(i + 1));
  }
  return Object.keys(dyn).length ? { fx, dyn } : { fx };
};
const axis = (id, stage, F, o, vs) =>
  vs.map(([text, st, p], i) => {
    const slider = st.length === 5;
    const lo = P(F[p?.[0] ?? 0]), hi = P(F[p?.[1] ?? F.length - 1]);
    const answers = slider
      ? st.map(([e, t], j) => ({ e, t, fx: lerpFx(lo.fx, hi.fx, j / 4), ...(lo.dyn && { dyn: lerpFx(lo.dyn, hi.dyn, j / 4) }), ...(o.big && j === 4 && { big: true }) }))
      : st.map(([e, t], j) => ({ e, t, ...P(F[j]), ...(o.ks && { k: o.ks[j] }), ...(o.big && j === F.length - 1 && { big: true }) }));
    return { id: id + (i + 1), axis: id, stage, text, answers, ...(slider && { slider: true }), ...(o.o && { ordered: true }), ...(o.multi && { multi: true }), ...(o.need && { need: o.need }) };
  });

export const QUESTIONS = [
  ...axis("hunger", 1, ["snack:3 dessert:1 meal:-2", "meal:3 snack:-2", "meal:3 heavy:2.5 light:-2 snack:-3"], { o: 1, big: 1 }, [
    ["כמה רעב יש בבטן?", [["🐭", "רק לנשנש משהו"], ["🐻", "רעבה, בא לי ארוחה"], ["🦖", "אני אוכלת את השולחן"]]],
    ["אם הרעב שלך היה חיה, מי הוא?", [["🐭", "עכבר, מספיק משהו קטן"], ["🐻", "דוב, צריך ארוחה אמיתית"], ["🦖", "דינוזאור, אוכלת הכל"]]],
    ["מתי אכלת משהו אמיתי בפעם האחרונה?", [["🍽️", "ממש עכשיו"], ["⏰", "לפני כמה שעות"], ["🕳️", "זה היה מזמן"]]],
    ["איפה את על סקאלת הרעב?", [["🐭", "רק לנשנש"], ["🐱", "קצת רעבה"], ["🐻", "רעבה"], ["🐯", "רעבה מאוד"], ["🦖", "אוכלת את השולחן"]]],
  ]),
  ...axis("body", 1, ["quick:2.5 couch:2 home:1.5", "light:1 fancy:1 resto:0.5", "choco:1.5 doughy:1.5 heavy:2 comfort:2 sweet:1.5"], {}, [
    ["ואיך הגוף מרגיש עכשיו?", [["🪫", "עייפה, בא לי משהו קל"], ["🙂", "בסדר, בא לי לאכול טוב"], ["🫠", "הגוף מבקש פינוק רציני"]]],
    ["כמה אנרגיה נשארה לך?", [["🪫", "כמעט אפס"], ["🔋", "חצי סוללה"], ["😮‍💨", "אין לי, מגיע לי פינוק"]]],
    ["מה הגוף מבקש ממך עכשיו?", [["🛏️", "לנוח, שיביאו לי"], ["🥂", "אוכל טוב שלא מכביד"], ["🫶", "פינוק גדול ומלא"]]],
  ]),
  ...axis("mood", 2, ["comfort:2.5 creamy:1.5 sweet:1 home:1.5", "salty:2 crunchy:2 junk:1.5", "fancy:2 resto:2 meal:1.5"], {}, [
    ["ומה עם הלב היום?", [["🤗", "צריכה חיבוק"], ["😤", "עמוס ולחוץ"], ["🥳", "שמחה, בא לחגוג"]]],
    ["אם היום שלך היה מזג אוויר, מה הוא היה?", [["🌫️", "אפרורי ושקט"], ["⛈️", "סוער"], ["☀️", "שמשי"]]],
    ["איך היה היום, במילה אחת?", [["🥺", "קשה"], ["🌀", "מטורף"], ["🎉", "מעולה"]]],
    ["איפה הלב שלך עכשיו?", [["🫂", "צריכה חיבוק"], ["🙂", "בסדר"], ["😌", "רגועה"], ["😄", "טוב לי"], ["🥳", "בא לחגוג"]], [0, 2]],
  ]),
  ...axis("vibe", 2, ["home:2.5 comfort:2.5 hot:1.5", "junk:3 fried:1.5 cheesy:1 healthy:-2", "light:2.5 healthy:2.5 sour:1 junk:-2"], {}, [
    ["איזה אוכל יעשה לך טוב עכשיו?", [["🛋️", "משהו ביתי ומנחם"], ["😈", "ג׳אנק בלי רגשות אשם"], ["🥗", "משהו טרי ונקי"]]],
    ["איזה סוג של ארוחה זו?", [["🛋️", "פיג׳מה וספה"], ["🎁", "פינוק קטן לעצמי"], ["🥗", "משהו נקי ורענן"]]],
    ["איזה אוכל מתאים לאווירה שלך?", [["🤍", "ביתי ומחבק"], ["🍔", "משוחרר ושמנוני"], ["🍃", "נקי ובהיר"]]],
  ]),
  ...axis("family", 3, ["sweet:3 dessert:2 salty:-1.5", "doughy:2 noodles:2 bread:1.5", "salty:3 fried:2 junk:1.5 sweet:-2", "sour:2.5 light:2 healthy:2"], { multi: 1 }, [
    ["מה הבטן רוצה?", [["🍫", "מתוק"], ["🥐", "פחמימה טובה, בצק או פסטה"], ["🍟", "משהו מלוח ושמנוני"], ["🥗", "משהו טרי וחמצמץ"]]],
    ["איזה טעם מתגלגל לך בראש?", [["🍬", "משהו מתוק וממכר"], ["🍝", "משהו עם בצק"], ["🧂", "מלוח ושמנוני"], ["🍋", "חמצמץ ורענן"]]],
    ["אם היה לך רק ביס אחד, ממה הוא היה?", [["🍰", "מתוק"], ["🍕", "בצק או פסטה"], ["🍿", "מלוח"], ["🥒", "טרי וחמצמץ"]]],
  ]),
  ...axis("warmth", 3, ["hot:3 cold:-2", "cold:3 hot:-2"], { ks: ["hot", "cold"] }, [
    ["משהו שמחמם או משהו שמרענן?", [["🔥", "שמחמם"], ["🧊", "שמרענן"]]],
    ["ספל תה חם או כוס לימונדה קרה?", [["☕", "תה חם"], ["🍋", "לימונדה קרה"]]],
    ["כמה חם או קר בא לך?", [["🧊", "קר מאוד"], ["🍃", "קריר"], ["🌤️", "פושר"], ["♨️", "חמים"], ["🔥", "חם ומהביל"]], [1, 0]],
  ]),
  ...axis("world", 3, ["israeli:2 middle:2 home:2 c:israeli:2.5", "c:italian:2 c:asian:2 c:american:2 c:mexican:2", "street:3 hands:1.5 middle:0.5"], {}, [
    ["ובאיזה עולם זה?", [["🏠", "מוכר וביתי"], ["✈️", "משהו מחו״ל"], ["🌯", "אוכל רחוב"]]],
    ["אם האוכל הזה היה מקום, איפה הוא?", [["👵", "המטבח של סבתא"], ["🌍", "עיר בחו״ל"], ["🏪", "דוכן בשוק"]]],
    ["לאן הטעם הזה לוקח אותך?", [["🏡", "הביתה"], ["🛫", "רחוק מכאן"], ["🛵", "לרחוב"]]],
  ]),
  ...axis("bite", 4, ["crunchy:3 fried:0.5", "creamy:3 crunchy:-1.5", "saucy:3.5", "cheesy:3.5"], { multi: 1 }, [
    ["הביס הראשון בדמיון שלך, איך הוא?", [["🥨", "קראנצ׳י"], ["☁️", "רך וקרמי"], ["🫓", "עם רוטב לנגב"], ["🧀", "נמתח וגבינתי"]]],
    ["איזה צליל עושה האוכל הזה?", [["🔊", "קראנץ׳!"], ["🤫", "שקט ורך"], ["🍜", "סלרפ של רוטב"], ["🧵", "נמתח ונמתח"]]],
  ]),
  ...axis("after", 4, ["light:2.5 healthy:1 heavy:-2", "heavy:2.5 comfort:1"], {}, [
    ["ואחרי האוכל, איך בא לך להרגיש?", [["🪶", "קלילה"], ["😴", "מלאה ומרוצה"]]],
    ["ומחר בבוקר, מה תרצי להגיד על הארוחה הזו?", [["🌤️", "הייתה קלילה ונעימה"], ["😋", "הייתה שווה כל ביס"]]],
    ["כמה כבד בא לך?", [["🪶", "קליל מאוד"], ["🌿", "די קליל"], ["🙂", "באמצע"], ["🍲", "משביע"], ["😴", "מלאה ומרוצה"]]],
  ]),
  ...axis("novel", 4, ["home:1 comfort:1 ~familiar:1", "fancy:0.5 ~fresh:1"], { ks: ["familiar", "fresh"] }, [
    ["משהו מוכר שעושה טוב, או משהו שלא אכלת מזמן?", [["💛", "מוכר ואהוב"], ["✨", "משהו שלא היה מזמן"]]],
    ["בא לך את הקבוע שלך, או לגוון?", [["🔁", "את הקבוע"], ["🎲", "לגוון"]]],
    ["כמה מוכר או חדש בא לך?", [["🏠", "מוכר מאוד"], ["💛", "קצת מוכר"], ["🤔", "באמצע"], ["🌱", "קצת חדש"], ["✨", "חדש לגמרי"]]],
  ]),
  ...axis("kick", 4, ["spicy:-3", "spicy:0.5", "spicy:3.5"], { o: 1, need: ["salty", "spicy", "meal"] }, [
    ["כמה עוצמה בטעם?", [["🌸", "עדין"], ["🌶️", "עם עקיצה"], ["🔥", "שישרוף"]]],
    ["כמה חריף מתאים לך?", [["🧊", "בלי חריף"], ["🌶️", "קצת עקיצה"], ["🥵", "כמה שיותר"]]],
  ]),
  ...axis("sweets", 4, ["choco:4.5", "fruit:4.5", "cold:2 creamy:2", "doughy:2.5"], { multi: 1, need: ["sweet", "dessert"] }, [
    ["איזה מתוק?", [["🍫", "שוקולדי"], ["🍓", "פירותי"], ["🍦", "קר וקרמי"], ["🥐", "מאפה"]]],
    ["איזה מתוק מפתה אותך?", [["🍫", "שוקולד"], ["🍓", "פירות"], ["🍨", "גלידה או קרם"], ["🥧", "מאפה חם"]]],
  ]),
];

/** The axis names, in stage order. */
export const AXES = [...new Set(QUESTIONS.map((q) => q.axis))];

// Retired questions (v1): [id, text, [[emoji, answer, effects]], "o:1 w:0.7 need:a,b"]. Kept so old history ("ans" ids), the history stats and the monthly card still resolve.
const R = ([id, text, answers, x = ""]) => ({
  id, text, retired: true,
  answers: answers.map(([e, t, f]) => ({ e, t, ...P(f) })),
  ...Object.fromEntries(x.split(" ").filter(Boolean).map((p) => p.split(":")).map(([k, v]) => (k === "o" ? ["ordered", true] : k === "w" ? ["w", +v] : ["need", v.split(",")]))),
});
export const RETIRED = [
  ["hunger", "כמה את רעבה עכשיו, בכנות?", [["🐭","סתם בא לנשנש","snack:3 dessert:1 meal:-2"],["🐱","משהו קטן ושמח","snack:1 light:1.5 quick:1"],["🐻","רעבה. ארוחה.","meal:3 snack:-2"],["🦖","אני אוכלת את השולחן","meal:3 heavy:2.5 light:-2 snack:-3"]], "o:1"],
  ["cuisine", "איזה סוג אוכל בא לך?", [["🍝","איטלקי","c:italian:3"],["🌮","מקסיקני","c:mexican:3"],["🍔","אמריקאי","c:american:3"],["🧆","ישראלי","c:israeli:3"],["🥢","אסייתי","c:asian:3"],["☕","בית קפה","c:cafe:3"],["🍰","משהו מתוק","c:sweet:3"],["🥨","נשנוש","c:snack:3"]], "o:1"],
  ["vibe", "איזה וייב יש לערב הזה?", [["🛋️","ספה, שמיכה, לא זזה","couch:2.5 home:1 heavy:1"],["✨","בא לי להתפנק","fancy:2.5 resto:1.5"],["🥗","קליל ונקי","light:2.5 healthy:2.5 junk:-2"],["😈","יום ג׳אנק, בלי שיפוטים","junk:3 fried:1.5 healthy:-2"]]],
  ["veto", "מה הכי לא בא לך עכשיו?", [["🍟","שום דבר שמנוני","fried:-3 heavy:-2 junk:-1.5"],["🍣","שום דבר אסייתי","asian:-3 japanese:-3 thai:-3"],["🧀","בלי גבינות","cheesy:-3 creamy:-1"],["🥙","לא עוד פיתה","bread:-2.5 middle:-2"]]],
  ["taste", "איזה טעם קורא לך?", [["🧂","מלוח","salty:3 sweet:-2"],["🍬","מתוק","sweet:3 dessert:1.5 salty:-1.5"],["🌶️","חריף!","spicy:3"],["🍋","חמצמץ ורענן","sour:3 light:1"]]],
  ["spice", "וכמה חריף מדובר?", [["🧊","אפס חריף, תודה","spicy:-3"],["🌶️","קצת עקיצה","spicy:0.5"],["🔥","שישרוף","spicy:3.5"]], "o:1 need:spicy"],
  ["temp", "חם או קר?", [["🔥","חם ומהביל","hot:3 cold:-2"],["🧊","קר ומרענן","cold:3 hot:-2"]]],
  ["texture", "איזה מרקם בא לך?", [["🥨","קראנצ׳י, שיישמע כשאני נוגסת","crunchy:3 fried:0.5"],["☁️","רך וקרמי","creamy:3 crunchy:-1.5"],["🫓","עם רוטב שצריך לנגב","saucy:3.5"],["🧀","גבינה נמתחת","cheesy:3.5"]]],
  ["how", "איך את רוצה לאכול את זה?", [["🤲","בידיים","hands:3"],["🍴","עם סכין ומזלג, כמו גברת","fancy:1 resto:1 hands:-1"],["📺","מול סדרה","couch:3"],["🤪","שיטפטף על הכל","messy:3"]]],
  ["protein", "מי הכוכב בצלחת?", [["🥩","בשר","meaty:3"],["🐟","דג","fish:3.5"],["🥚","ביצה","egg:3"],["🥦","בלי בשר היום","veg:2.5 meaty:-2"]], "need:meal"],
  ["base", "על מה כל זה יושב?", [["🥖","לחם או פיתה","bread:3"],["🍕","בצק","doughy:3"],["🍚","אורז או נודלס","rice:2 noodles:2"],["🙅‍♀️","בלי פחמימות","bread:-2 doughy:-2 rice:-2 noodles:-2 healthy:1"]], "need:meal"],
  ["flight", "אם האוכל הזה היה טיסה — לאן?", [["🇮🇹","רומא","italian:3"],["🇯🇵","טוקיו","japanese:3 asian:2"],["🇺🇸","ניו יורק","american:3"],["🇮🇱","נשארת פה","israeli:2 middle:2"]], "w:0.7"],
  ["fried", "מטוגן?", [["🍟","כן, שיהיה זהוב","fried:3 junk:1"],["🥗","לא היום","fried:-2.5 healthy:1"]]],
  ["energy", "כמה כוח יש לך לזוז?", [["🪫","אפס. שיביאו לי","couch:2 quick:1"],["🚶‍♀️","עד הקיוסק","kiosk:2 quick:1.5"],["💃","יוצאים!","resto:2.5 fancy:1"],["👩‍🍳","בא לי לבשל","cook:3 home:2"]]],
  ["brkfst", "ארוחת בוקר עכשיו?", [["🍳","תמיד!","breakfast:3 egg:1.5"],["🙅‍♀️","לא עכשיו","breakfast:-2"]]],
  ["street", "אוכל רחוב מדוכן?", [["🌯","כן, מהדוכן הכי מפוקפק","street:3 middle:1 hands:1"],["🍽️","משהו מסודר","street:-1.5 resto:1"]]],
  ["sweets", "איזה מתוק?", [["🍫","שוקולד","choco:4.5"],["🍓","פירות","fruit:4.5"],["🍦","קר וקרמי","cold:2 creamy:2"],["🥐","מאפה","doughy:2.5"]], "need:sweet,dessert"],
  ["bag", "חטיף משקית או משהו טרי?", [["🛍️","משקית","kiosk:3 junk:1.5"],["🥪","טרי","kiosk:-1.5 healthy:1 cook:1"]], "need:snack"],
  ["regret", "משהו שתתחרטי עליו מחר?", [["😇","לא, שיהיה טוב גם מחר","healthy:2 light:2 junk:-2.5"],["😈","בדיוק בשביל זה","junk:3 heavy:2 healthy:-2"]], "w:0.7"],
  ["day", "איך היה היום?", [["😮‍💨","קשה. צריכה חיבוק","comfort:3 heavy:1 home:1"],["🙂","רגיל",""],["🥳","מעולה! חוגגים","fancy:2 resto:1.5 comfort:-0.5"]], "w:0.8 o:1"],
].map(R);

/** Every question that ever existed (current and retired), for looking up an old id. */
export const ALL_QUESTIONS = [...QUESTIONS, ...RETIRED];

/** Evening = 17:00-04:00 local (REVIEW item 19). */
export const isEvening = (now = new Date()) => now.getHours() >= 17 || now.getHours() < 4;
/** The question's wording for this hour: a question may carry a daytime variant (textDay). */
export const questionText = (q, now = new Date()) => (q.textDay && !isEvening(now) ? q.textDay : q.text);
