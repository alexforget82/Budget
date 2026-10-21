// Extracted without changing domain validation or financial operations.
export function createRecurrencesRoutes({
  atomic,
  rememberRecurringCardPurchases = () => {},
  cents,
  journey,
  monthlyBudget,
  occurrenceInfo,
  q,
  reply,
  run,
  validDate,
  validateTransferEnvelope,
}) {
  return function handle(req, res, x, name, exists) {
    if (req.url === "/api/overrides" || req.url === "/api/overrides/delete") {
      const id = Number(x.id);
      if (req.url.endsWith("/delete")) {
        if (!exists("recurring_overrides", id))
          return reply(res, 400, { error: "Exception introuvable" });
        run("DELETE FROM recurring_overrides WHERE id=?", id);
      } else {
        const rid = Number(x.recurring_id),
          amount = cents(x.amount),
          date = x.occurrence_on;
        if (
          !exists("recurring", rid) ||
          !validDate(date) ||
          amount === null ||
          amount < 0
        )
          return reply(res, 400, { error: "Exception invalide" });
        const rule = q("SELECT * FROM recurring WHERE id=?", rid)[0];
        let scheduled = false;
        for (let i = 0; i < (rule.one_time ? 1 : 20000); i++) {
          const next = occurrenceInfo(
            rule.start_on,
            rule.frequency,
            i,
            rule.day_adjust || "none",
          ).date;
          if (next === date) {
            scheduled = true;
            break;
          }
          if (next > date) break;
        }
        if (!scheduled)
          return reply(res, 400, {
            error:
              "Cette date ne correspond pas à une occurrence prévue de la règle",
          });
        run(
          "INSERT INTO recurring_overrides(recurring_id,occurrence_on,amount_cents) VALUES(?,?,?) ON CONFLICT(recurring_id,occurrence_on) DO UPDATE SET amount_cents=excluded.amount_cents",
          rid,
          date,
          amount,
        );
      }
    } else {
      const id = Number(x.id);
      if (req.url === "/api/recurring/delete") {
        if (!exists("recurring", id))
          return reply(res, 400, { error: "Règle introuvable" });
        atomic(() => {
          rememberRecurringCardPurchases();
          run("DELETE FROM recurring WHERE id=?", id);
        });
        monthlyBudget.prune();
      } else {
        const amount = cents(x.amount),
          account = Number(x.account_id),
          to = x.to_account_id ? Number(x.to_account_id) : null,
          envelope = x.envelope_id ? Number(x.envelope_id) : null,
          description =
            typeof x.description === "string" ? x.description.trim() : "";
        if (
          !description ||
          description.length > 150 ||
          !["income", "expense", "transfer", "reserve"].includes(x.type) ||
          ![
            "weekly",
            "biweekly",
            "monthly",
            "quarterly",
            "semiannual",
            "yearly",
            "last_business_day",
            "rrq",
          ].includes(x.frequency) ||
          !["none", "before", "after"].includes(x.day_adjust ?? "none") ||
          !validDate(x.start_on) ||
          amount === null ||
          amount <= 0 ||
          (x.type !== "reserve" && !exists("accounts", account)) ||
          (x.type === "transfer" &&
            (!exists("accounts", to) || to === account)) ||
          ((x.type === "reserve" ||
            (["expense", "transfer"].includes(x.type) && envelope !== null)) &&
            !exists("envelopes", envelope)) ||
          (req.url.endsWith("update") && !exists("recurring", id))
        )
          return reply(res, 400, { error: "Règle récurrente invalide" });
        if (
          x.type === "transfer" &&
          x.active !== false &&
          q(
            "SELECT 1 FROM card_payment_plans WHERE card_account_id=? AND recurring_id!=?",
            to,
            id || 0,
          ).length
        )
          return reply(res, 400, {
            error:
              "Un plan de remboursement existe déjà pour cette carte. Modifiez ce plan pour éviter deux paiements prévus.",
          });
        const paymentPlan = q(
          "SELECT * FROM card_payment_plans WHERE recurring_id=?",
          id,
        )[0];
        if (
          paymentPlan &&
          (x.type !== "transfer" ||
            to !== paymentPlan.card_account_id ||
            q("SELECT kind FROM accounts WHERE id=?", account)[0]?.kind ===
              "credit" ||
            !["weekly", "biweekly", "monthly"].includes(x.frequency) ||
            (x.day_adjust || "none") !== "none" ||
            x.one_time === true ||
            x.one_time === 1 ||
            x.one_time === "true")
        )
          return reply(res, 400, {
            error: "Modifiez ce remboursement depuis le réglage de la carte.",
          });
        const linkedEnvelope =
          monthlyBudget.config().envelopes[
            monthlyBudget.config().recurring[id]
          ];
        if (
          x.type === "expense" &&
          envelope &&
          linkedEnvelope &&
          envelope !== linkedEnvelope
        )
          return reply(res, 400, {
            error:
              "Cette catégorie utilise une autre réserve. Conservez son enveloppe liée pour éviter deux réservations.",
          });
        if (
          req.url.endsWith("update") &&
          journey.state().funding_links.some((l) => l.transfer_rule_id === id)
        ) {
          const previous = q("SELECT * FROM recurring WHERE id=?", id)[0];
          if (
            x.type !== "transfer" ||
            previous.account_id !== account ||
            previous.to_account_id !== to ||
            previous.start_on !== x.start_on ||
            previous.frequency !== x.frequency
          )
            throw Error(
              "Retirez le lien de financement dans Bien démarrer avant de changer les comptes ou le calendrier du virement.",
            );
        }
        if (x.type === "transfer" && envelope) {
          validateTransferEnvelope(x, account, to);
          if (
            journey.state().funding_links.some((l) => l.transfer_rule_id === id)
          )
            throw Error(
              "Retirez le lien de financement existant avant de lier une enveloppe.",
            );
        }
        const funding =
          x.type === "transfer"
            ? journey.prepareFunding(x, {
                from: account,
                to,
                amount,
                date: x.start_on,
              })
            : null;
        const fields = [
          description,
          x.type,
          amount,
          x.type === "reserve" ? null : account,
          x.type === "transfer" ? to : null,
          ["reserve", "expense", "transfer"].includes(x.type) ? envelope : null,
          x.start_on,
          x.frequency,
          x.active === false ? 0 : 1,
          x.day_adjust || "none",
          x.one_time === true || x.one_time === 1 || x.one_time === "true"
            ? 1
            : 0,
        ];
        atomic(() => {
          if (req.url.endsWith("update")) {
            rememberRecurringCardPurchases();
            if (funding)
              throw Error(
                "Associez le financement lors de la création du virement.",
              );
            run(
              "UPDATE recurring SET description=?,type=?,amount_cents=?,account_id=?,to_account_id=?,envelope_id=?,start_on=?,frequency=?,active=?,day_adjust=?,one_time=? WHERE id=?",
              ...fields,
              id,
            );
          } else {
            const created = Number(
              run(
                "INSERT INTO recurring(description,type,amount_cents,account_id,to_account_id,envelope_id,start_on,frequency,active,day_adjust,one_time) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                ...fields,
              ).lastInsertRowid,
            );
            journey.addLink(funding, { rule_id: created });
          }
        });
      }
    }
  };
}
