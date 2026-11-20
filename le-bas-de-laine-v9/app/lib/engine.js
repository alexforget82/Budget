'use strict';

/*
 * Le moteur ne connaît ni HTML ni SQLite. Toutes les sommes sont en cents et
 * toutes les dates sont des YYYY-MM-DD UTC. Cette séparation permet de tester
 * chaque montant affiché avant de l'utiliser dans l'interface.
 */

const DAY = 86_400_000;
const pad = n => String(n).padStart(2, '0');
const parseDate = value => {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
const dateISO = date => date.toISOString().slice(0, 10);
const addDays = (value, amount) => dateISO(new Date(parseDate(value).getTime() + amount * DAY));
const compareDate = (a, b) => String(a).localeCompare(String(b));
const weekday = value => parseDate(value).getUTCDay();
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && dateISO(parseDate(value)) === value;
const startOfMonth = value => `${String(value).slice(0, 7)}-01`;
const endOfMonth = value => {
  const date = parseDate(startOfMonth(value));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return dateISO(date);
};

function addMonths(value, months, preferredDay) {
  const source = parseDate(value);
  const desired = preferredDay || source.getUTCDate();
  const target = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(desired, last));
  return dateISO(target);
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

function observed(value) {
  const day = weekday(value);
  return day === 6 ? addDays(value, 2) : day === 0 ? addDays(value, 1) : value;
}

// Jours où le système canadien de paiement est normalement fermé au Québec.
// Les règles de paie peuvent toujours choisir "avant" ou "après" pour un cas
// particulier; l'application n'impose jamais une convention sans l'afficher.
function paymentHolidays(year) {
  const nthMonday = (month, nth) => {
    let value = `${year}-${pad(month)}-01`;
    while (weekday(value) !== 1) value = addDays(value, 1);
    return addDays(value, 7 * (nth - 1));
  };
  const easter = easterSunday(year);
  let patriots = `${year}-05-24`;
  while (weekday(patriots) !== 1) patriots = addDays(patriots, -1);
  const christmas = `${year}-12-25`;
  const boxing = `${year}-12-26`;
  const holidays = new Set([
    observed(`${year}-01-01`),
    addDays(easter, -2),
    patriots,
    observed(`${year}-06-24`),
    observed(`${year}-07-01`),
    nthMonday(9, 1),
    `${year}-09-30`,
    nthMonday(10, 2),
    `${year}-11-11`,
    observed(christmas),
    observed(boxing)
  ]);
  // Noël le samedi : lundi pour Noël et mardi pour Boxing Day.
  if (weekday(christmas) === 6) {
    holidays.add(`${year}-12-28`);
  }
  return holidays;
}

function isBusinessDay(value) {
  const day = weekday(value);
  return day !== 0 && day !== 6 && !paymentHolidays(Number(value.slice(0, 4))).has(value);
}

function adjustBusinessDay(value, adjustment = 'none') {
  if (adjustment === 'none' || isBusinessDay(value)) return value;
  const direction = adjustment === 'previous' ? -1 : 1;
  let adjusted = value;
  while (!isBusinessDay(adjusted)) adjusted = addDays(adjusted, direction);
  return adjusted;
}

function lastBusinessDay(value) {
  let result = endOfMonth(value);
  while (!isBusinessDay(result)) result = addDays(result, -1);
  return result;
}

const intervalDays = { weekly: 7, biweekly: 14 };
const intervalMonths = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 };

