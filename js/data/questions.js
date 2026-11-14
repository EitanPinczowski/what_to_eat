// Question bank v1 (docs/plan/spec-questions.md §2.4). Ids are stable.
// start: fixed position among the opening questions · need: ask only when one of these tags is in play
// w: weight multiplier (playful questions) · ordered: keep answer order (R10) · fx: tag → score delta
const a = (e, t, fx = {}) => ({ e, t, fx });

export const QUESTIONS = [
  { id: "hunger", start: 1, ordered: true, text: "כמה את רעבה עכשיו, בכנות?", answers: [
    a("🐭", "סתם בא לנשנש", { snack: 3, dessert: 1, meal: -2 }),
    a("🐱", "משהו קטן ושמח", { snack: 1, light: 1.5, quick: 1 }),
    a("🐻", "רעבה. ארוחה.", { meal: 3, snack: -2 }),
    a("🦖", "אני אוכלת את השולחן", { meal: 3, heavy: 2.5, light: -2, snack: -3 }),
  ] },
  { id: "vibe", start: 2, text: "איזה וייב יש לערב הזה?", answers: [
    a("🛋️", "ספה, שמיכה, לא זזה", { couch: 2.5, home: 1, heavy: 1 }),
    a("✨", "בא לי להתפנק", { fancy: 2.5, resto: 1.5 }),
    a("🥗", "קליל ונקי", { light: 2.5, healthy: 2.5, junk: -2 }),
    a("😈", "יום ג׳אנק, בלי שיפוטים", { junk: 3, fried: 1.5, healthy: -2 }),
  ] },
  { id: "veto", start: 3, text: "מה הכי לא בא לך עכשיו?", answers: [
    a("🍟", "שום דבר שמנוני", { fried: -3, heavy: -2, junk: -1.5 }),
    a("🍣", "שום דבר אסייתי", { asian: -3, japanese: -3, thai: -3 }),
    a("🧀", "בלי גבינות", { cheesy: -3, creamy: -1 }),
    a("🥙", "לא עוד פיתה", { bread: -2.5, middle: -2 }),
  ] },
  { id: "taste", text: "איזה טעם קורא לך?", answers: [
    a("🧂", "מלוח", { salty: 3, sweet: -2 }),
    a("🍬", "מתוק", { sweet: 3, dessert: 1.5, salty: -1.5 }),
    a("🌶️", "חריף!", { spicy: 3 }),
    a("🍋", "חמצמץ ורענן", { sour: 3, light: 1 }),
  ] },
  { id: "spice", need: ["spicy"], ordered: true, text: "וכמה חריף מדובר?", answers: [
    a("🧊", "אפס חריף, תודה", { spicy: -3 }),
    a("🌶️", "קצת עקיצה", { spicy: 0.5 }),
    a("🔥", "שישרוף", { spicy: 3.5 }),
  ] },
  { id: "temp", text: "חם או קר?", answers: [
    a("🔥", "חם ומהביל", { hot: 3, cold: -2 }),
    a("🧊", "קר ומרענן", { cold: 3, hot: -2 }),
  ] },
  { id: "texture", text: "איזה מרקם בא לך?", answers: [
    a("🥨", "קראנצ׳י, שיישמע כשאני נוגסת", { crunchy: 3, fried: 0.5 }),
    a("☁️", "רך וקרמי", { creamy: 3, crunchy: -1.5 }),
    a("🫓", "עם רוטב שצריך לנגב", { saucy: 3.5 }),
    a("🧀", "גבינה נמתחת", { cheesy: 3.5 }),
  ] },
  { id: "how", text: "איך את רוצה לאכול את זה?", answers: [
    a("🤲", "בידיים", { hands: 3 }),
    a("🍴", "עם סכין ומזלג, כמו גברת", { fancy: 1, resto: 1, hands: -1 }),
    a("📺", "מול סדרה", { couch: 3 }),
    a("🤪", "שיטפטף על הכל", { messy: 3 }),
  ] },
  { id: "protein", need: ["meal"], text: "מי הכוכב בצלחת?", answers: [
    a("🥩", "בשר", { meaty: 3 }),
    a("🐟", "דג", { fish: 3.5 }),
    a("🥚", "ביצה", { egg: 3 }),
    a("🥦", "בלי בשר היום", { veg: 2.5, meaty: -2 }),
  ] },
  { id: "base", need: ["meal"], text: "על מה כל זה יושב?", answers: [
    a("🥖", "לחם או פיתה", { bread: 3 }),
    a("🍕", "בצק", { doughy: 3 }),
    a("🍚", "אורז או נודלס", { rice: 2, noodles: 2 }),
    a("🙅‍♀️", "בלי פחמימות", { bread: -2, doughy: -2, rice: -2, noodles: -2, healthy: 1 }),
  ] },
  { id: "flight", w: 0.7, text: "אם האוכל הזה היה טיסה — לאן?", answers: [
    a("🇮🇹", "רומא", { italian: 3 }),
    a("🇯🇵", "טוקיו", { japanese: 3, asian: 2 }),
    a("🇺🇸", "ניו יורק", { american: 3 }),
    a("🇮🇱", "נשארת פה", { israeli: 2, middle: 2 }),
  ] },
  { id: "fried", text: "מטוגן?", answers: [
    a("🍟", "כן, שיהיה זהוב", { fried: 3, junk: 1 }),
    a("🥗", "לא היום", { fried: -2.5, healthy: 1 }),
  ] },
  { id: "energy", text: "כמה כוח יש לך לזוז?", answers: [
    a("🪫", "אפס. שיביאו לי", { couch: 2, quick: 1 }),
    a("🚶‍♀️", "עד הקיוסק", { kiosk: 2, quick: 1.5 }),
    a("💃", "יוצאים!", { resto: 2.5, fancy: 1 }),
    a("👩‍🍳", "בא לי לבשל", { cook: 3, home: 2 }),
  ] },
  { id: "brkfst", text: "ארוחת בוקר עכשיו?", answers: [
    a("🍳", "תמיד!", { breakfast: 3, egg: 1.5 }),
    a("🙅‍♀️", "לא עכשיו", { breakfast: -2 }),
  ] },
  { id: "street", text: "אוכל רחוב מדוכן?", answers: [
    a("🌯", "כן, מהדוכן הכי מפוקפק", { street: 3, middle: 1, hands: 1 }),
    a("🍽️", "משהו מסודר", { street: -1.5, resto: 1 }),
  ] },
  { id: "sweets", need: ["sweet", "dessert"], text: "איזה מתוק?", answers: [
    a("🍫", "שוקולד", { choco: 3.5 }),
    a("🍓", "פירות", { fruit: 3.5 }),
    a("🍦", "קר וקרמי", { cold: 2, creamy: 2 }),
    a("🥐", "מאפה", { doughy: 2.5 }),
  ] },
  { id: "bag", need: ["snack"], text: "חטיף משקית או משהו טרי?", answers: [
    a("🛍️", "משקית", { kiosk: 3, junk: 1.5 }),
    a("🥪", "טרי", { kiosk: -1.5, healthy: 1, cook: 1 }),
  ] },
  { id: "regret", w: 0.7, text: "משהו שתתחרטי עליו מחר?", answers: [
    a("😇", "לא, שיהיה טוב גם מחר", { healthy: 2, light: 2, junk: -2.5 }),
    a("😈", "בדיוק בשביל זה", { junk: 3, heavy: 2, healthy: -2 }),
  ] },
  { id: "day", w: 0.8, ordered: true, text: "איך היה היום?", answers: [
    a("😮‍💨", "קשה. צריכה חיבוק", { comfort: 3, heavy: 1, home: 1 }),
    a("🙂", "רגיל"),
    a("🥳", "מעולה! חוגגים", { fancy: 2, resto: 1.5, comfort: -0.5 }),
  ] },
];
