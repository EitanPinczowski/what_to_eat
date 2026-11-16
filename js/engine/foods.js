// buildFoods(seed, custom) → Food[] ({id, name, emoji, tags, season?, custom?}).
export function buildFoods(seed, custom = []) {
  const out = seed.map(([id, name, emoji, tags, season, cuisine, has]) => {
    const f = { id, name, emoji, tags: tags.split(" "), cuisine: cuisine ? [...cuisine] : [] };
    if (season) f.season = season;
    if (has?.length) f.has = [...has];
    return f;
  });
  const ids = new Set(out.map((f) => f.id));
  for (const c of custom) {
    if (!c?.id || ids.has(c.id)) continue;
    ids.add(c.id);
    out.push({ ...c, tags: [...c.tags], custom: true });
  }
  return out;
}