function rawRecurringDates(rule, from, to) {
  if (!rule.active || !validDate(rule.anchor_date)) return [];
  const frequency = rule.frequency;
  const anchor = rule.anchor_date;
  const values = [];
  if (frequency === 'twice_monthly') {
    const dayOne = Number(anchor.slice(8, 10));
    const dayTwo = Number(rule.second_day || 15);
    let month = startOfMonth(compareDate(from, anchor) > 0 ? from : anchor);
    month = addMonths(month, -1, 1);
    while (compareDate(month, to) <= 0) {
      const candidateOne = addMonths(month, 0, dayOne);
      const candidateTwo = addMonths(month, 0, dayTwo);
      for (const candidate of [candidateOne, candidateTwo]) {
        if (compareDate(candidate, anchor) >= 0 && compareDate(candidate, from) >= 0 && compareDate(candidate, to) <= 0) values.push(candidate);
      }
      month = addMonths(month, 1, 1);
    }
  } else if (intervalDays[frequency]) {
    const step = intervalDays[frequency];
    let value = anchor;
    if (compareDate(value, from) < 0) {
      const distance = Math.floor((parseDate(from) - parseDate(value)) / DAY);
      value = addDays(value, Math.floor(distance / step) * step);
      while (compareDate(value, from) < 0) value = addDays(value, step);
    }
    while (compareDate(value, to) <= 0) {
      values.push(value);
      value = addDays(value, step);
    }
  } else if (intervalMonths[frequency]) {
    const step = intervalMonths[frequency];
    const preferredDay = Number(anchor.slice(8, 10));
    const monthMode = rule.date_mode || 'anchor';
    const candidate = cycle => {
      const month = addMonths(startOfMonth(anchor), cycle * step, 1);
      if (monthMode === 'last_day') return endOfMonth(month);
      if (monthMode === 'last_business_day') return lastBusinessDay(month);
      return addMonths(month, 0, preferredDay);
    };
    let cycle = 0;
    let value = candidate(cycle);
    while (compareDate(value, anchor) < 0 || compareDate(value, from) < 0) value = candidate(++cycle);
    while (compareDate(value, to) <= 0) {
      values.push(value);
      value = candidate(++cycle);
    }
  }
  return [...new Set(values)].sort();
}

function recurringOccurrences(rule, from, to, overrides = new Map()) {
  return rawRecurringDates(rule, from, to).map(rawDate => {
    const key = `${rule.id}:${rawDate}`;
    const override = overrides.get(key);
    if (override?.state === 'skipped' || override?.state === 'paid') return null;
    const date = override?.moved_to || adjustBusinessDay(rawDate, rule.adjustment || 'none');
    if (compareDate(date, from) < 0 || compareDate(date, to) > 0) return null;
    return {
      id: `recurring:${rule.id}:${rawDate}`,
      type: rule.kind === 'income' ? 'income' : 'bill',
      date,
      rawDate,
      name: rule.name,
      amount_cents: override?.amount_cents ?? rule.amount_cents,
      recurring_id: rule.id,
      adjusted: date !== rawDate
    };
  }).filter(Boolean);
}

function periodStarts(limit, from, to) {
  return rawRecurringDates({
    id: limit.id,
    active: limit.active !== 0,
    anchor_date: limit.anchor_date,
    frequency: limit.frequency,
    second_day: limit.second_day,
    date_mode: limit.date_mode
  }, from, to);
}

function activePeriod(limit, date) {
  if (!limit.active || !validDate(limit.anchor_date) || compareDate(date, limit.anchor_date) < 0) return null;
  const probeStart = addMonths(date, -14, 1);
  const probeEnd = addMonths(date, 14, 1);
  const starts = periodStarts(limit, probeStart, probeEnd).filter(value => compareDate(value, date) <= 0);
  const start = starts.at(-1);
  if (!start) return null;
  const next = periodStarts(limit, addDays(start, 1), probeEnd).find(value => compareDate(value, start) > 0);
  return { start, end: next ? addDays(next, -1) : addMonths(start, 12, 1) };
}

function centsSpent(transactions, limitId, from, to) {
  return transactions
    .filter(item => item.limit_id === limitId && item.amount_cents < 0 && compareDate(item.date, from) >= 0 && compareDate(item.date, to) <= 0)
    .reduce((sum, item) => sum + Math.abs(item.amount_cents), 0);
}

function activeLimitReserve(limit, date, transactions) {
  const period = activePeriod(limit, date);
  if (!period) return null;
  if (limit.mode === 'monthly_flexible') {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const starts = periodStarts(limit, monthStart, monthEnd).filter(value => compareDate(value, date) <= 0);
    const released = starts.length * limit.amount_cents;
    const spent = centsSpent(transactions, limit.id, monthStart, date);
    const totalPeriods = periodStarts(limit, monthStart, monthEnd).length;
    const monthCap = totalPeriods * limit.amount_cents;
    return {
      id: limit.id,
      name: limit.name,
      start: monthStart,
      end: monthEnd,
      next_start: periodStarts(limit, addDays(date, 1), addMonths(monthEnd, 2, 1)).find(value => compareDate(value, date) > 0) || null,
      budget_cents: monthCap,
      released_cents: released,
      spent_cents: spent,
      reserve_cents: Math.max(0, released - spent),
      remaining_cents: Math.max(0, monthCap - spent),
      mode: 'monthly_flexible'
    };
  }
  const spent = centsSpent(transactions, limit.id, period.start, date);
  return {
    id: limit.id,
    name: limit.name,
    start: period.start,
    end: period.end,
    next_start: addDays(period.end, 1),
    budget_cents: limit.amount_cents,
    released_cents: limit.amount_cents,
    spent_cents: spent,
    reserve_cents: Math.max(0, limit.amount_cents - spent),
    remaining_cents: Math.max(0, limit.amount_cents - spent),
    mode: 'period'
  };
}

