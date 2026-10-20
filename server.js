import { readJson, isJsonRequest } from "./http-body.js";
import { securityHeaders, authorizeRequest } from "./http-security.js";
import { createReadRoutes } from "./routes-read.js";
import { assetName, mime } from "./http-assets.js";
import {
  lastWeekday,
  easter,
  holidaySet,
  nonBusiness,
  shiftDate,
  occurrenceInfo,
  nextOccurrence,
} from "./recurrence-calendar.js";
import { createAccountsRoutes } from "./routes-accounts.js";
import { createEnvelopesRoutes } from "./routes-envelopes.js";
import { createTransactionsRoutes } from "./routes-transactions.js";
import { createTransfersRoutes } from "./routes-transfers.js";
import { createPlanningRoutes } from "./routes-planning.js";
import { createRecurrencesRoutes } from "./routes-recurrences.js";
import { openBudgetDatabase } from "./database.js";
import { createProWorkspace } from "./pro-workspace.js";
import { createBudgetTools80 } from "./budget-tools-v80.js";
import { createGlobalBudget } from "./global-budget.js";
import {
  cardEnvelopeTotal,
  earlyEnvelopePurchases,
} from "./card-envelope-funds.js";
import { createBudgetBanking } from "./budget-banking.js";
import { createBudgetJourney } from "./budget-journey.js";
import { createDemoWorkspace } from "./demo-workspace.js";
import { fileURLToPath } from "node:url";
import { envelopeBudgetDates } from "./budget-schedule.js";
import { createMonthlyBudget } from "./monthly-budget.js";
import { createBudgetLife } from "./budget-life.js";
import { createDashboardLayout } from "./dashboard-layout.js";
import { createCategoryTools } from "./category-tools.js";
import { createEnvelopeTools } from "./envelope-tools.js";
import { createFreeBudgets } from "./free-budgets.js";
import { createSupport } from "./budget-support.js";
import http from "node:http";
import { createCardPayments } from "./card-payments.js";
import { loadPrivateAccess } from "./private-access.js";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createPlanningActions } from "./planning-actions.js";
import { buildForecast } from "./forecast-engine.js";
import { createFeatures } from "./budget-features.js";
import fs from "node:fs";
import path from "node:path";

const HOST = "127.0.0.1",
  PORT = Number(process.env.PORT || 3030);
const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const privateAccess = loadPrivateAccess(dir, PORT);
const databasePath = path.join(dir, "budget.sqlite"),
  initialDemo = process.env.BUDGET_DEMO === "1" && !fs.existsSync(databasePath);

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const { db, q, run, atomic } = openBudgetDatabase(dir, todayLocal());

const cents = (v) =>
  typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100000000
    ? Math.round(v * 100)
    : null;
const reply = (r, status, o) => {
  if (r.budgetBefore && status === 200) {
    support.recordUndo(r.budgetBefore, r.budgetRoute);
    if (o.accounts) o.support41 = support.state();
    else if (o.state) o.state.support41 = support.state();
  }
  r.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  r.end(JSON.stringify(o));
};
const validDate = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
const dateFrom = (s) => new Date(s + "T12:00:00Z"),
  iso = (d) => d.toISOString().slice(0, 10);
const features = createFeatures({
  db,
  dir,
  cents,
  validDate,
  today: todayLocal,
  atomic,
  addTransaction,
});
const planningActions = createPlanningActions({
  db,
  snapshot,
  atomic,
  addTransaction,
  validateTransfer,
  accountEffect,
  cents,
  validDate,
  today: todayLocal,
  applyTransferEnvelope,
  prepareConfirmation: (row, amount) => journey.confirmationLink(row, amount),
  confirmFunding: (link, id, amount) => journey.confirmLink(link, id, amount),
});
const cardPayments = createCardPayments({
  db,
  cents,
  validDate,
  today: todayLocal,
  atomic,
});
const freeBudgets = createFreeBudgets({
  db,
  atomic,
  cents,
  today: todayLocal,
  exportBackup: features.exportBackup,
  forecastInput,
  buildForecast,
});
const envelopeTools = createEnvelopeTools({
  db,
  atomic,
  cents,
  validDate,
  today: todayLocal,
  exportBackup: features.exportBackup,
  forecastInput,
  buildForecast,
});
const categoryTools = createCategoryTools({
  db,
  atomic,
  exportBackup: features.exportBackup,
  today: todayLocal,
});
const dashboardLayout = createDashboardLayout({ db, atomic });
const budgetLife = createBudgetLife({
  db,
  atomic,
  cents,
  validDate,
  today: todayLocal,
  exportBackup: features.exportBackup,
  forecastInput,
  buildForecast,
});
const monthlyBudget = createMonthlyBudget({
  db,
  atomic,
  cents,
  today: todayLocal,
  exportBackup: features.exportBackup,
  forecastInput,
  buildForecast,
  nextOccurrence,
  occurrenceInfo,
  catalog: categoryTools.catalog,
});
const globalBudget = createGlobalBudget({
  db,
  atomic,
  cents,
  today: todayLocal,
  exportBackup: features.exportBackup,
  legacy: monthlyBudget,
  nextOccurrence,
});
const support = createSupport({
  db,
  dir,
  features,
  today: todayLocal,
  cents,
  validDate,
  validateScenario: simulateBudget,
});
const journey = createBudgetJourney({
  db,
  dir,
  atomic,
  features,
  today: todayLocal,
  snapshot,
  support,
  similarDescription,
  demo: process.env.BUDGET_DEMO === "1",
});
const tools80 = createBudgetTools80({
  db,
  atomic,
  cents,
  features,
  categoryTools,
  forecastInput,
  buildForecast,
  restoreEnvelope,
  applyEnvelope,
  allowanceCoverage,
  journey,
  support,
});
const proWorkspace = createProWorkspace({
  db,
  today: todayLocal,
  support,
  forecast: () => buildForecast(forecastInput()),
});
const demonstration =
  process.env.BUDGET_DEMO === "1"
    ? null
    : createDemoWorkspace({ dir, serverFile: fileURLToPath(import.meta.url) });
const banking = createBudgetBanking({
  db,
  atomic,
  features,
  journey,
  snapshot,
});
if (initialDemo) journey.seedDemo();
if (process.env.BUDGET_DEMO === "1" && process.send)
  process.on("disconnect", () => process.exit(0));
support.dailyBackup();
setInterval(() => support.dailyBackup(), 60000).unref();
const featureRoutes = new Set([
  "/api/categories",
  "/api/categories/update",
  "/api/category-budget",
  "/api/goals",
  "/api/goals/delete",
  "/api/balance/reconcile",
  "/api/import/inspect",
  "/api/import/preview",
  "/api/import/commit",
  "/api/backup/validate",
  "/api/backup/restore",
]);

// Fréquence « dernier jour ouvrable » : lundi à vendredi, sans jours fériés.
// L'ancienne fréquence « rrq » reste acceptée pour conserver les règles existantes.

// Calendrier de jours fériés courants au Québec/Canada, calculé localement.
// Les conventions particulières de chaque institution doivent être vérifiées.

// v1.6 : rapprochement conservateur des opérations déjà saisies.
// Ne modifie pas les comptes : les opérations réelles sont déjà reflétées dans leurs soldes.
// Rapproche seulement si compte, montant, description et date concordent sans ambiguïté.
const dayDistance = (a, b) => Math.abs((dateFrom(a) - dateFrom(b)) / 86400000);
const words = (s) =>
  new Set(
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(
        (w) =>
          w.length >= 3 &&
          ![
            "paiement",
            "virement",
            "facture",
            "prelevement",
            "automatique",
            "vers",
            "pour",
            "compte",
          ].includes(w),
      ),
  );
