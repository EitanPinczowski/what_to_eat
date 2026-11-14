// JSON ⇄ UTF-8 ⇄ base64url (Hebrew-safe). decode throws on a corrupt string.
export function encode(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decode(str) {
  if (typeof str !== "string" || !/^[A-Za-z0-9_-]+$/.test(str)) throw new Error("bad link");
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Random url-safe id (room ids, result ids). */
export function newId(len = 12, rnd = Math.random) {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += abc[Math.floor(rnd() * abc.length)];
  return s;
}
