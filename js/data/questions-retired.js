// Retired v1 questions, loaded on demand by findQuestion (questions.js); not in the start-up graph.
import { P } from "./questions.js";

// [id, text, [[emoji, answer, effects]], "o:1 w:0.7 need:a,b"]. Kept so old history ("ans" ids), the history stats and the monthly card still resolve.
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

