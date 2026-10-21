import { createHash, randomBytes } from "node:crypto";
// A read-only forecast using the same account/transfer inputs as a real repayment.
export function previewCardPayment(
  args,
  t,
  { buildForecast, cardEnvelopeTotal },
) {
  const source = args.accounts.find((a) => a.id === t.from),
    card = args.accounts.find((a) => a.id === t.to);
  if (
    !source ||
    source.kind === "credit" ||
    !card ||
    card.kind !== "credit" ||
    t.date > args.today
  )
    throw Error(
      "Choisissez un compte bancaire, une carte et une date passée ou aujourd’hui.",
    );
  const transfer = {
    id: Math.max(0, ...args.transfers.map((t) => t.id)) + 1,
    from_account_id: t.from,
    to_account_id: t.to,
    amount_cents: t.amount,
    description: t.description,
    happened_on: t.date,
  };
  const changed = {
    ...args,
    accounts: args.accounts.map((a) => ({
      ...a,
      balance_cents:
        a.balance_cents - ([t.from, t.to].includes(a.id) ? t.amount : 0),
    })),
    transfers: [...args.transfers, transfer],
  };
  function summary(input) {
    const cash = input.accounts
        .filter((a) => a.included && a.kind !== "credit")
        .reduce((v, a) => v + a.balance_cents, 0),
      protectedCards = cardEnvelopeTotal(input),
      safe =
        cash -
        input.envelopes.reduce((v, e) => v + e.reserved_cents, 0) -
        protectedCards;
    const days = buildForecast(input).days;
    return {
      source_cents: input.accounts.find((a) => a.id === t.from).balance_cents,
      card_cents: input.accounts.find((a) => a.id === t.to).balance_cents,
      protected_cents: protectedCards,
      safe_cents: safe,
      minimum_30_cents: Math.min(
        safe,
        ...days.slice(0, 30).map((d) => d.safe_cents),
      ),
    };
  }
  return {
    before: summary(args),
    after: summary(changed),
    source_name: source.name,
    card_name: card.name,
    source_included: !!source.included,
    duplicates: args.transfers
      .filter(
        (p) =>
          p.from_account_id === t.from &&
          p.to_account_id === t.to &&
          p.amount_cents === t.amount &&
          p.happened_on === t.date,
      )
      .map((p) => ({ id: p.id, description: p.description })),
  };
}
export function createCardPaymentActions({
  forecastInput,
  validateTransfer,
  buildForecast,
  cardEnvelopeTotal,
  record,
  now = Date.now,
}) {
  const tickets = new Map(),
    fingerprint = (args) =>
      createHash("sha256").update(JSON.stringify(args)).digest("hex");
  return {
    preview(x) {
      const args = forecastInput(),
        t = validateTransfer(x);
      const candidates = (buildForecast(args).rows || []).filter(
        (r) =>
          r.source === "recurring" &&
          r.type === "transfer" &&
          ["planned", "pending"].includes(r.status) &&
          r.account_id === t.from &&
          r.to_account_id === t.to &&
          r.planned_cents === t.amount &&
          r.remaining_cents === t.amount &&
          Math.abs(Date.parse(r.date) - Date.parse(t.date)) <= 3 * 86400000,
      );
      if (candidates.length === 1) t.description = candidates[0].description;
      const result = previewCardPayment(args, t, {
        buildForecast,
        cardEnvelopeTotal,
      });
      result.matched_plan =
        candidates.length === 1 ? candidates[0].description : null;
      const forecast = buildForecast({
        ...args,
        accounts: args.accounts.map((a) => ({
          ...a,
          balance_cents:
            a.balance_cents - ([t.from, t.to].includes(a.id) ? t.amount : 0),
        })),
        transfers: [
          ...args.transfers,
          {
            id: Math.max(0, ...args.transfers.map((p) => p.id)) + 1,
            from_account_id: t.from,
            to_account_id: t.to,
            amount_cents: t.amount,
            description: t.description,
            happened_on: t.date,
          },
        ],
      });
      result.warnings = (forecast.warnings || [])
        .filter(
          (w) => w.code === "card_payment_match" && w.card_account_id === t.to,
        )
        .map((w) => w.message);
      for (const [key, ticket] of tickets)
        if (ticket.expires <= now()) tickets.delete(key);
      if (tickets.size >= 100) tickets.delete(tickets.keys().next().value);
      const token = randomBytes(32).toString("hex");
      tickets.set(token, {
        payload: {
          from_account_id: t.from,
          to_account_id: t.to,
          amount: t.amount / 100,
          description: t.description,
          happened_on: t.date,
        },
        fingerprint: fingerprint(args),
        expires: now() + 300000,
        duplicate: result.duplicates.length > 0,
      });
      return { ...result, token };
    },
    confirm(x) {
      const ticket = tickets.get(x.token);
      if (!ticket || ticket.expires <= now())
        throw Error(
          "Cet aperçu a expiré ou a déjà été utilisé. Vérifiez à nouveau le paiement.",
        );
      if (ticket.fingerprint !== fingerprint(forecastInput())) {
        tickets.delete(x.token);
        throw Error("Votre budget a changé. Vérifiez à nouveau le paiement.");
      }
      if (ticket.duplicate && x.acknowledged !== true)
        throw Error(
          "Un paiement identique existe déjà. Confirmez qu’il s’agit d’un autre paiement.",
        );
      record(ticket.payload);
      tickets.delete(x.token);
    },
  };
}
