"""API integration checks. Every test owns a temporary database and local server."""
import copy,csv,datetime,io,json,os,socket,sqlite3,subprocess,tempfile,time,unittest,urllib.request,urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DAY=datetime.date.today().isoformat()
MONTH=DAY[:7]

class BudgetAPI(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='budget-api-');self.dir=Path(self.temp.name);self.start()
 def start(self):
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));self.port=sock.getsockname()[1]
  self.base=f'http://127.0.0.1:{self.port}';self.log=open(self.dir/'server.log','a')
  self.process=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=self.dir,env={**os.environ,'PORT':str(self.port)},stdout=self.log,stderr=self.log)
  for _ in range(80):
   try:self.get('/api/state');return
   except (OSError,urllib.error.URLError):
    if self.process.poll() is not None:raise AssertionError((self.dir/'server.log').read_text())
    time.sleep(.05)
  raise AssertionError('Server readiness timeout')
 def stop(self):self.process.terminate();self.process.wait(timeout=10);self.log.close()
 def tearDown(self):self.stop();self.temp.cleanup()
 def call(self,path,data=None,status=200,headers=None,raw=False):
  req=urllib.request.Request(self.base+path,data=None if data is None else json.dumps(data).encode(),headers=headers or ({'Content-Type':'application/json'} if data is not None else {}))
  try:response=urllib.request.urlopen(req)
  except urllib.error.HTTPError as e:response=e
  with response:
   body=response.read();self.assertEqual(response.status,status,body.decode()[:600]);return body.decode('utf-8-sig') if raw else json.loads(body)
 def get(self,path):return self.call(path)
 def post(self,path,data,status=200):return self.call(path,data,status)
 def account(self,kind='checking',balance=1000):return self.post('/api/accounts',{'name':'Compte '+kind,'kind':kind,'balance':balance})['accounts'][0]['id']
 def transaction(self,account,amount=-10,**extra):return self.post('/api/transactions',{'account_id':account,'amount':amount,'description':'Épicerie','happened_on':DAY,**extra})
 def csv_data(self,account,text=None,**extra):return {'csv':text or f'Date;Description;Montant\n{DAY};Marché;-12,50\n{DAY};Salaire;100,00','account_id':account,'mapping':{'date':0,'description':1,'amount':2},'date_format':'ISO','affects_balance':False,**extra}
 def import_rows(self,payload,selected=None,**extra):
  preview=self.post('/api/import/preview',payload)
  return self.post('/api/import/commit',{**payload,'fingerprint':preview['fingerprint'],'selected_rows':selected or [r['row'] for r in preview['rows'] if not r.get('error') and not r.get('duplicate')],**extra})
 def test_transaction_categories_credit_and_capped_envelope(self):
  aid=self.account();cat=self.get('/api/state')['categories'][0]['id']
  e=self.post('/api/envelopes',{'name':'Courses','reserved':10,'budget':40,'frequency':'none'})['envelopes'][0]['id']
  s=self.transaction(aid,-25,envelope_id=e,category_id=cat);t=s['transactions'][0];self.assertEqual(t['envelope_effect_cents'],1000);self.assertEqual(s['envelopes'][0]['reserved_cents'],0)
  s=self.post('/api/transactions/update',{'id':t['id'],'account_id':aid,'amount':-5,'description':'Courses corrigées','happened_on':DAY,'envelope_id':e});self.assertEqual(s['envelopes'][0]['reserved_cents'],500);self.assertEqual(s['transactions'][0]['category_id'],cat)
  s=self.post('/api/transactions/delete',{'id':t['id']});self.assertEqual(s['envelopes'][0]['reserved_cents'],1000);self.assertEqual(s['accounts'][0]['balance_cents'],100000)
  cid=self.account('credit',100);s=self.transaction(cid,-20);self.assertEqual(s['accounts'][0]['balance_cents'],12000)
  self.post('/api/transactions',{'account_id':aid,'amount':-1,'description':'Bad','happened_on':DAY,'category_id':999999},400)
 def test_monthly_all_pages_filters_and_csv_export(self):
  aid=self.account();cid=self.account('credit',0);cat=self.get('/api/state')['categories'][0]['id']
  for i in range(55):self.transaction(aid,-1,category_id=cat,description='Achat '+str(i))
  self.transaction(aid,200,description='Paie');self.transaction(cid,-10,category_id=cat)
  self.post('/api/transfers',{'from_account_id':aid,'to_account_id':cid,'amount':10,'description':'Paiement carte','happened_on':DAY})
  report=self.get('/api/monthly?month='+MONTH);self.assertEqual(report['income_cents'],20000);self.assertEqual(report['expense_cents'],6500);self.assertEqual(report['net_cents'],13500)
  self.post('/api/category-budget',{'category_id':cat,'amount':50});self.assertEqual(next(b for b in self.get('/api/monthly?month='+MONTH)['budgets'] if b['id']==cat)['limit_cents'],5000)
  self.assertEqual(self.get('/api/transactions/list')['count'],57);self.assertEqual(len(self.get('/api/transactions/list')['rows']),50)
  export=list(csv.reader(io.StringIO(self.call('/api/transactions/export',raw=True)),delimiter=';'));self.assertEqual(len(export),58)
  self.assertEqual(self.get(f'/api/transactions/list?category={cat}&account={aid}')['count'],55)
  self.transaction(aid,-1,description='=HYPERLINK("unsafe")');export=self.call('/api/transactions/export',raw=True);self.assertIn("'=HYPERLINK",export)
 def test_csv_localized_dates_quotes_duplicates_and_history(self):
  aid=self.account();payload=self.csv_data(aid,'Date;Description;Montant\n15/03/2026;"Marché; local";-12,50\n16/03/2026;"Note ""test""\nsuite";1 234,56',date_format='DMY')
  info=self.post('/api/import/inspect',{'csv':payload['csv']});self.assertEqual(info['delimiter'],';');self.assertEqual(info['count'],2)
  preview=self.post('/api/import/preview',payload);self.assertEqual(preview['rows'][0]['date'],'2026-03-15');self.assertEqual(preview['rows'][1]['amount_cents'],123456)
  result=self.import_rows(payload);self.assertEqual(result['imported'],2);self.assertEqual(result['state']['accounts'][0]['balance_cents'],100000)
  t=result['state']['transactions'][0];self.assertEqual(t['affects_balance'],0)
  s=self.post('/api/transactions/update',{'id':t['id'],'account_id':aid,'amount':-200,'description':'Historique corrigé','happened_on':t['happened_on']});self.assertEqual(s['accounts'][0]['balance_cents'],100000)
  s=self.post('/api/transactions/delete',{'id':t['id']});self.assertEqual(s['accounts'][0]['balance_cents'],100000)
  preview=self.post('/api/import/preview',payload);self.assertTrue(preview['rows'][0]['duplicate'])
  self.post('/api/import/commit',{**payload,'fingerprint':preview['fingerprint'],'selected_rows':[1]},400)
  self.post('/api/import/commit',{**payload,'fingerprint':preview['fingerprint'],'selected_rows':[1],'include_duplicates':True})
 def test_csv_invalid_atomic_stale_and_credit_sign(self):
  aid=self.account();payload=self.csv_data(aid,f'Date;Description;Montant\n{DAY};Valid;-10\n2026-02-30;Invalid;-20')
  p=self.post('/api/import/preview',payload);self.assertIn('error',p['rows'][1]);before=self.get('/api/backup/export')
  self.post('/api/import/commit',{**payload,'fingerprint':p['fingerprint'],'selected_rows':[1,2]},400)
  self.assertEqual(self.get('/api/backup/export')['tables'],before['tables'])
  self.post('/api/import/commit',{**payload,'fingerprint':p['fingerprint'],'selected_rows':[1],'affects_balance':True},400)
  payload=self.csv_data(aid,f'Date;Description;Montant\n{DAY};Valid;-10');p=self.post('/api/import/preview',payload);self.import_rows(payload)
  self.post('/api/import/commit',{**payload,'fingerprint':p['fingerprint'],'selected_rows':[1]},400)
  cid=self.account('credit',0);result=self.import_rows(self.csv_data(cid,f'Date;Description;Débit;Crédit\n{DAY};Achat;15,25;\n{DAY};Paiement;;5,00',mapping={'date':0,'description':1,'debit':2,'credit':3},affects_balance=True));self.assertEqual(result['state']['accounts'][0]['balance_cents'],1025)
 def test_reconciliation_stale_and_goals_do_not_create_spending(self):
  aid=self.account();self.post('/api/balance/reconcile',{'account_id':aid,'balance':900,'expected_balance_cents':999,'note':'Relevé','confirm':True},400)
  s=self.post('/api/balance/reconcile',{'account_id':aid,'balance':900,'expected_balance_cents':100000,'note':'Relevé','confirm':True});self.assertEqual(s['accounts'][0]['balance_cents'],90000);self.assertEqual(len(s['balance_reconciliations']),1)
  s=self.post('/api/goals',{'name':'Vacances','target':2000,'saved':500,'target_date':'2027-06-01'});goal=s['goals'][0]['id'];self.assertEqual(s['safe_cents'],90000)
  self.post('/api/goals',{'id':goal,'name':'Vacances','target':2000,'saved':600,'target_date':'2027-06-01'});self.assertEqual(self.get('/api/monthly?month='+MONTH)['expense_cents'],0)
  self.post('/api/goals/delete',{'id':goal});self.assertEqual(self.get('/api/state')['goals'],[])
 def test_backup_validation_restore_and_safety_copy(self):
  aid=self.account();self.transaction(aid,-20);self.post('/api/goals',{'name':'Épargne','target':1000,'saved':100});self.import_rows(self.csv_data(aid))
  backup=self.get('/api/backup/export');self.post('/api/backup/validate',{'backup':backup});self.transaction(aid,-5)
  current=self.get('/api/backup/export');files=list((self.dir/'data'/'backups').glob('*.json'))
  for corrupt in ['missing','foreign','date','duplicate','value']:
   bad=copy.deepcopy(backup)
   if corrupt=='missing':del bad['tables']['goals']
   if corrupt=='foreign':bad['tables']['transactions'][0]['category_id']=99999
   if corrupt=='date':bad['tables']['transactions'][0]['happened_on']='2026-02-30'
   if corrupt=='duplicate':bad['tables']['accounts'].append(copy.deepcopy(bad['tables']['accounts'][0]))
   if corrupt=='value':bad['tables']['goals'][0]['target_cents']=-1
   self.post('/api/backup/restore',{'backup':bad,'confirm':'REMPLACER'},400)
   self.assertEqual(self.get('/api/backup/export')['tables'],current['tables'])
  self.assertEqual(list((self.dir/'data'/'backups').glob('*.json')),files)
  self.post('/api/backup/restore',{'backup':backup,'confirm':'oui'},400)
  restored=self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
  safety=json.loads((self.dir/'data'/'backups'/restored['safety_backup']).read_text());self.assertEqual(safety['tables'],current['tables'])
  self.stop();self.start();self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
 def test_request_origin_and_content_type(self):
  self.call('/api/goals',{},403,headers={'Content-Type':'application/json','Origin':'https://untrusted.example'})
  self.call('/api/goals',{},403,headers={'Content-Type':'text/plain'})
  self.call('/api/state',status=403,headers={'Host':'untrusted.example'})
 def test_additive_legacy_migration_preserves_data(self):
  self.stop();dbpath=self.dir/'data'/'budget.sqlite';dbpath.unlink()
  for suffix in ['-wal','-shm']:
   Path(str(dbpath)+suffix).unlink(missing_ok=True)
  (self.dir/'data'/'backups'/'budget-before-v3.sqlite').unlink(missing_ok=True)
  con=sqlite3.connect(dbpath);con.executescript('''
   CREATE TABLE accounts(id INTEGER PRIMARY KEY,name TEXT NOT NULL,balance_cents INTEGER NOT NULL,kind TEXT NOT NULL,included INTEGER NOT NULL DEFAULT 1);
   CREATE TABLE envelopes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,reserved_cents INTEGER NOT NULL);
   CREATE TABLE transactions(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES accounts(id),envelope_id INTEGER REFERENCES envelopes(id),amount_cents INTEGER NOT NULL,description TEXT NOT NULL,happened_on TEXT NOT NULL);
   INSERT INTO accounts VALUES(7,'Compte existant',123456,'checking',1);
   INSERT INTO envelopes VALUES(9,'Réserve existante',1000);
  ''');con.execute('INSERT INTO transactions VALUES(11,7,9,-500,?,?)',('Achat existant',DAY));con.commit();con.close();self.start();s=self.get('/api/state')
  self.assertEqual(s['accounts'][0]['balance_cents'],123456);self.assertEqual(s['envelopes'][0]['reserved_cents'],1000);self.assertEqual(s['transactions'][0]['id'],11);self.assertIsNone(s['transactions'][0]['category_id']);self.assertEqual(s['transactions'][0]['affects_balance'],1)
  category=s['categories'][0]['id'];s=self.post('/api/transactions/update',{'id':11,'account_id':7,'envelope_id':9,'amount':-5,'description':'Achat classé','happened_on':DAY,'category_id':category});self.assertEqual(s['envelopes'][0]['reserved_cents'],1000);self.assertEqual(s['accounts'][0]['balance_cents'],123456)
  backup=sqlite3.connect(self.dir/'data'/'backups'/'budget-before-v3.sqlite');self.assertEqual(backup.execute('SELECT balance_cents FROM accounts WHERE id=7').fetchone()[0],123456);self.assertNotIn('category_id',[r[1] for r in backup.execute('PRAGMA table_info(transactions)')]);backup.close()
  self.stop();self.start();self.assertEqual(len(self.get('/api/state')['categories']),10)

if __name__=='__main__':unittest.main(verbosity=2)
