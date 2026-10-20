// Extracted without changing domain validation or financial operations.
export function createPlanningRoutes({
  cardPayments,
  dayDistance,
  db,
  occurrenceInfo,
  planningActions,
  reply,
  run,
  todayLocal,
  validDate,
}) {
  return function handle(req, res, x, name, exists) {
    if (
      req.url === "/api/card-payments" ||
      req.url === "/api/card-payments/delete"
    ) {
      cardPayments.post(req.url, x);
    } else if (req.url === "/api/planning/action") {
      planningActions.action(x);
    } else if (
      req.url === "/api/occurrence/move" ||
      req.url === "/api/occurrence/unmove"
    ) {
      const rid = Number(x.recurring_id),
        date = x.occurrence_on,
        rule = db.prepare("SELECT * FROM recurring WHERE id=?").get(rid);
      if (!rule || !validDate(date) || !rule.active)
        return reply(res, 400, { error: "Récurrence ou date invalide" });
      let scheduled = false;
      for (let i = 0; i < (rule.one_time ? 1 : 20000); i++) {
        const d = occurrenceInfo(
          rule.start_on,
          rule.frequency,
          i,
          rule.day_adjust || "none",
        ).date;
        if (d === date) {
          scheduled = true;
          break;
        }
        if (d > date) break;
      }
      if (!scheduled)
        return reply(res, 400, { error: "Occurrence introuvable" });
      if (req.url.endsWith("unmove"))
        run(
          "DELETE FROM recurring_moves WHERE recurring_id=? AND occurrence_on=?",
          rid,
          date,
        );
      else {
        if (
          !validDate(x.new_on) ||
          x.new_on < todayLocal() ||
          dayDistance(x.new_on, date) > 90
        )
          return reply(res, 400, {
            error: "Nouvelle date invalide (90 jours maximum)",
          });
        run(
          "INSERT INTO recurring_moves(recurring_id,occurrence_on,new_on) VALUES(?,?,?) ON CONFLICT(recurring_id,occurrence_on) DO UPDATE SET new_on=excluded.new_on",
          rid,
          date,
          x.new_on,
        );
      }
    } else if (req.url === "/api/reconcile/link") {
      const rid = Number(x.recurring_id),
        date = x.occurrence_on,
        kind = x.actual_type,
        id = Number(x.actual_id);
      const rule = db.prepare("SELECT * FROM recurring WHERE id=?").get(rid);
      const actual =
        kind === "transaction"
          ? db.prepare("SELECT * FROM transactions WHERE id=?").get(id)
          : kind === "transfer"
            ? db.prepare("SELECT * FROM account_transfers WHERE id=?").get(id)
            : null;
      if (
        !rule ||
        !actual ||
        !validDate(date) ||
        rule.type === "reserve" ||
        !rule.active ||
        !Number.isSafeInteger(id) ||
        id < 1
      )
        return reply(res, 400, { error: "Rapprochement invalide" });
      let validOccurrence = false;
      for (let i = 0; i < (rule.one_time ? 1 : 20000); i++) {
        const d = occurrenceInfo(
          rule.start_on,
          rule.frequency,
          i,
          rule.day_adjust || "none",
        ).date;
        if (d === date) {
          validOccurrence = true;
          break;
        }
        if (d > date) break;
      }
      if (!validOccurrence || dayDistance(date, actual.happened_on) > 31)
        return reply(res, 400, { error: "Occurrence ou date incompatible" });
      if (
        kind === "transaction" &&
        (rule.type === "transfer" ||
          rule.account_id !== actual.account_id ||
          (rule.type === "expense" && actual.amount_cents >= 0) ||
          (rule.type === "income" && actual.amount_cents <= 0))
      )
        return reply(res, 400, { error: "Compte ou type incompatible" });
      if (
        kind === "transfer" &&
        (rule.type !== "transfer" ||
          rule.account_id !== actual.from_account_id ||
          rule.to_account_id !== actual.to_account_id)
      )
        return reply(res, 400, { error: "Comptes incompatibles" });
      if (
        kind === "transaction" &&
        db
          .prepare("SELECT 1 FROM envelope_actual_links WHERE transaction_id=?")
          .get(id)
      )
        return reply(res, 400, {
          error: "Cette opération est déjà associée à une période d’enveloppe.",
        });
      // Une opération réelle et une occurrence ne peuvent être liées qu'une seule fois.
      run(
        "INSERT INTO reconciliation_links(recurring_id,occurrence_on,actual_type,actual_id) VALUES(?,?,?,?)",
        rid,
        date,
        kind,
        id,
      );
    } else if (req.url === "/api/reconcile/unlink") {
      const id = Number(x.id);
      if (
        !Number.isSafeInteger(id) ||
        !db.prepare("SELECT 1 FROM reconciliation_links WHERE id=?").get(id)
      )
        return reply(res, 400, { error: "Lien introuvable" });
      run("DELETE FROM reconciliation_links WHERE id=?", id);
    }
  };
}
