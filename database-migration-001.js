// Migration 001: the schema already used by Sillage 11.1. No financial rule changes.
export const schema = {
  "accounts": "CREATE TABLE accounts(id INTEGER PRIMARY KEY,name TEXT NOT NULL,balance_cents INTEGER NOT NULL DEFAULT 0,kind TEXT NOT NULL CHECK(kind IN ('checking','savings','credit')),included INTEGER NOT NULL DEFAULT 1)",
  "envelopes": "CREATE TABLE envelopes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK(reserved_cents>=0), budget_cents INTEGER NOT NULL DEFAULT 0, frequency TEXT NOT NULL DEFAULT 'none', start_on TEXT, rollover INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, forecast_account_id INTEGER REFERENCES accounts(id), forecast_spend INTEGER NOT NULL DEFAULT 1 CHECK(forecast_spend IN (0,1)), planning_since TEXT)",
  "transactions": "CREATE TABLE transactions(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),envelope_id INTEGER REFERENCES envelopes(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,happened_on TEXT NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0 CHECK(reviewed IN (0,1)), subcategory_id INTEGER REFERENCES subcategories(id), category_id INTEGER REFERENCES categories(id), import_batch_id INTEGER REFERENCES import_batches(id), affects_balance INTEGER NOT NULL DEFAULT 1 CHECK(affects_balance IN (0,1)), envelope_effect_cents INTEGER)",
  "account_transfers": "CREATE TABLE account_transfers(id INTEGER PRIMARY KEY,from_account_id INTEGER NOT NULL REFERENCES accounts(id),to_account_id INTEGER NOT NULL REFERENCES accounts(id),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),description TEXT NOT NULL,happened_on TEXT NOT NULL, envelope_id INTEGER REFERENCES envelopes(id), envelope_effect_cents INTEGER NOT NULL DEFAULT 0 CHECK(envelope_effect_cents>=0), envelope_on TEXT)",
  "recurring_overrides": "CREATE TABLE recurring_overrides(id INTEGER PRIMARY KEY,recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>=0),UNIQUE(recurring_id,occurrence_on))",
  "envelope_renewal_log": "CREATE TABLE envelope_renewal_log(\n envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,\n occurrence_on TEXT NOT NULL, applied_cents INTEGER NOT NULL,\n PRIMARY KEY(envelope_id,occurrence_on))",
  "app_settings": "CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
  "envelope_budget_overrides": "CREATE TABLE envelope_budget_overrides(envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,budget_cents INTEGER NOT NULL CHECK(budget_cents>=0),PRIMARY KEY(envelope_id,occurrence_on))",
  "recurring_moves": "CREATE TABLE recurring_moves(recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,new_on TEXT NOT NULL,PRIMARY KEY(recurring_id,occurrence_on))",
  "reconciliation_links": "CREATE TABLE reconciliation_links(\n id INTEGER PRIMARY KEY,\n recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,\n occurrence_on TEXT NOT NULL,\n actual_type TEXT NOT NULL CHECK(actual_type IN ('transaction','transfer')),\n actual_id INTEGER NOT NULL,\n UNIQUE(recurring_id,occurrence_on), UNIQUE(actual_type,actual_id))",
  "recurring": "CREATE TABLE \"recurring\"(id INTEGER PRIMARY KEY,description TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('income','expense','transfer','reserve')),amount_cents INTEGER NOT NULL CHECK(amount_cents>0),account_id INTEGER REFERENCES accounts(id),to_account_id INTEGER REFERENCES accounts(id),envelope_id INTEGER REFERENCES envelopes(id),start_on TEXT NOT NULL,frequency TEXT NOT NULL CHECK(frequency IN ('weekly','biweekly','monthly','quarterly','semiannual','yearly','last_business_day','rrq')),active INTEGER NOT NULL DEFAULT 1, day_adjust TEXT NOT NULL DEFAULT 'none', one_time INTEGER NOT NULL DEFAULT 0 CHECK(one_time IN (0,1)))",
  "categories": "CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE COLLATE NOCASE, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)))",
  "import_batches": "CREATE TABLE import_batches(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,account_id INTEGER NOT NULL REFERENCES accounts(id),affects_balance INTEGER NOT NULL CHECK(affects_balance IN (0,1)),imported_count INTEGER NOT NULL)",
  "category_budgets": "CREATE TABLE category_budgets(category_id INTEGER PRIMARY KEY REFERENCES categories(id),limit_cents INTEGER NOT NULL CHECK(limit_cents>=0))",
  "goals": "CREATE TABLE goals(id INTEGER PRIMARY KEY,name TEXT NOT NULL,target_cents INTEGER NOT NULL CHECK(target_cents>0),saved_cents INTEGER NOT NULL DEFAULT 0 CHECK(saved_cents>=0),target_date TEXT)",
  "balance_reconciliations": "CREATE TABLE balance_reconciliations(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),old_balance_cents INTEGER NOT NULL,new_balance_cents INTEGER NOT NULL,happened_on TEXT NOT NULL,note TEXT NOT NULL)",
  "subcategories": "CREATE TABLE subcategories(id INTEGER PRIMARY KEY,category_id INTEGER NOT NULL REFERENCES categories(id),name TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),UNIQUE(category_id,name COLLATE NOCASE))",
  "envelope_period_status": "CREATE TABLE envelope_period_status(envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('open','complete','skipped')),PRIMARY KEY(envelope_id,occurrence_on))",
  "envelope_occurrence_moves": "CREATE TABLE envelope_occurrence_moves(envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL,new_on TEXT NOT NULL,PRIMARY KEY(envelope_id,occurrence_on))",
  "envelope_actual_links": "CREATE TABLE envelope_actual_links(transaction_id INTEGER PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,envelope_id INTEGER NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,occurrence_on TEXT NOT NULL)",
  "card_payment_plans": "CREATE TABLE card_payment_plans(card_account_id INTEGER PRIMARY KEY REFERENCES accounts(id),recurring_id INTEGER NOT NULL UNIQUE REFERENCES recurring(id) ON DELETE CASCADE,mode TEXT NOT NULL CHECK(mode IN ('purchases','fixed')))"
};

