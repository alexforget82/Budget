import { normalizeMerchant } from "./merchant.js";
const ordered = (state) =>
  [...state.transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.seq - a.seq,
  );
export function recentMerchants(state, limit = 12) {
  const seen = new Set(),
    rows = [];
  for (const t of ordered(state)) {
    const key = normalizeMerchant(t.description);
    if (
      t.amount_cents >= 0 ||
      !key ||
      seen.has(key) ||
      !state.accounts.some((a) => a.id === t.account_id)
    )
      continue;
    seen.add(key);
    rows.push(t);
    if (rows.length === limit) break;
  }
  return rows;
}
export function recentFor(state, description, kind) {
  const key = normalizeMerchant(description);
  return key
    ? ordered(state).find(
        (t) =>
          normalizeMerchant(t.description) === key &&
          t.amount_cents < 0 === (kind === "expense") &&
          state.accounts.some((a) => a.id === t.account_id),
      ) || null
    : null;
}
