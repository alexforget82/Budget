import {simpleCreditKey, validateSimpleCreditConfig} from "./card-envelope-funds.js";
// Credit payment methods reuse the ledger; the optional mode never sets an opening debt.
export function createAccountsRoutes({ cents, journey, q, reply, run, atomic, protectionTotal }) {
  function configureMode(id, kind, requested) {
    const config = JSON.parse(q("SELECT value FROM app_settings WHERE key=?", simpleCreditKey)[0]?.value || "{}");
    if (kind !== "credit" || requested === false) delete config[id];
    else if (requested === true && !config[id]) config[id] = true;
    validateSimpleCreditConfig(config, q("SELECT * FROM accounts"));
    run("INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", simpleCreditKey, JSON.stringify(config));
  }
  return function handle(req, res, x, name, exists) {
    if (x.simple_credit !== undefined && typeof x.simple_credit !== "boolean")
      return reply(res, 400, {error: "Mode de carte invalide"});
    if (x.simple_credit === true && x.kind !== "credit")
      return reply(res, 400, {error: "Ce mode est réservé aux cartes et aux marges"});
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
        amount = x.simple_credit === true ? q("SELECT balance_cents FROM accounts WHERE id=?", id)[0]?.balance_cents : cents(x.balance),
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
      atomic(() => {
        const beforeProtection = x.simple_credit === true ? protectionTotal() : null;
        run(
          "UPDATE accounts SET name=?,balance_cents=?,kind=?,included=? WHERE id=?",
          name,
          amount,
          x.kind,
          x.kind === "credit" ? 0 : included,
          id,
        );
        configureMode(id, x.kind, x.simple_credit);
        if (x.simple_credit === true && protectionTotal() !== beforeProtection)
          throw Error("Ce compte contient des achats dont la protection dépend du solde rapproché. Le passage au mode simple réactiverait une ancienne réserve. Aucun changement effectué; conservez le suivi du solde pour cet historique.");
      });
    } else if (req.url === "/api/accounts") {
      const amount = x.simple_credit === true ? 0 : cents(x.balance);
      if (
        !name ||
        name.length > 80 ||
        amount === null ||
        !["checking", "savings", "credit"].includes(x.kind)
      )
        return reply(res, 400, { error: "Compte invalide" });
      atomic(() => {
        const result = run(
          "INSERT INTO accounts(name,balance_cents,kind,included) VALUES(?,?,?,?)",
          name,
          amount,
          x.kind,
          x.kind === "credit" ? 0 : 1,
        );
        configureMode(Number(result.lastInsertRowid), x.kind, x.simple_credit);
      });
    }
  };
}
