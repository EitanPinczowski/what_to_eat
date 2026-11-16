// Hebrew strings of couple mode (1e). Lazy on purpose: strings.js is in the start-up size budget.
// Eitan's own wording is masculine (the bank's answer texts speak to her); each row is [emoji, text] per answer of that bank question.
export const COUPLE = {
  toggle: "גם אני עונה",
  hint: "שתי שאלות קטנות עליי, והתוצאה תתאים לשנינו (התשובות שלה שוות פי 2 משלי)",
  hidden: "התשובות שלי יישארו חבויות ממנה עד שתסיים",
  saved: "נשמר, אפשר לשלוח",
  qs: {
    mood1: { t: "ומה עם הלב שלי היום?", a: [["🤗", "צריך חיבוק"], ["😤", "עמוס ולחוץ"], ["🥳", "שמח, בא לחגוג"]] },
    family1: { t: "מה הבטן שלי רוצה?", a: [["🍫", "מתוק"], ["🥐", "פחמימה טובה"], ["🍟", "מלוח ושמנוני"], ["🥗", "טרי וחמצמץ"]] },
    after1: { t: "ואחרי האוכל, איך בא לי להרגיש?", a: [["🪶", "קליל"], ["😴", "מלא ומרוצה"]] },
  },
  /** Her result screen: the line before his chips. */
  by: (me) => `${me} ענה:`,
};
