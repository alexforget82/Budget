// Extracted without changing domain validation or financial operations.
export function createTransactionsRoutes({
  addTransaction,
  atomic,
  reply,
  run,
  transactionChange,
}) {
  return function handle(req, res, x, name, exists) {
    if (
      req.url === "/api/transactions/update" ||
      req.url === "/api/transactions/delete"
    ) {
      transactionChange(x, req.url.endsWith("/delete"));
    } else if (req.url === "/api/transactions/review") {
      const id = Number(x.id);
      if (!exists("transactions", id) || typeof x.reviewed !== "boolean")
        return reply(res, 400, { error: "Statut de transaction invalide" });
      run(
        "UPDATE transactions SET reviewed=? WHERE id=?",
        x.reviewed ? 1 : 0,
        id,
      );
    } else if (req.url === "/api/transactions") {
      atomic(() => addTransaction(x));
    }
  };
}
