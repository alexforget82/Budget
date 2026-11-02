import { matchingRule, normalizeMerchant } from "./classification.js";
import { createHash } from "node:crypto";
import {
  occurrenceInfo,
  supportedFrequencies,
  normalizeAdjustment,
} from "./calendar.js";
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
        !["weekly", "monthly", "semimonthly"].includes(period) ||
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
      renewal_day2: period === "semimonthly" ? Number(x.renewal_day2) : null,
      starts_on: limit === null ? null : date(x.starts_on || clock()),
      active: x.active === false ? 0 : 1,
    };
    if (
      period === "semimonthly" &&
      (day > 27 ||
        !Number.isInteger(c.renewal_day2) ||
        c.renewal_day2 <= day ||
        c.renewal_day2 > 31)
    )
      throw Error(
        "Choisissez deux jours distincts : premier du 1 au 27, second jusqu’au 31.",
      );
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
        "UPDATE categories SET name=?,limit_cents=?,period=?,renewal_day=?,renewal_day2=?,starts_on=?,active=?,dirty=1 WHERE id=?",
        ...Object.values(c),
        Number(x.id),
      );
      if (c.name.toLocaleLowerCase("fr-CA") === "autres" && limit !== null)
        put("fallback_category_id", Number(x.id));
      if (limit === null && setting("fallback_category_id") === Number(x.id))
        put("fallback_category_id", null);
      return Number(x.id);
    }
    const id = Number(
      run(
        "INSERT INTO categories(name,limit_cents,period,renewal_day,renewal_day2,starts_on,active) VALUES(?,?,?,?,?,?,?)",
        ...Object.values(c),
      ).lastInsertRowid,
    );
    if (c.name.toLocaleLowerCase("fr-CA") === "autres" && limit !== null)
      put("fallback_category_id", id);
    return id;
  }
  function previewRecurrence(x) {
    const start = date(x.start_on),
      mode = normalizeAdjustment(x.day_adjust);
    if (!supportedFrequencies.includes(x.frequency))
      throw Error("Fréquence invalide.");
    const dates = [],
      old = x.id
        ? q("SELECT * FROM recurrences WHERE id=?", Number(x.id))[0]
        : null;
    const saved = old
      ? q("SELECT * FROM occurrence_states WHERE rule_id=?", old.id)
      : [];
    const monthly = ["monthly", "last_day", "last_business_day", "rrq"];
    const remappable =
      old &&
      ((old.frequency === x.frequency && old.start_on === start) ||
        (monthly.includes(old.frequency) &&
          monthly.includes(x.frequency) &&
          old.start_on.slice(0, 7) === start.slice(0, 7)));
    for (let i = 0; i < 30000; i++) {
      const info = occurrenceInfo(
        start,
        x.frequency,
        i,
        mode,
        false,
        false,
        x.frequency === "semimonthly" ? Number(x.second_day) : null,
      );
      const original = remappable
        ? occurrenceInfo(
            old.start_on,
            old.frequency,
            i,
            old.day_adjust || "none",
            false,
            false,
            old.second_day,
          ).date
        : info.date;
      const action = saved.find((row) => row.original_on === original);
      if (!["paid", "cancelled"].includes(action?.status)) {
        const actual = action?.postponed_on || info.date;
        if (actual >= clock() || x.one_time)
          dates.push({
            nominal: info.nominal,
            date: actual,
            shifted: info.nominal !== actual,
            manual: !!action?.postponed_on,
            ...(x.frequency === "rrq" ? { estimated: info.estimated } : {}),
          });
      }
      if (dates.length === 3 || x.one_time) break;
    }
    return {
      dates,
      calendar: "Fermetures du système de paiement canadien",
      estimated: dates.some((d) => d.estimated),
    };
  }
  function preserveOccurrenceStates(old, next) {
    if (!old) return;
    const monthly = ["monthly", "last_day", "last_business_day", "rrq"];
    const compatible =
      (old.frequency === next.frequency && old.start_on === next.start_on) ||
      (monthly.includes(old.frequency) &&
        monthly.includes(next.frequency) &&
        old.start_on.slice(0, 7) === next.start_on.slice(0, 7));
    if (
      !compatible ||
      (old.frequency === next.frequency &&
        old.start_on === next.start_on &&
        old.day_adjust === next.day_adjust &&
        old.second_day === next.second_day)
    )
      return;
    const states = q(
      "SELECT * FROM occurrence_states WHERE rule_id=? ORDER BY original_on",
      old.id,
    );
    if (!states.length) return;
    const remapped = new Map(),
      last = states.at(-1).original_on;
    for (let i = 0; i < 30000; i++) {
      const before = occurrenceInfo(
        old.start_on,
        old.frequency,
        i,
        old.day_adjust || "none",
        false,
        false,
        old.second_day,
      ).date;
      if (before > last) break;
      if (states.some((row) => row.original_on === before))
        remapped.set(
          before,
          occurrenceInfo(
            next.start_on,
            next.frequency,
            i,
            next.day_adjust,
            false,
            false,
            next.second_day,
          ).date,
        );
      if (old.one_time) break;
    }
    if (
      states.some((row) => !remapped.has(row.original_on)) ||
      new Set(remapped.values()).size !== states.length
    )
      throw Error(
        "Des échéances historiques demandent une vérification. Aucun déplacement effectué.",
      );
    run("DELETE FROM occurrence_states WHERE rule_id=?", old.id);
    for (const row of states)
      run(
        "INSERT INTO occurrence_states(rule_id,original_on,status,postponed_on,amount_cents,transaction_id,transfer_id) VALUES(?,?,?,?,?,?,?)",
        old.id,
        remapped.get(row.original_on),
        row.status,
        row.postponed_on,
        row.amount_cents,
        row.transaction_id,
        row.transfer_id,
      );
  }
  function recurrence(x) {
    const old = x.id
      ? q("SELECT * FROM recurrences WHERE id=?", Number(x.id))[0]
      : null;
    const adjustment = normalizeAdjustment(
      x.day_adjust === undefined
        ? (old?.day_adjust ?? (x.kind === "income" ? "before" : "after"))
        : x.day_adjust,
    );
    const a = account(x.account_id),
      kind = x.kind,
      amount = cents(x.amount);
    if (
      !["expense", "income", "transfer"].includes(kind) ||
      amount <= 0 ||
      !supportedFrequencies.includes(x.frequency)
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
    if (x.frequency === "semimonthly")
      occurrenceInfo(
        date(x.start_on),
        x.frequency,
        0,
        adjustment,
        false,
        false,
        Number(x.second_day),
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
      x.frequency === "semimonthly" ? Number(x.second_day) : null,
      adjustment,
      x.one_time === undefined ? old?.one_time || 0 : x.one_time ? 1 : 0,
      x.active === false ? 0 : 1,
    ];
    if (x.id) {
      if (!q("SELECT id FROM recurrences WHERE id=?", +x.id).length)
        throw Error("Récurrence introuvable.");
      preserveOccurrenceStates(old, {
        frequency: x.frequency,
        second_day: x.frequency === "semimonthly" ? Number(x.second_day) : null,
        start_on: x.start_on,
        day_adjust: adjustment,
      });
      run(
        "UPDATE recurrences SET name=?,kind=?,amount_cents=?,account_id=?,to_account_id=?,category_id=?,start_on=?,frequency=?,second_day=?,day_adjust=?,one_time=?,active=?,dirty=1 WHERE id=?",
        ...fields,
        +x.id,
      );
      return +x.id;
    }
    return Number(
      run(
        "INSERT INTO recurrences(name,kind,amount_cents,account_id,to_account_id,category_id,start_on,frequency,second_day,day_adjust,one_time,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ...fields,
      ).lastInsertRowid,
    );
  }
  function classify(x) {
    return matchingRule(store.state(), {
      id: x.id ? Number(x.id) : null,
      description: x.description,
      account_id: Number(x.account_id),
      amount_cents: cents(x.amount),
    });
  }
  function classificationRule(x) {
    const cat = Number(x.category_id),
      priority = Number(x.priority ?? 100),
      pattern = String(x.pattern || "").trim(),
      accountId = x.account_id ? Number(x.account_id) : null,
      min =
        x.min_amount == null || x.min_amount === ""
          ? null
          : cents(x.min_amount),
      max =
        x.max_amount == null || x.max_amount === ""
          ? null
          : cents(x.max_amount);
    if (
      !q("SELECT id FROM categories WHERE id=?", cat).length ||
      !normalizeMerchant(pattern) ||
      pattern.length > 200 ||
      !Number.isSafeInteger(priority) ||
      priority < 0 ||
      priority > 100000 ||
      !["contains", "starts", "equals"].includes(x.match_type) ||
      !["expense", "income"].includes(x.direction) ||
      (min !== null && min < 0) ||
      (max !== null && max < 0) ||
      (min !== null && max !== null && min > max)
    )
      throw Error("Règle de classement invalide.");
    if (accountId) account(accountId);
    const values = [
      priority,
      x.match_type,
      pattern,
      accountId,
      x.direction,
      min,
      max,
      cat,
      x.active === false ? 0 : 1,
    ];
    if (x.id) {
      if (!q("SELECT id FROM rules WHERE id=?", Number(x.id)).length)
        throw Error("Règle introuvable.");
      run(
        "UPDATE rules SET priority=?,match_type=?,pattern=?,account_id=?,direction=?,min_cents=?,max_cents=?,category_id=?,active=? WHERE id=?",
        ...values,
        Number(x.id),
      );
      return Number(x.id);
    }
    return Number(
      run(
        "INSERT INTO rules(priority,match_type,pattern,account_id,direction,min_cents,max_cents,category_id,active) VALUES(?,?,?,?,?,?,?,?,?)",
        ...values,
      ).lastInsertRowid,
    );
  }
  function deleteClassificationRule(x) {
    if (!q("SELECT id FROM rules WHERE id=?", Number(x.id)).length)
      throw Error("Règle introuvable.");
    run("DELETE FROM rules WHERE id=?", Number(x.id));
  }
  function reviewBatch(x, apply = false) {
    if (
      !["category", "review", "review_rules"].includes(x.action) ||
      !Array.isArray(x.ids) ||
      !x.ids.length ||
      x.ids.length > 5000
    )
      throw Error("Sélection ou action invalide.");
    const data = store.state(),
      ids = [...new Set(x.ids.map(Number))],
      cat = x.category_id ? Number(x.category_id) : null,
      target = data.categories.find((c) => c.id === cat);
    if (x.action === "category" && cat && !target)
      throw Error("Catégorie introuvable.");
    const rows = ids.map((id) => {
      const row = data.transactions.find((t) => t.id === id);
      if (!row) throw Error("Transaction introuvable.");
      return row;
    });
    const linked = new Set(
      data.occurrence_states
        .filter((o) => o.status === "paid")
        .map((o) => o.transaction_id),
    );
    if (x.action === "category" && rows.some((t) => linked.has(t.id)))
      throw Error(
        "Retirez les opérations liées à une facture de la sélection.",
      );
    const changes = rows.filter(
      (t) =>
        x.action !== "review_rules" ||
        (!t.reviewed && matchingRule(data, t)?.category_id === t.category_id),
    );
    const changeIds = new Set(changes.map((c) => c.id));
    const planned = structuredClone(data);
    for (const t of planned.transactions.filter((t) => changeIds.has(t.id))) {
      if (x.action === "category") {
        if (t.category_id !== cat)
          t.period_on =
            target?.limit_cents != null ? periodStart(target, t.date) : null;
        t.category_id = cat;
      } else t.reviewed = 1;
    }
    const before = simulate(data, clock()).spending_30.amount_cents,
      after = simulate(planned, clock()).spending_30.amount_cents,
      token = createHash("sha256")
        .update(JSON.stringify([data, x.action, ids, cat]))
        .digest("hex");
    if (apply) {
      if (x.action === "category" && x.token !== token)
        throw Error("L’aperçu a changé. Recommencez.");
      for (const row of planned.transactions.filter((t) =>
        changeIds.has(t.id),
      )) {
        if (x.action === "category")
          transaction({
            ...row,
            id: row.id,
            amount: row.amount_cents / 100,
            category_id: row.category_id,
            reviewed: !!row.reviewed,
          });
        else run("UPDATE transactions SET reviewed=1 WHERE id=?", row.id);
      }
    }
    return {
      count: changes.length,
      before_cents: before,
      after_cents: after,
      difference_cents: after - before,
      token,
    };
  }
  function removeRecurrence(x) {
    const id = Number(x.id);
    if (
      !Number.isSafeInteger(id) ||
      !q("SELECT id FROM recurrences WHERE id=?", id).length
    )
      throw Error("Récurrence introuvable.");
    // Keep paid-occurrence links: removing them can change historical category coverage.
    run("UPDATE recurrences SET active=0,dirty=1 WHERE id=?", id);
    put("removed_recurrence_ids", [
      ...new Set([...setting("removed_recurrence_ids", []), id]),
    ]);
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
    if (x.remember_rule) {
      if (
        x.occurrence ||
        (old &&
          q(
            "SELECT 1 FROM occurrence_states WHERE status='paid' AND transaction_id=?",
            old.id,
          ).length)
      )
        throw Error(
          "Créez les règles depuis une opération sans lien de facture.",
        );
      const remembered = q(
        "SELECT * FROM rules WHERE active=1 AND match_type='contains' AND account_id IS NULL AND category_id=? AND direction=?",
        cat,
        amount < 0 ? "expense" : "income",
      ).some(
        (r) =>
          r.min_cents === null &&
          r.max_cents === null &&
          normalizeMerchant(r.pattern) === normalizeMerchant(x.description),
      );
      if (!remembered)
        classificationRule({
          pattern: x.description,
          match_type: "contains",
          priority: 100,
          direction: amount < 0 ? "expense" : "income",
          category_id: cat,
          active: true,
        });
    }
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
        "UPDATE transactions SET account_id=?,category_id=?,description=?,amount_cents=?,date=?,period_on=?,included=?,settled_cents=?,reviewed=?,dirty=1 WHERE id=?",
        ...values,
        settled,
        x.reviewed === undefined ? old.reviewed : x.reviewed ? 1 : 0,
        old.id,
      );
      return old.id;
    }
    const id = Number(
      run(
        "INSERT INTO transactions(seq,account_id,category_id,description,amount_cents,date,period_on,included,settled_cents,reviewed) VALUES(?,?,?,?,?,?,?,?,?,?)",
        sequence(),
        ...values,
        settled,
        x.reviewed === false ? 0 : 1,
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
    if (x.action && !["update", "delete"].includes(x.action))
      throw Error("Action de virement invalide.");
    const old = x.id
      ? q("SELECT * FROM transfers WHERE id=?", Number(x.id))[0]
      : null;
    if ((x.id || x.action === "delete" || x.action === "update") && !old)
      throw Error("Virement introuvable.");
    if (x.action === "delete") {
      run(
        "UPDATE occurrence_states SET status='postponed',transfer_id=NULL WHERE transfer_id=?",
        old.id,
      );
      run("DELETE FROM transfers WHERE id=?", old.id);
      return old.id;
    }
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
    if (old) {
      if (
        (old.from_account_id !== from.id || old.to_account_id !== to.id) &&
        q("SELECT 1 FROM occurrence_states WHERE transfer_id=?", old.id).length
      )
        throw Error(
          "Ce virement règle une échéance : conservez ses comptes, ou supprimez-le pour rouvrir l’échéance avant de le recréer.",
        );
      run(
        "UPDATE transfers SET from_account_id=?,to_account_id=?,amount_cents=?,date=?,description=?,included=?,dirty=1 WHERE id=?",
        from.id,
        to.id,
        amount,
        on,
        name(x.description || old.description),
        x.included === undefined ? old.included : x.included ? 1 : 0,
        old.id,
      );
      return old.id;
    }
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
    if (x.action === "set_amount" || x.action === "reset_amount") {
      const base = q(
        "SELECT amount_cents FROM recurrences WHERE id=?",
        o.rule_id,
      )[0].amount_cents;
      const amount = x.action === "reset_amount" ? base : cents(x.amount);
      if (amount <= 0) throw Error("Indiquez un montant prévu positif.");
      run(
        "INSERT INTO occurrence_states(rule_id,original_on,status,amount_cents) VALUES(?,?,'postponed',?) ON CONFLICT(rule_id,original_on) DO UPDATE SET amount_cents=excluded.amount_cents",
        o.rule_id,
        o.original_on,
        amount === base ? null : amount,
      );
    } else if (x.action === "postpone") {
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
    if (a.kind !== "bank") throw Error("Choisissez un compte bancaire.");
    const amount = cents(x.amount),
      difference = amount - bankBalance(store.state(), a.id);
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
    put("weekly_rollover_from", clock());
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
      version: "1.1.0",
      configured: setting("configured", false),
      theme: "system",
      simulation,
      balance_verified_on:
        data.checkpoints
          .filter(
            (c) => c.account_id === data.accounts.find((a) => a.is_main)?.id,
          )
          .sort((a, b) => b.seq - a.seq)[0]?.date || null,
      account_balances: data.accounts
        .filter((a) => a.kind === "bank")
        .map((a) => ({ id: a.id, balance_cents: bankBalance(data, a.id) })),
      last_import: lastImport,
      review_count: data.transactions.filter((t) => !t.reviewed).length,
      review_rule_ids: data.transactions
        .filter(
          (t) =>
            !t.reviewed && matchingRule(data, t)?.category_id === t.category_id,
        )
        .map((t) => t.id),
      shared_enabled: !!setting("share_token"),
      removed_recurrence_ids: setting("removed_recurrence_ids", []),
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
    previewRecurrence,
    removeRecurrence,
    classify,
    classificationRule,
    deleteClassificationRule,
    reviewBatch,
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
