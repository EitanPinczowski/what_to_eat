// Question bank v2 (feelings quiz). Each AXIS has 2-4 variants (same feeling, other wording) that share the answer effects.
// id = axis + number · stage 1-4 (body, mood, craving, feel) · F = effects per answer slot ("tag:delta ..."; "~name" = a history effect, see js/engine/prior.js)
import { lerpFx } from "../engine/quiz.js";

export const P = (s) => {
  const fx = {}, dyn = {};
  for (const p of s.split(" ")) {
    const i = p.lastIndexOf(":"), k = p.slice(0, i);
    k[0] === "~" ? (dyn[k.slice(1)] = +p.slice(i + 1)) : (fx[k] = +p.slice(i + 1));
  }
  return Object.keys(dyn).length ? { fx, dyn } : { fx };
};
const axis = (id, stage, F, o, vs) =>
  vs.map(([text, st, p, ty], i) => {
    const slider = st.length === 5;
    const lo = P(F[p?.[0] ?? 0]), hi = P(F[p?.[1] ?? F.length - 1]);
    const answers = slider
      ? st.map(([e, t], j) => ({ e, t, fx: lerpFx(lo.fx, hi.fx, j / 4), ...(lo.dyn && { dyn: lerpFx(lo.dyn, hi.dyn, j / 4) }), ...(o.big && j === 4 && { big: true }) }))
      : st.map(([e, t], j) => ({ e, t, ...P(F[j]), ...(o.ks && { k: o.ks[j] }), ...(o.big && j === F.length - 1 && { big: true }) }));
    return { id: id + (i + 1), axis: id, stage, text, answers, ...(slider && { slider: true }), ...((ty ?? (slider ? "slider" : null)) && { type: ty ?? "slider" }), ...(o.o && { ordered: true }), ...(o.multi && { multi: true }), ...(o.need && { need: o.need }) };
  });

/** Answers that are not plain buttons (color swatches, big pictures): same axis, own effects per answer. */
const special = (axisId, n, stage, type, text, rows) => ({
  id: axisId + n, axis: axisId, stage, text, type,
  answers: rows.map(([e, t, fx, c]) => ({ e, t, ...P(fx), ...(c && { c }) })),
});

