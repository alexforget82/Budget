// Extracted without changing domain validation or financial operations.
export function createAccountsRoutes({ cents, journey, q, reply, run }) {
  return function handle(req, res, x, name, exists) {
    if (req.url === "/api/accounts/inclusion") {
      const id = Number(x.id);
      if (!exists("accounts", id) || typeof x.included !== "boolean")
        return reply(res, 400, { error: "Sélection de compte invalide" });
      const account = q("SELECT kind FROM accounts WHERE id=?", id)[0];
      if (journey.scope() && !x.included && id === journey.scope().id)
        return reply(res, 400, {
          error:
            "Ce compte définit le disponible. Choisissez un autre compte dans Bien démarrer avant de l’exclure.",
        });
      if (journey.scope() && x.included && id !== journey.scope().id)
        return reply(res, 400, {
          error:
            "Le disponible porte uniquement sur " +
            journey.scope().name +
            ". Changez ce compte dans Bien démarrer.",
        });
      if (account.kind === "credit" && x.included)
        return reply(res, 400, {
          error: "Un compte de crédit ne peut pas être inclus",
        });
      run(
        "UPDATE accounts SET included=? WHERE id=?",
        account.kind === "credit" ? 0 : x.included ? 1 : 0,
        id,
      );
    } else if (req.url === "/api/accounts/update") {
      const id = Number(x.id),
        amount = cents(x.balance),
        included = x.included === true || x.included === "true" ? 1 : 0;
      if (
        !exists("accounts", id) ||
        !name ||
        name.length > 80 ||
        amount === null ||
        !["checking", "savings", "credit"].includes(x.kind)
      )
        return reply(res, 400, { error: "Compte invalide" });
      if (journey.scope()?.id === id && x.kind === "credit")
        return reply(res, 400, {
          error:
            "Le compte du disponible doit rester un compte bancaire. Changez le compte dans Bien démarrer.",
        });
      if (
        x.kind !== "credit" &&
        q("SELECT 1 FROM card_payment_plans WHERE card_account_id=?", id).length
      )
        return reply(res, 400, {
          error:
            "Retirez le plan de remboursement avant de changer le type de cette carte.",
        });
      if (
        x.kind === "credit" &&
        q(
          "SELECT 1 FROM card_payment_plans p JOIN recurring r ON r.id=p.recurring_id WHERE r.account_id=?",
          id,
        ).length
      )
        return reply(res, 400, {
          error: "Ce compte est utilisé pour rembourser une carte.",
        });
      // A credit account can never be included in spendable cash.
      run(
        "UPDATE accounts SET name=?,balance_cents=?,kind=?,included=? WHERE id=?",
        name,
        amount,
        x.kind,
        x.kind === "credit" ? 0 : included,
        id,
      );
    } else if (req.url === "/api/accounts") {
      const amount = cents(x.balance);
      if (
        !name ||
        name.length > 80 ||
        amount === null ||
        !["checking", "savings", "credit"].includes(x.kind)
      )
        return reply(res, 400, { error: "Compte invalide" });
      run(
        "INSERT INTO accounts(name,balance_cents,kind,included) VALUES(?,?,?,?)",
        name,
        amount,
        x.kind,
        x.kind === "credit" ? 0 : 1,
      );
    }
  };
}
