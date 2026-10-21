// Exact normalized merchant identity, never fuzzy substring or amount matching.
export function normalizeMerchant(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr-CA")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
export function buildEntryMemory({
  transactions = [],
  categories = [],
  envelopes = [],
  subcategories = [],
}) {
  const cats = new Set(categories.filter((c) => !c.archived).map((c) => c.id)),
    envs = new Set(envelopes.filter((e) => e.active).map((e) => e.id)),
    children = new Map(
      subcategories
        .filter((s) => !s.archived)
        .map((s) => [s.id, s.category_id]),
    );
  const rows = transactions
      .filter((t) => t.amount_cents < 0)
      .slice()
      .sort(
        (a, b) =>
          String(b.happened_on).localeCompare(String(a.happened_on)) ||
          b.id - a.id,
      ),
    seen = new Set(),
    merchants = [],
    byEnvelope = new Map(),
    byCategory = new Map();
  for (const t of rows) {
    const c = cats.has(t.category_id) ? t.category_id : null,
      e = envs.has(t.envelope_id) ? t.envelope_id : null,
      key = normalizeMerchant(t.description);
    if (key && !seen.has(key)) {
      seen.add(key);
      merchants.push({
        key,
        description: t.description,
        category_id: c,
        envelope_id: e,
        subcategory_id:
          c && children.get(t.subcategory_id) === c ? t.subcategory_id : null,
        amount_cents: -1,
      });
    }
    if (c && e) {
      if (!byEnvelope.has(e)) byEnvelope.set(e, new Set());
      byEnvelope.get(e).add(c);
      if (!byCategory.has(c)) byCategory.set(c, new Set());
      byCategory.get(c).add(e);
    }
  }
  const unique = (map, key) =>
    map.get(key)?.size === 1 ? [...map.get(key)][0] : null;
  const envelope_categories = {},
    category_envelopes = {};
  for (const e of envelopes.filter((e) => e.active)) {
    const named = categories.filter(
      (c) =>
        !c.archived && normalizeMerchant(c.name) === normalizeMerchant(e.name),
    );
    envelope_categories[e.id] = byEnvelope.has(e.id)
      ? unique(byEnvelope, e.id)
      : named.length === 1
        ? named[0].id
        : null;
  }
  for (const c of categories.filter((c) => !c.archived)) {
    const named = envelopes.filter(
      (e) =>
        e.active && normalizeMerchant(e.name) === normalizeMerchant(c.name),
    );
    category_envelopes[c.id] = byCategory.has(c.id)
      ? unique(byCategory, c.id)
      : named.length === 1
        ? named[0].id
        : null;
  }
  return { merchants, envelope_categories, category_envelopes };
}
