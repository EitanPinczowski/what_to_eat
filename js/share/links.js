// Short room links (#w= wrapped link, see overview.md "Links") + the #r= fallback result link (PLAN.md §8).
import { encode, decode } from "./codec.js";

const ROOM = /^[a-z0-9]{6,40}$/;
const strip = (base) => String(base).replace(/#.*$/, "");

export const buildQuizLink = (base, roomId) => `${strip(base)}#q=${roomId}`;
export const buildSweepLink = (base, roomId) => `${strip(base)}#s=${roomId}`;
export const buildJoinLink = (base, roomId) => `${strip(base)}#join=${roomId}`;
export const buildWrappedLink = (base, summary) => `${strip(base)}#w=${encode({ v: 1, ...summary })}`;
export const buildResultLink = (base, payload) => `${strip(base)}#r=${encode({ v: 1, ...payload })}`;

/**
 * parseHash('#q=abc123') → {kind:'q', room:'abc123'} · '#r=…' → {kind:'r', payload}
 * Empty hash → {kind:'home'}. Anything broken → {kind:'bad'}.
 */
export function parseHash(hash) {
  const h = String(hash ?? "").replace(/^#/, "");
  if (!h) return { kind: "home" };
  if (h === "how") return { kind: "how" };
  const m = h.match(/^(q|s|join|r|w)=(.+)$/);
  if (!m) return { kind: "bad" };
  const [, kind, val] = m;
  if (kind === "r" || kind === "w") {
    try {
      const payload = decode(val);
      if (!payload || payload.v !== 1 || (kind === "r" ? !payload.id : !/^\d{4}-\d{2}$/.test(payload.mo ?? ""))) return { kind: "bad" };
      return { kind, payload };
    } catch {
      return { kind: "bad" };
    }
  }
  return ROOM.test(val) ? { kind, room: val } : { kind: "bad" };
}
