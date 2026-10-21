"""A past expense assigned to an envelope is not an explicit advance on its first future period."""
import importlib.util,datetime,sqlite3,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class FirstPeriod(api.BudgetAPI):
 def runTest(self):
  bank=self.account(balance=1000);start=self.future73(6);past=(datetime.date.fromisoformat(api.DAY)-datetime.timedelta(days=1)).isoformat()
  s=self.post('/api/envelopes',{'name':'Essence Alex','reserved':0,'budget':60,'frequency':'weekly','start_on':start,'rollover':False,'forecast_spend':False});eid=s['envelopes'][0]['id'];s=self.transaction(bank,-60,description='Essence',envelope_id=eid,happened_on=past);tid=s['transactions'][0]['id'];before=self.get('/api/backup/export')['tables']
  def check(s):
   self.assertEqual(s['safe_cents'],94000)
   for index in range(3):
    day=next(d for d in s['forecast'] if d['date']==self.future73(6+7*index));self.assertEqual(day['safe_cents'],94000-6000*(index+1));self.assertEqual(next(e for e in day['events'] if e.get('envelope_id')==eid and e.get('envelope_renewal'))['amount_cents'],6000)
  check(s);self.stop();self.start();check(self.get('/api/state'));self.assertEqual(self.get('/api/backup/export')['tables'],before)
  # An explicit future association still opts into the advance behavior.
  with sqlite3.connect(self.dir/'data'/'budget.sqlite') as db:db.execute('INSERT INTO envelope_actual_links(transaction_id,envelope_id,occurrence_on) VALUES(?,?,?)',(tid,eid,start))
  s=self.get('/api/state');day=next(d for d in s['forecast'] if d['date']==start);self.assertEqual(day['safe_cents'],94000);self.assertEqual(next(e for e in day['events'] if e.get('envelope_id')==eid and e.get('envelope_renewal'))['amount_cents'],0)
  # The same rule applies to an actual renewal due today, not just the projection.
  with sqlite3.connect(self.dir/'data'/'budget.sqlite') as db:
   db.execute('DELETE FROM envelope_actual_links WHERE transaction_id=?',(tid,));db.execute('UPDATE envelopes SET start_on=? WHERE id=?',(api.DAY,eid))
  s=self.get('/api/state');self.assertEqual(next(e['reserved_cents'] for e in s['envelopes'] if e['id']==eid),6000);self.assertEqual(s['safe_cents'],88000);self.assertEqual(s['cash_cents'],94000)
  print('PASS: past ordinary purchase preserves full first and following weekly allocations, survives restart without ledger changes; explicit future association still consumes only its chosen period.')
if __name__=='__main__':
 r=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([FirstPeriod()]));raise SystemExit(not r.wasSuccessful())