function similarDescription(a, b) {
  const x = words(a),
    y = words(b);
  if (!x.size || !y.size) return false;
  return [...x].some((w) => y.has(w));
}
// Les indicateurs sont prudents : minimum projeté sur la période, pas la somme des mouvements.
// La paie est le prochain revenu récurrent versé dans un compte bancaire inclus.
function spendingWindows(accounts, recurring, days, currentSafe) {
  const now = new Date(),
    weekday = now.getDay();
  const daysUntilSunday = (7 - weekday) % 7;
  const week = days.slice(0, daysUntilSunday + 1);
  const minimum = (arr) =>
    Math.min(currentSafe, ...arr.map((d) => d.safe_cents));
  let nextPayIndex = -1,
    payNames = [];
  for (let i = 0; i < days.length; i++) {
    const payEvents = days[i].events.filter(
      (ev) =>
        ev.type === "income" &&
        ev.amount_cents > 0 &&
        accounts.some(
          (a) => a.id === ev.account_id && a.included && a.kind !== "credit",
        ),
    );
    if (payEvents.length) {
      nextPayIndex = i;
      payNames = payEvents.map((e) => e.description);
      break;
    }
  }
  // On s'arrête la veille de la paie pour ne pas dépenser prématurément le revenu futur.
  const beforePay = nextPayIndex < 0 ? null : days.slice(0, nextPayIndex);
  return {
    today_cents: currentSafe,
    week_cents: minimum(week),
    week_end: week.at(-1)?.date || null,
    payday_cents: beforePay === null ? null : minimum(beforePay),
    payday_date: nextPayIndex < 0 ? null : days[nextPayIndex].date,
    payday_names: payNames,
    payday_found: nextPayIndex >= 0,
  };
}
function applyEnvelopeRenewals() {
  const pending = JSON.parse(
    q("SELECT value FROM app_settings WHERE key='envelope_advances_v73'")[0]
      ?.value || "{}",
  );
  for (const id of Object.keys(pending))
    if (q("SELECT 1 FROM envelopes WHERE id=?", Number(id)).length)
      recordEnvelopeAdvance(Number(id), 0);
  const today = todayLocal();
  const activation = db
    .prepare("SELECT value FROM app_settings WHERE key='renewal_activation'")
    .get().value;
  const envelopes = q(
    "SELECT * FROM envelopes WHERE active=1 AND frequency!='none' AND start_on IS NOT NULL",
  ).map(monthlyBudget.enrichEnvelope);
  db.exec("BEGIN");
  try {
    for (const e of envelopes) {
      const initial = e.start_on > activation ? e.start_on : activation,
        lookback = new Date(Date.parse(today + "T12:00:00Z") - 400 * 86400000)
          .toISOString()
          .slice(0, 10),
        start = e.budget_schedules && initial < lookback ? lookback : initial;
      if (start > today) continue;
      // Only evaluate dates from activation onward. Max 400 days protects startup time.
      const since = new Date(start + "T12:00:00Z"),
        end = new Date(today + "T12:00:00Z");
      if ((end - since) / 86400000 > 400) continue;
      for (const occurrence of envelopeBudgetDates(
        e,
        start,
        today,
        nextOccurrence,
      )) {
        const date = occurrence.date;
        const existing = db
          .prepare(
            "SELECT 1 FROM envelope_renewal_log WHERE envelope_id=? AND occurrence_on=?",
          )
          .get(e.id, date);
        if (existing) continue;
        const current = db
          .prepare("SELECT reserved_cents FROM envelopes WHERE id=?")
          .get(e.id).reserved_cents;
        const budget =
          db
            .prepare(
              "SELECT budget_cents FROM envelope_budget_overrides WHERE envelope_id=? AND occurrence_on=?",
            )
            .get(e.id, date)?.budget_cents ?? occurrence.amount_cents;
        const early = q(
            "SELECT amount_cents,envelope_effect_cents FROM account_transfers WHERE envelope_id=? AND envelope_on=? AND happened_on<?",
            e.id,
            date,
            date,
          ).reduce(
            (n, t) =>
              n +
              Math.max(
                0,
                t.amount_cents -
                  (e.rollover ? t.envelope_effect_cents || 0 : 0),
              ),
            0,
          ),
          remaining = Math.max(0, budget - early);
        const cardEarly = earlyEnvelopePurchases(
            {
              accounts: q("SELECT * FROM accounts"),
              transactions: q("SELECT * FROM transactions"),
              envelopeLinks: q("SELECT * FROM envelope_actual_links"),
            },
            e,
            date,
          ),
          allocation = Math.max(0, remaining - cardEarly);
        const advance = e.advance_funding?.[date],
          credit = advance?.amount_cents || 0,
          kept = Math.min(current, advance?.remaining_cents || 0),
          overlap = e.rollover ? 0 : credit - kept,
          addition = Math.max(
            0,
            budget - credit - Math.max(0, early + cardEarly - overlap),
          );
        const updated = advance
          ? e.rollover
            ? current + addition
            : kept + addition
          : e.rollover
            ? current + allocation
            : allocation;
        run("UPDATE envelopes SET reserved_cents=? WHERE id=?", updated, e.id);
        run(
          "INSERT INTO envelope_renewal_log(envelope_id,occurrence_on,applied_cents) VALUES(?,?,?)",
          e.id,
          date,
          updated - current,
        );
        if (advance) {
          const data = JSON.parse(
            q(
              "SELECT value FROM app_settings WHERE key='envelope_advances_v73'",
            )[0]?.value || "{}",
          );
          delete data[e.id]?.[date];
          if (!Object.keys(data[e.id] || {}).length) delete data[e.id];
          run(
            "UPDATE app_settings SET value=? WHERE key='envelope_advances_v73'",
            JSON.stringify(data),
          );
        }
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
// Advances belong to the next unapplied scheduled allocation, not to a second expense.
function recordEnvelopeAdvance(id, delta) {
  const e = monthlyBudget.enrichEnvelope(
    q("SELECT * FROM envelopes WHERE id=?", id)[0],
  );
  if (!e.active || e.frequency === "none" || !e.start_on) return;
  const data = JSON.parse(
      q("SELECT value FROM app_settings WHERE key='envelope_advances_v73'")[0]
        ?.value || "{}",
    ),
    entries = data[id] || {};
  if (!delta && !Object.keys(entries).length) return;
  const from = [todayLocal(), ...Object.keys(entries)].sort()[0],
    end = new Date(Date.parse(todayLocal() + "T12:00:00Z") + 740 * 86400000)
      .toISOString()
      .slice(0, 10),
    dates = envelopeBudgetDates(e, from, end, nextOccurrence),
    next = dates.find(
      (d) =>
        d.date >= todayLocal() &&
        !q(
          "SELECT 1 FROM envelope_renewal_log WHERE envelope_id=? AND occurrence_on=?",
          id,
          d.date,
        ).length,
    );
  // Changing the schedule must carry the advance to its new next due date.
  if (next)
    for (const date of Object.keys(entries))
      if (!dates.some((d) => d.date === date)) {
        const a = entries[date];
        delete entries[date];
        const b = entries[next.date];
        if (b) {
          const oldest = a.transaction_id <= b.transaction_id ? a : b;
          entries[next.date] = {
            ...oldest,
            amount_cents: a.amount_cents + b.amount_cents,
          };
        } else entries[next.date] = a;
      }
  if (delta > 0) {
    if (!next) return;
    const a = entries[next.date] || {
      amount_cents: 0,
      prior_cents: Math.max(0, e.reserved_cents - delta),
      transaction_id: q("SELECT COALESCE(MAX(id),0) id FROM transactions")[0]
        .id,
      transfer_id: q("SELECT COALESCE(MAX(id),0) id FROM account_transfers")[0]
        .id,
    };
    a.amount_cents += delta;
    entries[next.date] = a;
  } else if (delta < 0) {
    let release = -delta;
    for (const date of Object.keys(entries).sort().reverse()) {
      if (date <= todayLocal() || !release) continue;
      const amount = Math.min(release, entries[date].amount_cents);
      entries[date].amount_cents -= amount;
      release -= amount;
      if (!entries[date].amount_cents) delete entries[date];
    }
  }
  data[id] = entries;
  const serialized = JSON.stringify(data);
  if (serialized.length > 95000) throw Error("Trop d’avances en attente.");
  if (
    serialized ===
    (q("SELECT value FROM app_settings WHERE key='envelope_advances_v73'")[0]
      ?.value || "{}")
  )
    return;
  run(
    "INSERT INTO app_settings(key,value) VALUES('envelope_advances_v73',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    serialized,
  );
}
function forecastInput() {
  const accounts = q("SELECT * FROM accounts ORDER BY id DESC"),
    envelopes = q("SELECT * FROM envelopes ORDER BY id DESC").map(
      monthlyBudget.enrichEnvelope,
    ),
    recurring = [
      ...q("SELECT * FROM recurring ORDER BY id DESC").map(
        monthlyBudget.enrich,
      ),
      ...budgetLife.virtualRules(),
    ],
    overrides = q(
      "SELECT * FROM recurring_overrides ORDER BY occurrence_on,id",
    ),
    manual = q("SELECT * FROM reconciliation_links"),
    moves = q("SELECT * FROM recurring_moves"),
    envelopeOverrides = q(
      "SELECT * FROM envelope_budget_overrides ORDER BY occurrence_on",
    );
  return {
    fundingLinks: journey.forecastLinks(),
    accounts,
    envelopes,
    recurring,
    cardPaymentPlans: q("SELECT * FROM card_payment_plans"),
    overrides,
    moves,
    links: manual,
    transactions: q("SELECT * FROM transactions"),
    transfers: q("SELECT * FROM account_transfers"),
    periods: q("SELECT * FROM envelope_period_status"),
    envelopeMoves: q("SELECT * FROM envelope_occurrence_moves"),
    envelopeLinks: q("SELECT * FROM envelope_actual_links"),
    renewals: q("SELECT * FROM envelope_renewal_log"),
    envelopeOverrides,
    today: todayLocal(),
    since:
      db
        .prepare(
          "SELECT value FROM app_settings WHERE key='forecast_tracking_since'",
        )
        .get()?.value || todayLocal(),
    horizon: 90,
    nextOccurrence,
    occurrenceInfo,
    similarDescription,
  };
}
function snapshot() {
  applyEnvelopeRenewals();
  const accounts = q("SELECT * FROM accounts ORDER BY id DESC"),
    envelopes = q("SELECT * FROM envelopes ORDER BY id DESC"),
    recurring = q("SELECT * FROM recurring ORDER BY id DESC"),
    overrides = q(
      "SELECT * FROM recurring_overrides ORDER BY occurrence_on,id",
    );
  const cash = accounts
      .filter((a) => a.kind !== "credit" && a.included)
      .reduce((s, a) => s + a.balance_cents, 0),
    envelopeReserved = envelopes.reduce((s, e) => s + e.reserved_cents, 0),
    cardReserved = cardEnvelopeTotal({
      accounts,
      envelopes,
      transactions: q("SELECT * FROM transactions"),
      transfers: q("SELECT * FROM account_transfers"),
      today: todayLocal(),
    }),
    reserved = envelopeReserved + cardReserved;
  const manual = q("SELECT * FROM reconciliation_links");
  const envelopeOverrides = q(
      "SELECT * FROM envelope_budget_overrides ORDER BY occurrence_on",
    ),
    moves = q("SELECT * FROM recurring_moves");
  const simulation = buildForecast(forecastInput());
  const budgetConfig = monthlyBudget.config();
  for (const row of simulation.rows) {
    if (row.source === "recurring")
      row.category_id = budgetConfig.recurring[row.recurring_id] || null;
  }
  for (const row of simulation.rows)
    row.signature = createHash("sha256")
      .update(JSON.stringify(row))
      .digest("hex");
  const projected = simulation.days;
  const windows = spendingWindows(
    accounts,
    recurring,
    projected.slice(0, 30),
    cash - reserved,
  );
  const envelopeDetails = envelopes.map((raw) => {
    const e = monthlyBudget.enrichEnvelope(raw);
    const next = (() => {
      if (!e.active || e.frequency === "none" || !e.start_on) return null;
      if (e.budget_schedules)
        return (
          envelopeBudgetDates(
            e,
            todayLocal(),
            new Date(Date.parse(todayLocal() + "T12:00:00Z") + 400 * 86400000)
              .toISOString()
              .slice(0, 10),
            nextOccurrence,
          ).find(
            (d) =>
              !q(
                "SELECT 1 FROM envelope_renewal_log WHERE envelope_id=? AND occurrence_on=?",
                e.id,
                d.date,
              ).length,
          )?.date || null
        );
      for (let i = 0; i < 1500; i++) {
        const d = nextOccurrence(e.start_on, e.frequency, i);
        if (
          d >= todayLocal() &&
          !q(
            "SELECT 1 FROM envelope_renewal_log WHERE envelope_id=? AND occurrence_on=?",
            e.id,
            d,
          ).length
        )
          return d;
      }
      return null;
    })();
    const periodStart = (() => {
      if (!e.start_on || e.frequency === "none") return null;
      if (e.budget_schedules)
        return (
          envelopeBudgetDates(e, e.start_on, todayLocal(), nextOccurrence).at(
            -1,
          )?.date || null
        );
      let last = null;
      for (let i = 0; i < 1500; i++) {
        const d = nextOccurrence(e.start_on, e.frequency, i);
        if (d > todayLocal()) break;
        last = d;
      }
      return last;
    })();
    const spent =
      periodStart === null
        ? 0
        : q(
            "SELECT t.amount_cents FROM transactions t LEFT JOIN envelope_actual_links l ON l.transaction_id=t.id WHERE t.envelope_id=? AND t.happened_on<=? AND t.amount_cents<0 AND ((l.transaction_id IS NOT NULL AND l.occurrence_on=?) OR (l.transaction_id IS NULL AND t.happened_on>=?))",
            e.id,
            todayLocal(),
            periodStart,
            periodStart,
          ).reduce((n, t) => n - t.amount_cents, 0);
    return {
      id: e.id,
      spent_cents: spent,
      available_cents: e.reserved_cents,
      next_renewal: next,
      period_start: periodStart,
    };
  });
  const sts_breakdown = {
    credit: [],
    card_envelopes: simulation.card_envelope_funds.map((f) => ({
      ...f,
      name: envelopes.find((e) => e.id === f.envelope_id)?.name || "Enveloppe",
      card_name:
        accounts.find((a) => a.id === f.card_account_id)?.name || "Carte",
    })),
    accounts: accounts
      .filter((a) => a.kind !== "credit" && a.included)
      .map((a) => ({ name: a.name, balance_cents: a.balance_cents })),
    envelopes: envelopes
      .filter((e) => e.reserved_cents > 0)
      .map((e) => ({ name: e.name, reserved_cents: e.reserved_cents })),
    windows: { week_end: windows.week_end, payday_date: windows.payday_date },
    events: projected.slice(0, 30).flatMap((d) =>
      d.events
        .filter((ev) => ev.sts_impact_cents)
        .map((ev) => ({
          date: d.date,
          description: ev.description,
          impact_cents: ev.sts_impact_cents,
          type: ev.type,
        })),
    ),
  };
  return {
    ...features.state(),
    setup70: journey.state(),
    banking71: banking.state(),
    budget60: budgetConfig,
    support41: support.state(),
    life: budgetLife.state(),
    category_catalog: categoryTools.catalog(),
    dashboard_layout: dashboardLayout.state(),
    free_budgets: freeBudgets.state(),
    envelope_insights: envelopeTools.insights(
      envelopes,
      envelopeDetails,
      simulation,
    ),
    card_payment_plans: q("SELECT * FROM card_payment_plans"),
    planning: {
      envelope_actual_links: q("SELECT * FROM envelope_actual_links"),
      rows: simulation.rows,
      warnings: simulation.warnings,
      since: simulation.since,
    },
    calendar_actuals: q(
      "SELECT t.*,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id ORDER BY happened_on,id",
    ),
    calendar_transfers: q(
      "SELECT * FROM account_transfers ORDER BY happened_on,id",
    ),
    accounts,
    envelopes,
    recurring,
    overrides,
    forecast: projected,
    envelope_details: envelopeDetails,
    envelope_budget_overrides: envelopeOverrides,
    sts_breakdown,
    reconciliation_links: manual,
    recurring_moves: moves,
    reconciliation: {
      matched_count: simulation.rows.filter(
        (r) => r.source === "recurring" && r.status === "actual",
      ).length,
      method:
        "Montant, compte, description et date (±3 jours); correspondances ambiguës ignorées",
    },
    spending_windows: windows,
    transfers: q(
      "SELECT t.*,a.name from_name,b.name to_name FROM account_transfers t JOIN accounts a ON a.id=t.from_account_id JOIN accounts b ON b.id=t.to_account_id ORDER BY t.id DESC LIMIT 30",
    ),
    transactions: q(
      "SELECT t.*,a.name account_name,e.name envelope_name FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN envelopes e ON e.id=t.envelope_id ORDER BY t.id DESC LIMIT 50",
    ),
    cash_cents: cash,
    reserved_cents: reserved,
    envelope_reserved_cents: envelopeReserved,
    card_envelope_reserved_cents: cardReserved,
    credit_reserved_cents: 0,
    safe_cents: cash - reserved,
  };
}
function simulateBudget(x) {
  const args = forecastInput(),
    baseline = buildForecast(args),
    last = baseline.days.at(-1).date;
  const changes = x.kind === "plan" ? x.changes : [x];
  if (!Array.isArray(changes) || !changes.length || changes.length > 10)
    throw Error("Choisissez de 1 à 10 changements par scénario.");
  const moved = new Set();
  for (const [index, item] of changes.entries()) {
    if (!item || !["purchase", "move"].includes(item.kind))
      throw Error("Simulation inconnue.");
    if (item.kind === "move") {
      const row = baseline.rows.find((r) => r.key === item.key);
      if (
        !row ||
        !["recurring", "envelope"].includes(row.source) ||
        !["planned", "pending"].includes(row.status) ||
        !validDate(item.new_on) ||
        item.new_on < args.today ||
        Math.abs(Date.parse(item.new_on) - Date.parse(row.original_on)) >
          90 * 86400000 ||
        item.new_on > last ||
        moved.has(row.key)
      )
        throw Error(
          "Choisissez une échéance prévue distincte et une date dans les 90 prochains jours.",
        );
      moved.add(row.key);
      const list = row.source === "envelope" ? "envelopeMoves" : "moves",
        id = row.source === "envelope" ? "envelope_id" : "recurring_id";
      args[list] = [
        ...args[list].filter(
          (m) => !(m[id] === row[id] && m.occurrence_on === row.original_on),
        ),
        { [id]: row[id], occurrence_on: row.original_on, new_on: item.new_on },
      ];
    } else {
      const amount = cents(item.amount),
        account = args.accounts.find((a) => a.id === Number(item.account_id));
      if (
        !account ||
        amount === null ||
        amount <= 0 ||
        amount > 1e10 ||
        !validDate(item.date) ||
        item.date < args.today ||
        item.date > last
      )
        throw Error(
          "Choisissez un compte, un montant positif et une date dans les 90 prochains jours.",
        );
      args.recurring = [
        ...args.recurring,
        {
          id: -1 - index,
          description: "Simulation · achat supplémentaire",
          type: "expense",
          amount_cents: amount,
          account_id: account.id,
          start_on: item.date,
          frequency: "monthly",
          one_time: 1,
          active: 1,
          day_adjust: "none",
        },
      ];
      args.similarDescription = (a, b) =>
        a === "Simulation · achat supplémentaire"
          ? false
          : similarDescription(a, b);
    }
  }
  const scenario = buildForecast(args);
  return {
    baseline: baseline.days,
    scenario: scenario.days,
    warnings: scenario.warnings,
  };
}

function accountEffect(accountId, amount) {
  const kind = db
    .prepare("SELECT kind FROM accounts WHERE id=?")
    .get(accountId)?.kind;
  if (!kind) throw Error("Compte introuvable");
  return kind === "credit" ? -amount : amount;
}
function restoreEnvelope(id, amount, effect = null) {
  if (id && amount < 0)
    run(
      "UPDATE envelopes SET reserved_cents=reserved_cents+? WHERE id=?",
      effect ?? -amount,
      id,
    );
}
function applyEnvelope(id, amount) {
  if (!id || amount >= 0) return 0;
  const effect = Math.min(
    q("SELECT reserved_cents FROM envelopes WHERE id=?", id)[0].reserved_cents,
    -amount,
  );
  run(
    "UPDATE envelopes SET reserved_cents=reserved_cents-? WHERE id=?",
    effect,
    id,
  );
  return effect;
}
function validateTransaction(x, old = null) {
  const account = Number(x.account_id),
    envelope = x.envelope_id ? Number(x.envelope_id) : null,
    amount = cents(x.amount);
  const description =
    typeof x.description === "string" ? x.description.trim() : "";
  if (
    !Number.isInteger(account) ||
    !db.prepare("SELECT id FROM accounts WHERE id=?").get(account) ||
    amount === null ||
    !amount ||
    !description ||
    description.length > 150 ||
    !validDate(x.happened_on) ||
    (envelope !== null &&
      !db.prepare("SELECT id FROM envelopes WHERE id=?").get(envelope)) ||
    (envelope !== null && amount > 0)
  )
    throw Error("Transaction invalide");
  const category = features.categoryId(
      x.category_id,
      old && Number(x.category_id) === old.category_id,
    ),
    subcategory = categoryTools.subcategoryId(
      x.subcategory_id,
      category,
      old &&
        Number(x.subcategory_id) === old.subcategory_id &&
        category === old.category_id,
    );
  return {
    account,
    envelope,
    amount,
    description,
    date: x.happened_on,
    category,
    subcategory,
  };
}
function addTransaction(
  x,
  { affectsBalance = true, importBatch = null, coveredCents = 0 } = {},
) {
  if (Number(x.amount) < 0 && x.category_id && !x.envelope_id)
    x = { ...x, envelope_id: monthlyBudget.envelopeForCategory(x.category_id) };
  const t = validateTransaction(x);
  if (!coveredCents)
    coveredCents = Math.max(
      journey.coveredForTransaction(t),
      allowanceCoverage(t),
    );
  const effect = affectsBalance
    ? applyEnvelope(
        t.envelope,
        t.amount < 0 ? t.amount + Math.min(-t.amount, coveredCents) : t.amount,
      )
    : 0;
  const result = run(
    "INSERT INTO transactions(account_id,envelope_id,amount_cents,description,happened_on,category_id,subcategory_id,import_batch_id,affects_balance,envelope_effect_cents) VALUES(?,?,?,?,?,?,?,?,?,?)",
    t.account,
    t.envelope,
    t.amount,
    t.description,
    t.date,
    t.category,
    t.subcategory,
    importBatch,
    affectsBalance ? 1 : 0,
    effect,
  );
  if (affectsBalance)
    run(
      "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
      accountEffect(t.account, t.amount),
      t.account,
    );
  return Number(result.lastInsertRowid);
}
function validateTransfer(x) {
  const from = Number(x.from_account_id),
    to = Number(x.to_account_id),
    amount = cents(x.amount),
    description = String(x.description || "").trim();
  if (
    !db.prepare("SELECT id FROM accounts WHERE id=?").get(from) ||
    !db.prepare("SELECT id FROM accounts WHERE id=?").get(to) ||
    from === to ||
    amount === null ||
    amount <= 0 ||
    !description ||
    description.length > 150 ||
    !validDate(x.happened_on)
  )
    throw Error("Virement invalide");
  return { from, to, amount, description, date: x.happened_on };
}
function validateTransferEnvelope(x, from, to) {
  const id = x.envelope_id ? Number(x.envelope_id) : null;
  if (!id) return null;
  const source = q("SELECT * FROM accounts WHERE id=?", from)[0],
    target = q("SELECT * FROM accounts WHERE id=?", to)[0];
  if (
    !q("SELECT 1 FROM envelopes WHERE id=?", id).length ||
    !source?.included ||
    source.kind === "credit" ||
    target?.included ||
    target?.kind === "credit" ||
    x.funding_answer === "yes"
  )
    throw Error(
      "Une enveloppe de virement utilise un compte inclus en source et un compte personnel exclu en destination, sans autre lien de financement.",
    );
  return id;
}
function transferPeriod(id, date) {
  const e = q("SELECT * FROM envelopes WHERE id=?", id)[0];
  if (!e?.start_on || e.frequency === "none") return date;
  const dates = envelopeBudgetDates(
    monthlyBudget.enrichEnvelope(e),
    e.start_on,
    date,
    nextOccurrence,
  );
  return dates.at(-1)?.date || e.start_on;
}
function allowanceCoverage(t, ignoreId = null) {
  if (t.amount >= 0 || !t.envelope) return 0;
  const account = q("SELECT * FROM accounts WHERE id=?", t.account)[0];
  if (!account) return 0;
  const e = q(
    "SELECT forecast_spend,forecast_account_id FROM envelopes WHERE id=?",
    t.envelope,
  )[0];
  if (
    e?.forecast_spend &&
    account.kind === "credit" &&
    q(
      "SELECT 1 FROM accounts WHERE id=? AND kind!='credit' AND included=0",
      e.forecast_account_id,
    ).length &&
    q("SELECT 1 FROM accounts WHERE kind!='credit' AND included=1").length === 1
  )
    return -t.amount;
  if (account.included || account.kind === "credit") return 0;
  if (e?.forecast_spend && e.forecast_account_id === t.account)
    return -t.amount;
  const funded = q(
      "SELECT COALESCE(SUM(amount_cents),0) n FROM account_transfers WHERE envelope_id=? AND to_account_id=? AND happened_on<=?",
      t.envelope,
      t.account,
      t.date,
    )[0].n,
    spent = q(
      "SELECT COALESCE(SUM(-amount_cents),0) n FROM transactions WHERE envelope_id=? AND account_id=? AND amount_cents<0 AND happened_on<=? AND id!=?",
      t.envelope,
      t.account,
      t.date,
      ignoreId || -1,
    )[0].n;
  return Math.min(-t.amount, Math.max(0, funded - spent));
}
function applyTransferEnvelope(id, envelope, amount, date, period = null) {
  if (!envelope) return;
  const on = period || transferPeriod(envelope, date),
    effect = applyEnvelope(envelope, -amount);
  run(
    "UPDATE account_transfers SET envelope_id=?,envelope_effect_cents=?,envelope_on=? WHERE id=?",
    envelope,
    effect,
    on,
    id,
  );
}
function detachTransferEnvelope(old) {
  if (!old.envelope_id) return;
  if (old.envelope_effect_cents)
    run(
      "UPDATE envelopes SET reserved_cents=reserved_cents+? WHERE id=?",
      old.envelope_effect_cents,
      old.envelope_id,
    );
  if (old.envelope_on)
    run(
      "DELETE FROM envelope_period_status WHERE envelope_id=? AND occurrence_on=?",
      old.envelope_id,
      old.envelope_on,
    );
}

function detachEnvelopeActual(id) {
  const link = db
    .prepare("SELECT * FROM envelope_actual_links WHERE transaction_id=?")
    .get(id);
  if (!link) return;
  run("DELETE FROM envelope_actual_links WHERE transaction_id=?", id);
  if (
    !q(
      "SELECT 1 FROM envelope_actual_links WHERE envelope_id=? AND occurrence_on=?",
      link.envelope_id,
      link.occurrence_on,
    ).length
  )
    run(
      "DELETE FROM envelope_period_status WHERE envelope_id=? AND occurrence_on=?",
      link.envelope_id,
      link.occurrence_on,
    );
}
function transactionChange(x, remove = false) {
  const id = Number(x.id),
    old = db.prepare("SELECT * FROM transactions WHERE id=?").get(id);
  if (!old) throw Error("Transaction introuvable");
  const updated = remove
    ? null
    : validateTransaction(
        {
          ...x,
          category_id:
            x.category_id === undefined ? old.category_id : x.category_id,
          subcategory_id:
            x.subcategory_id === undefined
              ? x.category_id === undefined ||
                Number(x.category_id) === old.category_id
                ? old.subcategory_id
                : null
              : x.subcategory_id,
        },
        old,
      );
  atomic(() => {
    if (
      updated &&
      old.account_id === updated.account &&
      old.envelope_id === updated.envelope &&
      old.amount_cents === updated.amount
    ) {
      if (updated.date !== old.happened_on)
        run(
          "DELETE FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?",
          id,
        );
      run(
        "UPDATE transactions SET description=?,happened_on=?,category_id=?,subcategory_id=? WHERE id=?",
        updated.description,
        updated.date,
        updated.category,
        updated.subcategory,
        id,
      );
      return;
    }
    if (old.affects_balance)
      run(
        "UPDATE accounts SET balance_cents=balance_cents-? WHERE id=?",
        accountEffect(old.account_id, old.amount_cents),
        old.account_id,
      );
    restoreEnvelope(
      old.envelope_id,
      old.amount_cents,
      old.envelope_effect_cents,
    );
    if (remove) {
      detachEnvelopeActual(id);
      run(
        "DELETE FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?",
        id,
      );
      run("DELETE FROM transactions WHERE id=?", id);
    } else {
      if (updated.envelope !== old.envelope_id) detachEnvelopeActual(id);
      if (
        updated.account !== old.account_id ||
        updated.date !== old.happened_on ||
        updated.envelope !== old.envelope_id ||
        Math.sign(updated.amount) !== Math.sign(old.amount_cents)
      )
        run(
          "DELETE FROM reconciliation_links WHERE actual_type='transaction' AND actual_id=?",
          id,
        );
      run(
        "UPDATE transactions SET account_id=?,envelope_id=?,amount_cents=?,description=?,happened_on=? WHERE id=?",
        updated.account,
        updated.envelope,
        updated.amount,
        updated.description,
        updated.date,
        id,
      );
      if (old.affects_balance)
        run(
          "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
          accountEffect(updated.account, updated.amount),
          updated.account,
        );
      const effect = old.affects_balance
        ? applyEnvelope(
            updated.envelope,
            updated.amount + allowanceCoverage(updated, id),
          )
        : 0;
      run(
        "UPDATE transactions SET category_id=?,subcategory_id=?,envelope_effect_cents=? WHERE id=?",
        updated.category,
        updated.subcategory,
        effect,
        id,
      );
    }
  });
}
function transferChange(x, remove = false) {
  const id = Number(x.id),
    old = db.prepare("SELECT * FROM account_transfers WHERE id=?").get(id);
  if (!old) throw Error("Virement introuvable");
  if (!remove && journey.hasActualLink(id))
    throw Error(
      "Retirez d’abord l’association de financement dans Bien démarrer avant de modifier ce virement.",
    );
  const updated = remove ? null : validateTransfer(x);
  const envelope = updated
    ? validateTransferEnvelope(
        {
          ...x,
          envelope_id:
            x.envelope_id === undefined ? old.envelope_id : x.envelope_id,
        },
        updated.from,
        updated.to,
      )
    : null;
  atomic(() => {
    if (
      updated &&
      updated.from === old.from_account_id &&
      updated.to === old.to_account_id &&
      updated.amount === old.amount_cents &&
      updated.date === old.happened_on &&
      envelope === old.envelope_id
    ) {
      run(
        "UPDATE account_transfers SET description=? WHERE id=?",
        updated.description,
        id,
      );
      return;
    }
    detachTransferEnvelope(old);
    if (remove && journey.hasActualLink(id)) journey.detachActual(id);
    run(
      "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
      -accountEffect(old.from_account_id, -old.amount_cents),
      old.from_account_id,
    );
    run(
      "UPDATE accounts SET balance_cents=balance_cents-? WHERE id=?",
      accountEffect(old.to_account_id, old.amount_cents),
      old.to_account_id,
    );
    if (remove) {
      run(
        "DELETE FROM reconciliation_links WHERE actual_type='transfer' AND actual_id=?",
        id,
      );
      run("DELETE FROM account_transfers WHERE id=?", id);
    } else {
      if (
        updated.from !== old.from_account_id ||
        updated.to !== old.to_account_id ||
        updated.date !== old.happened_on
      )
        run(
          "DELETE FROM reconciliation_links WHERE actual_type='transfer' AND actual_id=?",
          id,
        );
      run(
        "UPDATE account_transfers SET envelope_id=NULL,envelope_effect_cents=0,envelope_on=NULL,from_account_id=?,to_account_id=?,amount_cents=?,description=?,happened_on=? WHERE id=?",
        updated.from,
        updated.to,
        updated.amount,
        updated.description,
        updated.date,
        id,
      );
      run(
        "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
        accountEffect(updated.from, -updated.amount),
        updated.from,
      );
      run(
        "UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?",
        accountEffect(updated.to, updated.amount),
        updated.to,
      );
      applyTransferEnvelope(
        id,
        envelope,
        updated.amount,
        updated.date,
        old.envelope_id === envelope && old.happened_on === updated.date
          ? old.envelope_on
          : null,
      );
    }
  });
}
const normalizeSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
db.function("budget_search", { deterministic: true }, normalizeSearch);
function listTransactions(url, all = false) {
  const u = new URL(url, "http://localhost"),
    params = u.searchParams,
    where = [],
    args = [];
  if (params.get("search")) {
    where.push("budget_search(t.description) LIKE ? ESCAPE '\\'");
    args.push(
      "%" +
        normalizeSearch(params.get("search").slice(0, 80)).replace(
          /[\\%_]/g,
          (c) => "\\" + c,
        ) +
        "%",
    );
  }
  if (params.get("account")) {
    where.push("t.account_id=?");
    args.push(Number(params.get("account")));
  }
  if (params.get("category") === "uncategorized")
    where.push("t.category_id IS NULL");
  else if (params.get("category")) {
    where.push("t.category_id=?");
    args.push(Number(params.get("category")));
  }
  if (params.get("subcategory")) {
    where.push("t.subcategory_id=?");
    args.push(Number(params.get("subcategory")));
  }
  if (params.get("envelope")) {
    where.push("t.envelope_id=?");
    args.push(Number(params.get("envelope")));
  }
  if (params.get("reviewed") === "0" || params.get("reviewed") === "1") {
    where.push("t.reviewed=?");
    args.push(Number(params.get("reviewed")));
  }
  if (params.get("from") && validDate(params.get("from"))) {
    where.push("t.happened_on>=?");
    args.push(params.get("from"));
  }
  if (params.get("to") && validDate(params.get("to"))) {
    where.push("t.happened_on<=?");
    args.push(params.get("to"));
  }
  if (params.get("kind") === "expense" || params.get("kind") === "income")
    where.push(
      "t.amount_cents" + (params.get("kind") === "expense" ? "<" : ">") + "0",
    );
  const sorts = {
      date: "t.happened_on",
      amount: "t.amount_cents",
      description: "t.description COLLATE NOCASE",
      account: "a.name COLLATE NOCASE",
      category: "COALESCE(c.name,'Non-catégorisé') COLLATE NOCASE",
    },
    order = sorts[params.get("sort")] || sorts.date,
    direction = params.get("direction") === "asc" ? "ASC" : "DESC";
  const filter = where.length ? " WHERE " + where.join(" AND ") : "";
  const totals = db
    .prepare(
      "SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN amount_cents>0 THEN amount_cents ELSE 0 END),0) income_cents,COALESCE(SUM(CASE WHEN amount_cents<0 THEN -amount_cents ELSE 0 END),0) expense_cents,COALESCE(SUM(CASE WHEN reviewed=0 THEN 1 ELSE 0 END),0) pending_count FROM transactions t" +
        filter,
    )
    .get(...args);
  const count = totals.count;
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1)),
    limit = 50;
  const rows = db
    .prepare(
      "SELECT t.*,a.name account_name,e.name envelope_name,COALESCE(c.name,'Non-catégorisé') category_name,s.name subcategory_name FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN envelopes e ON e.id=t.envelope_id LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN subcategories s ON s.id=t.subcategory_id" +
        filter +
        " ORDER BY " +
        order +
        " " +
        direction +
        ",t.id " +
        direction +
        (all ? "" : " LIMIT ? OFFSET ?"),
    )
    .all(...args, ...(all ? [] : [limit, (page - 1) * limit]));
  return {
    rows,
    count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
    summary: {
      ...totals,
      net_cents: totals.income_cents - totals.expense_cents,
    },
  };
}

const sharedAccessFile = path.join(dir, "shared-view.json");
function sharedToken() {
  try {
    const token = JSON.parse(fs.readFileSync(sharedAccessFile, "utf8")).token;
    return typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
      ? token
      : null;
  } catch {
    return null;
  }
}
function sharedPath() {
  const token = sharedToken();
  return token ? "/shared/" + token : null;
}
function sharedSummary() {
  applyEnvelopeRenewals();
  const args = forecastInput(),
    days = buildForecast(args).days,
    cash = args.accounts
      .filter((a) => a.included && a.kind !== "credit")
      .reduce((n, a) => n + a.balance_cents, 0),
    safe =
      cash -
      args.envelopes.reduce((n, e) => n + e.reserved_cents, 0) -
      cardEnvelopeTotal(args),
    point = { date: todayLocal(), cash_cents: cash, safe_cents: safe },
    first = [point, ...days.slice(0, 30)],
    lowest = first.reduce((a, b) => (b.cash_cents < a.cash_cents ? b : a)),
    highest = first.reduce((a, b) => (b.cash_cents > a.cash_cents ? b : a));
  return {
    updated_at: new Date().toISOString(),
    current_safe_cents: safe,
    daily: days.map((d) => ({ date: d.date, safe_cents: d.safe_cents })),
    periods: Object.fromEntries(
      [30, 60, 90].map((n) => {
        const window = [point, ...days.slice(0, n)],
          low = window.reduce((a, b) => (b.safe_cents < a.safe_cents ? b : a)),
          range = (key) => {
            const min = window.reduce((a, b) => (b[key] < a[key] ? b : a)),
              max = window.reduce((a, b) => (b[key] > a[key] ? b : a));
            return {
              lowest: { amount_cents: min[key], on: min.date },
              highest: { amount_cents: max[key], on: max.date },
            };
          };
        return [
          n,
          {
            safe_cents: low.safe_cents,
            on: low.date,
            safe: range("safe_cents"),
          },
        ];
      }),
    ),
    highest_30: { amount_cents: highest.cash_cents, on: highest.date },
    lowest_30: { amount_cents: lowest.cash_cents, on: lowest.date },
  };
}
function sharedPurchase(x) {
  if (
    !x ||
    Array.isArray(x) ||
    Object.keys(x).some((k) => !["amount", "date", "days"].includes(k)) ||
    ![30, 60, 90].includes(x.days) ||
    !validDate(x.date) ||
    x.date < todayLocal() ||
    x.date >
      new Date(
        Date.parse(todayLocal() + "T12:00:00Z") + (x.days - 1) * 86400000,
      )
        .toISOString()
        .slice(0, 10) ||
    cents(x.amount) === null ||
    cents(x.amount) <= 0 ||
    cents(x.amount) > 1e10
  )
    throw Error(
      "Indiquez un montant positif et une date dans la période choisie.",
    );
  const included = q(
      "SELECT * FROM accounts WHERE included=1 AND kind!='credit'",
    ),
    scope = journey.state().scope,
    account = included.find((a) => a.id === scope?.account_id) || included[0];
  if (!account)
    throw Error(
      "Le compte du disponible doit être configuré par le propriétaire.",
    );
  const result = simulateBudget({
    kind: "purchase",
    amount: x.amount,
    date: x.date,
    account_id: account.id,
  });
  return {
    allowed: result.scenario.slice(0, x.days).every((d) => d.safe_cents >= 0),
    days: x.days,
  };
}
const accountsRoutes = createAccountsRoutes({ cents, journey, q, reply, run });
const envelopesRoutes = createEnvelopesRoutes({
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
});
const transactionsRoutes = createTransactionsRoutes({
  addTransaction,
  atomic,
  reply,
  run,
  transactionChange,
});
const transfersRoutes = createTransfersRoutes({
  accountEffect,
  applyTransferEnvelope,
  atomic,
  journey,
  run,
  transferChange,
  validateTransfer,
  validateTransferEnvelope,
});
const planningRoutes = createPlanningRoutes({
  cardPayments,
  dayDistance,
  db,
  occurrenceInfo,
  planningActions,
  reply,
  run,
  todayLocal,
  validDate,
});
const recurrencesRoutes = createRecurrencesRoutes({
  atomic,
  cents,
  journey,
  monthlyBudget,
  occurrenceInfo,
  q,
  reply,
  run,
  validDate,
  validateTransferEnvelope,
});
const readRoutes = createReadRoutes({
  createHash,
  dir,
  features,
  globalBudget,
  journey,
  listTransactions,
  monthlyBudget,
  path,
  privateAccess,
  proWorkspace,
  q,
  reply,
  sharedPath,
  snapshot,
  support,
  todayLocal,
});
const handleRequest = async (req, res) => {
  try {
    securityHeaders(res);
    const viewing = req.url.startsWith("/shared/");
    const accessError = authorizeRequest(req, {
      privateAccess,
      localPort: PORT,
      viewing,
    });
    if (accessError) return reply(res, 403, { error: accessError });
    if (
      process.env.BUDGET_DEMO !== "1" &&
      req.headers["x-budget-workspace"] === "demo" &&
      req.url.startsWith("/api/")
    )
      return reply(res, 409, {
        error:
          "Une requête de démonstration ne peut pas modifier ou lire le budget réel.",
      });
    if (viewing) {
      const match = /^\/shared\/([a-f0-9]{64})(\/(?:data|simulate))?$/.exec(
          req.url,
        ),
        token = sharedToken();
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      if (
        !match ||
        !token ||
        !timingSafeEqual(Buffer.from(match[1]), Buffer.from(token)) ||
        !["GET", "POST"].includes(req.method)
      )
        return reply(res, 403, {
          error: "Lien de consultation invalide ou révoqué.",
        });
      if (match[2] === "/simulate") {
        const origin =
          privateAccess && req.socket.localPort === privateAccess.port
            ? privateAccess.origin
            : "http://" + req.headers.host;
        if (
          req.method !== "POST" ||
          req.headers.origin !== origin ||
          !isJsonRequest(req)
        )
          return reply(res, 403, {
            error: "Simulation JSON depuis votre page de consultation requise.",
          });
        const body = await readJson(req, 2048);
        try {
          return reply(res, 200, sharedPurchase(body));
        } catch (e) {
          return reply(res, 400, {
            error: e instanceof SyntaxError ? "Requête invalide." : e.message,
          });
        }
      }
      if (req.method !== "GET")
        return reply(res, 403, { error: "Consultation seulement." });
      if (match[2] === "/data") return reply(res, 200, sharedSummary());
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(
        fs.readFileSync(new URL("./shared-view.html", import.meta.url)),
      );
    }
    if (req.method === "GET") {
      readRoutes(req, res);
      if (res.writableEnded) return;
    }

    if (req.method === "POST" && req.url === "/api/sharing") {
      const x = await readJson(req, 1024);
      if (!["create", "revoke"].includes(x.action))
        return reply(res, 400, { error: "Action invalide." });
      if (x.action === "revoke") {
        if (fs.existsSync(sharedAccessFile)) fs.unlinkSync(sharedAccessFile);
      } else {
        fs.writeFileSync(
          sharedAccessFile,
          JSON.stringify({ token: randomBytes(32).toString("hex") }),
          { mode: 0o600 },
        );
        fs.chmodSync(sharedAccessFile, 0o600);
      }
      return reply(res, 200, {
        path: sharedPath(),
        origin: privateAccess?.origin || null,
      });
    }

    if (req.url === "/demo" || req.url.startsWith("/demo/")) {
      if (!demonstration)
        return reply(res, 404, { error: "Démonstration déjà ouverte." });
      return await demonstration.proxy(req, res);
    }

    if (req.method === "GET" && assetName(req.url)) {
      const name = assetName(req.url);
      let body;
      try {
        body = fs.readFileSync(new URL("./" + name, import.meta.url));
      } catch (e) {
        if (["ENOENT", "ENOTDIR"].includes(e.code))
          return reply(res, 404, {
            error:
              "Fichier de l’application manquant. Réinstallez la mise à jour complète.",
          });
        throw e;
      }
      res.writeHead(200, {
        "Content-Type": mime[name],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return res.end(body);
    }

    if (
      req.method !== "POST" ||
      (!featureRoutes.has(req.url) &&
        ![
          "/api/budget/start-preview",
          "/api/budget/start-apply",
          "/api/workspace/bulk-preview",
          "/api/workspace/bulk-apply",
          "/api/workspace/split-preview",
          "/api/workspace/split-apply",
          "/api/workspace/reconcile",
          "/api/budget/global-preview",
          "/api/budget/global-apply",
          "/api/budget/global-copy-preview",
          "/api/budget/global-copy",
          "/api/banking/preview",
          "/api/banking/apply",
          "/api/setup/progress",
          "/api/setup/scope",
          "/api/setup/reset-preview",
          "/api/setup/reset",
          "/api/setup/funding-unlink",
          "/api/setup/funding-link",
          "/api/setup/demo-seed",
          "/api/budget/copy-preview",
          "/api/budget/copy",
          "/api/budget/preview",
          "/api/budget/apply",
          "/api/budget/recurring-link",
          "/api/accounts",
          "/api/accounts/update",
          "/api/accounts/inclusion",
          "/api/envelopes/fund",
          "/api/envelopes",
          "/api/envelopes/update",
          "/api/envelopes/delete",
          "/api/transactions",
          "/api/transactions/review",
          "/api/transactions/update",
          "/api/transactions/delete",
          "/api/transfers",
          "/api/transfers/update",
          "/api/transfers/delete",
          "/api/recurring",
          "/api/recurring/update",
          "/api/recurring/delete",
          "/api/overrides",
          "/api/overrides/delete",
          "/api/reconcile/link",
          "/api/reconcile/unlink",
          "/api/occurrence/move",
          "/api/occurrence/unmove",
          "/api/envelope/period",
          "/api/envelope/period/delete",
          "/api/envelope/status",
          "/api/planning/action",
          "/api/card-payments",
          "/api/card-payments/delete",
          "/api/simulate",
          "/api/support/reconcile",
          "/api/support/checkpoint",
          "/api/support/undo",
          "/api/support/backup",
          "/api/support/profiles",
          "/api/support/profiles/delete",
          "/api/support/scenarios",
          "/api/support/scenarios/delete",
          "/api/life/theme",
          "/api/life/cycle",
          "/api/life/review",
          "/api/life/suggest",
          "/api/life/funding-preview",
          "/api/life/funding",
          "/api/life/fund-now",
          "/api/life/cancel-funding",
          "/api/life/rules",
          "/api/life/rules-delete",
          "/api/life/rule-preview",
          "/api/life/rule-apply",
          "/api/life/projects",
          "/api/life/projects-delete",
          "/api/dashboard-layout",
          "/api/categories/delete-all-preview",
          "/api/categories/delete-all",
          "/api/categories/delete-preview",
          "/api/categories/delete",
          "/api/categories/catalog-preview",
          "/api/categories/catalog-apply",
          "/api/categories/group",
          "/api/categories/merge-preview",
          "/api/categories/merge",
          "/api/categories/archive",
          "/api/subcategories",
          "/api/subcategories/update",
          "/api/subcategories/archive",
          "/api/envelope-tools/preview",
          "/api/envelope-tools/apply",
          "/api/free-budgets/create",
          "/api/free-budgets/starter",
          "/api/free-budgets/adopt",
          "/api/free-budgets/preview",
          "/api/free-budgets/fund",
          "/api/free-budgets/update",
          "/api/free-budgets/delete",
        ].includes(req.url))
    )
      return reply(res, 404, { error: "Introuvable" });
    const x = await readJson(
        req,
        featureRoutes.has(req.url) ? 10_000_000 : 20000,
      ),
      name = typeof x.name === "string" ? x.name.trim() : "",
      exists = (table, id) =>
        Number.isInteger(id) &&
        q(`SELECT id FROM ${table} WHERE id=?`, id).length > 0;
    if (
      ![
        "/api/budget/start-preview",
        "/api/workspace/bulk-preview",
        "/api/workspace/split-preview",
        "/api/workspace/reconcile",
        "/api/budget/global-preview",
        "/api/budget/global-copy-preview",
        "/api/banking/preview",
        "/api/setup/reset-preview",
        "/api/setup/reset",
        "/api/setup/progress",
        "/api/budget/copy-preview",
        "/api/budget/preview",
        "/api/life/theme",
        "/api/life/cycle",
        "/api/life/review",
        "/api/life/suggest",
        "/api/life/funding-preview",
        "/api/life/rule-preview",
        "/api/dashboard-layout",
        "/api/categories/delete-all-preview",
        "/api/categories/delete-preview",
        "/api/categories/catalog-preview",
        "/api/categories/merge-preview",
        "/api/envelope-tools/preview",
        "/api/free-budgets/preview",
        "/api/simulate",
        "/api/import/inspect",
        "/api/import/preview",
        "/api/backup/validate",
        "/api/support/reconcile",
        "/api/support/undo",
        "/api/support/backup",
        "/api/support/profiles",
        "/api/support/profiles/delete",
        "/api/support/scenarios",
        "/api/support/scenarios/delete",
      ].includes(req.url)
    ) {
      applyEnvelopeRenewals();
      res.budgetBefore = features.exportBackup();
      res.budgetRoute = req.url;
    }
    if (req.url === "/api/workspace/bulk-preview")
      return reply(res, 200, tools80.bulkPlan(x));
    if (req.url === "/api/workspace/bulk-apply") {
      tools80.bulkApply(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/workspace/split-preview")
      return reply(res, 200, tools80.splitPreview(x));
    if (req.url === "/api/workspace/split-apply") {
      const ids = tools80.splitApply(x);
      return reply(res, 200, { ...snapshot(), split_ids: ids });
    }
    if (req.url === "/api/workspace/reconcile")
      return reply(res, 200, tools80.reconcile(x));
    if (req.url === "/api/budget/start-preview")
      return reply(res, 200, globalBudget.startPreview(x));
    if (req.url === "/api/budget/start-apply") {
      globalBudget.startApply(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/budget/global-preview")
      return reply(res, 200, globalBudget.preview(x));
    if (req.url === "/api/budget/global-apply") {
      globalBudget.apply(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/budget/global-copy-preview")
      return reply(res, 200, globalBudget.copyPreview(x));
    if (req.url === "/api/budget/global-copy") {
      globalBudget.copy(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/banking/preview")
      return reply(res, 200, banking.plan(x));
    if (req.url === "/api/banking/apply") {
      banking.apply(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/setup/reset-preview")
      return reply(res, 200, journey.resetPreview());
    if (req.url === "/api/setup/reset") {
      const result = journey.reset(x);
      return reply(res, 200, { ...snapshot(), reset70: result });
    }
    if (req.url === "/api/setup/scope") {
      journey.configureScope(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/setup/progress") {
      journey.progress(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/setup/funding-link") {
      journey.linkExisting(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/setup/funding-unlink") {
      journey.unlink(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/setup/demo-seed") {
      journey.seedDemo();
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/budget/copy-preview")
      return reply(res, 200, monthlyBudget.copyPreview(x));
    if (req.url === "/api/budget/copy") {
      monthlyBudget.copy(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/budget/preview")
      return reply(res, 200, monthlyBudget.preview(x));
    if (req.url === "/api/budget/apply") {
      monthlyBudget.apply(x);
      return reply(res, 200, snapshot());
    }
    if (req.url === "/api/budget/recurring-link") {
      monthlyBudget.linkRule(x);
      return reply(res, 200, snapshot());
    }
    if (req.url.startsWith("/api/life/")) {
      const result = budgetLife.post(req.url, x);
      return reply(res, 200, result === null ? snapshot() : result);
    }
    if (req.url === "/api/dashboard-layout") {
      try {
        return reply(res, 200, { dashboard_layout: dashboardLayout.save(x) });
      } catch (e) {
        return reply(res, e.code === "LAYOUT_CONFLICT" ? 409 : 400, {
          error: e.message,
          code: e.code,
          dashboard_layout: dashboardLayout.state(),
        });
      }
    }
    if (
      [
        "/api/categories/delete-all-preview",
        "/api/categories/delete-all",
        "/api/categories/delete-preview",
        "/api/categories/delete",
        "/api/categories/catalog-preview",
        "/api/categories/catalog-apply",
        "/api/categories/group",
        "/api/categories/merge-preview",
        "/api/categories/merge",
        "/api/categories/archive",
        "/api/subcategories",
        "/api/subcategories/update",
        "/api/subcategories/archive",
      ].includes(req.url)
    ) {
      const mergeConfig = [
        "/api/categories/merge-preview",
        "/api/categories/merge",
      ].includes(req.url)
        ? monthlyBudget.mergeConfig(x.source_id, x.target_id)
        : null;
      const globalMerge =
        req.url === "/api/categories/merge" ||
        (req.url === "/api/categories/delete" && x.target_id)
          ? globalBudget.prepareMerge(x.source_id || x.id, x.target_id)
          : null;
      const result = categoryTools.post(req.url, x);
      if (globalMerge) globalBudget.save(globalMerge);
      if (
        [
          "/api/categories/delete-all",
          "/api/categories/delete",
          "/api/categories/merge",
        ].includes(req.url)
      )
        globalBudget.prune();
      if (
        req.url === "/api/categories/merge" &&
        mergeConfig &&
        q("SELECT 1 FROM app_settings WHERE key='monthly_budget_v60'").length
      )
        monthlyBudget.save(mergeConfig);
      if (
        [
          "/api/categories/delete-all",
          "/api/categories/delete",
          "/api/categories/merge",
        ].includes(req.url)
      )
        monthlyBudget.prune();
      return reply(
        res,
        200,
        req.url.endsWith("/merge-preview") ||
          req.url.endsWith("/catalog-preview") ||
          req.url.endsWith("/delete-preview") ||
          req.url.endsWith("/delete-all-preview")
          ? result
          : snapshot(),
      );
    }
    if (req.url.startsWith("/api/envelope-tools/")) {
      if (
        x.changes?.some(
          (c) => monthlyBudget.config().reserve_schedules[c.id]?.length,
        )
      )
        throw Error(
          "Cette réserve suit son budget périodique. Modifiez sa programmation dans Budget.",
        );
      const result = envelopeTools.post(req.url, x);
      return reply(
        res,
        200,
        req.url.endsWith("/preview") ? result : snapshot(),
      );
    }
    if (req.url.startsWith("/api/free-budgets/")) {
      const result = freeBudgets.post(req.url, x);
      if (req.url === "/api/free-budgets/delete") monthlyBudget.prune();
      return reply(
        res,
        200,
        req.url === "/api/free-budgets/preview" ? result : snapshot(),
      );
    }
    if (req.url.startsWith("/api/support/")) {
      const result = support.post(req.url, x);
      return reply(
        res,
        200,
        req.url === "/api/support/reconcile" ? result : snapshot(),
      );
    }
    if (featureRoutes.has(req.url)) {
      const result = features.post(req.url, x);
      return reply(
        res,
        200,
        result.changed
          ? snapshot()
          : {
              ...result,
              ...(result.imported || result.safety_backup
                ? { state: snapshot() }
                : {}),
            },
      );
    }
    if (req.url === "/api/simulate") return reply(res, 200, simulateBudget(x));
    const domain = req.url.startsWith("/api/accounts")
      ? "accounts"
      : /^\/api\/envelop(?:e|es)(?:\/|$)/.test(req.url)
        ? "envelopes"
        : req.url.startsWith("/api/transactions")
          ? "transactions"
          : req.url.startsWith("/api/transfers")
            ? "transfers"
            : [
                  "/api/card-payments",
                  "/api/card-payments/delete",
                  "/api/planning/action",
                  "/api/occurrence/move",
                  "/api/occurrence/unmove",
                  "/api/reconcile/link",
                  "/api/reconcile/unlink",
                ].includes(req.url)
              ? "planning"
              : "recurrences";
    if ("accounts" === domain) accountsRoutes(req, res, x, name, exists);
    else if ("envelopes" === domain) envelopesRoutes(req, res, x, name, exists);
    else if ("transactions" === domain)
      transactionsRoutes(req, res, x, name, exists);
    else if ("transfers" === domain) transfersRoutes(req, res, x, name, exists);
    else if ("planning" === domain) planningRoutes(req, res, x, name, exists);
    else if ("recurrences" === domain)
      recurrencesRoutes(req, res, x, name, exists);
    if (res.writableEnded) return;

    journey.enforceScope();
    return reply(res, 200, snapshot());
  } catch (e) {
    if (e.httpStatus) {
      if (e.httpStatus === 413) res.setHeader("Connection", "close");
      return reply(res, e.httpStatus, { error: e.message });
    }
    console.error(e);
    return reply(res, 400, {
      error:
        featureRoutes.has(req.url) ||
        req.url.startsWith("/api/transfers") ||
        req.url === "/api/planning/action" ||
        req.url === "/api/simulate" ||
        req.url.startsWith("/api/banking/") ||
        req.url.startsWith("/api/setup/") ||
        req.url.startsWith("/api/workspace/") ||
        req.url.startsWith("/api/budget/") ||
        req.url.startsWith("/api/support/") ||
        req.url.startsWith("/api/free-budgets/") ||
        req.url.startsWith("/api/life/") ||
        req.url.startsWith("/api/subcategories") ||
        req.url.startsWith("/api/categories/") ||
        req.url.startsWith("/api/envelope-tools/") ||
        req.url.startsWith("/api/card-payments")
          ? String(e.message).includes("UNIQUE constraint")
            ? "Ce nom existe déjà."
            : e.message
          : "Données invalides",
    });
  }
};
if (process.env.BUDGET_DEMO === "1" && process.env.BUDGET_SOCKET)
  http
    .createServer(handleRequest)
    .listen(process.env.BUDGET_SOCKET, () =>
      fs.chmodSync(process.env.BUDGET_SOCKET, 0o600),
    );
else
  http
    .createServer(handleRequest)
    .listen(PORT, HOST, () =>
      console.log(`Sillage 2026 (11.4.2) : http://${HOST}:${PORT}`),
    );
if (privateAccess)
  http
    .createServer(handleRequest)
    .listen(privateAccess.port, HOST, () =>
      console.log(
        "Accès privé : backend Tailscale prêt sur l’interface locale.",
      ),
    );
