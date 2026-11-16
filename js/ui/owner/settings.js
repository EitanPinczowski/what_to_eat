// Owner settings: names, phones, city, site URL, ntfy, connect a device, paste a result link,
// backup export/import (+ monthly reminder), rotate key, reset.
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildJoinLink, parseHash } from "../../share/links.js";
import { normPhone } from "../../share/whatsapp.js";
import { ROOM_KEY, openStore } from "../../store/open.js";
import { rejoinFromLink } from "../../store/room-backup.js";
import { render, html, raw, toast, copy, saveFailed, topbar, keepOpen } from "../dom.js";
import { addSub, removeSub, hasSub, pushSupport, subscribeThisDevice, currentSub, unsubscribeThisDevice, notifyAll, knownEndpoint, rememberEndpoint, epHash, pruneDead } from "../../push.js";
import { installKind, installHelp } from "../../pwa.js";
import { withTimeout } from "../guest/session.js";
import { BACKUP_EVERY, backupDue } from "./backup-due.js";
import { relTime } from "./live-status.js";

const G = STR.settings;
/**
 * Site address as typed on a phone: Android keyboards capitalise ("Https://"), add spaces or invisible
 * RTL marks, and people leave out the scheme. Returns "" for empty input, null when it is not an address.
 */
export function normBase(raw) {
  let t = String(raw ?? "").replace(/[‎‏‪-‮⁦-⁩﻿\s]/g, "");
  if (!t) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = "https://" + t;
  let u;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || (!u.hostname.includes(".") && u.hostname !== "localhost")) return null;
  const path = u.pathname.replace(/index\.html$/i, "").replace(/\/?$/, "/");
  return u.origin + path;
}

export { BACKUP_EVERY, backupDue };

/** A write that never gets its server ack (offline) must not leave the screen hanging: reject with Error("timeout"). */
export const WRITE_TIMEOUT = 10000;

/**
 * Copy everything to a fresh room id and switch to it (old links stop working). With keepData the old room is
 * then blanked and marked moved, so an old link shows "this link was replaced" instead of stale data.
 * Throws Error("timeout") when the copy gets no server ack in time (nothing is switched then).
 */
