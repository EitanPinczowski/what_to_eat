// Owner settings: names, phones, city, site URL, ntfy, connect a device, paste a result link,
// backup export/import (+ monthly reminder), rotate key, reset.
import { STR } from "../../data/strings.js";
import { newId } from "../../share/codec.js";
import { buildJoinLink, parseHash } from "../../share/links.js";
import { normPhone } from "../../share/whatsapp.js";
import { ROOM_KEY, openStore } from "../../store/open.js";
import { render, html, raw, toast, copy } from "../dom.js";

const G = STR.settings;
export const BACKUP_EVERY = 30 * 864e5;

export const backupDue = (settings, now = Date.now()) => !settings.lastBackup || now - new Date(settings.lastBackup) >= BACKUP_EVERY;

/** Copy everything to a fresh room id and switch to it (old links stop working). */
export async function moveToNewRoom(store, { keepData = true, storage = localStorage, mode } = {}) {
  const id = newId(24, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);
  const next = await openStore(id, { mode });
  if (keepData) await next.importJSON(store.exportJSON());
  else await next.update((db) => (db.settings = { ...store.get().settings, ntfy: "" }));
  storage.setItem(ROOM_KEY, id);
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
        ${field("city", G.city, 'maxlength="40"')}${field("base", G.base, 'dir="ltr" inputmode="url" maxlength="200"')}
        <button class="btn btn-primary" type="submit">${G.save}</button>
      </form>
      <section class="card stack"><b>${G.ntfy}</b><span class="sub">${G.ntfyHelp}</span>
        <code class="link" dir="ltr">https://ntfy.sh/${s.ntfy}</code></section>
      <section class="card stack"><b>${G.join}</b><span class="sub">${G.joinHelp}</span>
        <code class="link" dir="ltr">${join}</code><button class="btn" data-on="copyJoin">${STR.owner.copy}</button></section>
      <form class="card stack" data-submit="paste"><b>${G.paste}</b>
        <input name="link" dir="ltr" placeholder="${G.pastePh}"><button class="btn" type="submit">${G.import}</button></form>
      <section class="card stack"><b>${G.backup}</b>
        <button class="btn" data-on="export">${G.export}</button>
        <label class="btn">${G.restore}<input type="file" accept="application/json,.json" data-input="restore" hidden></label></section>
      <button class="btn btn-ghost" data-on="rotate">${G.rotate}</button>
      <button class="btn btn-ghost" data-on="reset">${G.reset}</button>`, {
      ...common,
      save: (fd) => {
        const v = (k, n) => String(fd.get(k) ?? "").trim().slice(0, n);
        store
          .update((db) =>
            Object.assign(db.settings, {
              her: v("her", 30) || db.settings.her,
              me: v("me", 30) || db.settings.me,
              herPhone: normPhone(v("herPhone", 20)),
              myPhone: normPhone(v("myPhone", 20)),
              city: v("city", 40),
              base: /^https?:\/\//.test(v("base", 200)) ? v("base", 200) : "",
            }),
          )
          .catch(() => {});
        toast(STR.owner.saved);
        views.settings();
      },
      copyJoin: async () => toast((await copy(join)) ? STR.owner.copied : join),
      paste: async (fd) => {
        const r = parseHash(String(fd.get("link") ?? "").replace(/^[^#]*/, ""));
        if (r.kind !== "r") return toast(G.badPaste);
        const { fresh } = await store.importResult(r.payload);
        toast(fresh ? STR.imported : STR.importedOld);
      },
      export: () => {
        const blob = new Blob([store.exportJSON()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `mabalach-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        store.update((db) => (db.settings.lastBackup = new Date().toISOString())).catch(() => {});
      },
      restore: async (_v, _e, el) => {
        const file = el.files?.[0];
        if (!file) return;
        try {
          await store.importJSON(await file.text());
          toast(G.restored);
        } catch {
          toast(G.badBackup);
        }
      },
      rotate: async () => {
        if (!confirm(G.rotateAsk)) return;
        await moveToNewRoom(store, { keepData: true, mode });
        toast(G.rotated);
        location.reload();
      },
      reset: async () => {
        if (!confirm(G.resetAsk)) return;
        await moveToNewRoom(store, { keepData: false, mode });
        location.reload();
      },
    });
  };
}