export const QUESTIONS = [
  ...axis("hunger", 1, ["snack:3 dessert:1 meal:-2", "meal:3 snack:-2", "meal:3 heavy:2.5 light:-2 snack:-3"], { o: 1, big: 1 }, [
    ["כמה רעב יש בבטן?", [["🐭", "רק לנשנש משהו"], ["🐻", "רעבה, בא לי ארוחה"], ["🦖", "אני אוכלת את השולחן"]]],
    ["אם הרעב שלך היה חיה, מי הוא?", [["🐭", "עכבר, מספיק משהו קטן"], ["🐻", "דוב, צריך ארוחה אמיתית"], ["🦖", "דינוזאור, אוכלת הכל"]]],
    ["מתי אכלת משהו אמיתי בפעם האחרונה?", [["🍽️", "ממש עכשיו"], ["⏰", "לפני כמה שעות"], ["🕳️", "זה היה מזמן"]]],
    ["איפה את על סקאלת הרעב?", [["🐭", "רק לנשנש"], ["🐱", "קצת רעבה"], ["🐻", "רעבה"], ["🐯", "רעבה מאוד"], ["🦖", "אוכלת את השולחן"]]],
  ]),
  ...axis("body", 1, ["quick:2.5 couch:2 home:1.5", "fancy:1.5 resto:0.5 healthy:1", "choco:1.5 doughy:1.5 comfort:2 sweet:1.5"], {}, [
    ["ואיך הגוף מרגיש עכשיו?", [["🪫", "עייפה, בא לי משהו בלי מאמץ"], ["🙂", "בסדר, בא לי לאכול טוב"], ["🫠", "הגוף מבקש פינוק רציני"]]],
    ["כמה אנרגיה נשארה לך?", [["🪫", "כמעט אפס, שיביאו לי"], ["🔋", "מספיק כדי לאכול משהו טוב"], ["😮‍💨", "אין לי, מגיע לי פינוק"]]],
    ["מה הגוף מבקש ממך עכשיו?", [["🛏️", "לנוח, שיביאו לי"], ["🥂", "אוכל טוב שלא מכביד"], ["🫶", "פינוק גדול ומלא"]]],
  ]),
  ...axis("mood", 2, ["comfort:2.5 creamy:1.5 sweet:1 home:1.5", "salty:2 crunchy:2 junk:1.5", "fancy:2 resto:2 meal:1.5"], {}, [
    ["ומה עם הלב היום?", [["🤗", "צריכה חיבוק"], ["😤", "עמוס ולחוץ"], ["🥳", "שמחה, בא לחגוג"]]],
    ["אם היום שלך היה מזג אוויר, מה הוא היה?", [["🌫️", "אפרורי ושקט"], ["⛈️", "סוער"], ["☀️", "שמשי"]]],
    ["איך היה היום, במילה אחת?", [["🥺", "קשה"], ["🌀", "מטורף"], ["🎉", "מעולה"]]],
    ["איפה הלב שלך עכשיו?", [["🫂", "צריכה חיבוק"], ["🪫", "קצת עייפה"], ["🙂", "בסדר"], ["😄", "טוב לי"], ["🥳", "בא לחגוג"]], [0, 2]],
  ]),
  special("mood", 5, 2, "color", "איזה צבע את עכשיו?", [
    ["🟤", "חום וחמים", "comfort:2.5 creamy:1.5 sweet:1 home:1.5", "#8a5a3c"],
    ["🔴", "אדום ובוער", "salty:2 crunchy:1.5 junk:2 spicy:1", "#d6322e"],
    ["🔵", "כחול ורגוע", "healthy:2.5 cold:1 sour:1", "#2f6fd0"],
    ["🟡", "צהוב ושמשי", "fancy:2 resto:2 meal:1.5", "#f2b705"],
  ]),
  special("mood", 6, 2, "art", "איזו תמונה הכי את עכשיו?", [
    ["☁️", "ענן רך", "creamy:2.5 sweet:1.5 dessert:1"],
    ["🔥", "להבה", "salty:2 junk:1.5 spicy:1 hot:1"],
    ["🧊", "קרח", "healthy:2 cold:2"],
    ["🌧️", "גשם", "comfort:2.5 home:2 hot:1.5"],
  ]),
  special("mood", 7, 2, "faceoff", "איזה מצב רוח מנצח היום?", [
    ["🤗", "צריכה חיבוק", "comfort:2.5 creamy:1.5 sweet:1 home:1.5"],
    ["😤", "עמוס ולחוץ", "salty:2 crunchy:2 junk:1.5"],
    ["🥳", "בא לחגוג", "fancy:2 resto:2 meal:1.5"],
    ["😌", "רגועה ושקטה", "healthy:2 cold:1 sour:1"],
  ]),
  ...axis("vibe", 2, ["home:2.5 comfort:2.5 hot:1.5", "junk:3 fried:1.5 cheesy:1 healthy:-2", "healthy:3 sour:1.5 junk:-2"], {}, [
    ["איזה אוכל יעשה לך טוב עכשיו?", [["🛋️", "משהו ביתי ומנחם"], ["😈", "ג׳אנק בלי רגשות אשם"], ["🥗", "משהו טרי ונקי"]]],
    ["איזה סוג של ארוחה זו?", [["🛋️", "פיג׳מה וספה"], ["😈", "משהו שמנוני בלי רגשות אשם"], ["🥗", "משהו נקי ורענן"]]],
    ["איזה אוכל מתאים לאווירה שלך?", [["🤍", "ביתי ומחבק"], ["🍔", "משוחרר ושמנוני"], ["🍃", "נקי ובהיר"]]],
  ]),
  ...axis("family", 3, ["sweet:3 dessert:2 salty:-1.5", "doughy:2 noodles:2 bread:1.5", "salty:3 fried:2 junk:1.5 sweet:-2", "sour:3 healthy:2"], { multi: 1 }, [
    ["מה הבטן רוצה?", [["🍫", "מתוק"], ["🥐", "פחמימה טובה, בצק או פסטה"], ["🍟", "משהו מלוח ושמנוני"], ["🥗", "משהו טרי וחמצמץ"]]],
    ["איזה טעם מתגלגל לך בראש?", [["🍬", "משהו מתוק וממכר"], ["🍝", "משהו עם בצק"], ["🧂", "מלוח ושמנוני"], ["🍋", "חמצמץ ורענן"]]],
    ["אם היה לך רק ביס אחד, ממה הוא היה?", [["🍰", "מתוק"], ["🍕", "בצק או פסטה"], ["🍿", "מלוח"], ["🥒", "טרי וחמצמץ"]]],
  ]),
  special("family", 4, 3, "magnets", "אילו שני מגנטים מתאימים לך היום?", [
    ["🤗", "מנחם", "comfort:2.5 home:1.5 creamy:1 hot:1"],
    ["🥨", "קריספי", "crunchy:3 fried:1 salty:0.5"],
    ["🍬", "מתוק", "sweet:3 dessert:2"],
    ["🪶", "קליל", "light:2.5 healthy:1.5"],
    ["🌶️", "חריף", "spicy:3.5"],
    ["☁️", "קרמי", "creamy:3 cheesy:1"],
  ]),
  ...axis("warmth", 3, ["hot:3 cold:-2", "cold:3 hot:-2"], { ks: ["hot", "cold"] }, [
    ["משהו שמחמם או משהו שמרענן?", [["🔥", "שמחמם"], ["🧊", "שמרענן"]]],
    ["ספל תה חם או כוס לימונדה קרה?", [["☕", "תה חם"], ["🍋", "לימונדה קרה"]]],
    ["כמה חם או קר בא לך?", [["🧊", "קר מאוד"], ["🍃", "קריר"], ["🌤️", "פושר"], ["♨️", "חמים"], ["🔥", "חם ומהביל"]], [1, 0]],
    ["איפה הכספית אצלך עכשיו?", [["🧊", "קר מאוד"], ["🍃", "קריר"], ["🌤️", "פושר"], ["♨️", "חמים"], ["🔥", "חם ומהביל"]], [1, 0], "thermo"],
  ]),
  ...axis("world", 3, ["israeli:2 middle:2 home:2 c:israeli:2.5", "c:italian:2 c:japanese:2 c:thai:2 c:chinese:2 c:indian:2 c:american:2 c:mexican:2", "street:3 hands:1.5 middle:0.5"], {}, [
    ["ובאיזה עולם זה?", [["🏠", "מוכר וביתי"], ["✈️", "משהו מחו״ל"], ["🌯", "אוכל רחוב"]]],
    ["אם האוכל הזה היה מקום, איפה הוא?", [["👵", "המטבח של סבתא"], ["🌍", "עיר בחו״ל"], ["🏪", "דוכן בשוק"]]],
    ["לאן הטעם הזה לוקח אותך?", [["🏡", "הביתה"], ["🛫", "רחוק מכאן"], ["🛵", "לרחוב"]]],
  ]),
  ...axis("bite", 4, ["crunchy:3 fried:0.5", "creamy:3 crunchy:-1.5", "saucy:3.5", "cheesy:3.5"], { multi: 1 }, [
    ["הביס הראשון בדמיון שלך, איך הוא?", [["🥨", "קראנצ׳י"], ["☁️", "רך וקרמי"], ["🫓", "עם רוטב לנגב"], ["🧀", "נמתח וגבינתי"]]],
    ["איזה צליל בא לך לשמוע בביס?", [["🔊", "קראנץ׳!"], ["🤫", "שקט ורך"], ["🍜", "סלרפ של רוטב"], ["🧵", "נמתח ונמתח"]]],
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
  ...axis("kick", 4, ["spicy:-3", "spicy:1.5", "spicy:3.5"], { o: 1, need: ["salty", "spicy", "meal"] }, [
    ["כמה עוצמה בטעם?", [["🌸", "עדין"], ["🌶️", "עם עקיצה"], ["🔥", "שישרוף"]]],
    ["כמה חריף מתאים לך?", [["🧊", "בלי חריף"], ["🌶️", "קצת עקיצה"], ["🥵", "כמה שיותר"]]],
  ]),
  ...axis("sweets", 4, ["choco:4.5", "fruit:4.5", "cold:2 creamy:2", "doughy:2.5"], { multi: 1, need: ["sweet", "dessert"] }, [
    ["איזה מתוק?", [["🍫", "שוקולדי"], ["🍓", "פירותי"], ["🍦", "קר וקרמי"], ["🥐", "מאפה"]]],
    ["איזה מתוק מפתה אותך?", [["🍫", "שוקולד"], ["🍓", "פירות"], ["🍨", "גלידה או קרם"], ["🥧", "מאפה חם"]]],
  ]),
];

/** Opener by moment (R1): the first question's wording fits the hour. "Last time you ate" asks about the day; the hunger animal is for the evening. Others fit any time. */
const AT = { hunger2: ["evening", "late", "shabbat"], hunger3: ["morning", "noon", "friNoon"] };
for (const q of QUESTIONS) if (AT[q.id]) q.at = AT[q.id];

/** The axis names, in stage order. */
export const AXES = [...new Set(QUESTIONS.map((q) => q.axis))];

/** A question by id; a retired (v1) one loads on demand from questions-retired.js (old history, wrapped). */
export const findQuestion = async (id) => QUESTIONS.find((x) => x.id === id) ?? (await import("./questions-retired.js")).RETIRED.find((x) => x.id === id);

/** Evening = 17:00-04:00 local (REVIEW item 19). */
export const isEvening = (now = new Date()) => now.getHours() >= 17 || now.getHours() < 4;
/** The question's wording for this hour: a question may carry a daytime variant (textDay). */
export const questionText = (q, now = new Date()) => (q.textDay && !isEvening(now) ? q.textDay : q.text);
