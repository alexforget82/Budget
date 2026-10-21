"""Entry-time protected-period choice equals the established two-step flow."""
import importlib.util,unittest,copy
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class Entry(api.BudgetAPI):
 def runTest(self):
  bank=self.account(balance=1000);card=self.account('credit',0);start=self.future73(1)
  eid=self.post('/api/envelopes',{'name':'Épicerie','reserved':0,'budget':230,'frequency':'weekly','start_on':start,'rollover':False,'forecast_spend':False})['envelopes'][0]['id']
  for account in [bank,card]:
   draft={'account_id':account,'envelope_id':eid,'amount':-71.69,'description':'Épicerie anticipée','happened_on':api.DAY}
   backup=self.get('/api/backup/export');before=copy.deepcopy(backup['tables']);preview=self.post('/api/envelopes/period-preview',{'draft':draft});self.assertEqual(len(preview['choices']),1);choice=preview['choices'][0];self.assertEqual(before,self.get('/api/backup/export')['tables'])
   payload={**draft,'budget_period_on':choice['date'],'budget_period_signature':choice['signature']}
   self.post('/api/transactions',{**payload,'budget_period_on':self.future73(20)},400);self.assertEqual(before,self.get('/api/backup/export')['tables'])
   self.post('/api/transactions',{**payload,'amount':-70},400);self.assertEqual(before,self.get('/api/backup/export')['tables'])
   result=self.post('/api/transactions',payload);tid=result['transactions'][0]['id'];one_step=self.get('/api/backup/export')['tables'];self.assertEqual(len(one_step['envelope_actual_links']),len(before['envelope_actual_links'])+1);self.assertEqual(next(t for t in result['transactions'] if t['id']==tid)['happened_on'],api.DAY)
   # Restore exactly the same starting point and compare with the prior explicit association.
   self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'})
   s=self.post('/api/transactions',draft);tid=s['transactions'][0]['id'];old=self.post('/api/envelopes/period-preview',{'transaction_id':tid})['choices'][0];separate=self.post('/api/envelopes/link-period',{'transaction_id':tid,'envelope_id':eid,'occurrence_on':old['date'],'signature':old['signature']})
   two_step=self.get('/api/backup/export')['tables']
   for table in ['accounts','transactions','envelopes','envelope_actual_links','account_transfers']:
    self.assertEqual(one_step[table],two_step[table],table)
   self.assertEqual(result['forecast'],separate['forecast']);self.assertEqual(result['safe_cents'],separate['safe_cents'])
  draft={'account_id':bank,'envelope_id':eid,'amount':-5,'description':'Autre achat','happened_on':api.DAY}
  c=self.post('/api/envelopes/period-preview',{'draft':draft})['choices'][0];self.transaction(bank,-1,description='Autre appareil');before=self.get('/api/backup/export')['tables'];self.post('/api/transactions',{**draft,'budget_period_on':c['date'],'budget_period_signature':c['signature']},400);self.assertEqual(before,self.get('/api/backup/export')['tables'])
  # The default current-period choice does not create a future link.
  count=len(before['envelope_actual_links']);self.post('/api/transactions',draft);self.assertEqual(len(self.get('/api/backup/export')['tables']['envelope_actual_links']),count)
  print('PASS: draft preview read-only, atomic bank/card entry equals existing explicit association, actual date retained, invalid/stale/mutated choices rejected without writes, default current period unchanged.')
if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Entry()]));raise SystemExit(not result.wasSuccessful())
