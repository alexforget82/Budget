"""Precision validation and transfer-funded edits must not debit reserves twice."""
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class Integrity(api.BudgetAPI):
 def runTest(self):
  joint,other=self.setup_joint();s=self.post('/api/envelopes',{'name':'Facture financée test','reserved':100,'budget':0,'frequency':'none','forecast_spend':False});eid=s['envelopes'][0]['id'];bill=self.funding_bill(other,eid)
  self.post('/api/transfers',{'description':'Financement réel','from_account_id':joint,'to_account_id':other,'amount':100,'happened_on':api.DAY,'funding_answer':'yes','funding_expense_key':bill['key']})
  self.post('/api/envelopes/update',{'id':eid,'name':'Facture financée test','reserved':100,'budget':0,'frequency':'none','forecast_spend':False})
  s=self.transaction(other,-100,envelope_id=eid,description='Facture financée v7');tid=s['transactions'][0]['id'];self.assertEqual(s['reserved_cents'],10000);self.assertEqual(s['transactions'][0]['envelope_effect_cents'],0)
  before=self.get('/api/backup/export')['tables'];payload={'id':tid,'account_id':other,'envelope_id':eid,'amount':-100,'description':'Facture financée v7 - reçue','happened_on':api.DAY}
  changed=self.post('/api/transactions/update',payload);self.assertEqual(changed['reserved_cents'],10000);self.assertEqual(changed['cash_cents'],s['cash_cents']);self.assertEqual(changed['safe_cents'],s['safe_cents']);self.assertEqual(changed['transactions'][0]['envelope_effect_cents'],0)
  self.post('/api/recurring/update',{'id':bill['recurring_id'],'description':'Facture financée v7','type':'expense','amount':90,'account_id':other,'envelope_id':eid,'start_on':api.DAY,'frequency':'monthly','active':True,'one_time':True})
  payload['amount']=-90
  adjusted=self.post('/api/transactions/update',payload);self.assertEqual(adjusted['reserved_cents'],10000);self.assertEqual(adjusted['transactions'][0]['envelope_effect_cents'],0)
  # A repeat edit must also remain neutral, and bad precision must not write anything.
  self.post('/api/transactions/update',payload);before=self.get('/api/backup/export')['tables']
  for amount in [1.005,10.005,-1.005]:
   self.post('/api/transactions',{'account_id':joint,'amount':amount,'description':'Précision invalide','happened_on':api.DAY},400);self.assertEqual(self.get('/api/backup/export')['tables'],before)
   self.post('/api/transactions/update',{**payload,'amount':amount},400);self.assertEqual(self.get('/api/backup/export')['tables'],before)
  print('PASS: funded edit retains reserve/cash/safe, repeated edits neutral, invalid precision refused without mutations.')
if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Integrity()]));raise SystemExit(not result.wasSuccessful())
