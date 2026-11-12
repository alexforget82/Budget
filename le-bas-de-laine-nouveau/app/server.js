'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3045);
const DATA = process.env.BDL_DATA || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const DB_PATH = path.join(DATA, 'bas-de-laine.db');
const VERSION = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim();
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'w',
    renewal TEXT NOT NULL DEFAULT '4',
    start_date TEXT,
    funding TEXT NOT NULL DEFAULT 'start',
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS recurring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    frequency TEXT NOT NULL,
    anchor_date TEXT NOT NULL,
    adjustment TEXT NOT NULL DEFAULT 'auto',
    category_id INTEGER,
    method TEXT NOT NULL DEFAULT 'joint',
    active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    kind TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'joint',
    category_id INTEGER,
    description TEXT NOT NULL DEFAULT '',
    recurring_id INTEGER,
    recurring_date TEXT,
    included INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY(recurring_id) REFERENCES recurring(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS occurrences (
    recurring_id INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT '',
    moved_to TEXT,
    amount INTEGER,
    PRIMARY KEY(recurring_id, due_date),
    FOREIGN KEY(recurring_id) REFERENCES recurring(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS limit_overrides (
    category_id INTEGER NOT NULL,
    due_date TEXT NOT NULL,
    moved_to TEXT,
    amount INTEGER,
    PRIMARY KEY(category_id, due_date),
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS merchant_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant TEXT NOT NULL,
    normalized TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS imported_rows (
    import_key TEXT PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
  );
`);

const q = (sql, ...args) => db.prepare(sql).all(...args);
const one = (sql, ...args) => db.prepare(sql).get(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const setting = key => (one('SELECT value FROM settings WHERE key=?', key) || {}).value;
const set = (key, value) => run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', key, String(value));

// Les premières installations n'avaient pas le choix de financement d'une
// limite. Cette migration est sans effet sur les autres catégories.
if (!q('PRAGMA table_info(categories)').some(column => column.name === 'funding')) {
  db.exec("ALTER TABLE categories ADD COLUMN funding TEXT NOT NULL DEFAULT 'start'");
  db.exec("UPDATE categories SET funding='income' WHERE name IN ('Lait et Couches','Pharmacie et Médicaments')");
}

const pad = n => String(n).padStart(2, '0');
const dateObj = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = dateObj(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = s => dateObj(s).getUTCDay();
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && iso(dateObj(s)) === s;
const today = () => process.env.BDL_TODAY || iso(new Date());
const money = value => {
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw Error('Montant invalide : utilise au plus deux décimales.');
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0) throw Error('Montant invalide.');
  return cents;
};
const clean = (value, label, max = 100) => {
  const text = String(value || '').trim();
  if (!text || text.length > max) throw Error(`${label} requis.`);
  return text;
};
const merchantKey = value => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toUpperCase()
  .replace(/\b(?:TERMINAL|SUCCURSALE|SUCC|BRANCH|STORE)\.?\s*(?:NO\.?\s*)?[#:]?\s*\d+\b/g, ' ')
  .replace(/#\s*\d+\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function backupDaily() {
  if (!fs.existsSync(DB_PATH)) return;
  const folder = path.join(DATA, 'sauvegardes');
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const target = path.join(folder, `bas-de-laine-${today()}.db`);
  if (!fs.existsSync(target)) fs.copyFileSync(DB_PATH, target);
}
backupDaily();

// Jours de fermeture usuels du système de paiement au Québec. Une date peut
// toujours être déplacée au cas par cas si son émetteur publie son propre
// calendrier (cela arrive notamment pour certaines prestations).
const holidayCache = new Map();
function holidays(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const nthMonday = (month, nth) => {
    let d = `${year}-${pad(month)}-01`;
    while (dow(d) !== 1) d = addDays(d, 1);
    return addDays(d, 7 * (nth - 1));
  };
  const easter = (() => {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    return `${year}-${pad(Math.floor((h + l - 7 * m + 114) / 31))}-${pad(((h + l - 7 * m + 114) % 31) + 1)}`;
  })();
  const observe = d => dow(d) === 6 ? addDays(d, 2) : dow(d) === 0 ? addDays(d, 1) : d;
  const may24 = `${year}-05-24`;
  let victoria = may24;
  while (dow(victoria) !== 1) victoria = addDays(victoria, -1);
  const set = new Set([
    observe(`${year}-01-01`), addDays(easter, -2), victoria,
    observe(`${year}-06-24`), observe(`${year}-07-01`), nthMonday(9, 1),
    `${year}-09-30`, nthMonday(10, 2), `${year}-11-11`,
    observe(`${year}-12-25`), observe(`${year}-12-26`)
  ]);
  // Quand Noël est observé le lundi, Boxing Day est observé le mardi.
  if (dow(`${year}-12-25`) === 6) {
    set.delete(observe(`${year}-12-26`));
    set.add(`${year}-12-28`);
  }
  if (dow(`${year}-12-25`) === 0) {
    set.delete(observe(`${year}-12-26`));
    set.add(`${year}-12-27`);
  }
  holidayCache.set(year, set);
  return set;
}
function businessDay(date, direction = 1) {
  let d = date;
  while (dow(d) === 0 || dow(d) === 6 || holidays(+d.slice(0, 4)).has(d)) d = addDays(d, direction);
  return d;
}
function lastBusinessDay(year, month) {
  const last = iso(new Date(Date.UTC(year, month, 0)));
  return businessDay(last, -1);
}
function monthDate(year, month, day) {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(Math.max(1, day), dim))}`;
}

function ruleNominals(rule, from, to) {
  const result = [], start = rule.anchor_date;
  if (rule.frequency === 'w' || rule.frequency === 'b') {
    const step = rule.frequency === 'w' ? 7 : 14;
    for (let d = start, i = 0; d <= to && i < 600; d = addDays(d, step), i++) if (d >= from) result.push(d);
    return result;
  }
  const anchor = dateObj(start), startYear = anchor.getUTCFullYear(), startMonth = anchor.getUTCMonth() + 1, startDay = anchor.getUTCDate();
  const interval = rule.frequency === 'a' ? 12 : 1;
  for (let index = 0, i = 0; i < 600; index += interval, i++) {
    const absolute = startYear * 12 + (startMonth - 1) + index;
    const year = Math.floor(absolute / 12), month = absolute % 12 + 1;
    let d = rule.adjustment === 'last' ? lastBusinessDay(year, month) : monthDate(year, month, startDay);
    if (d < start) continue;
    if (d > to) break;
    if (d >= from) result.push(d);
  }
  return result;
}
function adjustedDate(rule, nominal) {
  if (rule.adjustment === 'last') return nominal;
  if (rule.adjustment === 'none') return nominal;
  const direction = rule.adjustment === 'prev' ? -1 : rule.adjustment === 'next' ? 1 : rule.kind === 'income' ? -1 : 1;
  return businessDay(nominal, direction);
}
function allOccurrences(from, to) {
  const list = [];
  for (const rule of q('SELECT * FROM recurring WHERE active=1')) {
    for (const nominal of ruleNominals(rule, from, to)) {
      const state = one('SELECT * FROM occurrences WHERE recurring_id=? AND due_date=?', rule.id, nominal);
      if (state && ['paid', 'skipped'].includes(state.state)) continue;
      const due = state && state.moved_to ? state.moved_to : adjustedDate(rule, nominal);
      if (due < from || due > to) continue;
      list.push({ id: `${rule.id}|${nominal}`, rid: rule.id, nominal, due, name: rule.name, kind: rule.kind, amount: state && state.amount != null ? state.amount : rule.amount, category_id: rule.category_id, method: rule.method, moved: !!(state && state.moved_to) });
    }
  }
  return list.sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name, 'fr-CA'));
}

function categoryStarts(category, until) {
  if (!category.start_date || category.start_date > until) return [];
  const start = category.start_date, out = [start];
  if (category.frequency === 'w') {
    const wanted = Number(category.renewal);
    let next = addDays(start, ((wanted - dow(start) + 7) % 7) || 7);
    for (let i = 0; next <= until && i < 600; i++, next = addDays(next, 7)) out.push(next);
    return out;
  }
  const [year0, month0] = start.slice(0, 7).split('-').map(Number);
  for (let absolute = year0 * 12 + month0; ; absolute++) {
    const year = Math.floor(absolute / 12), month = absolute % 12 + 1;
    const normal = category.renewal === 'last' ? iso(new Date(Date.UTC(year, month, 0))) : monthDate(year, month, Number(category.renewal));
    if (normal > until) break;
    if (normal > start) out.push(normal);
  }
  return [...new Set(out)].sort();
}
function monthKey(d) { return d.slice(0, 7); }
function categoryPeriods(category, until) {
  const periods = [];
  for (const due of categoryStarts(category, until)) {
    const changed = one('SELECT * FROM limit_overrides WHERE category_id=? AND due_date=?', category.id, due);
    const date = changed && changed.moved_to ? changed.moved_to : due;
    const amount = changed && changed.amount != null ? changed.amount : category.amount;
    if (date <= until && amount > 0) periods.push({ due, date, amount, moved: !!(changed && changed.moved_to), adjusted: !!changed });
  }
  return periods.sort((a, b) => a.date.localeCompare(b.date));
}
function incomeFundedPeriods(category, from, until) {
  if (category.frequency !== 'm' || !category.start_date) return [];
  const [startYear, startMonth] = category.start_date.slice(0, 7).split('-').map(Number);
  const out = [];
  for (let absolute = startYear * 12 + startMonth - 1, i = 0; i < 120; i++, absolute++) {
    const year = Math.floor(absolute / 12), month = absolute % 12 + 1;
    const date = category.renewal === 'last'
      ? lastBusinessDay(year, month)
      : monthDate(year, month, Number(category.renewal));
    if (date < category.start_date) continue;
    if (date > until) break;
    if (date >= from) out.push({ due: date, date, amount: category.amount, funded: false });
  }
  return out;
}
function categoryReserve(category, day, transactions) {
  const periods = categoryPeriods(category, day).filter(p => monthKey(p.date) === monthKey(day) && p.date <= day);
  const allocated = periods.reduce((sum, p) => sum + p.amount, 0);
  const spent = transactions.filter(t => t.kind === 'expense' && t.category_id === category.id && t.date <= day && t.date >= category.start_date && monthKey(t.date) === monthKey(day)).reduce((sum, t) => sum + t.amount, 0);
  return Math.max(0, allocated - spent);
}

function baseData() {
  return {
    bank: Number(setting('bank_cents') || 0),
    checkpointDate: setting('checkpoint_date') || '',
    checkpointAt: Number(setting('checkpoint_at') || 0),
    setupComplete: setting('setup_complete') === '1'
  };
}
function buildState() {
  const t = today(), horizon = addDays(t, 89), settings = baseData();
  const categories = q('SELECT * FROM categories WHERE active=1 ORDER BY name COLLATE NOCASE');
  const transactions = q('SELECT * FROM transactions ORDER BY date DESC, id DESC');
  const afterCheckpoint = transactions.filter(tx => tx.created_at > settings.checkpointAt && !tx.included);
  const occurrenceList = allOccurrences(t, horizon);
  const daily = [];
  const incomeCategories = categories.filter(category => category.funding === 'income');
  const incomeDue = incomeCategories.flatMap(category => incomeFundedPeriods(category, t, horizon).map(period => ({ ...period, category })));
  const funded = new Map();
  const fundingKey = period => `${period.category.id}|${period.due}`;
  const categorySpent = (category, day) => transactions.filter(tx => tx.kind === 'expense' && tx.category_id === category.id && tx.date <= day && tx.date >= category.start_date && monthKey(tx.date) === monthKey(day)).reduce((sum, tx) => sum + tx.amount, 0);
  const reservesFor = day => {
    const reserves = {};
    for (const category of categories) {
      if (!category.amount || !category.start_date || category.start_date > day) continue;
      if (category.funding === 'income') {
        const allocated = [...funded.values()].filter(period => period.category.id === category.id && period.funded_on <= day && monthKey(period.due) === monthKey(day)).reduce((sum, period) => sum + period.amount, 0);
        reserves[category.name] = Math.max(0, allocated - categorySpent(category, day));
      } else {
        reserves[category.name] = categoryReserve(category, day, transactions);
      }
    }
    return reserves;
  };
  const fund = (period, on) => funded.set(fundingKey(period), { ...period, funded_on: on });
  // Le solde de contrôle est le point de départ. Les opérations saisies après
  // ce contrôle, les paies et les factures s'ajoutent ensuite une seule fois,
  // puis restent dans le solde des jours suivants.
  let cash = settings.bank;
  for (const tx of afterCheckpoint) if (tx.date <= t) {
    if (tx.kind === 'income') cash += tx.amount;
    if (tx.kind === 'expense' && tx.method === 'joint') cash -= tx.amount;
    if (tx.kind === 'card_payment') cash -= tx.amount;
  }
  let cardReserve = 0;
  for (const tx of transactions) if (tx.date <= t) {
    if (tx.kind === 'expense' && tx.method === 'card') cardReserve += tx.amount;
    if (tx.kind === 'card_payment') cardReserve -= tx.amount;
  }
  cardReserve = Math.max(0, cardReserve);
  for (let d = t; d <= horizon; d = addDays(d, 1)) {
    if (d > t) for (const tx of afterCheckpoint) if (tx.date === d) {
      if (tx.kind === 'income') cash += tx.amount;
      if (tx.kind === 'expense' && tx.method === 'joint') cash -= tx.amount;
      if (tx.kind === 'card_payment') cash -= tx.amount;
    }
    if (d > t) for (const tx of transactions) if (tx.date === d) {
      if (tx.kind === 'expense' && tx.method === 'card') cardReserve += tx.amount;
      if (tx.kind === 'card_payment') cardReserve -= tx.amount;
    }
    cardReserve = Math.max(0, cardReserve);
    const events = occurrenceList.filter(e => e.due === d);
    for (const e of events) {
      if (e.kind === 'income') {
        cash += e.amount;
      } else if (e.method === 'card') {
        // Une facture prévue sur carte est protégée comme un achat de carte.
        // Elle ne touchera le compte conjoint qu'au paiement de la carte.
        cardReserve += e.amount;
      } else {
        cash -= e.amount;
      }
    }
    // Une limite financée par revenu n'est gelée qu'au premier revenu qui la
    // couvre avant son échéance. À l'échéance, elle devient obligatoire même
    // si aucun revenu n'a encore pu la financer.
    for (const period of incomeDue) if (period.due === d && !funded.has(fundingKey(period))) fund(period, d);
    const hasIncome = events.some(event => event.kind === 'income');
    if (hasIncome) {
      const next = occurrenceList.find(event => event.kind === 'income' && event.due > d);
      const cutoff = next ? next.due : addDays(d, 30);
      for (const period of incomeDue.filter(item => item.due >= d && item.due <= cutoff && !funded.has(fundingKey(item))).sort((a, b) => a.due.localeCompare(b.due) || a.category.name.localeCompare(b.category.name, 'fr-CA'))) {
        const before = reservesFor(d);
        const currentLimits = Object.values(before).reduce((sum, amount) => sum + amount, 0);
        const impact = Math.max(0, period.amount - categorySpent(period.category, d));
        if (cash - cardReserve - currentLimits - impact >= 0) fund(period, d);
      }
    }
    const reserves = reservesFor(d);
    const limitEvents = [];
    for (const category of categories) {
      if (!category.amount || !category.start_date || category.start_date > d) continue;
      if (category.funding !== 'income') for (const period of categoryPeriods(category, d)) {
        if (period.date === d) limitEvents.push({ category_id: category.id, name: category.name, amount: period.amount, due: period.due, date: period.date, moved: period.moved, adjusted: period.adjusted });
      }
    }
    for (const period of funded.values()) if (period.funded_on === d) {
      limitEvents.push({ category_id: period.category.id, name: period.category.name, amount: period.amount, due: period.due, date: d, funded: true });
    }
    const limits = Object.values(reserves).reduce((sum, value) => sum + value, 0);
    daily.push({ date: d, cash, cards: cardReserve, limits, reserves, safe: cash - cardReserve - limits, events, limitEvents });
  }
  const nextIncome = occurrenceList.find(e => e.kind === 'income') || null;
  const first30 = daily.slice(0, 30), low30 = first30.reduce((low, d) => d.safe < low.safe ? d : low, first30[0] || { safe: 0, date: t });
  const until = nextIncome ? daily.filter(d => d.date < nextIncome.due) : first30;
  const lowUntil = (until.length ? until : first30).reduce((low, d) => d.safe < low.safe ? d : low, (until.length ? until : first30)[0] || { safe: 0, date: t });
  const todayRow = daily[0] || { reserves: {} };
  const visibleCategories = categories.map(c => {
    const periods = c.funding === 'income' ? incomeFundedPeriods(c, t, horizon) : categoryPeriods(c, horizon);
    return { ...c, reserve: todayRow.reserves[c.name] || 0, periods: periods.filter(p => p.date >= t && p.date <= addDays(t, 30)), starts: periods.filter(p => p.date >= t && p.date <= addDays(t, 30)).map(p => p.date) };
  });
  const firstNegative = daily.find(d => d.safe < 0) || null;
  const toReview = transactions.filter(tx =>
    tx.kind === 'expense' && !tx.category_id && !tx.recurring_id
  ).length;
  return {
    version: VERSION, today: t, settings, categories: visibleCategories, recurring: q('SELECT * FROM recurring WHERE active=1 ORDER BY kind,name'),
    transactions: transactions.slice(0, 250), upcoming: occurrenceList.filter(e => e.due <= addDays(t, 30)), daily,
    safe30: low30, safeUntilIncome: lowUntil, nextIncome, firstNegative,
    limitOverrides: q('SELECT * FROM limit_overrides ORDER BY due_date'), merchant_rules: merchantRules(), review_count: toReview,
    current: daily[0] || { safe: 0, cash: settings.bank, cards: 0, limits: 0, reserves: {} }
  };
}

function categoryById(id) { return one('SELECT * FROM categories WHERE id=?', Number(id)); }
function merchantRuleFor(description, method = '') {
  const key = merchantKey(description);
  if (!key) return null;
  return q(`SELECT merchant_rules.*, categories.name AS category_name
            FROM merchant_rules JOIN categories ON categories.id=merchant_rules.category_id
            WHERE merchant_rules.active=1 AND categories.active=1
            ORDER BY length(merchant_rules.normalized) DESC, merchant_rules.id DESC`)
    .find(rule => (!rule.method || rule.method === method) && key.includes(rule.normalized)) || null;
}
function merchantRules() {
  return q(`SELECT merchant_rules.*, categories.name AS category_name
            FROM merchant_rules JOIN categories ON categories.id=merchant_rules.category_id
            ORDER BY merchant_rules.merchant COLLATE NOCASE`);
}
function importKey(value) {
  const key = String(value || '');
  if (Buffer.byteLength(key) < 8 || Buffer.byteLength(key) > 400 || /[\0-\x1F]/.test(key)) throw Error('Clé d’import invalide.');
  return key;
}
function action(body) {
  const t = today();
  switch (body.action) {
    case 'setup': {
      set('bank_cents', money(body.bank)); set('checkpoint_date', t); set('checkpoint_at', Date.now()); set('setup_complete', body.complete ? '1' : '0');
      if (body.seed_limits) {
        const suggestions = [
          ['Épicerie', 22500, 'w', '4', 'start'],
          ['Essence Alex', 5000, 'w', '4', 'start'],
          ['Essence Jenny', 5000, 'w', '2', 'start'],
          ['Lait et Couches', 15000, 'm', 'last', 'income'],
          ['Pharmacie et Médicaments', 10000, 'm', 'last', 'income']
        ];
        for (const [name, amount, frequency, renewal, funding] of suggestions) {
          run('INSERT OR IGNORE INTO categories(name,amount,frequency,renewal,start_date,funding) VALUES(?,?,?,?,?,?)', name, amount, frequency, renewal, t, funding);
        }
      }
      return body.seed_limits ? 'Solde et limites de départ enregistrés.' : 'Solde de départ enregistré.';
    }
    case 'checkpoint': {
      set('bank_cents', money(body.bank)); set('checkpoint_date', t); set('checkpoint_at', Date.now());
      return 'Solde vérifié. La prévision repart de ce montant.';
    }
    case 'category': {
      const name = clean(body.name, 'Nom de limite', 80), amount = money(body.amount);
      const frequency = ['w', 'm'].includes(body.frequency) ? body.frequency : 'w';
      const renewal = frequency === 'w' ? String(Math.max(0, Math.min(6, Number(body.renewal)))) : (body.renewal === 'last' ? 'last' : String(Math.max(1, Math.min(28, Number(body.renewal)))));
      const funding = frequency === 'm' && body.funding === 'income' ? 'income' : 'start';
      const start = String(body.start_date || '');
      if (!validDate(start)) throw Error('Choisis la date de début de la limite.');
      if (body.id) {
        if (!categoryById(body.id)) throw Error('Limite introuvable.');
        run('UPDATE categories SET name=?,amount=?,frequency=?,renewal=?,start_date=?,funding=? WHERE id=?', name, amount, frequency, renewal, start, funding, Number(body.id));
      } else run('INSERT INTO categories(name,amount,frequency,renewal,start_date,funding) VALUES(?,?,?,?,?,?)', name, amount, frequency, renewal, start, funding);
      return 'Limite enregistrée.';
    }
    case 'delete_category': {
      if (!categoryById(body.id)) throw Error('Limite introuvable.');
      run('DELETE FROM categories WHERE id=?', Number(body.id));
      return 'Limite supprimée.';
    }
    case 'limit_override': {
      const category = categoryById(body.category_id);
      if (!category) throw Error('Limite introuvable.');
      const due = String(body.due_date || '');
      if (!validDate(due) || !categoryStarts(category, addDays(due, 1)).includes(due)) throw Error('Renouvellement de limite introuvable.');
      const type = body.type === 'move' ? 'move' : body.type === 'amount' ? 'amount' : null;
      if (!type) throw Error('Ajustement de limite invalide.');
      if (type === 'move') {
        const moved = String(body.moved_to || '');
        if (!validDate(moved) || moved <= due) throw Error('Choisis une date après le renouvellement.');
        run('INSERT OR REPLACE INTO limit_overrides(category_id,due_date,moved_to,amount) VALUES(?,?,?,NULL)', category.id, due, moved);
        return `Renouvellement de ${category.name} déplacé au ${moved}.`;
      }
      const amount = money(body.amount);
      if (amount > category.amount) throw Error('Le montant temporaire ne peut pas dépasser la limite habituelle.');
      run('INSERT OR REPLACE INTO limit_overrides(category_id,due_date,moved_to,amount) VALUES(?,?,NULL,?)', category.id, due, amount);
      return `Limite de ${category.name} ajustée pour cette période.`;
    }
    case 'delete_limit_override': {
      run('DELETE FROM limit_overrides WHERE category_id=? AND due_date=?', Number(body.category_id), String(body.due_date || ''));
      return 'Ajustement de limite annulé.';
    }
    case 'recurring': {
      const name = clean(body.name, 'Nom', 100), amount = money(body.amount), kind = ['income', 'expense'].includes(body.kind) ? body.kind : null;
      if (!kind) throw Error('Type de règle invalide.');
      const frequency = ['w', 'b', 'm', 'a'].includes(body.frequency) ? body.frequency : 'm';
      const anchor = String(body.anchor_date || ''); if (!validDate(anchor)) throw Error('Choisis une date de départ.');
      const adjustment = ['auto', 'prev', 'next', 'none', 'last'].includes(body.adjustment) ? body.adjustment : 'auto';
      const categoryId = body.category_id ? Number(body.category_id) : null;
      if (categoryId && !categoryById(categoryId)) throw Error('Limite introuvable.');
      const method = body.method === 'card' ? 'card' : 'joint';
      if (body.id) run('UPDATE recurring SET name=?,kind=?,amount=?,frequency=?,anchor_date=?,adjustment=?,category_id=?,method=? WHERE id=?', name, kind, amount, frequency, anchor, adjustment, categoryId, method, Number(body.id));
      else run('INSERT INTO recurring(name,kind,amount,frequency,anchor_date,adjustment,category_id,method) VALUES(?,?,?,?,?,?,?,?)', name, kind, amount, frequency, anchor, adjustment, categoryId, method);
      return 'Règle enregistrée.';
    }
    case 'delete_recurring': run('DELETE FROM recurring WHERE id=?', Number(body.id)); return 'Règle supprimée.';
    case 'merchant_rule': {
      const merchant = clean(body.merchant, 'Commerçant', 100);
      const normalized = merchantKey(merchant);
      if (normalized.length < 2) throw Error('Le nom du commerçant est trop court.');
      const categoryId = Number(body.category_id);
      if (!categoryById(categoryId)) throw Error('Choisis une limite pour cette règle.');
      const method = body.method === 'card' ? 'card' : body.method === 'joint' ? 'joint' : '';
      if (body.id) {
        if (!one('SELECT id FROM merchant_rules WHERE id=?', Number(body.id))) throw Error('Règle de commerçant introuvable.');
        run('UPDATE merchant_rules SET merchant=?,normalized=?,category_id=?,method=?,active=1 WHERE id=?', merchant, normalized, categoryId, method, Number(body.id));
      } else {
        run(`INSERT INTO merchant_rules(merchant,normalized,category_id,method,created_at)
             VALUES(?,?,?,?,?)
             ON CONFLICT(normalized) DO UPDATE SET merchant=excluded.merchant,category_id=excluded.category_id,method=excluded.method,active=1`, merchant, normalized, categoryId, method, Date.now());
      }
      return `Règle enregistrée : ${merchant}.`;
    }
    case 'delete_merchant_rule': {
      run('DELETE FROM merchant_rules WHERE id=?', Number(body.id));
      return 'Règle de commerçant supprimée.';
    }
    case 'transaction': {
      const kind = ['income', 'expense', 'card_payment'].includes(body.kind) ? body.kind : null; if (!kind) throw Error('Type d’opération invalide.');
      const amount = money(body.amount), date = String(body.date || t); if (!validDate(date)) throw Error('Date invalide.');
      const method = kind === 'expense' && body.method === 'card' ? 'card' : 'joint';
      const description = String(body.description || '').trim().slice(0, 160);
      const recurringId = body.recurring_id ? Number(body.recurring_id) : null, recurringDate = body.recurring_date ? String(body.recurring_date) : null;
      const proposed = !body.id && kind === 'expense' && !body.category_id && !recurringId ? merchantRuleFor(description, method) : null;
      const categoryId = kind === 'expense' ? Number(body.category_id || proposed?.category_id || 0) || null : null;
      if (categoryId && !categoryById(categoryId)) throw Error('Limite introuvable.');
      if (body.id) {
        const existing = one('SELECT id FROM transactions WHERE id=?', Number(body.id));
        if (!existing) throw Error('Transaction introuvable.');
        run('UPDATE transactions SET date=?,amount=?,kind=?,method=?,category_id=?,description=?,recurring_id=?,recurring_date=?,included=? WHERE id=?', date, amount, kind, method, categoryId, description, recurringId, recurringDate, body.included ? 1 : 0, Number(body.id));
      } else {
        run('INSERT INTO transactions(date,amount,kind,method,category_id,description,recurring_id,recurring_date,included,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', date, amount, kind, method, categoryId, description, recurringId, recurringDate, body.included ? 1 : 0, Date.now());
      }
      if (body.remember_rule && kind === 'expense' && description && categoryId) {
        const normalized = merchantKey(description);
        if (normalized.length >= 2) run(`INSERT INTO merchant_rules(merchant,normalized,category_id,method,created_at)
          VALUES(?,?,?,?,?) ON CONFLICT(normalized) DO UPDATE SET merchant=excluded.merchant,category_id=excluded.category_id,method=excluded.method,active=1`, description, normalized, categoryId, method, Date.now());
      }
      if (recurringId && recurringDate) run('INSERT OR REPLACE INTO occurrences(recurring_id,due_date,state) VALUES(?,?,?)', recurringId, recurringDate, 'paid');
      return proposed ? `Opération enregistrée · ${proposed.category_name} proposée par une règle.` : 'Opération enregistrée.';
    }
    case 'import_transactions': {
      if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 500) throw Error('Choisis entre 1 et 500 lignes CSV.');
      const included = body.included ? 1 : 0;
      const rows = body.rows.map((raw, index) => {
        const date = String(raw.date || '');
        if (!validDate(date)) throw Error(`Date invalide à la ligne ${index + 1}.`);
        const description = clean(raw.description, `Description à la ligne ${index + 1}`, 160);
        const kind = raw.kind === 'income' ? 'income' : raw.kind === 'expense' ? 'expense' : null;
        if (!kind) throw Error(`Type invalide à la ligne ${index + 1}.`);
        const amount = money(raw.amount);
        const method = kind === 'expense' && raw.method === 'card' ? 'card' : 'joint';
        const proposed = kind === 'expense' && !raw.category_id ? merchantRuleFor(description, method) : null;
        const categoryId = kind === 'expense' ? Number(raw.category_id || proposed?.category_id || 0) || null : null;
        if (categoryId && !categoryById(categoryId)) throw Error(`Limite invalide à la ligne ${index + 1}.`);
        return { date, description, kind, amount, method, categoryId, key: importKey(raw.import_key) };
      });
      let imported = 0, skipped = 0;
      db.exec('BEGIN');
      try {
        for (const row of rows) {
          if (one('SELECT import_key FROM imported_rows WHERE import_key=?', row.key)) { skipped++; continue; }
          const result = run('INSERT INTO transactions(date,amount,kind,method,category_id,description,included,created_at) VALUES(?,?,?,?,?,?,?,?)', row.date, row.amount, row.kind, row.method, row.categoryId, row.description, included, Date.now());
          run('INSERT INTO imported_rows(import_key,transaction_id) VALUES(?,?)', row.key, Number(result.lastInsertRowid));
          imported++;
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return `${imported} opération${imported > 1 ? 's' : ''} importée${imported > 1 ? 's' : ''}${skipped ? ` · ${skipped} déjà présente${skipped > 1 ? 's' : ''}` : ''}.`;
    }
    case 'classify_transactions': {
      if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 250) throw Error('Sélection invalide.');
      const categoryId = Number(body.category_id);
      if (!categoryById(categoryId)) throw Error('Choisis une limite.');
      const ids = [...new Set(body.ids.map(Number).filter(Number.isInteger))];
      if (!ids.length) throw Error('Sélection invalide.');
      const selected = q(`SELECT id FROM transactions WHERE id IN (${ids.map(() => '?').join(',')}) AND kind='expense'`, ...ids);
      if (!selected.length) throw Error('Aucune dépense à classer.');
      run(`UPDATE transactions SET category_id=? WHERE id IN (${selected.map(() => '?').join(',')})`, categoryId, ...selected.map(row => row.id));
      return `${selected.length} dépense${selected.length > 1 ? 's' : ''} classée${selected.length > 1 ? 's' : ''}.`;
    }
    case 'delete_transaction': run('DELETE FROM transactions WHERE id=?', Number(body.id)); return 'Opération supprimée.';
    case 'occurrence': {
      const rule = one('SELECT * FROM recurring WHERE id=?', Number(body.recurring_id)); if (!rule) throw Error('Règle introuvable.');
      const due = String(body.due_date || ''); if (!validDate(due)) throw Error('Date invalide.');
      if (body.state === 'skip') { run('INSERT OR REPLACE INTO occurrences(recurring_id,due_date,state) VALUES(?,?,?)', rule.id, due, 'skipped'); return 'Échéance ignorée.'; }
      if (body.state === 'move') { const moved = String(body.moved_to || ''); if (!validDate(moved)) throw Error('Choisis la nouvelle date.'); run('INSERT OR REPLACE INTO occurrences(recurring_id,due_date,state,moved_to) VALUES(?,?,?,?)', rule.id, due, 'moved', moved); return 'Échéance déplacée.'; }
      const amount = body.amount === '' ? rule.amount : money(body.amount);
      const kind = rule.kind === 'income' ? 'income' : 'expense';
      run('INSERT INTO transactions(date,amount,kind,method,category_id,description,recurring_id,recurring_date,included,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', t, amount, kind, rule.method, rule.category_id, rule.name, rule.id, due, body.included ? 1 : 0, Date.now());
      run('INSERT OR REPLACE INTO occurrences(recurring_id,due_date,state,amount) VALUES(?,?,?,?)', rule.id, due, 'paid', amount);
      return 'Échéance marquée payée.';
    }
    case 'afford': {
      const date = String(body.date || t), amount = money(body.amount); if (!validDate(date)) throw Error('Date invalide.');
      const state = buildState(), days = state.daily.filter(d => d.date >= date && d.date <= addDays(date, 30));
      if (!days.length) throw Error('Date hors de la prévision.');
      const low = days.reduce((min, d) => Math.min(min, d.safe), days[0].safe) - amount;
      return { afford: low >= 0, low, date };
    }
    case 'reset': {
      db.exec('BEGIN');
      try { db.exec('DELETE FROM occurrences; DELETE FROM transactions; DELETE FROM recurring; DELETE FROM categories; DELETE FROM settings;'); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
      return 'Nouvelle base vide créée.';
    }
    default: throw Error('Action inconnue.');
  }
}
function budget(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Mois invalide.');
  const first = `${month}-01`, last = iso(new Date(Date.UTC(+month.slice(0,4), +month.slice(5,7), 0)));
  const categories = q('SELECT * FROM categories WHERE active=1 ORDER BY name COLLATE NOCASE');
  const transactions = q('SELECT * FROM transactions WHERE date>=? AND date<=?', first, last);
  const entries = categories.map(c => {
    const starts = categoryStarts(c, last).filter(d => d >= first && d <= last);
    const planned = starts.length * c.amount;
    const spent = transactions.filter(t => t.kind === 'expense' && t.category_id === c.id).reduce((sum, t) => sum + t.amount, 0);
    return { ...c, planned, spent, remaining: planned - spent };
  });
  const recurring = allOccurrences(first, last);
  const income = recurring.filter(e => e.kind === 'income').reduce((sum,e) => sum + e.amount, 0);
  const fixed = recurring.filter(e => e.kind === 'expense').reduce((sum,e) => sum + e.amount, 0);
  return { month, categories: entries, income, fixed, variable: entries.reduce((sum,e) => sum + e.planned,0), actualVariable: entries.reduce((sum,e) => sum + e.spent,0) };
}

function respond(res, value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); }
function readBody(req, callback) {
  let length = 0; const chunks = [];
  req.on('data', chunk => { length += chunk.length; if (length <= 512 * 1024) chunks.push(chunk); });
  req.on('end', () => { if (length > 512 * 1024) return callback(Error('Requête trop volumineuse')); try { callback(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { callback(Error('Données JSON invalides')); } });
  req.on('error', () => callback(Error('Lecture impossible')));
}
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/state') return respond(res, buildState());
  if (url.pathname === '/api/budget') { try { return respond(res, budget(url.searchParams.get('month') || today().slice(0,7))); } catch (error) { return respond(res, { error: error.message }, 400); } }
  if (url.pathname === '/api/export') {
    const tables = {}; for (const name of ['settings','categories','recurring','transactions','occurrences','limit_overrides','merchant_rules','imported_rows']) tables[name] = q(`SELECT * FROM ${name}`);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="le-bas-de-laine-${today()}.json"` }); return res.end(JSON.stringify({ format: 'le-bas-de-laine-v3', exported: today(), tables }, null, 2));
  }
  if (url.pathname === '/api/action' && req.method === 'POST') return readBody(req, (error, body) => { if (error) return respond(res, { error: error.message }, 400); try { const note = action(body); if (note && typeof note === 'object') return respond(res, note); const state = buildState(); state.note = note; respond(res, state); } catch (err) { respond(res, { error: err.message }, 400); } });
  const requested = url.pathname === '/' ? 'index.html' : url.pathname === '/simple' ? 'simple.html' : url.pathname.replace(/^\//, '');
  const file = path.resolve(PUBLIC, requested);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Introuvable'); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.end(fs.readFileSync(file));
}).listen(PORT, '0.0.0.0', () => console.log(`Le Bas de Laine v1.4.0 — http://localhost:${PORT}`));
