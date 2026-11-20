'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adjustBusinessDay, lastBusinessDay, paymentHolidays, rawRecurringDates, recurringOccurrences, simulate } = require('../lib/engine');

const weeklyGroceries = {
  id: 1,
  name: 'Épicerie',
  amount_cents: 22_500,
  frequency: 'weekly',
  anchor_date: '2026-11-19',
  active: 1,
  mode: 'period'
};

test('une limite active protège le disponible sans créer de mouvement bancaire', () => {
  const result = simulate({
    asOfDate: '2026-11-19', balance_cents: 100_000, limits: [weeklyGroceries]
  });
  assert.equal(result.available_cents, 77_500);
  assert.equal(result.reserve_cents, 22_500);
});

test('un achat déjà encaissé consomme sa réserve sans deuxième déduction', () => {
  const result = simulate({
    asOfDate: '2026-11-19',
    // 1 000 $ moins l'achat réel de 71,69 $.
    balance_cents: 92_831,
    limits: [weeklyGroceries],
    transactions: [{ id: 3, date: '2026-11-19', amount_cents: -7_169, limit_id: 1, description: 'IGA' }]
  });
  assert.equal(result.reserve_cents, 15_331);
  assert.equal(result.available_cents, 77_500);
});

test('une limite mensuelle souple est financée semaine par semaine', () => {
  const limit = { ...weeklyGroceries, mode: 'monthly_flexible', anchor_date: '2026-11-05' };
  const start = simulate({ asOfDate: '2026-11-05', balance_cents: 100_000, limits: [limit] });
  const followingWeek = simulate({ asOfDate: '2026-11-12', balance_cents: 100_000, limits: [limit] });
  assert.equal(start.reserve_cents, 22_500);
  assert.equal(followingWeek.reserve_cents, 45_000);
  assert.equal(followingWeek.days[0].limits[0].budget_cents, 90_000);
});

test('la limite mensuelle souple peut absorber un dépassement hebdomadaire', () => {
  const limit = { ...weeklyGroceries, mode: 'monthly_flexible', anchor_date: '2026-11-05' };
  const result = simulate({
    asOfDate: '2026-11-12',
    balance_cents: 70_000,
    limits: [limit],
    transactions: [{ id: 4, date: '2026-11-11', amount_cents: -30_000, limit_id: 1, description: 'IGA' }]
  });
  // 45 000 $ avaient été rendus disponibles en deux jeudis; 30 000 $ sont
  // consommés. Les 15 000 $ restants sont encore protégés.
  assert.equal(result.reserve_cents, 15_000);
  assert.equal(result.available_cents, 55_000);
});

test('les revenus et factures à venir font varier le minimum journalier', () => {
  const result = simulate({
    asOfDate: '2026-11-19',
    balance_cents: 100_000,
    recurring: [
      { id: 10, name: 'Paie', kind: 'income', amount_cents: 50_000, frequency: 'weekly', anchor_date: '2026-11-20', adjustment: 'none', active: 1 },
      { id: 11, name: 'Internet', kind: 'bill', amount_cents: -9_000, frequency: 'monthly', anchor_date: '2026-11-21', adjustment: 'none', active: 1 }
    ]
  });
  assert.equal(result.days.find(day => day.date === '2026-11-20').available_cents, 150_000);
  assert.equal(result.days.find(day => day.date === '2026-11-21').available_cents, 141_000);
});

test('Noël et Boxing Day observés sont tous les deux exclus', () => {
  // La prochaine vraie journée ouvrable est le mercredi : lundi et mardi
  // sont les jours observés distincts du système de paiement.
  assert.equal(adjustBusinessDay('2027-12-25', 'next'), '2027-12-29');
  assert.equal(adjustBusinessDay('2027-12-26', 'next'), '2027-12-29');
  assert.ok(paymentHolidays(2027).has('2027-12-27'));
  assert.ok(paymentHolidays(2027).has('2027-12-28'));
});

test('un revenu peut choisir le vendredi avant un week-end', () => {
  assert.equal(adjustBusinessDay('2026-11-21', 'previous'), '2026-11-20');
});

test('la RRQ peut être placée au dernier jour ouvrable du mois', () => {
  assert.equal(lastBusinessDay('2026-11-01'), '2026-11-30');
  assert.equal(lastBusinessDay('2026-05-01'), '2026-05-29');
  const dates = rawRecurringDates({ id: 20, active: 1, frequency: 'monthly', anchor_date: '2026-11-01', date_mode: 'last_business_day' }, '2026-11-01', '2027-01-31');
  assert.deepEqual(dates, ['2026-11-30', '2026-12-31', '2027-01-29']);
});

test('une seule occurrence peut être déplacée et modifiée sans toucher la règle', () => {
  const rule = { id: 28, active: 1, name: 'Bell', kind: 'bill', amount_cents: -8_000, frequency: 'monthly', anchor_date: '2026-11-20', adjustment: 'none' };
  const overrides = new Map([['28:2026-11-20', { state: 'changed', moved_to: '2026-11-23', amount_cents: -9_250 }]]);
  const occurrences = recurringOccurrences(rule, '2026-11-01', '2026-12-31', overrides);
  assert.deepEqual(occurrences.map(item => [item.date, item.amount_cents]), [['2026-11-23', -9_250], ['2026-12-20', -8_000]]);
});

test('une facture échue reste retenue tant que le solde n’est pas reverifié', () => {
  const result = simulate({
    asOfDate: '2026-11-21', balance_cents: 100_000,
    pendingBills: [{ id: 'pending:1', type: 'pending_bill', date: '2026-11-20', name: 'Garderie · à confirmer', amount_cents: -4_825 }]
  });
  assert.equal(result.available_cents, 95_175);
  assert.equal(result.days[0].events[0].type, 'pending_bill');
});

test('chaque nouvelle protection est nommée dans la prévision sans toucher au solde', () => {
  const result = simulate({
    asOfDate: '2026-11-19',
    balance_cents: 100_000,
    limits: [
      { id: 31, name: 'Essence Jenny', amount_cents: 4_000, frequency: 'weekly', anchor_date: '2026-11-24', active: 1, mode: 'period' },
      { id: 32, name: 'Épicerie', amount_cents: 22_500, frequency: 'weekly', anchor_date: '2026-11-26', active: 1, mode: 'monthly_flexible' },
      { id: 33, name: 'Essence Alex', amount_cents: 6_000, frequency: 'weekly', anchor_date: '2026-11-26', active: 1, mode: 'period' }
    ]
  });
  const on24 = result.days.find(day => day.date === '2026-11-24');
  const on26 = result.days.find(day => day.date === '2026-11-26');
  assert.deepEqual(on24.events.map(item => [item.type, item.name, item.amount_cents]), [
    ['reserve', 'Essence Jenny · réserve', -4_000]
  ]);
  assert.deepEqual(on26.events.map(item => [item.type, item.name, item.amount_cents]), [
    ['reserve', 'Épicerie · réserve', -22_500],
    ['reserve', 'Essence Alex · réserve', -6_000]
  ]);
  assert.equal(on26.cash_cents, 100_000);
  assert.equal(on26.reserve_cents, 32_500);
  assert.equal(on26.available_cents, 67_500);
  assert.ok(result.events.some(item => item.name === 'Épicerie · réserve'));
});