// Une protection n'est pas un mouvement bancaire. C'est toutefois un moment
// important de la prévision : il doit donc être visible, sous le vrai nom de
// la limite, dans la ligne du jour et le calendrier. On ne l'ajoute jamais au
// solde; la réserve est calculée séparément par activeLimitReserve().
function limitProtectionEvent(limit, date) {
  if (!limit.active || !validDate(limit.anchor_date)) return null;
  if (!periodStarts(limit, date, date).includes(date)) return null;
  return {
    id: `reserve:${limit.id}:${date}`,
    type: 'reserve',
    date,
    name: `${limit.name} · réserve`,
    amount_cents: -Math.abs(Number(limit.amount_cents || 0)),
    limit_id: limit.id
  };
}

function simulate({ asOfDate, balance_cents, transactions = [], recurring = [], limits = [], occurrenceStates = [], pendingBills = [], days = 30 }) {
  if (!validDate(asOfDate)) throw Error('Date de référence invalide.');
  const end = addDays(asOfDate, days);
  const overrideMap = new Map(occurrenceStates.map(item => [`${item.recurring_id}:${item.due_date}`, item]));
  const events = [];
  for (const item of transactions) {
    if (compareDate(item.date, asOfDate) > 0 && compareDate(item.date, end) <= 0) {
      events.push({ id: `transaction:${item.id}`, type: item.amount_cents >= 0 ? 'income' : 'transaction', date: item.date, name: item.description || 'Transaction', amount_cents: item.amount_cents, limit_id: item.limit_id || null });
    }
  }
  for (const rule of recurring) events.push(...recurringOccurrences(rule, addDays(asOfDate, 1), end, overrideMap));
  const grouped = new Map();
  for (const event of events) {
    const list = grouped.get(event.date) || [];
    list.push(event);
    grouped.set(event.date, list);
  }
  let cash = Number(balance_cents || 0) + pendingBills.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
  const daysOut = [];
  let minimum = null;
  for (let offset = 0; offset <= days; offset += 1) {
    const date = addDays(asOfDate, offset);
    // Seuls les mouvements connus modifient le solde. Les protections de
    // limites servent à expliquer la réserve, sans jamais être déduites une
    // deuxième fois du compte.
    const cashEvents = grouped.get(date) || [];
    if (offset > 0) cash += cashEvents.reduce((sum, event) => sum + Number(event.amount_cents), 0);
    const protectionEvents = limits.map(limit => limitProtectionEvent(limit, date)).filter(Boolean);
    const dayEvents = offset === 0
      ? [...cashEvents, ...pendingBills, ...protectionEvents]
      : [...cashEvents, ...protectionEvents];
    const reserves = limits.map(limit => activeLimitReserve(limit, date, transactions)).filter(Boolean);
    const reserveTotal = reserves.reduce((sum, item) => sum + item.reserve_cents, 0);
    const available = cash - reserveTotal;
    const row = { date, cash_cents: cash, reserve_cents: reserveTotal, available_cents: available, events: dayEvents, limits: reserves };
    daysOut.push(row);
    if (!minimum || row.available_cents < minimum.available_cents) minimum = row;
  }
  const futureEvents = daysOut
    .flatMap(day => day.events)
    .filter(event => compareDate(event.date, asOfDate) > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return {
    as_of: asOfDate,
    balance_cents: Number(balance_cents || 0),
    available_cents: daysOut[0].available_cents,
    reserve_cents: daysOut[0].reserve_cents,
    minimum_cents: minimum.available_cents,
    minimum_date: minimum.date,
    days: daysOut,
    events: futureEvents,
    next_income: futureEvents.find(item => item.type === 'income') || null,
    next_bill: futureEvents.find(item => item.type === 'bill') || null,
    pending_bills: pendingBills
  };
}

module.exports = {
  addDays, addMonths, activeLimitReserve, adjustBusinessDay, compareDate,
  endOfMonth, isBusinessDay, lastBusinessDay, paymentHolidays, rawRecurringDates,
  recurringOccurrences, simulate, startOfMonth, validDate
};
