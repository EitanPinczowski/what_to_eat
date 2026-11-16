// Strings of the next-day check-in (lazy, with js/ui/guest/checkin.js): feminine 2nd person, phrased as questions.
export const CHECKIN = {
  ask: "רוצה שאזכיר לך מחר לספר איך היה?",
  yes: "כן, תזכיר לי",
  no: "לא, תודה",
  ok: "סגור, אזכיר לך מחר 🙂",
  fail: "לא הצלחתי לקבוע תזכורת. אולי בפעם הבאה?",
  denied: "בסדר, בלי תזכורת.",
  how: (fn) => `איך היה ה${fn}?`,
  up: "👍 היה טעים",
  down: "👎 לא ממש",
  thanks: "תודה, רשמתי 👍",
  none: "אין עכשיו מה לדרג. רוצה שאשאל אותך משהו אחר?",
};
