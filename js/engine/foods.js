// buildFoods(seed, custom) → Food[] ({id, name, emoji, tags, season?, custom?}).
export function buildFoods(seed, custom = []) {
  const out = seed.map(([id, name, emoji, tags, season]) => {
    const f = { id, name, emoji, tags: tags.split(" ") };
    if (season) f.season = season;
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
