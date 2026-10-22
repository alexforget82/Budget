"""Envelope filtering/sorting/export cover the whole ledger, never just a displayed page."""
import importlib.util,unittest,csv,io
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class Register(api.BudgetAPI):
 def runTest(self):
  bank=self.account(balance=5000)
  for name in ['Alpha registre','Zulu registre']:self.post('/api/envelopes',{'name':name,'reserved':0,'budget':0,'frequency':'none','forecast_spend':False})
  envelopes=self.get('/api/state')['envelopes'];a=next(e['id'] for e in envelopes if e['name']=='Alpha registre');z=next(e['id'] for e in envelopes if e['name']=='Zulu registre')
  for i in range(65):self.transaction(bank,-1,description=f'Filtre {i:02d}',envelope_id=a if i<60 else z)
  before=self.get('/api/backup/export')['tables'];state=self.get('/api/state')
  rows=self.get('/api/transactions/list?envelope='+str(a));self.assertEqual(rows['count'],60);self.assertEqual(len(rows['rows']),50);self.assertTrue(all(t['envelope_id']==a for t in rows['rows']))
  second=self.get('/api/transactions/list?envelope='+str(a)+'&page=2');self.assertEqual(len(second['rows']),10);self.assertFalse({t['id'] for t in rows['rows']}&{t['id'] for t in second['rows']})
  ordered=self.get('/api/transactions/list?sort=envelope&direction=asc');self.assertTrue(all(t['envelope_id']==a for t in ordered['rows']));reverse=self.get('/api/transactions/list?sort=envelope&direction=desc');self.assertEqual(reverse['rows'][0]['envelope_id'],z)
  exported=list(csv.reader(io.StringIO(self.call('/api/transactions/export?envelope='+str(a),raw=True)),delimiter=';'));self.assertEqual(len(exported),61);self.assertTrue(all(row[5]=='Alpha registre' for row in exported[1:]));self.assertEqual(self.get('/api/backup/export')['tables'],before);self.assertEqual(self.get('/api/state')['forecast'],state['forecast'])
  print('PASS: all-history envelope filter, pagination, sort both directions, filtered CSV export and exact financial invariance.')
if __name__=='__main__':
 result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Register()]));raise SystemExit(not result.wasSuccessful())
