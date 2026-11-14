import { test } from "node:test";
import assert from "node:assert/strict";
import { backupDue, BACKUP_EVERY } from "../js/ui/owner/settings.js";

test("backup reminder is due with no backup or after 30 days", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.equal(backupDue({}, now), true);
  assert.equal(backupDue({ lastBackup: new Date(now - 864e5).toISOString() }, now), false);
  assert.equal(backupDue({ lastBackup: new Date(now - BACKUP_EVERY).toISOString() }, now), true);
});
