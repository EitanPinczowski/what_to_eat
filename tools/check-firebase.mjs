// Checks the live Firebase project: anonymous sign-in works and the security rules behave.
// Usage: node tools/check-firebase.mjs
import { firebaseConfig as c } from "../js/firebase-config.js";

const base = `https://firestore.googleapis.com/v1/projects/${c.projectId}/databases/(default)/documents`;
const randomId = "check" + Math.random().toString(36).slice(2).padEnd(24, "x");
const out = [];
const record = (name, ok, detail) => out.push(`${ok ? "PASS" : "FAIL"}  ${name}  (${detail})`);

const signUp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${c.apiKey}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ returnSecureToken: true }),
});
const auth = await signUp.json();
record("anonymous sign-in is enabled", Boolean(auth.idToken), auth.idToken ? "got a token" : auth.error?.message);

const noAuth = await fetch(`${base}/rooms/${randomId}`);
record("reading without sign-in is refused", noAuth.status === 403, `status ${noAuth.status}`);

if (auth.idToken) {
  const h = { authorization: `Bearer ${auth.idToken}` };
  const get = await fetch(`${base}/rooms/${randomId}`, { headers: h });
  record("signed-in read of a room by id is allowed", get.status === 404 || get.status === 200, `status ${get.status}`);
  const list = await fetch(`${base}/rooms`, { headers: h });
  record("listing rooms is refused", list.status === 403, `status ${list.status}`);
  const other = await fetch(`${base}/other/${randomId}`, { headers: h });
  record("other collections are refused", other.status === 403, `status ${other.status}`);
  const sub = await fetch(`${base}/rooms/${randomId}/history`, { headers: h });
  record("listing a room's history is allowed", sub.status === 200, `status ${sub.status}`);
  // Tightened rules: no writes into a room that does not exist, and room ids must look like the app's (a-z0-9, 20-40).
  const wr = (id, path) => fetch(`${base}/rooms/${id}${path}`, { method: "PATCH", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ fields: { text: { stringValue: "x" } } }) });
  const w1 = await wr(randomId, "/feedback/check");
  record("writing into a room that does not exist is refused", w1.status === 403, `status ${w1.status}`);
  const w2 = await wr("SHORT", "");
  record("a malformed room id is refused", w2.status === 403, `status ${w2.status}`);
  const bad = await fetch(`${base}/rooms/${randomId}/secrets`, { headers: h });
  record("unknown subcollections are refused", bad.status === 403, `status ${bad.status}`);
}
console.log(out.join("\n"));
process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
