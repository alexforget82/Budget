import { simulate, bankBalance } from "./engine.js";
import {
  validDate,
  today,
  periodStart,
  nextPeriod,
  occurrences,
  addDays,
} from "./dates.js";
export function cents(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw Error("Indiquez un montant avec au plus deux décimales.");
  const [whole, dec = ""] = text.replace("-", "").split(".");
  const n =
    (Number(whole) * 100 + Number(dec.padEnd(2, "0"))) *
    (text.startsWith("-") ? -1 : 1);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12)
    throw Error("Montant trop élevé.");
  return n;
}
export function createService(store, clock = today) {
  const { q, run, atomic, sequence, setting, put } = store;
  const name = (x) => {
    const s = String(x ?? "").trim();
    if (!s || s.length > 150)
      throw Error("Nom requis (150 caractères maximum).");
    return s;
  };
  const date = (x) => {
    if (!validDate(x)) throw Error("Date invalide.");
    return x;
  };
  const account = (id) => {
    const a = q("SELECT * FROM accounts WHERE id=?", Number(id))[0];
    if (!a) throw Error("Compte introuvable.");
    return a;
  };
  function category(x) {
    if (!x.id) {
      const existing = q("SELECT id,name FROM categories").find(
        (c) =>
          c.name.trim().toLocaleLowerCase("fr-CA") ===
          String(x.name ?? "")
            .trim()
            .toLocaleLowerCase("fr-CA"),
      );
      if (existing) x = { ...x, id: existing.id };
    }
    const limit =
        x.limit === "" || x.limit === null || x.limit === undefined
          ? null
          : cents(x.limit),
      period = limit === null ? null : x.period,
      day = limit === null ? null : Number(x.renewal_day);
    if (
      limit !== null &&
      (limit < 0 ||
        !["weekly", "monthly"].includes(period) ||
        !Number.isInteger(day) ||
        day < (period === "weekly" ? 0 : 1) ||
        day > (period === "weekly" ? 6 : 31))
    )
      throw Error("Limite ou période invalide.");
    const c = {
      name: name(x.name),
      limit_cents: limit,
      period,
      renewal_day: day,
      starts_on: limit === null ? null : date(x.starts_on || clock()),
      active: x.active === false ? 0 : 1,
    };
    if (c.starts_on) c.starts_on = periodStart(c, c.starts_on);
    if (x.id) {
      if (!q("SELECT id FROM categories WHERE id=?", Number(x.id)).length)
        throw Error("Catégorie introuvable.");
      if (
        limit !== null &&
        q(
          "SELECT 1 FROM recurrences WHERE category_id=? AND active=1",
          Number(x.id),
        ).length
      )
        throw Error(
          "Cette catégorie contient une facture programmée. Évitez de protéger la même dépense par une facture et une limite.",
        );
      run(
        "UPDATE categories SET name=?,limit_cents=?,period=?,renewal_day=?,starts_on=?,active=?,dirty=1 WHERE id=?",
        ...Object.values(c),
        Number(x.id),
      );
      if (c.name.toLocaleLowerCase("fr-CA") === "autres" && limit !== null)
        put("fallback_category_id", Number(x.id));
      return Number(x.id);
    }
    const id = Number(
      run(
        "INSERT INTO categories(name,limit_cents,period,renewal_day,starts_on,active) VALUES(?,?,?,?,?,?)",
        ...Object.values(c),
      ).lastInsertRowid,
    );
    if (c.name.toLocaleLowerCase("fr-CA") === "autres" && limit !== null)
      put("fallback_category_id", id);
    return id;
  }
  function recurrence(x) {
    const a = account(x.account_id),
      kind = x.kind,
      amount = cents(x.amount);
    if (
      !["expense", "income", "transfer"].includes(kind) ||
      amount <= 0 ||
      ![
        "weekly",
        "biweekly",
        "monthly",
        "quarterly",
        "semiannual",
        "yearly",
        "last_business_day",
        "rrq",
      ].includes(x.frequency)
    )
      throw Error("Récurrence invalide.");
    if (kind === "transfer" && account(x.to_account_id).id === a.id)
      throw Error("Choisissez deux comptes différents.");
    const cat = x.category_id ? Number(x.category_id) : null;
    if (
      cat &&
      !q("SELECT id FROM categories WHERE id=? AND limit_cents IS NULL", cat)
        .length
    )
      throw Error(
        "Une facture ne doit pas faire double emploi avec une limite variable.",
      );
    const fields = [
      name(x.name),
      kind,
      amount,
      a.id,
      kind === "transfer" ? Number(x.to_account_id) : null,
      cat,
      date(x.start_on),
      x.frequency,
      ["none", "before", "after"].includes(x.day_adjust)
        ? x.day_adjust
        : { previous: "before", next: "after" }[x.day_adjust] || "none",
      x.one_time ? 1 : 0,
      x.active === false ? 0 : 1,
    ];
    if (x.id) {
      if (!q("SELECT id FROM recurrences WHERE id=?", +x.id).length)
        throw Error("Récurrence introuvable.");
      run(
        "UPDATE recurrences SET name=?,kind=?,amount_cents=?,account_id=?,to_account_id=?,category_id=?,start_on=?,frequency=?,day_adjust=?,one_time=?,active=?,dirty=1 WHERE id=?",
        ...fields,
        +x.id,
      );
      return +x.id;
    }
    return Number(
      run(
        "INSERT INTO recurrences(name,kind,amount_cents,account_id,to_account_id,category_id,start_on,frequency,day_adjust,one_time,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        ...fields,
      ).lastInsertRowid,
    );
  }
  function transaction(x) {
    const a = account(x.account_id),
      amount = cents(x.amount),
      on = date(x.date || clock()),
      cat = x.category_id ? Number(x.category_id) : null;
    if (!amount || on > clock())
      throw Error("Un achat réel doit être daté d’aujourd’hui ou avant.");
    const c = cat ? q("SELECT * FROM categories WHERE id=?", cat)[0] : null;
    if (cat && !c) throw Error("Catégorie introuvable.");
    let period = null;
    if (c?.limit_cents !== null && c?.limit_cents !== undefined) {
      const current = periodStart(c, on);
      period = x.period_on || current;
      if (period !== current && period !== nextPeriod(c, current))
        throw Error("Choisissez cette période ou la prochaine.");
    }
    const old = x.id
      ? q("SELECT * FROM transactions WHERE id=?", +x.id)[0]
      : null;
    if (x.id && !old) throw Error("Transaction introuvable.");
    if (
      old &&
      q("SELECT 1 FROM occurrence_states WHERE transaction_id=?", old.id)
        .length &&
      (old.account_id !== a.id ||
        Math.sign(old.amount_cents) !== Math.sign(amount))
    )
      throw Error(
        "Retirez d’abord le lien de facture avant de changer son compte ou son type.",
      );
    const values = [
      a.id,
      cat,
      name(x.description),
      amount,
      on,
      period,
      x.included ? 1 : 0,
    ];
    const settled = x.card_settled
      ? Math.abs(amount)
      : old
        ? Math.min(old.settled_cents, Math.abs(amount))
        : 0;
    if (old) {
      run(
        "UPDATE transactions SET account_id=?,category_id=?,description=?,amount_cents=?,date=?,period_on=?,included=?,settled_cents=?,dirty=1 WHERE id=?",
        ...values,
        settled,
        old.id,
      );
      return old.id;
    }
    const id = Number(
      run(
        "INSERT INTO transactions(seq,account_id,category_id,description,amount_cents,date,period_on,included,settled_cents) VALUES(?,?,?,?,?,?,?,?,?)",
        sequence(),
        ...values,
        settled,
      ).lastInsertRowid,
    );
    if (x.occurrence) {
      const o = openOccurrence(x.occurrence);
      if (
        o.account_id !== a.id ||
        (o.kind === "income") !== amount > 0 ||
        o.kind === "transfer"
      )
        throw Error("Échéance incompatible.");
      markPaid(o, id, null);
    }
    return id;
  }
  function transfer(x) {
    const from = account(x.from_account_id),
      to = account(x.to_account_id),
      amount = cents(x.amount),
      on = date(x.date || clock());
    if (
      from.id === to.id ||
      from.kind === "card" ||
      amount <= 0 ||
      on > clock()
    )
      throw Error("Paiement ou virement invalide.");
    return Number(
      run(
        "INSERT INTO transfers(seq,from_account_id,to_account_id,amount_cents,date,description,included) VALUES(?,?,?,?,?,?,?)",
        sequence(),
        from.id,
        to.id,
        amount,
        on,
        name(x.description || "Paiement de carte"),
        x.included ? 1 : 0,
      ).lastInsertRowid,
    );
  }
  function openOccurrence(x) {
    const rule = q(
      "SELECT * FROM recurrences WHERE id=?",
      Number(x.rule_id),
    )[0];
    if (!rule) throw Error("Échéance introuvable.");
    const o = occurrences(rule, date(x.original_on), x.original_on).find(
      (o) => o.date === x.original_on,
    );
    if (!o) throw Error("Date d’échéance invalide.");
    const action = q(
      "SELECT * FROM occurrence_states WHERE rule_id=? AND original_on=?",
      rule.id,
      o.original_on,
    )[0];
    if (["paid", "cancelled"].includes(action?.status))
      throw Error("Échéance déjà réglée.");
    return {
      ...o,
      date: action?.postponed_on || o.date,
      amount_cents: action?.amount_cents ?? o.amount_cents,
    };
  }
  function markPaid(o, tid, transferId) {
    run(
      "INSERT INTO occurrence_states(rule_id,original_on,status,transaction_id,transfer_id) VALUES(?,?,'paid',?,?) ON CONFLICT(rule_id,original_on) DO UPDATE SET status='paid',transaction_id=excluded.transaction_id,transfer_id=excluded.transfer_id",
      o.rule_id,
      o.original_on,
      tid,
      transferId,
    );
  }
  function occurrence(x) {
    const o = openOccurrence(x);
    if (x.action === "postpone") {
      const on = date(x.date);
      if (on < clock())
        throw Error("Choisissez aujourd’hui ou une date à venir.");
      run(
        "INSERT INTO occurrence_states(rule_id,original_on,status,postponed_on) VALUES(?,?,'postponed',?) ON CONFLICT(rule_id,original_on) DO UPDATE SET status='postponed',postponed_on=excluded.postponed_on",
        o.rule_id,
        o.original_on,
        on,
      );
    } else if (x.action === "cancel")
      run(
        "INSERT INTO occurrence_states(rule_id,original_on,status) VALUES(?,?,'cancelled') ON CONFLICT(rule_id,original_on) DO UPDATE SET status='cancelled'",
        o.rule_id,
        o.original_on,
      );
    else if (x.action === "pay") {
      const amount = x.amount === undefined ? o.amount_cents / 100 : x.amount,
        on = x.date || clock();
      if (cents(amount) <= 0) throw Error("Le paiement doit être positif.");
      if (o.kind === "transfer") {
        const id = transfer({
          from_account_id: o.account_id,
          to_account_id: o.to_account_id,
          amount,
          date: on,
          description: o.name,
        });
        markPaid(o, null, id);
      } else {
        const id = transaction({
          account_id: o.account_id,
          category_id: o.category_id,
          description: o.name,
          amount: ((o.kind === "income" ? 1 : -1) * cents(amount)) / 100,
          date: on,
        });
        markPaid(o, id, null);
      }
    } else throw Error("Action inconnue.");
  }
  function checkpoint(x) {
    const a = account(x.account_id);
    if (!a.is_main) throw Error("Choisissez le compte principal.");
    const amount = cents(x.amount),
      difference = amount - bankBalance(store.state());
    run(
      "INSERT INTO checkpoints(seq,account_id,amount_cents,date,difference_cents) VALUES(?,?,?,?,?)",
      sequence(),
      a.id,
      amount,
      clock(),
      difference,
    );
    return difference;
  }
  function setup(x) {
    if (setting("configured", false))
      throw Error("La configuration est déjà terminée.");
    const id = Number(
      run(
        "INSERT INTO accounts(name,kind,is_main) VALUES(?,'bank',1)",
        name(x.account_name || "Conjoint"),
      ).lastInsertRowid,
    );
    checkpoint({ account_id: id, amount: x.balance });
    for (const pay of x.paychecks || [])
      recurrence({ ...pay, kind: "income", account_id: id });
    for (const bill of x.bills || [])
      recurrence({ ...bill, kind: "expense", account_id: id });
    for (const c of x.categories || []) category(c);
    if (!q("SELECT 1 FROM recurrences WHERE kind='income' AND active=1").length)
      throw Error("Ajoutez au moins une prochaine paie.");
    put("configured", true);
  }
  function snapshot() {
    const data = store.state(),
      lastImport = setting("sillage_import"),
      simulation = simulate(data, clock());
    simulation.provisional = !!lastImport?.warnings?.some((w) => w.blocking);
    if (simulation.provisional)
      simulation.warnings.unshift(
        "Import à vérifier : certaines règles Sillage n’ont pas été reprises. Ce disponible reste provisoire.",
      );
    return {
      ...data,
      version: "0.2.0",
      configured: setting("configured", false),
      theme: "system",
      simulation,
      last_import: lastImport,
      shared_enabled: !!setting("share_token"),
    };
  }
  function matches(x) {
    const on = date(x.date || clock()),
      amount = cents(x.amount),
      description = String(x.description || "").toLocaleLowerCase("fr-CA");
    const sim = simulate(store.state(), clock());
    return sim.upcoming
      .filter(
        (o) =>
          o.account_id === Number(x.account_id) &&
          o.kind !== "transfer" &&
          (o.kind === "income") === amount > 0 &&
          Math.abs(Date.parse(o.date) - Date.parse(on)) <= 7 * 86400000 &&
          (Math.abs(o.amount_cents - Math.abs(amount)) <=
            Math.max(100, o.amount_cents * 0.2) ||
            (description.length > 3 &&
              o.name.toLocaleLowerCase("fr-CA").includes(description))),
      )
      .slice(0, 5);
  }
  return {
    snapshot,
    setup,
    transaction,
    transfer,
    category,
    recurrence,
    occurrence,
    checkpoint,
    matches,
    account,
    name,
    date,
    clock,
    atomic,
  };
}
