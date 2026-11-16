// Home keeps three tiles; everything else lives behind "עוד". openMore opens that list (from home, or from a screen opened out of it) and taps the tile for `key`.
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
