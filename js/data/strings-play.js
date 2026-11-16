// Hebrew strings of the playful answer types, the little chef and the recap mood lines. Lazy on purpose: strings.js is in the start-up size budget.
export const PLAY = {
  magnets: { hint: "אילו שני מגנטים תצמידי למקרר?", done: "אלה השניים", door: "דלת המקרר" },
  faceoff: { round: "מי מנצח מהשניים?", final: "ועכשיו הגמר, מי לוקח?" },
  busy: "השרת עמוס היום, שומרים אצלך וננסה שוב",
  chef: { alt: "השף הקטן" },
  moodTitle: "מה שעושה לך טוב",
  moodLine: (slot, food, n) => `${["כשהיה לך יום קשה", "כשהיית עמוסה", "כשהיה לך יום טוב"][slot]} בחרת ${food} ${n === 2 ? "פעמיים" : `${n} פעמים`}`,
};
