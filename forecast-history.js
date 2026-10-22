// Local observation journal. Never writes to the ledger or changes forecast formulas.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const domains = {
  accounts: "Compte",
  envelopes: "Enveloppe",
  transactions: "Transaction",
  recurring: "Récurrence",
  account_transfers: "Virement",
  recurring_overrides: "Exception",
  recurring_moves: "Déplacement",
  envelope_budget_overrides: "Budget de période",
  envelope_actual_links: "Association d’enveloppe",
  reconciliation_links: "Association au prévu",
  envelope_period_status: "Période d’enveloppe",
  card_payment_plans: "Paiement de carte",
};
export function forecastObservation(state, tables, date) {
  const inputs = {};
  for (const [table, label] of Object.entries(domains))
    for (const row of tables[table] || []) {
      const clean = { ...row };
      delete clean.reviewed;
      delete clean.category_id;
      delete clean.subcategory_id;
      const identity =
        row.id ??
        row.transaction_id ??
        row.card_account_id ??
        `${row.recurring_id ?? row.envelope_id}:${row.occurrence_on}`;
      inputs[table + ":" + identity] = {
        hash: hash(clean),
        label:
          label +
          " · " +
          (row.description ||
            row.name ||
            row.occurrence_on ||
            String(identity)),
        amount_cents:
          row.amount_cents ?? row.budget_cents ?? row.balance_cents ?? null,
      };
    }
  // Metadata includes coverage and scope; ignore presentation-only preferences.
  const settings = (tables.app_settings || []).filter((s) =>
    /funding|scope|banking|advances|protection|since|allocation/.test(s.key),
  );
  for (const setting of settings) {
    const label = /funding/.test(setting.key)
      ? "Financement d’une dépense"
      : /scope|banking/.test(setting.key)
        ? "Compte du disponible"
        : /advances/.test(setting.key)
          ? "Alimentation anticipée d’une enveloppe"
          : /protection/.test(setting.key)
            ? "Protection d’achats sur carte"
            : /allocation/.test(setting.key)
              ? "Répartition d’une paie"
              : "Point de départ de la prévision";
    inputs["setting:" + setting.key] = {
      hash: hash(setting.value),
      label: "Réglage · " + label,
      amount_cents: null,
    };
  }
  const points = [
    {
      date,
      cash_cents: state.cash_cents,
      reserved_cents: state.reserved_cents,
      safe_cents: state.safe_cents,
      opening: true,
    },
    ...state.forecast.slice(0, 90).map((d) => ({
      date: d.date,
      cash_cents: d.cash_cents,
      reserved_cents: d.reserved_cents,
      safe_cents: d.safe_cents,
    })),
  ];
  return {
    date,
    inputs,
    points,
    signature: hash([date, inputs, settings, points]),
  };
}
export function compareForecasts(before, after, horizon) {
  const old = before.points.slice(0, horizon + 1),
    next = after.points.slice(0, horizon + 1),
    low = (points) =>
      points.reduce((a, b) => (b.safe_cents < a.safe_cents ? b : a));
  const a = low(old),
    b = low(next),
    oldAtDate = old.filter((p) => p.date === b.date).at(-1);
  const bridge = oldAtDate
    ? {
        date: b.date,
        previous_at_date_cents: oldAtDate.safe_cents,
        cash_change_cents: b.cash_cents - oldAtDate.cash_cents,
        reserve_change_cents: oldAtDate.reserved_cents - b.reserved_cents,
        minimum_date_change_cents: oldAtDate.safe_cents - a.safe_cents,
      }
    : null;
  // Opening and end-of-day values differ; use the same point when today's opening is the minimum.
  if (bridge && b.opening) {
    const opening = old.find((p) => p.opening && p.date === b.date);
    if (opening) {
      bridge.previous_at_date_cents = opening.safe_cents;
      bridge.cash_change_cents = b.cash_cents - opening.cash_cents;
      bridge.reserve_change_cents = opening.reserved_cents - b.reserved_cents;
      bridge.minimum_date_change_cents = opening.safe_cents - a.safe_cents;
    }
  }
  return {
    before: { date: a.date, cents: a.safe_cents },
    after: { date: b.date, cents: b.safe_cents },
    delta_cents: b.safe_cents - a.safe_cents,
    window_changed: before.date !== after.date,
    bridge,
  };
}
export function createForecastHistory({
  dir,
  today,
  clock = () => new Date().toISOString(),
  limit = 40,
}) {
  const file = path.join(dir, "forecast-history.json");
  let data = { format: 1, records: [], last: null },
    error = null,
    corrupt = false;
  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        parsed.format !== 1 ||
        !Array.isArray(parsed.records) ||
        parsed.records.length > limit
      )
        throw Error("Journal invalide");
      data = parsed;
    }
  } catch {
    corrupt = true;
    error =
      "Historique illisible. Les calculs et les données du budget restent disponibles.";
  }
  function observe(state, tables, reason = "observation") {
    if (corrupt) return;
    error = null;
    try {
      const next = forecastObservation(state, tables, today()),
        previous = data.last;
      if (previous?.signature === next.signature) return;
      const changes = [];
      if (previous)
        for (const key of new Set([
          ...Object.keys(previous.inputs),
          ...Object.keys(next.inputs),
        ])) {
          const a = previous.inputs[key],
            b = next.inputs[key];
          if (a?.hash !== b?.hash)
            changes.push({
              action: !a ? "Ajout" : !b ? "Retrait" : "Modification",
              label: (b || a).label,
              before_cents: a?.amount_cents ?? null,
              after_cents: b?.amount_cents ?? null,
            });
        }
      const record = {
        id: randomUUID(),
        at: clock(),
        date: next.date,
        reason,
        baseline: !previous,
        changes: changes.slice(0, 100),
        changes_count: changes.length,
        comparisons: previous
          ? Object.fromEntries(
              [30, 60, 90].map((h) => [h, compareForecasts(previous, next, h)]),
            )
          : null,
      };
      // Ignore purely descriptive/check-off changes when the canonical forecast is unchanged.
      const changed =
        !previous ||
        JSON.stringify(previous.points) !== JSON.stringify(next.points) ||
        previous.date !== next.date;
      const records = changed
        ? [...data.records, record].slice(-limit)
        : data.records;
      const updated = { format: 1, records, last: next };
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(file + ".tmp", JSON.stringify(updated), { mode: 0o600 });
      fs.renameSync(file + ".tmp", file);
      data = updated;
    } catch {
      error =
        "Historique temporairement indisponible. Aucune opération financière n’est annulée.";
    }
  }
  function reset() {
    data = { format: 1, records: [], last: null };
    error = null;
    corrupt = false;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      error = "Impossible de réinitialiser le journal local.";
    }
  }
  return {
    observe,
    reset,
    unavailable: () => {
      error =
        "Historique temporairement indisponible. Les opérations du budget sont conservées.";
    },
    read: () => ({
      error,
      started_at: data.records[0]?.at || null,
      retention: limit,
      records: data.records.slice().reverse(),
    }),
  };
}
