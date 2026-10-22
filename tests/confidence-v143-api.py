"""Local explanation journal, reset/privacy and read-only reconciliation suggestions."""
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class Confidence(api.BudgetAPI):
 def runTest(self):
  bank=self.account(balance=1000);baseline=self.get('/api/state');before=self.get('/api/backup/export')['tables'];history=self.get('/api/forecast/history');self.assertEqual(self.get('/api/backup/export')['tables'],before)
  count=len(history['records']);self.get('/api/state');self.assertEqual(len(self.get('/api/forecast/history')['records']),count)
  self.post('/api/simulate',{'kind':'purchase','account_id':bank,'amount':25,'date':self.future73(2)});self.assertEqual(len(self.get('/api/forecast/history')['records']),count)
  self.transaction(bank,-10,description='Achat test');history=self.get('/api/forecast/history');last=history['records'][0]
  for h in ['30','60','90']:
   c=last['comparisons'][h];self.assertEqual(c['delta_cents'],-1000);self.assertEqual(c['delta_cents'],sum(c['bridge'][k] for k in ['cash_change_cents','reserve_change_cents','minimum_date_change_cents']))
  self.assertTrue(any('Achat test' in c['label'] for c in last['changes']))
  self.stop();self.start();self.assertEqual(self.get('/api/forecast/history')['records'][0]['id'],last['id']);self.call('/forecast-history.json',status=404)
  self.transaction(bank,-30,description='Opération A');self.transaction(bank,-20,description='Opération B');before=self.get('/api/backup/export')['tables'];current=self.get('/api/state');balance=current['accounts'][0]['balance_cents']/100
  out=self.post('/api/workspace/reconcile',{'account_id':bank,'balance':balance+50,'since':api.MONTH+'-01'});self.assertTrue(any({r['description'] for r in pair}=={'Opération A','Opération B'} for pair in out['guidance']['pairs']));self.assertEqual(self.get('/api/backup/export')['tables'],before)
  self.post('/api/recurring',{'description':'Paiement prévu à vérifier','amount':53.98,'type':'expense','account_id':bank,'start_on':api.DAY,'frequency':'monthly','one_time':True})
  out=self.post('/api/workspace/reconcile',{'account_id':bank,'balance':balance-53.98,'since':api.MONTH+'-01'});self.assertTrue(any(r['description']=='Paiement prévu à vérifier' for r in out['guidance']['planned']))
  backup=self.get('/api/backup/export');self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});history=self.get('/api/forecast/history');self.assertEqual(len(history['records']),1);self.assertTrue(history['records'][0]['baseline'])
  p=self.post('/api/setup/reset-preview',{});self.post('/api/setup/reset',{'token':p['token'],'confirmation':'EFFACER','acknowledged':True,'backup':False});fresh=self.get('/api/forecast/history');self.assertEqual(len(fresh['records']),1);self.assertTrue(fresh['records'][0]['baseline']);self.assertNotIn('Achat test',(self.dir/'data'/'forecast-history.json').read_text())
  print('PASS: canonical history/bridge, identical reads, persistence, private file blocked, pair/planned hints readonly and reset after restore.')
if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Confidence()]));raise SystemExit(not result.wasSuccessful())
