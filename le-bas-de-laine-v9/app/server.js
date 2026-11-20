'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { addDays, compareDate, recurringOccurrences, simulate, validDate } = require('./lib/engine');

const PORT = Number(process.env.PORT || 3050);
const DATA = process.env.BDL9_DATA || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const VERSION = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim();
const DB_PATH = path.join(DATA, 'le-bas-de-laine-v9.sqlite');
const MAX_BODY = 50 * 1024;
fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });

function appToday() {
  return process.env.BDL9_TODAY || new Date().toISOString().slice(0, 10);
}

function copyDailyBackup() {
  if (!fs.existsSync(DB_PATH)) return;
  const folder = path.join(DATA, 'sauvegardes');
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const target = path.join(folder, `le-bas-de-laine-${appToday()}.sqlite`);
  if (!fs.existsSync(target)) fs.copyFileSync(DB_PATH, target);
}

copyDailyBackup();
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

function migrate() {
  let version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 1) db.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
      frequency TEXT NOT NULL,
      anchor_date TEXT NOT NULL,
      second_day INTEGER,
      adjustment TEXT NOT NULL DEFAULT 'none',
      mode TEXT NOT NULL DEFAULT 'period',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE recurring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('income', 'bill')),
      amount_cents INTEGER NOT NULL,
      frequency TEXT NOT NULL,
      anchor_date TEXT NOT NULL,
      second_day INTEGER,
      adjustment TEXT NOT NULL DEFAULT 'none',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      limit_id INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(limit_id) REFERENCES limits(id) ON DELETE SET NULL
    );
    CREATE TABLE occurrence_states (
      recurring_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('paid', 'skipped')),
      moved_to TEXT,
      amount_cents INTEGER,
      PRIMARY KEY(recurring_id, due_date),
      FOREIGN KEY(recurring_id) REFERENCES recurring(id) ON DELETE CASCADE
    );
    CREATE INDEX transactions_date_idx ON transactions(date);
    CREATE INDEX transactions_limit_idx ON transactions(limit_id, date);
    PRAGMA user_version=1;
  `);
  version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 2) {
    db.exec("ALTER TABLE limits ADD COLUMN date_mode TEXT NOT NULL DEFAULT 'anchor';");
    db.exec("ALTER TABLE recurring ADD COLUMN date_mode TEXT NOT NULL DEFAULT 'anchor';");
    db.exec('PRAGMA user_version=2;');
  }
  version = db.prepare('PRAGMA user_version').get().user_version;
  if (version < 3) {
    // SQLite ne sait pas élargir un CHECK. Une occurrence peut maintenant être
    // modifiée une fois (montant/date) sans devenir une facture permanente.
    db.exec(`
      CREATE TABLE occurrence_states_v3 (
        recurring_id INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        state TEXT NOT NULL,
        moved_to TEXT,
        amount_cents INTEGER,
        PRIMARY KEY(recurring_id, due_date),
        FOREIGN KEY(recurring_id) REFERENCES recurring(id) ON DELETE CASCADE
      );
      INSERT INTO occurrence_states_v3(recurring_id,due_date,state,moved_to,amount_cents)
        SELECT recurring_id,due_date,state,moved_to,amount_cents FROM occurrence_states;
      DROP TABLE occurrence_states;
      ALTER TABLE occurrence_states_v3 RENAME TO occurrence_states;
      PRAGMA user_version=3;
    `);
  }
}
migrate();

const all = (sql, ...args) => db.prepare(sql).all(...args);
const one = (sql, ...args) => db.prepare(sql).get(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);
const getSetting = (key, fallback = '') => (one('SELECT value FROM settings WHERE key=?', key) || {}).value ?? fallback;
const setSetting = (key, value) => run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value));

function settings() {
  return {
    configured: getSetting('configured', '0') === '1',
    balance_cents: Number(getSetting('balance_cents', '0')),
    balance_verified_on: getSetting('balance_verified_on', ''),
    theme: getSetting('theme', 'system'),
    owner_name: getSetting('owner_name', ''),
    share_token: getSetting('share_token', '')
  };
}

function setBalance(value, date) {
  setSetting('balance_cents', value);
  setSetting('balance_verified_on', date);
}

function json(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  response.end(text);
}

function fail(response, status, message) {
  json(response, status, { error: message });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let received = 0;
    let text = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      received += Buffer.byteLength(chunk);
      if (received > MAX_BODY) {
        reject(Error('La demande est trop grande.'));
        request.destroy();
        return;
      }
      text += chunk;
    });
    request.on('end', () => {
      try { resolve(text ? JSON.parse(text) : {}); } catch { reject(Error('Le format envoyé est invalide.')); }
    });
    request.on('error', reject);
  });
}

function clean(value, label, max = 80) {
  const result = String(value || '').trim();
  if (!result || result.length > max) throw Error(`${label} est requis.`);
  return result;
}

function integer(value, label, { min = -9_000_000_000, max = 9_000_000_000 } = {}) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) throw Error(`${label} est invalide.`);
  return result;
}

const FREQUENCIES = new Set(['weekly', 'biweekly', 'monthly', 'twice_monthly', 'quarterly', 'semiannual', 'yearly']);
const ADJUSTMENTS = new Set(['none', 'previous', 'next']);
const DATE_MODES = new Set(['anchor', 'last_day', 'last_business_day']);

function recurrenceInput(payload, current = {}) {
  const kind = payload.kind === 'income' ? 'income' : payload.kind === 'bill' ? 'bill' : null;
  if (!kind) throw Error('Choisis revenu ou facture.');
  const frequency = String(payload.frequency || '');
  if (!FREQUENCIES.has(frequency)) throw Error('Fréquence invalide.');
  const anchor = String(payload.anchor_date || '');
  if (!validDate(anchor)) throw Error('Date de départ invalide.');
  const adjustment = String(payload.adjustment || 'none');
  if (!ADJUSTMENTS.has(adjustment)) throw Error('Déplacement invalide.');
  const dateMode = String(payload.date_mode || 'anchor');
  if (!DATE_MODES.has(dateMode)) throw Error('Mode de date invalide.');
  const amount = integer(payload.amount_cents, 'Montant', { min: 1, max: 999_999_999 });
  const second = frequency === 'twice_monthly' ? integer(payload.second_day, 'Deuxième jour', { min: 1, max: 31 }) : null;
  return {
    name: clean(payload.name, 'Nom'), kind,
    amount_cents: kind === 'income' ? amount : -amount,
    frequency, anchor_date: anchor, second_day: second, adjustment, date_mode: dateMode,
    active: payload.active === false ? 0 : 1,
    created_at: current.created_at || Date.now()
  };
}

function limitInput(payload, current = {}) {
  const frequency = String(payload.frequency || '');
  if (!FREQUENCIES.has(frequency)) throw Error('Fréquence invalide.');
  const anchor = String(payload.anchor_date || '');
  if (!validDate(anchor)) throw Error('Première date invalide.');
  const adjustment = String(payload.adjustment || 'none');
  if (!ADJUSTMENTS.has(adjustment)) throw Error('Déplacement invalide.');
  const dateMode = String(payload.date_mode || 'anchor');
  if (!DATE_MODES.has(dateMode)) throw Error('Mode de date invalide.');
  const mode = payload.mode === 'monthly_flexible' ? 'monthly_flexible' : 'period';
  const second = frequency === 'twice_monthly' ? integer(payload.second_day, 'Deuxième jour', { min: 1, max: 31 }) : null;
  return {
    name: clean(payload.name, 'Nom'),
    amount_cents: integer(payload.amount_cents, 'Montant', { min: 1, max: 999_999_999 }),
    frequency, anchor_date: anchor, second_day: second, adjustment, date_mode: dateMode, mode,
    active: payload.active === false ? 0 : 1,
    sort_order: integer(payload.sort_order ?? current.sort_order ?? 0, 'Ordre', { min: 0, max: 99_999 }),
    created_at: current.created_at || Date.now()
  };
}

function transactionInput(payload) {
  const date = String(payload.date || '');
  if (!validDate(date)) throw Error('Date invalide.');
  const kind = payload.kind === 'income' ? 'income' : 'expense';
  const amount = integer(payload.amount_cents, 'Montant', { min: 1, max: 999_999_999 });
  const limitId = payload.limit_id === null || payload.limit_id === '' || payload.limit_id === undefined ? null : integer(payload.limit_id, 'Limite', { min: 1 });
  if (limitId && !one('SELECT id FROM limits WHERE id=?', limitId)) throw Error('La limite choisie est introuvable.');
  return {
    date, description: clean(payload.description, 'Description'),
    amount_cents: kind === 'income' ? amount : -amount,
    limit_id: limitId, created_at: Date.now()
  };
}

function records() {
  return {
    limits: all('SELECT * FROM limits WHERE active=1 ORDER BY sort_order, name'),
    recurring: all('SELECT * FROM recurring WHERE active=1 ORDER BY kind DESC, name'),
    transactions: all('SELECT * FROM transactions ORDER BY date DESC, id DESC'),
    occurrenceStates: all('SELECT * FROM occurrence_states')
  };
}

function buildState(asOf = appToday(), horizon = 30) {
  const prefs = settings();
  const data = records();
  const forecast = simulate({
    asOfDate: asOf,
    balance_cents: prefs.balance_cents,
    transactions: data.transactions,
    recurring: data.recurring,
    limits: data.limits,
    occurrenceStates: data.occurrenceStates,
    days: horizon
  });
  const limitRows = data.limits.map(limit => forecast.days[0].limits.find(item => item.id === limit.id) || {
    id: limit.id, name: limit.name, budget_cents: limit.amount_cents, spent_cents: 0,
    remaining_cents: limit.amount_cents, reserve_cents: 0, start: null, end: null, next_start: limit.anchor_date, mode: limit.mode
  });
  return {
    version: VERSION, today: asOf, settings: prefs, forecast, limits: limitRows,
    limit_config: data.limits, recurring: data.recurring,
    transactions: data.transactions.slice(0, 100)
  };
}

function occurrenceList(from, to) {
  const data = records();
  const overrides = new Map(data.occurrenceStates.map(item => [`${item.recurring_id}:${item.due_date}`, item]));
  return data.recurring.flatMap(rule => recurringOccurrences(rule, from, to, overrides)).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

function withCurrentBalanceChange(oldItem, nextItem) {
  const today = appToday();
  const oldEffect = oldItem && compareDate(oldItem.date, today) <= 0 ? oldItem.amount_cents : 0;
  const nextEffect = nextItem && compareDate(nextItem.date, today) <= 0 ? nextItem.amount_cents : 0;
  if (oldEffect !== nextEffect) setSetting('balance_cents', settings().balance_cents - oldEffect + nextEffect);
}

function removeRecord(table, id) {
  const item = one(`SELECT * FROM ${table} WHERE id=?`, id);
  if (!item) throw Error('Élément introuvable.');
  if (table === 'transactions') withCurrentBalanceChange(item, null);
  run(`DELETE FROM ${table} WHERE id=?`, id);
}

async function handleApi(request, response, url) {
  const method = request.method;
  const pathname = url.pathname;
  if (method === 'GET' && pathname === '/api/export') {
    const backup = {
      format: 'le-bas-de-laine-v9',
      version: VERSION,
      exported_at: new Date().toISOString(),
      settings: settings(),
      limits: all('SELECT * FROM limits ORDER BY sort_order, name'),
      recurring: all('SELECT * FROM recurring ORDER BY id'),
      transactions: all('SELECT * FROM transactions ORDER BY id'),
      occurrence_states: all('SELECT * FROM occurrence_states ORDER BY recurring_id, due_date')
    };
    const text = JSON.stringify(backup, null, 2);
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="le-bas-de-laine-${appToday()}.json"`,
      'Content-Length': Buffer.byteLength(text),
      'Cache-Control': 'no-store'
    });
    return response.end(text);
  }
  if (method === 'GET' && pathname === '/api/state') {
    const requested = url.searchParams.get('date') || appToday();
    if (!validDate(requested)) return fail(response, 400, 'Date invalide.');
    return json(response, 200, buildState(requested, 30));
  }
  if (method === 'GET' && pathname === '/api/calendar') {
    const month = url.searchParams.get('month') || appToday().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return fail(response, 400, 'Mois invalide.');
    const first = `${month}-01`;
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const start = compareDate(first, appToday()) < 0 ? appToday() : first;
    const horizon = Math.max(0, Math.ceil((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));
    const state = buildState(start, horizon);
    return json(response, 200, { month, state, occurrences: occurrenceList(first, last) });
  }
  if (method === 'GET' && pathname === '/api/simple') {
    const state = buildState(appToday(), 30);
    return json(response, 200, { version: VERSION, today: state.today, forecast: state.forecast });
  }
  if (method === 'POST' && pathname === '/api/setup') {
    const payload = await readJson(request);
    const balance = integer(payload.balance_cents, 'Solde', { min: -9_000_000_000, max: 9_000_000_000 });
    const date = String(payload.date || appToday());
    if (!validDate(date)) throw Error('Date de vérification invalide.');
    setBalance(balance, date);
    setSetting('configured', '1');
    setSetting('owner_name', String(payload.owner_name || '').trim().slice(0, 60));
    if (!getSetting('share_token')) setSetting('share_token', crypto.randomBytes(18).toString('base64url'));
    return json(response, 201, buildState(appToday(), 30));
  }
  if (method === 'PUT' && pathname === '/api/settings') {
    const payload = await readJson(request);
    if (payload.theme && !['light', 'dark', 'system'].includes(payload.theme)) throw Error('Thème invalide.');
    if (payload.theme) setSetting('theme', payload.theme);
    if (payload.balance_cents !== undefined) {
      const amount = integer(payload.balance_cents, 'Solde', { min: -9_000_000_000, max: 9_000_000_000 });
      const date = String(payload.balance_verified_on || appToday());
      if (!validDate(date)) throw Error('Date de vérification invalide.');
      setBalance(amount, date);
    }
    return json(response, 200, buildState(appToday(), 30));
  }
  if (method === 'POST' && pathname === '/api/check-purchase') {
    const payload = await readJson(request);
    const amount = integer(payload.amount_cents, 'Montant', { min: 1, max: 999_999_999 });
    const date = String(payload.date || appToday());
    if (!validDate(date)) throw Error('Date invalide.');
    const base = buildState(appToday(), 30);
    const state = records();
    const hypothetical = { id: -1, date, description: 'Achat envisagé', amount_cents: -amount, limit_id: null };
    const result = simulate({
      asOfDate: appToday(),
      balance_cents: compareDate(date, appToday()) <= 0 ? base.settings.balance_cents - amount : base.settings.balance_cents,
      transactions: date > appToday() ? [...state.transactions, hypothetical] : state.transactions,
      recurring: state.recurring, limits: state.limits, occurrenceStates: state.occurrenceStates, days: 30
    });
    return json(response, 200, { can_afford: result.minimum_cents >= 0, minimum_cents: result.minimum_cents, minimum_date: result.minimum_date, available_cents: result.available_cents });
  }
  const occurrenceMatch = pathname.match(/^\/api\/occurrences\/(\d+)\/(\d{4}-\d{2}-\d{2})$/);
  if (occurrenceMatch && (method === 'PUT' || method === 'DELETE')) {
    const recurringId = Number(occurrenceMatch[1]);
    const dueDate = occurrenceMatch[2];
    const rule = one('SELECT * FROM recurring WHERE id=?', recurringId);
    if (!rule || !validDate(dueDate)) throw Error('Occurrence introuvable.');
    if (method === 'DELETE') {
      run('DELETE FROM occurrence_states WHERE recurring_id=? AND due_date=?', recurringId, dueDate);
      return json(response, 200, { ok: true });
    }
    const payload = await readJson(request);
    const state = ['changed', 'paid', 'skipped'].includes(payload.state) ? payload.state : 'changed';
    const movedTo = payload.moved_to ? String(payload.moved_to) : null;
    if (movedTo && !validDate(movedTo)) throw Error('Nouvelle date invalide.');
    const unsignedAmount = payload.amount_cents === undefined || payload.amount_cents === null ? Math.abs(rule.amount_cents) : integer(payload.amount_cents, 'Montant', { min: 1, max: 999_999_999 });
    const amount = rule.kind === 'income' ? unsignedAmount : -unsignedAmount;
    run('INSERT INTO occurrence_states(recurring_id,due_date,state,moved_to,amount_cents) VALUES(?,?,?,?,?) ON CONFLICT(recurring_id,due_date) DO UPDATE SET state=excluded.state,moved_to=excluded.moved_to,amount_cents=excluded.amount_cents', recurringId, dueDate, state, movedTo, amount);
    return json(response, 200, { ok: true });
  }
  if (pathname === '/api/limits' && method === 'POST') {
    const value = limitInput(await readJson(request));
    const result = run('INSERT INTO limits(name,amount_cents,frequency,anchor_date,second_day,adjustment,date_mode,mode,active,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', value.name, value.amount_cents, value.frequency, value.anchor_date, value.second_day, value.adjustment, value.date_mode, value.mode, value.active, value.sort_order, value.created_at);
    return json(response, 201, { id: Number(result.lastInsertRowid) });
  }
  if (pathname === '/api/recurring' && method === 'POST') {
    const value = recurrenceInput(await readJson(request));
    const result = run('INSERT INTO recurring(name,kind,amount_cents,frequency,anchor_date,second_day,adjustment,date_mode,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)', value.name, value.kind, value.amount_cents, value.frequency, value.anchor_date, value.second_day, value.adjustment, value.date_mode, value.active, value.created_at);
    return json(response, 201, { id: Number(result.lastInsertRowid) });
  }
  if (pathname === '/api/transactions' && method === 'POST') {
    const value = transactionInput(await readJson(request));
    const result = run('INSERT INTO transactions(date,description,amount_cents,limit_id,created_at) VALUES(?,?,?,?,?)', value.date, value.description, value.amount_cents, value.limit_id, value.created_at);
    withCurrentBalanceChange(null, { ...value, id: Number(result.lastInsertRowid) });
    return json(response, 201, { id: Number(result.lastInsertRowid) });
  }
  const itemMatch = pathname.match(/^\/api\/(limits|recurring|transactions)\/(\d+)$/);
  if (itemMatch && (method === 'PUT' || method === 'DELETE')) {
    const [, table, textId] = itemMatch;
    const id = Number(textId);
    if (method === 'DELETE') {
      removeRecord(table, id);
      return json(response, 200, { ok: true });
    }
    const old = one(`SELECT * FROM ${table} WHERE id=?`, id);
    if (!old) throw Error('Élément introuvable.');
    const payload = await readJson(request);
    if (table === 'limits') {
      const value = limitInput(payload, old);
      run('UPDATE limits SET name=?,amount_cents=?,frequency=?,anchor_date=?,second_day=?,adjustment=?,date_mode=?,mode=?,active=?,sort_order=? WHERE id=?', value.name, value.amount_cents, value.frequency, value.anchor_date, value.second_day, value.adjustment, value.date_mode, value.mode, value.active, value.sort_order, id);
    } else if (table === 'recurring') {
      const value = recurrenceInput(payload, old);
      run('UPDATE recurring SET name=?,kind=?,amount_cents=?,frequency=?,anchor_date=?,second_day=?,adjustment=?,date_mode=?,active=? WHERE id=?', value.name, value.kind, value.amount_cents, value.frequency, value.anchor_date, value.second_day, value.adjustment, value.date_mode, value.active, id);
    } else {
      const value = transactionInput(payload);
      withCurrentBalanceChange(old, value);
      run('UPDATE transactions SET date=?,description=?,amount_cents=?,limit_id=? WHERE id=?', value.date, value.description, value.amount_cents, value.limit_id, id);
    }
    return json(response, 200, { ok: true });
  }
  return fail(response, 404, 'Adresse API introuvable.');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
function serveStatic(request, response, pathname) {
  const aliases = { '/': '/index.html', '/simple': '/simple.html' };
  const wanted = aliases[pathname] || pathname;
  const file = path.resolve(PUBLIC, `.${wanted}`);
  if (!file.startsWith(`${PUBLIC}${path.sep}`)) return fail(response, 403, 'Accès refusé.');
  fs.readFile(file, (error, data) => {
    if (error) return fail(response, 404, 'Page introuvable.');
    response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return fail(response, 405, 'Méthode non permise.');
    return serveStatic(request, response, url.pathname);
  } catch (error) {
    if (response.writableEnded) return;
    console.error(error);
    return fail(response, 400, error.message || 'Erreur inattendue.');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Le Bas de Laine v${VERSION} : http://localhost:${PORT}`);
});
