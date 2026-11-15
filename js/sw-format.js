// Push notification text, shared by sw.js (importScripts) and the unit tests (import for the global).
// Classic script on purpose: service workers cannot be relied on to load ES modules in every browser.
// The Hebrew template lives here (not js/data/strings.js) because the worker cannot import that module.
(function (g) {
  const CHOSE = (her, name, emoji) => `${her || "נגה"} בחרה: ${name} ${emoji}`;
  const FOOD_ID = /^[a-z_]{1,30}$/;

  /** {title, body, tag} for a relay payload {title, body, url, kind, food?}. A known food id rewrites the body. */
  g.wteFormatPush = function (d, names, her) {
    const p = d && typeof d === "object" ? d : {};
    let body = typeof p.body === "string" ? p.body : "";
    const hit = typeof p.food === "string" && FOOD_ID.test(p.food) && Object.prototype.hasOwnProperty.call(names || {}, p.food) ? names[p.food] : null;
    if (hit) body = CHOSE(her, hit[0], hit[1]);
    return {
      title: typeof p.title === "string" && p.title ? p.title : "מה בא לך?",
      body,
      tag: "wte-" + (typeof p.kind === "string" && /^[a-z]{1,12}$/.test(p.kind) ? p.kind : "msg"),
    };
  };
})(globalThis);
