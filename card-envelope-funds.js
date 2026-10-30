import { occurrenceInfo as defaultOccurrenceInfo } from "./recurrence-calendar.js";
export const simpleCreditKey = "simple_credit_v161";
// Settings stay in the normal JSON backups; no historical balance is reset.
export function validateSimpleCreditConfig(value, accounts) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Mode de carte invalide.");
  for (const [id, item] of Object.entries(value)) {
    if (!/^[1-9]\d*$/.test(id) || !accounts.some(a => a.id === Number(id) && a.kind === "credit") ||
        item !== true)
      throw Error("Mode de carte invalide.");
  }
  return value;
}
export function simpleCreditAccounts(accounts, text = "{}") {
  const config = validateSimpleCreditConfig(JSON.parse(text), accounts);
  return accounts.map(a => config[a.id] ? {...a, simple_credit: true} : a);
}
export const cardPurchaseIdentity = (t) => ({
  id: t.id,
  account_id: t.account_id,
  happened_on: t.happened_on,
  amount_cents: t.amount_cents,
  description: t.description,
});
// Identified recurring or explicitly protected simple-mode purchases; never opening debt.
export function recurringCardPurchaseIds(args) {
  const {
    accounts = [],
    transactions = [],
    recurring = [],
    links = [],
    overrides = [],
    moves = [],
    today,
    cardProtectionSince = today,
    protectedCardTransactions = [],
    occurrenceInfo = defaultOccurrenceInfo,
    similarDescription = (a, b) =>
      a.trim().toLowerCase() === b.trim().toLowerCase(),
  } = args;
  const cards = new Set(
    accounts.filter((a) => a.kind === "credit").map((a) => a.id),
  );
  const protectedKeys = new Set(protectedCardTransactions.map(t => JSON.stringify(cardPurchaseIdentity(t))));
  const isProtected = t => protectedKeys.has(JSON.stringify(cardPurchaseIdentity(t)));
  const eligible = transactions.filter(
    (t) =>
      cards.has(t.account_id) &&
      !t.envelope_id &&
      t.amount_cents < 0 &&
      t.affects_balance !== 0 &&
      (t.happened_on >= cardProtectionSince || isProtected(t)),
  );
  const result = new Set(
      eligible.filter(isProtected).map((t) => t.id),
    ),
    used = new Set();
  const rules = recurring.filter(
    (r) =>
      r.active &&
      r.type === "expense" &&
      !r.envelope_id &&
      cards.has(r.account_id),
  );
  for (const l of links)
    if (
      l.actual_type === "transaction" &&
      rules.some((r) => r.id === l.recurring_id) &&
      eligible.some((t) => t.id === l.actual_id)
    ) {
      result.add(l.actual_id);
      used.add(l.recurring_id + "|" + l.occurrence_on);
    }
  const dates = eligible.map((t) => t.happened_on),
    last = dates.length ? dates.sort().at(-1) : null;
  if (!last) return [...result];
  const end = new Date(Date.parse(last + "T12:00:00Z") + 93 * 86400000)
      .toISOString()
      .slice(0, 10),
    rows = [];
  for (const r of rules)
    for (let i = 0; i < (r.one_time ? 1 : 20000); i++) {
      const original = occurrenceInfo(
        r.start_on,
        r.frequency,
        i,
        r.day_adjust || "none",
      ).date;
      if (original > end) break;
      const date =
        moves.find(
          (m) => m.recurring_id === r.id && m.occurrence_on === original,
        )?.new_on || original;
      const amount =
        overrides.find(
          (o) => o.recurring_id === r.id && o.occurrence_on === original,
        )?.amount_cents ?? r.amount_cents;
      if (!used.has(r.id + "|" + original) && amount > 0)
        rows.push({ r, date, amount });
    }
  const proposals = [];
  for (const t of eligible.filter((t) => !result.has(t.id))) {
    const matches = rows.filter(
      (o) =>
        o.r.account_id === t.account_id &&
        o.amount === -t.amount_cents &&
        Math.abs(Date.parse(o.date) - Date.parse(t.happened_on)) <=
          3 * 86400000 &&
        similarDescription(o.r.description, t.description),
    );
    if (matches.length === 1) proposals.push({ t, row: matches[0] });
  }
  for (const p of proposals)
    if (proposals.filter((x) => x.row === p.row).length === 1)
      result.add(p.t.id);
  return [...result];
}
// Envelope purchases and identified recurring purchases are protected here.
// Opening card debt and historical imports never create an allocation.
export function createCardEnvelopeFunds(args) {
  const {
    accounts = [],
    envelopes = [],
    transactions = [],
    transfers = [],
    today,
  } = args;
  const recurringIds = new Set(recurringCardPurchaseIds(args));
  const cards = new Set(
      accounts.filter((a) => a.kind === "credit").map((a) => a.id),
    ),
    lots = [];
  const externalAllowances = new Set(
    envelopes
      .filter(
        (e) =>
          e.forecast_spend &&
          accounts.some(
            (a) =>
              a.id === e.forecast_account_id &&
              a.kind !== "credit" &&
              !a.included,
          ) &&
          accounts.filter((a) => a.included && a.kind !== "credit").length ===
            1,
      )
      .map((e) => e.id),
  );
  function charge(cardId, envelopeId, amount, recurring = false) {
    if (
      cards.has(cardId) &&
      (envelopeId || recurring) &&
      !externalAllowances.has(envelopeId) &&
      amount > 0
    )
      lots.push({
        card_account_id: cardId,
        envelope_id: envelopeId || null,
        amount_cents: amount,
        ...(!envelopeId ? { protection_kind: "recurring" } : {}),
      });
  }
  function pay(cardId, amount) {
    let left = Math.max(0, amount),
      released = 0;
    for (const lot of lots) {
      if (lot.card_account_id !== cardId || !left) continue;
      const part = Math.min(left, lot.amount_cents);
      lot.amount_cents -= part;
      left -= part;
      released += part;
    }
    return released;
  }
  // Without timestamps, same-day purchases are funded before same-day payments.
  const events = [
    ...transactions
      .filter(
        (t) =>
          cards.has(t.account_id) &&
          t.affects_balance !== 0 &&
          (!today || t.happened_on <= today),
      )
      .map((t) => ({
        on: t.happened_on,
        order: t.amount_cents < 0 ? 0 : 1,
        id: t.id,
        transaction: t,
      })),
    ...transfers
      .filter(
        (t) => cards.has(t.to_account_id) && (!today || t.happened_on <= today),
      )
      .map((t) => ({ on: t.happened_on, order: 2, id: t.id, transfer: t })),
  ].sort(
    (a, b) => a.on.localeCompare(b.on) || a.order - b.order || a.id - b.id,
  );
  for (const event of events) {
    const t = event.transaction;
    if (t) {
      if (t.amount_cents < 0)
        charge(
          t.account_id,
          t.envelope_id,
          -t.amount_cents,
          recurringIds.has(t.id),
        );
      else pay(t.account_id, t.amount_cents);
    } else pay(event.transfer.to_account_id, event.transfer.amount_cents);
  }
  // A reconciled zero/credit card balance cannot still require bank funding.
  for (const a of accounts)
    if (cards.has(a.id) && !a.simple_credit && Number.isSafeInteger(a.balance_cents)) {
      const total = lots
        .filter((l) => l.card_account_id === a.id)
        .reduce((n, l) => n + l.amount_cents, 0);
      pay(a.id, Math.max(0, total - Math.max(0, a.balance_cents)));
    }
  const entries = () => {
    const groups = new Map();
    for (const lot of lots)
      if (lot.amount_cents) {
        const key = lot.card_account_id + "|" + lot.envelope_id,
          entry = groups.get(key) || {
            card_account_id: lot.card_account_id,
            envelope_id: lot.envelope_id,
            amount_cents: 0,
            ...(lot.protection_kind
              ? { protection_kind: lot.protection_kind }
              : {}),
          };
        entry.amount_cents += lot.amount_cents;
        groups.set(key, entry);
      }
    return [...groups.values()];
  };
  return {
    charge,
    pay,
    entries,
    isExternalAllowance: (id) => externalAllowances.has(id),
    total: () => lots.reduce((n, l) => n + l.amount_cents, 0),
  };
}
export const cardEnvelopeTotal = (args) =>
  createCardEnvelopeFunds(args).total();

// An early purchase must not be allocated again at the start of its period.
// Protected budgets also recognize purchases on included bank accounts.
// Only an explicit period association makes an earlier purchase consume a future period.
// Merely selecting an envelope does not assign an expense before its first start date.
export function earlyEnvelopePurchases(
  { accounts = [], transactions = [], envelopeLinks = [] },
  envelope,
  on,
) {
  const eligible = new Set(
      accounts
        .filter(
          (a) =>
            a.kind === "credit" ||
            (envelope.forecast_spend === 0 && a.included),
        )
        .map((a) => a.id),
    ),
    links = new Map(envelopeLinks.map((l) => [l.transaction_id, l]));
  return transactions
    .filter(
      (t) =>
        t.envelope_id === envelope.id &&
        eligible.has(t.account_id) &&
        t.affects_balance !== 0 &&
        t.amount_cents < 0 &&
        t.happened_on < on &&
        links.get(t.id)?.occurrence_on === on,
    )
    .reduce(
      (n, t) =>
        n +
        Math.max(
          0,
          -t.amount_cents -
            (envelope.rollover ? t.envelope_effect_cents || 0 : 0),
        ),
      0,
    );
}
