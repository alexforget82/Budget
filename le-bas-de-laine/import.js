import { nationalOccurrenceDate } from "./calendar-state.js";
import { createHash } from "node:crypto";
import { cardLots } from "./engine.js";
import { occurrences, periodStart, addDays } from "./dates.js";
export const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const setting = (source, key, fallback) => {
  try {
    return (
      JSON.parse(
        source.app_settings.find((s) => s.key === key)?.value || "null",
      ) ?? fallback
    );
  } catch {
    return fallback;
  }
};
// Source identities are stable; an imported row edited locally is never silently overwritten.
export function planSillage(backup, reference, current) {
  if (backup?.format !== "mon-budget" || backup.version !== 1 || !backup.tables)
    throw Error(
      "Choisissez une sauvegarde JSON complète de Sillage (pas l’export ChatGPT).",
    );
  const s = backup.tables;
  for (const key of [
    "accounts",
    "categories",
    "transactions",
    "account_transfers",
    "recurring",
    "envelopes",
    "app_settings",
  ])
    if (!Array.isArray(s[key])) throw Error("Sauvegarde incomplète : " + key);
  const main = s.accounts.find((a) => a.kind !== "credit" && a.included);
  if (!main) throw Error("Le compte principal est absent de la sauvegarde.");
  const warnings = [],
    rows = {
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      recurrences: [],
    },
    catByEnvelope = new Map();
  const add = (table, id, row, raw) => {
    rows[table].push({
      ...row,
      source_key: "sillage:" + table + ":" + id,
      source_hash: hash(raw),
    });
  };
  const money = (n) => {
    if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12)
      throw Error("Montant invalide dans la sauvegarde.");
    return n;
  };
  for (const a of s.accounts)
    add(
      "accounts",
      a.id,
      {
        name: String(a.name).slice(0, 150),
        kind: a.kind === "credit" ? "card" : "bank",
        is_main: a.id === main.id ? 1 : 0,
        opening_card_cents: 0,
      },
      a,
    );
  if (s.accounts.filter((a) => a.kind !== "credit" && a.included).length > 1)
    warnings.push({
      code: "single_main",
      reason: "règle différente",
      message:
        "La nouvelle application utilise un seul compte principal. Vérifiez ce choix : " +
        main.name,
    });
  for (const [key, label] of [
    ["envelope_budget_overrides", "Budgets exceptionnels d’enveloppe"],
    ["envelope_occurrence_moves", "Déplacements de périodes d’enveloppe"],
    ["card_payment_plans", "Plans de paiement calculés des cartes"],
  ]) {
    if (s[key]?.length)
      warnings.push({
        code: key,
        blocking: true,
        reason: "à vérifier",
        message:
          label +
          " : ces règles demandent une reprise manuelle avant de valider le disponible.",
      });
  }
  if (setting(s, "v50_paychecks", []).some((p) => p.status === "planned"))
    warnings.push({
      code: "paycheck_allocations",
      blocking: true,
      reason: "à vérifier",
      message:
        "Des répartitions de paie planifiées doivent être remplacées par les limites.",
    });
  if (setting(s, "v70_funding_links", []).length)
    warnings.push({
      code: "funding_links",
      blocking: true,
      reason: "à vérifier",
      message: "Des liens de financement Sillage demandent une vérification.",
    });
  const monthly = setting(s, "monthly_budget_v60", {});
  if (Object.keys(setting(s, "envelope_advances_v73", {})).length)
    warnings.push({
      code: "advance_funding",
      reason: "règle différente",
      message:
        "Les alimentations anticipées de Sillage sont remplacées par les périodes des limites. Comparez les dates et les montants protégés.",
    });
  if (Object.keys(monthly.reserve_schedules || {}).length)
    warnings.push({
      code: "reserve_schedules",
      blocking: true,
      reason: "à vérifier",
      message:
        "Des calendriers variables de réservation ne peuvent pas être remplacés sans vérifier leurs montants.",
    });
  // Explicit source envelope/category references win; name matching is only used if unique.
  for (const e of s.envelopes.filter((e) => e.active)) {
    const candidates = s.categories.filter(
      (c) =>
        c.name.trim().toLocaleLowerCase("fr-CA") ===
        e.name.trim().toLocaleLowerCase("fr-CA"),
    );
    const cid =
      e.category_id ||
      Object.entries(monthly.envelopes || {}).find(
        ([, v]) => Number(v) === e.id,
      )?.[0] ||
      (candidates.length === 1 ? candidates[0].id : null);
    const key = cid
      ? "sillage:categories:" + cid
      : "sillage:categories:envelope-" + e.id;
    catByEnvelope.set(e.id, key);
    if (!["weekly", "monthly"].includes(e.frequency)) {
      warnings.push({
        code: "unsupported_limit",
        blocking: true,
        reason: "à vérifier",
        message:
          e.name +
          " : fréquence non hebdomadaire/mensuelle, limite à configurer manuellement.",
      });
      continue;
    }
    if (e.forecast_spend) {
      warnings.push({
        code: "dated_envelope",
        blocking: true,
        reason: "à vérifier",
        message:
          e.name +
          " : ancien paiement prévu à date précise; créer une facture plutôt qu’une limite.",
      });
      continue;
    }
    const row = {
      name: e.name,
      limit_cents: money(e.budget_cents),
      period: e.frequency,
      renewal_day:
        e.frequency === "weekly"
          ? new Date(e.start_on + "T12:00:00Z").getUTCDay()
          : Number(e.start_on?.slice(8) || 1),
      starts_on: e.start_on,
      active: 1,
    };
    const old = rows.categories.find((r) => r.source_key === key);
    if (old)
      warnings.push({
        code: "multiple_limits",
        blocking: true,
        reason: "à vérifier",
        message:
          e.name + " : plusieurs enveloppes correspondent à la même catégorie.",
      });
    else
      rows.categories.push({ ...row, source_key: key, source_hash: hash(e) });
    if (e.rollover)
      warnings.push({
        code: "rollover_removed",
        reason: "règle différente",
        message:
          e.name +
          " : le report d’enveloppe n’existe pas dans les limites de période.",
      });
  }
  for (const c of s.categories)
    if (
      !rows.categories.some(
        (r) => r.source_key === "sillage:categories:" + c.id,
      )
    )
      add(
        "categories",
        c.id,
        {
          name: c.name,
          limit_cents: null,
          period: null,
          renewal_day: null,
          starts_on: null,
          active: c.archived ? 0 : 1,
        },
        c,
      );
  for (const t of [...s.transactions].sort(
    (a, b) => a.happened_on.localeCompare(b.happened_on) || a.id - b.id,
  )) {
    if (t.happened_on > reference) {
      warnings.push({
        code: "future_actual",
        blocking: true,
        reason: "à vérifier",
        message:
          "Une transaction future n’a pas été reprise : " + t.description,
      });
      continue;
    }
    const key =
      t.envelope_id && catByEnvelope.has(t.envelope_id)
        ? catByEnvelope.get(t.envelope_id)
        : t.category_id
          ? "sillage:categories:" + t.category_id
          : null;
    const category = rows.categories.find((c) => c.source_key === key),
      link = (s.envelope_actual_links || []).find(
        (l) => l.transaction_id === t.id,
      );
    add(
      "transactions",
      t.id,
      {
        account_key: "sillage:accounts:" + t.account_id,
        category_key: category ? key : null,
        description: t.description,
        amount_cents: money(t.amount_cents),
        date: t.happened_on,
        period_on: category?.period
          ? link?.occurrence_on || periodStart(category, t.happened_on)
          : null,
        included: 1,
        settled_cents: 0,
      },
      t,
    );
  }
  for (const t of [...s.account_transfers].sort(
    (a, b) => a.happened_on.localeCompare(b.happened_on) || a.id - b.id,
  )) {
    if (t.happened_on > reference) continue;
    add(
      "transfers",
      t.id,
      {
        from_key: "sillage:accounts:" + t.from_account_id,
        to_key: "sillage:accounts:" + t.to_account_id,
        amount_cents: money(t.amount_cents),
        date: t.happened_on,
        description: t.description,
        included: 1,
      },
      t,
    );
  }
  for (const r of s.recurring) {
    if (r.type === "reserve") {
      warnings.push({
        code: "reserve_removed",
        reason: "règle différente",
        message:
          r.description +
          " : alimentation d’enveloppe remplacée par une limite.",
      });
      continue;
    }
    if (r.envelope_id && catByEnvelope.has(r.envelope_id)) {
      warnings.push({
        code: "variable_rule",
        blocking: true,
        reason: "à vérifier",
        message:
          r.description +
          " : vérifier le remplacement par une limite, sans protection en double.",
      });
      continue;
    }
    if (!r.account_id) {
      warnings.push({
        code: "missing_account",
        blocking: true,
        reason: "à vérifier",
        message: r.description + " : compte à choisir.",
      });
      continue;
    }
    const cat = rows.categories.find(
      (c) => c.source_key === "sillage:categories:" + r.category_id,
    );
    add(
      "recurrences",
      r.id,
      {
        name: r.description,
        kind: r.type,
        amount_cents: money(r.amount_cents),
        account_key: "sillage:accounts:" + r.account_id,
        to_key: r.to_account_id ? "sillage:accounts:" + r.to_account_id : null,
        category_key: cat?.limit_cents === null ? cat.source_key : null,
        start_on: r.start_on,
        frequency: r.frequency,
        day_adjust: r.day_adjust || "none",
        one_time: r.one_time || 0,
        active: r.active ? 1 : 0,
      },
      r,
    );
  }
  const conflicts = [];
  for (const [table, list] of Object.entries(rows))
    for (const row of list) {
      const existing = current[table].find(
        (r) => r.source_key === row.source_key,
      );
      if (existing?.dirty && existing.source_hash !== row.source_hash)
        conflicts.push({
          table,
          key: row.source_key,
          message:
            "Modifié dans les deux applications : " +
            (row.name || row.description),
        });
    }
  for (const [table, list] of Object.entries(rows))
    for (const row of current[table].filter((r) => r.source_key))
      if (!list.some((r) => r.source_key === row.source_key))
        conflicts.push({
          table,
          key: row.source_key,
          message:
            "Absent de la nouvelle sauvegarde source; aucune suppression automatique.",
        });
  // Never reset a bank checkpoint over locally added activity.
  if (
    current.transactions.some((t) => !t.source_key) ||
    current.transfers.some((t) => !t.source_key) ||
    current.transactions.some((t) => t.dirty) ||
    current.transfers.some((t) => t.dirty)
  )
    conflicts.push({
      message:
        "Des opérations ont été saisies ou modifiées dans Le bas de laine. Réimporter ne doit pas les écraser.",
    });
  const counts = Object.fromEntries(
    Object.entries(rows).map(([t, list]) => [
      t,
      {
        new: list.filter(
          (r) => !current[t].some((e) => e.source_key === r.source_key),
        ).length,
        updated: list.filter((r) =>
          current[t].some(
            (e) =>
              e.source_key === r.source_key &&
              e.source_hash !== r.source_hash &&
              !e.dirty,
          ),
        ).length,
      },
    ]),
  );
  return {
    rows,
    warnings,
    conflicts,
    counts,
    reference,
    main_key: "sillage:accounts:" + main.id,
    balance_cents: money(main.balance_cents),
    source: backup,
    token: hash([backup, current, reference]),
  };
}
export function applySillage(store, plan) {
  if (store.setting("sillage_import")?.hash === hash(plan.source))
    return { unchanged: true, warnings: plan.warnings };
  if (plan.conflicts.length) throw Error("Conflits à résoudre avant l’import.");
  const maps = {};
  for (const table of [
    "accounts",
    "categories",
    "transactions",
    "transfers",
    "recurrences",
  ]) {
    maps[table] = new Map(
      store
        .q("SELECT id,source_key FROM " + table)
        .map((r) => [r.source_key, r.id]),
    );
    for (const original of plan.rows[table]) {
      const row = { ...original };
      for (const [key, target, column] of [
        ["account_key", "accounts", "account_id"],
        ["category_key", "categories", "category_id"],
        ["from_key", "accounts", "from_account_id"],
        [
          "to_key",
          "accounts",
          table === "transfers" ? "to_account_id" : "to_account_id",
        ],
      ])
        if (Object.hasOwn(row, key)) {
          row[column] = row[key] ? maps[target].get(row[key]) : null;
          delete row[key];
          if (original[key] && !row[column])
            throw Error("Référence source manquante.");
        }
      const old = store.q(
        "SELECT * FROM " + table + " WHERE source_key=?",
        row.source_key,
      )[0];
      if (old && (old.dirty || old.source_hash === row.source_hash)) {
        maps[table].set(row.source_key, old.id);
        continue;
      }
      if (["transactions", "transfers"].includes(table) && !old)
        row.seq = store.sequence();
      const columns = Object.keys(row);
      if (old)
        store.run(
          "UPDATE " +
            table +
            " SET " +
            columns.map((k) => k + "=?").join() +
            " WHERE id=?",
          ...columns.map((k) => row[k]),
          old.id,
        );
      else {
        const id = Number(
          store.run(
            "INSERT INTO " +
              table +
              "(" +
              columns.join() +
              ") VALUES(" +
              columns.map(() => "?").join() +
              ")",
            ...columns.map((k) => row[k]),
          ).lastInsertRowid,
        );
        maps[table].set(row.source_key, id);
      }
    }
  }
  // Reconstruct only purchase protections known to Sillage, never its opening card debt.
  const source = plan.source.tables,
    protectedIds = setting(source, "card_recurring_protected_ids_v12", []),
    simple = setting(source, "simple_credit_v161", {});
  const tmp = {
    accounts: source.accounts.map((a) => ({
      id: a.id,
      kind: a.kind === "credit" ? "card" : "bank",
      opening_card_cents: 0,
    })),
    transactions: source.transactions
      .filter((t) => t.happened_on <= plan.reference && t.affects_balance !== 0)
      .map((t) => ({
        id: t.id,
        seq: t.id * 2,
        account_id: t.account_id,
        amount_cents: t.amount_cents,
        settled_cents:
          t.amount_cents < 0 &&
          !(t.envelope_id || protectedIds.some((p) => p.id === t.id))
            ? -t.amount_cents
            : 0,
      })),
    transfers: source.account_transfers
      .filter((t) => t.happened_on <= plan.reference)
      .map((t) => ({ ...t, seq: t.id * 2 + 1 })),
  };
  // Order from dates because source transaction/transfer IDs have separate counters.
  const combined = [
    ...tmp.transactions.map((t) => ({
      ...t,
      source_date: source.transactions.find((s) => s.id === t.id).happened_on,
      type: "t",
    })),
    ...tmp.transfers.map((t) => ({
      ...t,
      source_date: source.account_transfers.find((s) => s.id === t.id)
        .happened_on,
      type: "v",
    })),
  ].sort(
    (a, b) =>
      a.source_date.localeCompare(b.source_date) ||
      (a.type === "t" ? 0 : 1) - (b.type === "t" ? 0 : 1) ||
      a.id - b.id,
  );
  combined.forEach((t, i) => {
    (t.type === "t" ? tmp.transactions : tmp.transfers).find(
      (x) => x.id === t.id,
    ).seq = i + 1;
  });
  const lots = cardLots(tmp);
  store.run(
    "UPDATE transactions SET settled_cents=CASE WHEN amount_cents<0 THEN -amount_cents ELSE 0 END WHERE source_key IS NOT NULL",
  );
  for (const a of source.accounts.filter((a) => a.kind === "credit")) {
    const cardLots = lots.filter((l) => l.account_id === a.id),
      total = cardLots.reduce((s, l) => s + l.remaining_cents, 0),
      target = simple[a.id]
        ? total
        : Math.min(total, Math.max(0, a.balance_cents));
    let excess = total - target;
    store.run(
      "UPDATE accounts SET opening_card_cents=0 WHERE id=?",
      maps.accounts.get("sillage:accounts:" + a.id),
    );
    for (const lot of cardLots) {
      const release = Math.min(excess, lot.remaining_cents);
      excess -= release;
      const remaining = lot.remaining_cents - release,
        tid = maps.transactions.get(
          "sillage:transactions:" + lot.transaction_id,
        );
      if (tid)
        store.run(
          "UPDATE transactions SET settled_cents=-amount_cents-? WHERE id=?",
          remaining,
          tid,
        );
    }
  }
  store.run("UPDATE transfers SET included=1 WHERE source_key IS NOT NULL");
  // Imported transfers must not consume the just-captured opening protection again: engine ignores pre-snapshot card events.
  store.put("card_baseline_seq", store.setting("sequence", 0));
  const main = maps.accounts.get(plan.main_key);
  store.run(
    "INSERT INTO checkpoints(seq,account_id,amount_cents,date) VALUES(?,?,?,?)",
    store.sequence(),
    main,
    plan.balance_cents,
    plan.reference,
  );
  for (const row of plan.rows.recurrences) {
    const id = maps.recurrences.get(row.source_key),
      rawId = Number(row.source_key.split(":").at(-1)),
      raw = source.recurring.find((r) => r.id === rawId);
    for (const o of occurrences(
      {
        ...raw,
        id,
        name: raw.description,
        kind: raw.type,
        calendar_legacy: true,
      },
      raw.start_on,
      plan.reference,
    )) {
      const override = (source.recurring_overrides || []).find(
          (v) => v.recurring_id === rawId && v.occurrence_on === o.original_on,
        ),
        move = (source.recurring_moves || []).find(
          (v) => v.recurring_id === rawId && v.occurrence_on === o.original_on,
        ),
        link = (source.reconciliation_links || []).find(
          (v) => v.recurring_id === rawId && v.occurrence_on === o.original_on,
        );
      if (move && move.new_on >= plan.reference)
        store.run(
          "INSERT OR REPLACE INTO occurrence_states(rule_id,original_on,status,postponed_on,amount_cents) VALUES(?,?,'postponed',?,?)",
          id,
          nationalOccurrenceDate(raw, o.original_on),
          move.new_on,
          override?.amount_cents ?? null,
        );
      else if (override?.amount_cents === 0)
        store.run(
          "INSERT OR REPLACE INTO occurrence_states(rule_id,original_on,status) VALUES(?,?,'cancelled')",
          id,
          nationalOccurrenceDate(raw, o.original_on),
        );
      else if (
        o.date <
          (source.app_settings.find((s) => s.key === "forecast_tracking_since")
            ?.value || plan.reference) ||
        link ||
        source.transactions.some(
          (t) =>
            t.account_id === raw.account_id &&
            Math.abs(t.amount_cents) ===
              (override?.amount_cents ?? raw.amount_cents) &&
            Math.abs(Date.parse(t.happened_on) - Date.parse(o.date)) <=
              3 * 86400000 &&
            t.description.trim().toLocaleLowerCase("fr-CA") ===
              raw.description.trim().toLocaleLowerCase("fr-CA"),
        )
      )
        store.run(
          "INSERT OR REPLACE INTO occurrence_states(rule_id,original_on,status) VALUES(?,?,'paid')",
          id,
          nationalOccurrenceDate(raw, o.original_on),
        );
    }
  }
  for (const raw of source.recurring_overrides || []) {
    const id = maps.recurrences.get("sillage:recurrences:" + raw.recurring_id);
    if (!id || raw.occurrence_on < plan.reference) continue;
    const moved = (source.recurring_moves || []).find(
      (m) =>
        m.recurring_id === raw.recurring_id &&
        m.occurrence_on === raw.occurrence_on,
    );
    store.run(
      "INSERT OR REPLACE INTO occurrence_states(rule_id,original_on,status,postponed_on,amount_cents) VALUES(?,?,?,?,?)",
      id,
      nationalOccurrenceDate(
        source.recurring.find((r) => r.id === raw.recurring_id),
        raw.occurrence_on,
      ),
      raw.amount_cents === 0 ? "cancelled" : "postponed",
      moved?.new_on || raw.occurrence_on,
      raw.amount_cents,
    );
  }
  for (const raw of source.recurring_moves || []) {
    const id = maps.recurrences.get("sillage:recurrences:" + raw.recurring_id);
    if (
      !id ||
      raw.occurrence_on < plan.reference ||
      (source.recurring_overrides || []).some(
        (o) =>
          o.recurring_id === raw.recurring_id &&
          o.occurrence_on === raw.occurrence_on,
      )
    )
      continue;
    store.run(
      "INSERT OR REPLACE INTO occurrence_states(rule_id,original_on,status,postponed_on) VALUES(?,?,'postponed',?)",
      id,
      nationalOccurrenceDate(
        source.recurring.find((r) => r.id === raw.recurring_id),
        raw.occurrence_on,
      ),
      raw.new_on,
    );
  }
  store.put("configured", true);
  store.put("sillage_import", {
    reference: plan.reference,
    hash: hash(plan.source),
    at: new Date().toISOString(),
    warnings: plan.warnings,
  });
  return { counts: plan.counts, warnings: plan.warnings };
}
