// Home keeps four tiles; everything else lives behind "עוד". openMore opens that list (from home, or from a screen opened out of it) and taps the tile for `key`.
export async function openMore(page, key) {
  const tile = page.locator(`.tile[data-arg="${key}"]`);
  const more = page.locator('[data-on="go"][data-arg="more"]');
  await page.locator('.tile, [data-on="go"][data-arg="more"]').first().waitFor(); // a screen is drawn
  if (!(await tile.count())) {
    if (!(await more.count())) await page.locator('[data-on="back"]').click();
    await more.click();
  }
  await tile.click();
}

// Technical settings sit in the collapsed "מתקדם" section: open it (once; it stays open across redraws).
export async function openAdvanced(page) {
  const d = page.getByTestId("advanced");
  if (!(await d.evaluate((e) => e.open))) await d.locator("summary").click();
}

/** The fridge-magnets answer: its "done" button stays disabled until two magnets are stuck, so a generic
 * "click the first answer" loop would wait on it forever. Sticks two when that question is on screen. */
export async function magnets(page) {
  if (!(await page.locator('[data-testid="magnets"] [data-on="ans"][disabled]').count())) return;
  const free = page.locator('[data-testid="magnets"] .magnet:not(.stuck)');
  await free.first().click();
  await free.first().click();
}

/** R1c-2: her quiz opens with a category screen (6 food types). Picks the first tile when it is showing, so tests
 * that are about the questions start on the first question. */
export async function pickCategory(page) {
  await page.locator('[data-on="cat"], .q, .title').first().waitFor();
  const tile = page.locator('[data-on="cat"]').first();
  if (await tile.count()) await tile.click();
}
