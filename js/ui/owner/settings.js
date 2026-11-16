// Owner settings: names, phones, city, site URL, ntfy, connect a device, paste a result link,
// backup export/import (+ monthly reminder), rotate key, reset.
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildJoinLink, parseHash } from "../../share/links.js";
import { normPhone } from "../../share/whatsapp.js";
import { ROOM_KEY, openStore } from "../../store/open.js";
import { render, html, raw, toast, copy, saveFailed } from "../dom.js";
import { addSub, removeSub, hasSub, pushSupport, subscribeThisDevice, currentSub, unsubscribeThisDevice, notifyAll, knownEndpoint, rememberEndpoint, epHash, pruneDead } from "../../push.js";
import { installKind, installHelp } from "../../pwa.js";
import { withTimeout } from "../guest/session.js";
import { BACKUP_EVERY, backupDue } from "./backup-due.js";

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

export function settingsViews({ root, store, views, back, common, base, mode }) {
  views.settings = () => {
    const s = store.get().settings;
    const join = buildJoinLink(s.base || base, store.roomId);
    const field = (k, label, extra = "") => raw(html`<label class="field">${label}<input name="${k}" value="${s[k] ?? ""}" ${raw(extra)}></label>`);
    render(root, html`${raw(back)}
      <h2 class="q">${G.title}</h2>
      <form data-submit="save" class="stack">
        ${field("her", G.her, 'maxlength="30"')}${field("me", G.me, 'maxlength="30"')}
        ${field("herPhone", G.herPhone, 'inputmode="tel" dir="ltr" maxlength="20"')}${field("myPhone", G.myPhone, 'inputmode="tel" dir="ltr" maxlength="20"')}
        ${field("city", G.city, 'maxlength="40"')}${field("base", G.base, 'dir="ltr" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="200"')}
        <button class="btn btn-primary" type="submit">${G.save}</button>
      </form>
      <section class="card stack"><b>${G.ntfy}</b><span class="sub">${G.ntfyHelp}</span>
        <code class="link" dir="ltr">https://ntfy.sh/${s.ntfy}</code></section>
      <section class="card stack" data-testid="push"><b>${G.push.title}</b><span class="sub">${G.push.help}</span>
        <span class="sub" data-testid="push-state" role="status"></span>
        <div class="stack" data-testid="push-actions"></div>
        <label class="field row"><input type="checkbox" data-testid="notify-open" data-input="notifyOpen" ${s.notifyOpen ? "checked" : ""}> ${G.push.openedLabel}</label>
        <span class="sub">${G.push.openedHelp}</span></section>
      <section class="card stack"><b>${G.join}</b><span class="sub">${G.joinHelp}</span>
        <code class="link" dir="ltr">${join}</code><button class="btn" data-on="copyJoin">${STR.owner.copy}</button></section>
      <form class="card stack" data-submit="paste"><b>${G.paste}</b>
        <input name="link" dir="ltr" placeholder="${G.pastePh}"><button class="btn" type="submit">${G.import}</button></form>
      <section class="card stack"><b>${G.backup}</b>
        <button class="btn" data-on="export">${G.export}</button>
        <label class="btn">${G.restore}<input type="file" accept="application/json,.json" data-input="restore" hidden></label></section>
      <section class="card stack install"><b>${STR.install.title}</b><span class="sub">${installHelp(installKind())}</span>
        ${globalThis.__installPrompt ? raw(html`<button class="btn" data-on="install">${STR.install.button}</button>`) : ""}
        ${installKind() !== "ios" ? raw(html`<span class="sub">${STR.install.ios}</span>`) : ""}</section>
      <button class="btn btn-ghost" data-on="rotate">${G.rotate}</button>
      <button class="btn btn-ghost" data-on="reset">${G.reset}</button>`, {
      ...common,
      pushOn: async () => {
        try {
          // fresh: a stored subscription may be dead, so ask the push service for a new one and replace the old entries
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
        // Offline-first: a write only queued (no server ack in 6 s) still counts as saved; a refusal shows an error.
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
