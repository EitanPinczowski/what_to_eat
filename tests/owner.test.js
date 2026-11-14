import { test } from "node:test";
import assert from "node:assert/strict";
import { liveStatus } from "../js/ui/owner/app.js";

test("liveStatus reflects the guest's live doc", () => {
  assert.equal(liveStatus(null, "נגה"), "עוד לא נפתח");
  assert.equal(liveStatus({ opened: "x", n: 0 }, "נגה"), "נגה פתחה");
  assert.equal(liveStatus({ opened: "x", n: 5 }, "נגה"), "נגה פתחה · שאלה 5");
  assert.equal(liveStatus({ opened: "x", n: 9, finished: true }, "נגה"), "נגה סיימה! 🎉");
});
