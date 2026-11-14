// All UI strings. Feminine 2nd person, questions not commands, the app speaks as Eitan.
export const STR = {
  appTitle: "מה בא לך?",
  skip: { e: "🤷‍♀️", t: "לא משנה לי" },
  escape: "🤫 אני כבר יודעת מה בא לי",
  back: "רגע, אחורה",
  progress: (n, total) => `שאלה ${n} מתוך ~${total}`,

  duel: { text: "אם חייבים לבחור עכשיו:", both: "שניהם 😍", neither: "אף אחד 🙅‍♀️" },
  grid: { text: "מה מכל אלה ממש לא?", done: "זהו, אלה" },
  guess: {
    text: "נראה לי שבא לך…",
    yes: "בול! 🎯",
    close: "קרוב…",
    no: "ממש לא",
  },
  pick: {
    text: "טוב, ניצחת 😅 מה מאלה?",
    free: "משהו אחר? מה בא לך?",
    send: "זה!",
  },

  // Result mood titles (R8), chosen by the winning food's tags; first match wins.
  moods: [
    { tags: ["comfort", "heavy"], t: "פחמימה מחבקת 🫶" },
    { tags: ["junk"], t: "יום ג׳אנק מגיע לך 😈" },
    { tags: ["spicy"], t: "אש בפה 🔥" },
    { tags: ["dessert"], t: "שן מתוקה 🍬" },
    { tags: ["sweet"], t: "שן מתוקה 🍬" },
    { tags: ["healthy"], t: "קליל ומאושר 🌿" },
    { tags: ["fancy"], t: "ערב של פינוק ✨" },
    { tags: ["couch"], t: "ספה ושמיכה 🛋️" },
    { tags: ["comfort"], t: "חיבוק בצלחת 🫶" },
  ],
  moodDefault: "בדיוק מה שבא לך 😋",

  result: {
    title: "אז מה בא לך:",
    sendTo: (me) => `לשלוח ל${me}?`,
    sent: "נשלח! 💌",
  },

  errors: {
    badLink: "הקישור הזה נראה שבור 😕 אולי תבקשי ממני חדש?",
    offline: "אין אינטרנט כרגע. ננסה שוב כשיחזור?",
  },
};
