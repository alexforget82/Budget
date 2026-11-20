'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');

async function freePort() {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function start() {
  const port = await freePort();
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'bdl-v9-test-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), BDL9_DATA: data, BDL9_TODAY: '2026-11-19' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error(`Serveur non démarré : ${output}`)), 4_000);
    child.stdout.on('data', () => { clearTimeout(timeout); resolve(); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(Error(`Serveur arrêté (${code}) : ${output}`)); });
  });
  const request = async (pathname, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};
    assert.ok(response.ok, body.error || `${response.status}`);
    return body;
  };
  return {
    request,
    async close() {
      child.kill('SIGINT');
      await new Promise(resolve => child.once('exit', resolve));
      fs.rmSync(data, { recursive: true, force: true });
    }
  };
}

test('l’API applique une limite une seule fois et protège les données', async t => {
  const app = await start();
  t.after(() => app.close());
  const post = (pathname, body) => app.request(pathname, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const put = (pathname, body) => app.request(pathname, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  await post('/api/setup', { balance_cents: 100_000, date: '2026-11-19' });
  let onboarding = await app.request('/api/state');
  assert.equal(onboarding.settings.onboarding_complete, false);
  await put('/api/settings', { onboarding_complete: true });
  onboarding = await app.request('/api/state');
  assert.equal(onboarding.settings.onboarding_complete, true);
  const limit = await post('/api/limits', { name: 'Épicerie', amount_cents: 22_500, frequency: 'weekly', anchor_date: '2026-11-19', mode: 'period' });
  let state = await app.request('/api/state');
  assert.equal(state.forecast.available_cents, 77_500);

  await post('/api/transactions', { kind: 'expense', description: 'IGA', amount_cents: 7_169, date: '2026-11-19', limit_id: limit.id });
  state = await app.request('/api/state');
  assert.equal(state.settings.balance_cents, 92_831);
  assert.equal(state.forecast.reserve_cents, 15_331);
  assert.equal(state.forecast.available_cents, 77_500);

  const rrq = await post('/api/recurring', { name: 'Rente RRQ', kind: 'income', amount_cents: 122_102, frequency: 'monthly', anchor_date: '2026-11-01', date_mode: 'last_business_day', adjustment: 'none' });
  state = await app.request('/api/state');
  assert.equal(state.forecast.events.find(item => item.recurring_id === rrq.id).date, '2026-11-30');
  await put(`/api/occurrences/${rrq.id}/2026-11-30`, { state: 'changed', moved_to: '2026-11-27', amount_cents: 121_000 });
  state = await app.request('/api/state');
  const changed = state.forecast.events.find(item => item.recurring_id === rrq.id);
  assert.equal(changed.date, '2026-11-27');
  assert.equal(changed.amount_cents, 121_000);

  const bill = await post('/api/recurring', { name: 'Garderie', kind: 'bill', amount_cents: 4_825, frequency: 'monthly', anchor_date: '2026-11-20', adjustment: 'none' });
  state = await app.request('/api/state?date=2026-11-21');
  assert.equal(state.forecast.pending_bills.length, 1);
  const beforePay = state.forecast.available_cents;
  await post(`/api/occurrences/${bill.id}/2026-11-20/pay`, { amount_cents: 4_825, date: '2026-11-19' });
  state = await app.request('/api/state?date=2026-11-21');
  assert.equal(state.forecast.pending_bills.length, 0);
  assert.equal(state.forecast.available_cents, beforePay);

  const exportData = await app.request('/api/export');
  assert.equal(exportData.format, 'le-bas-de-laine-v9');
  assert.equal(exportData.transactions.length, 2);
  await app.request(`/api/limits/${limit.id}`, { method: 'DELETE' });
  state = await app.request('/api/state');
  assert.equal(state.limit_config.length, 0);
  assert.equal(state.transactions[0].limit_id, null);
});