export const additions = {
  envelopes: {
    budget_cents: 'INTEGER NOT NULL DEFAULT 0',
    frequency: "TEXT NOT NULL DEFAULT 'none'",
    start_on: 'TEXT', rollover: 'INTEGER NOT NULL DEFAULT 0',
    active: 'INTEGER NOT NULL DEFAULT 1',
    forecast_account_id: 'INTEGER REFERENCES accounts(id)',
    forecast_spend: 'INTEGER NOT NULL DEFAULT 1 CHECK(forecast_spend IN (0,1))',
    planning_since: 'TEXT',
  },
  transactions: {
    reviewed: 'INTEGER NOT NULL DEFAULT 0 CHECK(reviewed IN (0,1))',
    subcategory_id: 'INTEGER REFERENCES subcategories(id)',
    category_id: 'INTEGER REFERENCES categories(id)',
    import_batch_id: 'INTEGER REFERENCES import_batches(id)',
    affects_balance: 'INTEGER NOT NULL DEFAULT 1 CHECK(affects_balance IN (0,1))',
    envelope_effect_cents: 'INTEGER',
  },
  recurring: {
    day_adjust: "TEXT NOT NULL DEFAULT 'none'",
    one_time: 'INTEGER NOT NULL DEFAULT 0 CHECK(one_time IN (0,1))',
  },
  account_transfers: {
    envelope_id: 'INTEGER REFERENCES envelopes(id)',
    envelope_effect_cents: 'INTEGER NOT NULL DEFAULT 0 CHECK(envelope_effect_cents>=0)',
    envelope_on: 'TEXT',
  },
  categories: {archived: 'INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))'},
};

// Explicit replacement DDL: never rewrite a stored CREATE statement with a regexp.
const recurringReplacement = `CREATE TABLE recurring_migration_001 (
  id INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income','expense','transfer','reserve')),
  amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
  account_id INTEGER REFERENCES accounts(id),
  to_account_id INTEGER REFERENCES accounts(id),
  envelope_id INTEGER REFERENCES envelopes(id),
  start_on TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN
    ('weekly','biweekly','monthly','quarterly','semiannual','yearly','last_business_day','rrq')),
  active INTEGER NOT NULL DEFAULT 1,
  day_adjust TEXT NOT NULL DEFAULT 'none',
  one_time INTEGER NOT NULL DEFAULT 0 CHECK(one_time IN (0,1))
)`;

export function apply(db, today) {
  const existingTables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
  const planningWasMissing = existingTables.has('envelopes') &&
    !db.prepare('PRAGMA table_info(envelopes)').all().some(c => c.name === 'planning_since');

  for (const [table, ddl] of Object.entries(schema)) {
    if (!existingTables.has(table)) db.exec(ddl);
  }
  for (const [table, columns] of Object.entries(additions)) {
    const present = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [name, definition] of Object.entries(columns)) {
      if (!present.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
  const recurringSQL = db.prepare("SELECT sql FROM sqlite_master WHERE name='recurring'").get().sql;
  if (!['quarterly','semiannual','yearly','last_business_day','rrq'].every(f => recurringSQL.includes("'" + f + "'"))) {
    const columns = db.prepare('PRAGMA table_info(recurring)').all().map(c => c.name);
    const names = columns.map(c => '"' + c + '"').join(',');
    // Additional indexes/triggers are rejected by preflight rather than silently lost.
    db.exec(recurringReplacement);
    db.exec(`INSERT INTO recurring_migration_001 (${names}) SELECT ${names} FROM recurring`);
    db.exec('DROP TABLE recurring; ALTER TABLE recurring_migration_001 RENAME TO recurring');
  }
  if (planningWasMissing) db.prepare('UPDATE envelopes SET planning_since=? WHERE planning_since IS NULL').run(today);

  // Historical initialization, in its original order. Existing values are untouched.
  db.prepare("INSERT OR IGNORE INTO app_settings(key,value) VALUES('renewal_activation',?)").run(today);
  if (!db.prepare("SELECT 1 FROM app_settings WHERE key='features_v3'").get()) {
    for (const name of ['Épicerie','Logement','Transport','Restaurants','Santé','Loisirs','Abonnements','Achats','Revenus','Autres']) {
      db.prepare('INSERT OR IGNORE INTO categories(name) VALUES(?)').run(name);
    }
    db.exec("INSERT INTO app_settings(key,value) VALUES('features_v3','1')");
  }
  db.prepare("INSERT OR IGNORE INTO app_settings(key,value) VALUES('forecast_tracking_since',?)").run(today);
  db.exec("INSERT OR IGNORE INTO app_settings(key,value) VALUES('planning_actions_v1','1'); INSERT OR IGNORE INTO app_settings(key,value) VALUES('card_payments_v1','1')");
}
