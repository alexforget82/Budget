// Extracted without changing domain validation or financial operations.
export function createTransfersRoutes({
  accountEffect,
  applyTransferEnvelope,
  atomic,
  journey,
  run,
  transferChange,
  validateTransfer,
  validateTransferEnvelope,
}) {
  return function handle(req, res, x, name, exists) {
    if (
      req.url === "/api/transfers/update" ||
      req.url === "/api/transfers/delete"
    ) {
      transferChange(x, req.url.endsWith("/delete"));
    } else if (req.url === "/api/transfers") {
      const t = validateTransfer(x),
        envelope = validateTransferEnvelope(x, t.from, t.to),
        link = journey.prepareFunding(x, { ...t, date: t.date, actual: true });
      atomic(() => {
        const id = Number(
          run(
            "INSERT INTO account_transfers(from_account_id,to_account_id,amount_cents,description,happened_on) VALUES(?,?,?,?,?)",
            t.from,
            t.to,
            t.amount,
            t.description,
            t.date,
          ).lastInsertRowid,
        );
        run(
          "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
          accountEffect(t.from, -t.amount),
          t.from,
        );
        run(
          "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
          accountEffect(t.to, t.amount),
          t.to,
        );
        applyTransferEnvelope(id, envelope, t.amount, t.date);
        journey.addLink(link, { transfer_id: id, amount: t.amount });
      });
    }
  };
}
