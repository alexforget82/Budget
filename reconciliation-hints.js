// Suggestions only; the existing review/edit/confirmation paths own all mutations.
export function reconciliationHints(out, rows, today) {
  const delta = out.delta_cents,
    account = out.account;
  if (!delta) return { pairs: [], planned: [] };
  const effect = (t) =>
    account.kind === "credit" ? -t.amount_cents : t.amount_cents;
  const transactions = out.transactions.filter((t) => t.affects_balance !== 0),
    pairs = [];
  for (let i = 0; i < transactions.length && pairs.length < 5; i++)
    for (let j = i + 1; j < transactions.length && pairs.length < 5; j++)
      if (-effect(transactions[i]) - effect(transactions[j]) === delta)
        pairs.push([transactions[i], transactions[j]]);
  const planned = rows
    .filter(
      (r) =>
        r.date >= out.since &&
        r.date <= today &&
        r.remaining_cents > 0 &&
        ["planned", "pending"].includes(r.status),
    )
    .filter((r) => {
      let impact = 0;
      if (r.type === "transfer")
        impact =
          (r.to_account_id === account.id ? 1 : 0) -
          ((r.from_account_id ?? r.account_id) === account.id ? 1 : 0);
      else if (r.account_id === account.id)
        impact = r.type === "income" ? 1 : r.type === "expense" ? -1 : 0;
      if (account.kind === "credit") impact = -impact;
      return impact * r.remaining_cents === delta;
    })
    .slice(0, 8);
  return {
    pairs,
    planned,
    examined_transactions: transactions.length,
    limited: out.transaction_count > out.transactions.length,
  };
}
