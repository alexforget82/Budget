import { normalizeMerchant } from "./public/merchant.js";
export { normalizeMerchant };
export function matchingRule(state, transaction) {
  if (
    transaction.id &&
    state.occurrence_states?.some(
      (o) => o.status === "paid" && o.transaction_id === transaction.id,
    )
  )
    return null;
  const text = normalizeMerchant(transaction.description),
    amount = Math.abs(transaction.amount_cents);
  return (
    [...(state.rules || [])]
      .filter((r) => r.active)
      .sort((a, b) => a.priority - b.priority || a.id - b.id)
      .find((r) => {
        if (r.account_id && r.account_id !== Number(transaction.account_id))
          return false;
        if (
          r.direction !== (transaction.amount_cents < 0 ? "expense" : "income")
        )
          return false;
        if (
          (r.min_cents !== null && amount < r.min_cents) ||
          (r.max_cents !== null && amount > r.max_cents)
        )
          return false;
        const pattern = normalizeMerchant(r.pattern);
        return (
          !!pattern &&
          (r.match_type === "equals"
            ? text === pattern
            : r.match_type === "starts"
              ? text.startsWith(pattern)
              : text.includes(pattern))
        );
      }) || null
  );
}