export async function moveToNewRoom(store, { keepData = true, storage = localStorage, mode, open = openStore, timeout = WRITE_TIMEOUT } = {}) {
  const id = newId(24, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
  const next = await withTimeout(open(id, { mode }), timeout);
  if (keepData) await withTimeout(next.importJSON(store.exportJSON()), timeout);
  else await withTimeout(next.update((db) => (db.settings = { ...store.get().settings, ntfy: "" })), timeout);
  storage.setItem(ROOM_KEY, id);
  if (keepData) await withTimeout(store.retire(), timeout).catch((e) => console.error("retire old room", e)); // best effort: the move already happened
  return id;
}

const clip = (t, n) => (String(t ?? "").length > n ? String(t).slice(0, n - 1) + "…" : String(t ?? ""));

/** Item 11: the problems card (last 20 errors) and the feedback list (last 5), each with a clear button. */
export function problemsCard(store, now = Date.now()) {
  const P = STR.settings.problems;
  const errs = store.list("errors");
  const fb = store.list("feedback");
  return html`<section class="card stack" data-testid="problems"><b>${P.title(errs.length)}</b>
    ${errs.length ? raw(html`<ul class="foods">${errs.slice(0, 20).map((e) => raw(html`<li class="sub"><span dir="ltr">${clip(e.msg, 90)}</span> · ${e.screen ?? ""} · ${relTime(e.at, now)}</li>`))}</ul>
      <button class="btn btn-ghost" data-on="clearLog" data-arg="errors" data-testid="clear-errors">${P.clear}</button>`) : raw(html`<span class="sub">${P.none}</span>`)}
    <b>${P.feedbackTitle(fb.length)}</b>
    ${fb.length ? raw(html`<ul class="foods">${fb.slice(0, 5).map((e) => raw(html`<li class="sub">${clip(e.text, 120)} · ${relTime(e.at, now)}</li>`))}</ul>
      <button class="btn btn-ghost" data-on="clearLog" data-arg="feedback" data-testid="clear-feedback">${P.clear}</button>`) : raw(html`<span class="sub">${P.feedbackNone}</span>`)}</section>`;
}

export function settingsViews({ root, store, views, common, base, mode }) {
  const st = {};
  keepOpen(root, st);
  views.settings = () => {
    const s = store.get().settings;
    const join = buildJoinLink(s.base || base, store.roomId);
    const field = (k, label, extra = "") => raw(html`<label class="field">${label}<input name="${k}" value="${s[k] ?? ""}" ${raw(extra)}></label>`);
    render(root, html`${raw(topbar(G.title))}
      <form data-submit="save" class="stack">
        ${field("her", G.her, 'maxlength="30"')}${field("me", G.me, 'maxlength="30"')}
        ${field("herPhone", G.herPhone, 'inputmode="tel" dir="ltr" maxlength="20"')}${field("myPhone", G.myPhone, 'inputmode="tel" dir="ltr" maxlength="20"')}
        ${field("city", G.city, 'maxlength="40"')}${field("base", G.base, 'dir="ltr" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="200"')}
        <button class="btn btn-primary act" type="submit">${G.save}</button>
      </form>
      <section class="card stack" data-testid="push"><b>${G.push.title}</b><span class="sub">${G.push.help}</span>
        <span class="sub" data-testid="push-state" role="status"></span>
        <div class="stack" data-testid="push-actions"></div>
        <label class="check"><input type="checkbox" data-testid="notify-open" data-input="notifyOpen" ${s.notifyOpen ? "checked" : ""}> ${G.push.openedLabel}</label>
        <span class="sub">${G.push.openedHelp}</span></section>
      <a class="btn btn-ghost" href="credits.html" data-testid="credits-link">${G.credits.link}</a>
      <section class="card stack install"><b>${STR.install.title}</b><span class="sub">${installHelp(installKind())}</span>
        ${globalThis.__installPrompt ? raw(html`<button class="btn" data-on="install">${STR.install.button}</button>`) : ""}
        ${installKind() !== "ios" ? raw(html`<span class="sub">${STR.install.ios}</span>`) : ""}</section>
      <details data-k="adv" class="stack" data-testid="advanced" ${st.adv ? "open" : ""}><summary>${G.adv}</summary>
      <section class="card stack"><b>${G.ntfy}</b><span class="sub">${G.ntfyHelp}</span>
        <code class="link" dir="ltr">https://ntfy.sh/${s.ntfy}</code></section>
      <section class="card stack"><b>${G.join}</b><span class="sub">${G.joinHelp}</span>
        <code class="link" dir="ltr">${join}</code><button class="btn" data-on="copyJoin">${STR.owner.copy}</button></section>
      <form class="card stack" data-submit="paste"><b>${G.paste}</b>
        <input name="link" dir="ltr" placeholder="${G.pastePh}"><button class="btn" type="submit">${G.import}</button></form>
      <form class="card stack" data-submit="rejoin" data-testid="rejoin"><b>${G.rejoin}</b><span class="sub">${G.rejoinHelp}</span>
        <input name="roomlink" dir="ltr" placeholder="${G.rejoinPh}" autocapitalize="off" autocorrect="off" spellcheck="false"><button class="btn" type="submit">${G.rejoinBtn}</button></form>
      <section class="card stack"><b>${G.backup}</b>
        <button class="btn" data-on="export">${G.export}</button>
        <label class="btn">${G.restore}<input type="file" accept="application/json,.json" data-input="restore" hidden></label></section>
      ${raw(problemsCard(store))}
      <button class="btn btn-ghost" data-on="rotate">${G.rotate}</button>
      <button class="btn btn-ghost" data-on="reset">${G.reset}</button></details>`, {
      ...common,
      pushOn: async () => {
        try {
          // fresh: a stored subscription may be dead, so get a new one and replace the old entries
          const old = [knownEndpoint(), (await currentSub())?.endpoint].filter(Boolean);
          const sub = await subscribeThisDevice(undefined, undefined, { fresh: true });
          await withTimeout(store.update((db) => (db.settings.push = addSub(old.reduce(removeSub, db.settings.push), sub))), WRITE_TIMEOUT);
          rememberEndpoint(sub.endpoint);
          toast(G.push.done);
        } catch (e) {
          toast(e?.message === "denied" ? G.push.denied : e?.message === "timeout" ? G.offline : G.push.fail);
        }
        views.settings();
      },
      notifyOpen: async (_v, _e, el) => {
        const on = !!el?.checked;
        await store.update((db) => (db.settings.notifyOpen = on)).catch(() => toast(G.saveFail));
      },
      pushTest: async () => {
        const res = await notifyAll({ push: [await currentSub()].filter(Boolean) }, "test");
        toast(res.some((c) => c === 201) ? G.push.testSent : G.push.testFail);
        const cur = await currentSub();
        if (cur && res.includes(410)) store.update((db) => (db.settings.push = pruneDead(db.settings.push, [epHash(cur.endpoint)]))).catch(saveFailed); // the relay says it is gone: drop it
      },
      pushOff: async () => {
        const ep = await unsubscribeThisDevice();
        rememberEndpoint("");
        if (ep) await store.update((db) => (db.settings.push = removeSub(db.settings.push, ep))).catch(saveFailed);
        toast(G.push.offDone);
        views.settings();
      },
      install: async () => {
        const p = globalThis.__installPrompt;
        globalThis.__installPrompt = null;
        await p?.prompt?.();
        views.settings();
      },
      save: async (fd) => {
        const v = (k, n) => String(fd.get(k) ?? "").trim().slice(0, n);
        const baseUrl = normBase(fd.get("base"));
        if (baseUrl === null) return toast(G.badBase);
        // Offline-first: a write queued with no ack in 6 s counts as saved; a refusal shows an error.
        const queued = Symbol();
        const res = await Promise.race([
          store
          .update((db) =>
            Object.assign(db.settings, {
              her: v("her", 30) || db.settings.her,
              me: v("me", 30) || db.settings.me,
              herPhone: normPhone(v("herPhone", 20)),
              myPhone: normPhone(v("myPhone", 20)),
              city: v("city", 40),
              base: baseUrl,
            }),
          )
          .catch((e) => (console.error("settings save failed", e), new Error(String(e)))),
          new Promise((r) => setTimeout(r, 6000, queued)),
        ]);
        if (res instanceof Error) return toast(G.saveFail);
        toast(STR.owner.saved);
        views.settings();
      },
      copyJoin: async () => toast((await copy(join)) ? STR.owner.copied : join),
      paste: async (fd) => {
        const r = parseHash(String(fd.get("link") ?? "").replace(/^[^#]*/, ""));
        if (r.kind !== "r") return toast(G.badPaste);
        const chk = store.checkResult(r.payload);
        if (chk.bad) return toast(STR.importBad);
        if (chk.dup) return toast(STR.importedOld);
        if (!confirm(STR.importAsk(chk.clean))) return;
        const { fresh } = await withTimeout(store.importResult(r.payload), WRITE_TIMEOUT).catch(() => ({ fresh: true })); // no ack in time: it is applied locally and syncs later
        toast(fresh ? STR.imported : STR.importedOld);
      },
      rejoin: async (fd) => {
        const res = await rejoinFromLink(String(fd.get("roomlink") ?? ""), { ask: () => confirm(STR.joinAsk) });
        if (res === "bad") return toast(G.rejoinBad);
        if (res === "same") return toast(G.rejoinSame);
        if (res === "declined") return;
        toast(STR.joined);
        location.reload();
      },
      clearLog: async (col) => {
        if (!confirm(G.problems.clearAsk)) return;
        try {
          await withTimeout(store.clearLog(col), WRITE_TIMEOUT);
          toast(G.problems.cleared);
        } catch {
          toast(G.problems.clearFail);
        }
        views.settings();
      },
      export: () => {
        const blob = new Blob([store.exportJSON()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `mabalach-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        store.update((db) => (db.settings.lastBackup = new Date().toISOString())).catch(saveFailed);
      },
      restore: async (_v, _e, el) => {
        const file = el.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          JSON.parse(text);
          await withTimeout(store.importJSON(text), WRITE_TIMEOUT);
          toast(G.restored);
        } catch (e) {
          toast(e?.message === "timeout" ? G.offline : G.badBackup);
        }
      },
      rotate: async () => {
        if (!confirm(G.rotateAsk)) return;
        try {
          await moveToNewRoom(store, { keepData: true, mode });
        } catch (e) {
          return toast(e?.message === "timeout" ? G.offline : G.saveFail);
        }
        toast(G.rotated);
        location.reload();
      },
      reset: async () => {
        if (!confirm(G.resetAsk)) return;
        try {
          await moveToNewRoom(store, { keepData: false, mode });
        } catch (e) {
          return toast(e?.message === "timeout" ? G.offline : G.saveFail);
        }
        location.reload();
      },
    });
    fillPush(root, store);
  };
}

/** Fill the notifications card with this device's state (async: needs the service worker). */
async function fillPush(root, store) {
  const st = root.querySelector?.("[data-testid=push-state]");
  const acts = root.querySelector?.("[data-testid=push-actions]");
  if (!st || !acts) return;
  const P = G.push;
  const support = pushSupport();
  const sub = support === "unsupported" ? null : await currentSub();
  if (!st.isConnected) return; // the view changed while waiting
  const on = !!sub && hasSub(store.get().settings.push, sub.endpoint);
  const state = on ? "on" : support;
  st.textContent = P[state];
  acts.innerHTML = state === "on"
    ? `<button class="btn" data-on="pushTest">${P.test}</button><button class="btn btn-ghost" data-on="pushOff">${P.disable}</button>`
    : state === "off" ? `<button class="btn btn-primary" data-on="pushOn">${P.enable}</button>` : "";
}
