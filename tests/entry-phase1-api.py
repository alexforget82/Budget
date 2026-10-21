"""Phase 1: learned defaults/imports and exact bulk parity with the existing editor."""
import importlib.util,unittest,copy
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class Phase(api.BudgetAPI):
 def runTest(self):
  bank=self.account(balance=1000);card=self.account('credit',0);category=self.make_category('Alimentation 132')
  a=self.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':self.future73(1),'rollover':False,'forecast_spend':False})['envelopes'][0]['id'];b=self.post('/api/envelopes',{'name':'Restaurant','reserved':10,'budget':100,'frequency':'monthly','start_on':self.future73(1),'rollover':False,'forecast_spend':False})['envelopes'][0]['id']
  s=self.transaction(bank,-50,description='MÉTRO - Plus',category_id=category,envelope_id=a);first=s['transactions'][0]['id'];s=self.transaction(card,-20,description='Carte',envelope_id=b);second=s['transactions'][0]['id']
  # CSV preview uses normalized merchant memory; manual choices and history are preserved.
  payload=self.csv_data(bank,text=f'Date;Description;Montant\n{api.DAY};metro plus!;-12.50',affects_balance=False)
  before=self.get('/api/backup/export')['tables'];p=self.post('/api/import/preview',payload);r=p['rows'][0];self.assertEqual((r['category_id'],r['envelope_id']),(category,a));self.assertEqual(self.get('/api/backup/export')['tables'],before)
  none=self.post('/api/import/preview',{**payload,'category_explicit_none':True});self.assertIsNone(none['rows'][0]['category_id']);self.assertIsNone(none['rows'][0]['envelope_id']);manual=self.post('/api/import/preview',{**payload,'envelope_id':None});self.assertIsNone(manual['rows'][0]['envelope_id']);self.post('/api/import/commit',{**payload,'fingerprint':p['fingerprint'],'selected_rows':[1]});s=self.get('/api/state');history=s['transactions'][0];self.assertEqual(history['envelope_effect_cents'],0);self.assertEqual(s['cash_cents'],95000)
  # A change in learned choices invalidates an old import preview.
  stale=self.post('/api/import/preview',payload);self.transaction(bank,-1,description='metro PLUS',envelope_id=b);self.post('/api/import/commit',{**payload,'fingerprint':stale['fingerprint'],'selected_rows':[1]},400)
  # Explicit future association must be disclosed and detached by an envelope reassignment.
  choice=self.post('/api/envelopes/period-preview',{'transaction_id':first})['choices'][0];self.post('/api/envelopes/link-period',{'transaction_id':first,'envelope_id':a,'occurrence_on':choice['date'],'signature':choice['signature']})
  backup=self.get('/api/backup/export');ids=[first,second,history['id']];changes={'envelope_id':b};p=self.post('/api/workspace/bulk-preview',{'ids':ids,'changes':changes});self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables']);self.assertTrue(next(i for i in p['items'] if i['id']==first)['detaches_period']);self.assertTrue(next(i for i in p['items'] if i['id']==history['id'])['historical'])
  bulk=self.post('/api/workspace/bulk-apply',{'ids':ids,'changes':changes,'token':p['token']});self.assertEqual(bulk['safe_cents'],p['after']['safe_cents']);self.assertEqual(bulk['cash_cents'],p['before']['cash_cents']);self.assertEqual(next(t for t in bulk['transactions'] if t['id']==history['id'])['envelope_effect_cents'],0)
  # Compare to the original single-transaction edit implementation, on an identical restored copy.
  self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'})
  for tid in sorted(ids):
   old=next(t for t in self.get('/api/state')['transactions'] if t['id']==tid);self.post('/api/transactions/update',{**old,'amount':old['amount_cents']/100,'envelope_id':b})
  single=self.get('/api/state')
  for key in ['accounts','envelopes','transactions','forecast','safe_cents','reserved_cents','cash_cents','card_envelope_reserved_cents']:self.assertEqual(bulk[key],single[key],key)
  # Server-side missing-envelope filter covers the whole ledger and only expenses.
  s=self.transaction(bank,-2,description='Sans enveloppe');self.transaction(bank,5,description='Revenu');out=self.get('/api/transactions/list?without_envelope=1');self.assertTrue(all(t['amount_cents']<0 and t['envelope_id'] is None for t in out['rows']))
  # Preview signatures cover all current finances, not just the selected records.
  p=self.post('/api/workspace/bulk-preview',{'ids':[first],'changes':{'envelope_id':a}});self.transaction(bank,-1);self.post('/api/workspace/bulk-apply',{'ids':[first],'changes':{'envelope_id':a},'token':p['token']},400)
  # Live CSV uses the same envelope consumption as a real manually entered expense.
  self.transaction(bank,-1,description='Commerçant vivant',category_id=category,envelope_id=a);live=self.csv_data(bank,text=f'Date;Description;Montant\n{api.DAY};COMMERCANT-VIVANT!;-2.58',affects_balance=True);state=self.get('/api/state');p=self.post('/api/import/preview',live);self.assertEqual(p['rows'][0]['envelope_id'],a);self.post('/api/import/commit',{**live,'fingerprint':p['fingerprint'],'selected_rows':[1]});after=self.get('/api/state');self.assertEqual(after['cash_cents'],state['cash_cents']-258);self.assertEqual(next(t for t in after['transactions'] if t['description']=='COMMERCANT-VIVANT!')['envelope_effect_cents'],258)
  # Moving a real card purchase changes its envelope through the same protected-card logic.
  previous=self.get('/api/state');p=self.post('/api/workspace/bulk-preview',{'ids':[second],'changes':{'envelope_id':a}});changed=self.post('/api/workspace/bulk-apply',{'ids':[second],'changes':{'envelope_id':a},'token':p['token']});self.assertEqual(changed['accounts'],previous['accounts']);self.assertEqual(changed['safe_cents'],p['after']['safe_cents']);self.assertEqual(changed['card_envelope_reserved_cents'],previous['card_envelope_reserved_cents'])
  print('PASS: normalized memory and CSV preview/history/manual override/staleness, bulk envelope preview read-only and exact parity to single editor, period detachment, protected cards/history intact, full-ledger missing-envelope filter.')
if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Phase()]));raise SystemExit(not result.wasSuccessful())
