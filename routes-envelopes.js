// Extracted without changing domain validation or financial operations.
export function createEnvelopesRoutes({
  atomic,
  cents,
  db,
  monthlyBudget,
  nextOccurrence,
  q,
  recordEnvelopeAdvance,
  reply,
  run,
  todayLocal,
  validDate,
}) {
  return function handle(req, res, x, name, exists) {
    if (req.url.startsWith("/api/envelopes")) {
      const id = Number(x.id);
      if (req.url.endsWith("/fund")) {
        const e = q("SELECT * FROM envelopes WHERE id=?", id)[0],
          amount = cents(x.amount);
        if (
          !e ||
          !e.active ||
          amount === null ||
          amount <= 0 ||
          e.reserved_cents !== x.expected_reserved_cents ||
          e.reserved_cents + amount > 1e12
        )
          throw Error(
            "Montant invalide ou réserve modifiée. Actualisez avant de réessayer.",
          );
        atomic(() => {
          run(
            "UPDATE envelopes SET reserved_cents=reserved_cents+? WHERE id=?",
            amount,
            id,
          );
          recordEnvelopeAdvance(id, amount);
        });
      } else if (req.url.endsWith("/delete")) {
        if (!exists("envelopes", id))
          return reply(res, 400, { error: "Enveloppe introuvable" });
        const linked =
          q(
            "SELECT COUNT(*) AS n FROM account_transfers WHERE envelope_id=?",
            id,
          )[0].n +
          q("SELECT COUNT(*) AS n FROM transactions WHERE envelope_id=?", id)[0]
            .n +
          q("SELECT COUNT(*) AS n FROM recurring WHERE envelope_id=?", id)[0].n;
        if (linked)
          return reply(res, 400, {
            error:
              "Enveloppe liée à des transactions ou récurrences : supprime ou modifie ces liens avant de supprimer cette enveloppe.",
          });
        run("DELETE FROM envelopes WHERE id=?", id);
        const advances = JSON.parse(
          q(
            "SELECT value FROM app_settings WHERE key='envelope_advances_v73'",
          )[0]?.value || "{}",
        );
        delete advances[id];
        run(
          "UPDATE app_settings SET value=? WHERE key='envelope_advances_v73'",
          JSON.stringify(advances),
        );
        monthlyBudget.prune();
      } else {
        const reserved = cents(x.reserved),
          budget = cents(x.budget),
          frequency = x.frequency || "none";
        if (
          !name ||
          name.length > 80 ||
          reserved === null ||
          reserved < 0 ||
          budget === null ||
          budget < 0 ||
          ![
            "none",
            "weekly",
            "biweekly",
            "monthly",
            "quarterly",
            "semiannual",
            "yearly",
          ].includes(frequency) ||
          (frequency !== "none" && (!validDate(x.start_on) || budget <= 0)) ||
          (req.url.endsWith("/update") && !exists("envelopes", id))
        )
          return reply(res, 400, { error: "Enveloppe invalide" });
        const old = req.url.endsWith("/update")
          ? q("SELECT * FROM envelopes WHERE id=?", id)[0]
          : null;
        if (
          old &&
          monthlyBudget.config().reserve_schedules[id]?.length &&
          (frequency !== old.frequency ||
            budget !== old.budget_cents ||
            x.start_on !== old.start_on ||
            x.forecast_spend === true ||
            x.forecast_spend === "true")
        )
          return reply(res, 400, {
            error:
              "Cette réserve suit le calendrier défini dans Budget. Modifiez sa fréquence ou sa programmation depuis Budget.",
          });
        const account =
          x.forecast_account_id === undefined
            ? (old?.forecast_account_id ?? null)
            : x.forecast_account_id
              ? Number(x.forecast_account_id)
              : null;
        if (account !== null && !exists("accounts", account))
          return reply(res, 400, { error: "Compte de prévision invalide" });
        const values = [
          name,
          reserved,
          budget,
          frequency,
          frequency === "none" ? null : x.start_on,
          x.rollover === true ? 1 : 0,
          x.active === false ? 0 : 1,
          account,
          x.forecast_spend === undefined
            ? (old?.forecast_spend ?? 1)
            : x.forecast_spend === false || x.forecast_spend === "false"
              ? 0
              : 1,
        ];
        atomic(() => {
          let eid = id;
          if (req.url.endsWith("/update")) {
            run(
              "UPDATE envelopes SET name=?,reserved_cents=?,budget_cents=?,frequency=?,start_on=?,rollover=?,active=?,forecast_account_id=?,forecast_spend=? WHERE id=?",
              ...values,
              id,
            );
          } else
            eid = Number(
              run(
                "INSERT INTO envelopes(name,reserved_cents,budget_cents,frequency,start_on,rollover,active,forecast_account_id,forecast_spend,planning_since) VALUES(?,?,?,?,?,?,?,?,?,?)",
                ...values,
                todayLocal(),
              ).lastInsertRowid,
            );
          recordEnvelopeAdvance(eid, reserved - (old?.reserved_cents || 0));
        });
      }
    } else if (req.url === "/api/envelope/status") {
      const id = Number(x.envelope_id),
        e = q("SELECT * FROM envelopes WHERE id=?", id)[0];
      if (
        !e ||
        !validDate(x.occurrence_on) ||
        !["open", "complete", "skipped", "auto"].includes(x.status) ||
        e.frequency === "none"
      )
        return reply(res, 400, { error: "Période invalide" });
      let valid = false;
      for (let i = 0; i < 20000; i++) {
        const d = nextOccurrence(e.start_on, e.frequency, i);
        if (d === x.occurrence_on) {
          valid = true;
          break;
        }
        if (d > x.occurrence_on) break;
      }
      if (!valid) return reply(res, 400, { error: "Date non programmée" });
      if (x.status === "auto")
        run(
          "DELETE FROM envelope_period_status WHERE envelope_id=? AND occurrence_on=?",
          id,
          x.occurrence_on,
        );
      else
        run(
          "INSERT INTO envelope_period_status(envelope_id,occurrence_on,status) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET status=excluded.status",
          id,
          x.occurrence_on,
          x.status,
        );
    } else if (
      req.url === "/api/envelope/period" ||
      req.url === "/api/envelope/period/delete"
    ) {
      const eid = Number(x.envelope_id),
        date = x.occurrence_on,
        e = db.prepare("SELECT * FROM envelopes WHERE id=?").get(eid);
      if (
        !e ||
        e.frequency === "none" ||
        !e.start_on ||
        !validDate(date) ||
        date <= todayLocal()
      )
        return reply(res, 400, { error: "Période future invalide" });
      let scheduled = false;
      for (let i = 0; i < 1500; i++) {
        const d = nextOccurrence(e.start_on, e.frequency, i);
        if (d === date) {
          scheduled = true;
          break;
        }
        if (d > date) break;
      }
      if (!scheduled)
        return reply(res, 400, { error: "Date de renouvellement invalide" });
      if (req.url.endsWith("/delete"))
        run(
          "DELETE FROM envelope_budget_overrides WHERE envelope_id=? AND occurrence_on=?",
          eid,
          date,
        );
      else {
        const budget = cents(x.budget);
        if (budget === null || budget < 0)
          return reply(res, 400, { error: "Budget invalide" });
        run(
          "INSERT INTO envelope_budget_overrides(envelope_id,occurrence_on,budget_cents) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET budget_cents=excluded.budget_cents",
          eid,
          date,
          budget,
        );
      }
    }
  };
}
