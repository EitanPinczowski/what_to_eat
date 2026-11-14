// Tag vocabulary. First tag of every food is its kind.
export const KINDS = ["snack", "meal", "dessert"];

export const TAG_GROUPS = {
  kind: ["snack", "meal", "dessert"],
  flavor: ["salty", "sweet", "spicy", "sour"],
  vibe: ["hot", "cold", "heavy", "light", "healthy", "junk", "fancy", "home", "comfort"],
  texture: ["crunchy", "creamy", "saucy", "doughy", "bread", "rice", "noodles", "cheesy", "fried"],
  protein: ["meaty", "fish", "veg", "egg"],
  sweets: ["choco", "fruit"],
  cuisine: ["israeli", "middle", "street", "italian", "asian", "japanese", "thai", "american", "mexican", "indian", "breakfast"],
  eating: ["messy", "hands", "couch", "quick"],
  source: ["kiosk", "cook", "resto"],
};

export const TAGS = {
  snack: "נשנוש", meal: "ארוחה", dessert: "קינוח",
  salty: "מלוח", sweet: "מתוק", spicy: "חריף", sour: "חמצמץ",
  hot: "חם", cold: "קר", heavy: "כבד", light: "קליל", healthy: "בריא", junk: "ג׳אנק",
  fancy: "מפנק", home: "ביתי", comfort: "מנחם",
  crunchy: "קראנצ׳י", creamy: "קרמי", saucy: "עם רוטב", doughy: "בצק", bread: "לחם",
  rice: "אורז", noodles: "נודלס ופסטה", cheesy: "גבינתי", fried: "מטוגן",
  meaty: "בשר", fish: "דג", veg: "צמחוני", egg: "ביצה",
  choco: "שוקולד", fruit: "פירות",
  israeli: "ישראלי", middle: "מזרחי", street: "אוכל רחוב", italian: "איטלקי",
  asian: "אסייתי", japanese: "יפני", thai: "תאילנדי", american: "אמריקאי",
  mexican: "מקסיקני", indian: "הודי", breakfast: "ארוחת בוקר",
  messy: "מטפטף", hands: "בידיים", couch: "מול סדרה", quick: "מהיר",
  kiosk: "מהקיוסק", cook: "מבשלים", resto: "מסעדה",
};

export const ALL_TAGS = Object.values(TAG_GROUPS).flat();
