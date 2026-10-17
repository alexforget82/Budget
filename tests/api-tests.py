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
 def test_register_totals_recent_categories_and_literal_accent_search(self):
  from urllib.parse import urlencode
  aid=self.account();cat=self.get('/api/state')['categories'][0]['id']
  for _ in range(52):self.transaction(aid,-2.35,description='CAFÉ du Coin',category_id=cat)
  income=self.transaction(aid,100,description='Salaire')['transactions'][0]['id']
  self.post('/api/transactions/review',{'id':income,'reviewed':True})
  data=self.get('/api/transactions/list');self.assertEqual(data['count'],53);self.assertEqual(len(data['rows']),50);self.assertEqual(data['summary'],{'count':53,'expense_cents':12220,'income_cents':10000,'net_cents':-2220,'pending_count':52});self.assertEqual(self.get('/api/transactions/list?page=2')['summary'],data['summary'])
  found=self.get('/api/transactions/list?'+urlencode({'search':'cafe'}));self.assertEqual(found['count'],52);self.assertEqual(found['summary']['expense_cents'],12220)
  self.assertEqual(self.get('/api/transactions/list?'+urlencode({'search':'CAFÉ','category':cat}))['count'],52)
  for description,search in [('Rabais 10%','%'),('Frais_A','_'),('Chemin\\boutique','\\')]:
   self.transaction(aid,-1,description=description);self.assertEqual(self.get('/api/transactions/list?'+urlencode({'search':search}))['count'],1)
  recent=next(r for r in self.get('/api/state')['recent_descriptions'] if r['description']=='CAFÉ du Coin');self.assertEqual(recent['category_id'],cat);self.assertEqual(recent['amount_cents'],-235)
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
  for corrupt in ['missing','planning_table','foreign','date','duplicate','value']:
   bad=copy.deepcopy(backup)
   if corrupt=='missing':del bad['tables']['goals']
   elif corrupt=='planning_table':del bad['tables']['envelope_period_status']
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
 def test_envelope_forecast_actual_partial_and_delete(self):
  aid=self.account(balance=2000)
  s=self.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':DAY,'forecast_account_id':aid})
  eid=s['envelopes'][0]['id'];row=next(r for r in s['planning']['rows'] if r['date']==DAY)
  self.assertEqual(row['planned_cents'],23000);self.assertEqual(s['accounts'][0]['balance_cents'],200000);self.assertEqual(s['forecast'][0]['cash_cents'],177000);self.assertEqual(s['forecast'][0]['safe_cents'],177000)
  s=self.transaction(aid,-215,envelope_id=eid);tid=s['transactions'][0]['id'];row=next(r for r in s['planning']['rows'] if r['date']==DAY)
  self.assertEqual(row['status'],'actual');self.assertEqual(row['variance_cents'],-1500);self.assertEqual(s['forecast'][0]['cash_cents'],178500);self.assertEqual(s['reserved_cents'],1500)
  s=self.post('/api/envelope/status',{'envelope_id':eid,'occurrence_on':DAY,'status':'open'});self.assertEqual(s['forecast'][0]['cash_cents'],177000);self.assertEqual(s['accounts'][0]['balance_cents'],178500)
  before=self.get('/api/backup/export')['tables'];self.get('/api/state');self.get('/api/state');self.assertEqual(self.get('/api/backup/export')['tables'],before)
  s=self.post('/api/envelope/status',{'envelope_id':eid,'occurrence_on':DAY,'status':'complete'});self.assertEqual(s['forecast'][0]['cash_cents'],178500)
  s=self.post('/api/transactions/delete',{'id':tid});self.assertEqual(s['accounts'][0]['balance_cents'],200000)
  s=self.post('/api/envelope/status',{'envelope_id':eid,'occurrence_on':DAY,'status':'auto'});self.assertEqual(s['forecast'][0]['cash_cents'],177000)
  self.post('/api/envelope/status',{'envelope_id':eid,'occurrence_on':'2026-02-30','status':'open'},400)
 def test_linked_one_time_expense_and_actual_different_amount(self):
  aid=self.account(balance=2000);s=self.post('/api/envelopes',{'name':'Courses','reserved':230,'budget':230,'frequency':'weekly','start_on':DAY,'forecast_account_id':aid});eid=s['envelopes'][0]['id']
  s=self.post('/api/recurring',{'description':'Achat prévu','type':'expense','amount':230,'account_id':aid,'envelope_id':eid,'start_on':DAY,'frequency':'weekly','one_time':True});rid=s['recurring'][0]['id']
  self.assertEqual(s['recurring'][0]['envelope_id'],eid);self.assertEqual(len([r for r in s['planning']['rows'] if r.get('recurring_id')==rid]),1);self.assertEqual(s['forecast'][0]['cash_cents'],177000)
  s=self.transaction(aid,-215,envelope_id=eid,description='Marchand différent');tid=s['transactions'][0]['id']
  s=self.post('/api/reconcile/link',{'recurring_id':rid,'occurrence_on':DAY,'actual_type':'transaction','actual_id':tid});self.assertEqual(s['forecast'][0]['cash_cents'],178500);self.assertEqual(s['planning']['rows'][0]['actual_cents'],21500)
  next_week=(datetime.date.today()+datetime.timedelta(days=7)).isoformat();self.post('/api/overrides',{'recurring_id':rid,'occurrence_on':next_week,'amount':10},400)
 def test_planning_backup_roundtrip_and_preplanning_backup_compatibility(self):
  aid=self.account();s=self.post('/api/envelopes',{'name':'Courses','reserved':0,'budget':100,'frequency':'weekly','start_on':DAY,'forecast_account_id':aid});eid=s['envelopes'][0]['id']
  self.post('/api/envelope/status',{'envelope_id':eid,'occurrence_on':DAY,'status':'skipped'})
  backup=self.get('/api/backup/export');self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
  old=copy.deepcopy(backup);del old['tables']['envelope_period_status']
  for e in old['tables']['envelopes']:
   for key in ['forecast_account_id','forecast_spend','planning_since']:del e[key]
  for r in old['tables']['recurring']:del r['one_time']
  old['tables']['app_settings']=[r for r in old['tables']['app_settings'] if r['key']!='forecast_tracking_since']
  self.post('/api/backup/validate',{'backup':old});self.post('/api/backup/restore',{'backup':old,'confirm':'REMPLACER'});s=self.get('/api/state');self.assertEqual(s['envelopes'][0]['name'],'Courses');self.assertIsNone(s['envelopes'][0]['forecast_account_id']);self.assertTrue(any(w['code']=='envelope_account' for w in s['planning']['warnings']))
 def test_credit_debt_never_reserved_and_only_repayments_reduce_available(self):
  aid=self.account(balance=2000);cid=self.account('credit',5000)
  s=self.get('/api/state');self.assertEqual(s['safe_cents'],200000);self.assertEqual(s['credit_reserved_cents'],0);self.assertTrue(all(d['safe_cents']==200000 and d['credit_reserved_cents']==0 for d in s['forecast']))
  s=self.transaction(cid,-25);self.assertEqual(s['safe_cents'],200000);self.assertEqual(s['spending_windows']['today_cents'],200000)
  s=self.post('/api/transfers',{'from_account_id':aid,'to_account_id':cid,'amount':125,'description':'Remboursement','happened_on':DAY});self.assertEqual(s['safe_cents'],187500);self.assertEqual(s['credit_reserved_cents'],0)

 def planning_action(self,row,action='confirm',status=200,**extra):
  return self.post('/api/planning/action',{'key':row['key'],'signature':row['signature'],'action':action,**extra},status)
 def test_atomic_planning_confirmations_income_expense_transfer_and_duplicate_guard(self):
  aid=self.account(balance=2000);cid=self.account('credit',5000)
  def rule(kind,amount,**extra):
   s=self.post('/api/recurring',{'description':'À confirmer '+kind,'type':kind,'amount':amount,'account_id':aid,'start_on':DAY,'frequency':'monthly','one_time':True,**extra});return next(r for r in s['planning']['rows'] if r['recurring_id']==s['recurring'][0]['id'])
  expense=rule('expense',100);before=self.get('/api/backup/export')['tables'];future=(datetime.date.today()+datetime.timedelta(days=1)).isoformat()
  self.planning_action(expense,status=400,amount=90,happened_on=future);self.assertEqual(self.get('/api/backup/export')['tables'],before)
  s=self.planning_action(expense,amount=90,happened_on=DAY);self.assertEqual(next(a for a in s['accounts'] if a['id']==aid)['balance_cents'],191000);self.assertEqual(s['forecast'][0]['cash_cents'],191000);self.assertEqual(s['safe_cents'],191000)
  before=self.get('/api/backup/export')['tables'];self.planning_action(expense,status=400,amount=90,happened_on=DAY);self.assertEqual(self.get('/api/backup/export')['tables'],before)
  income=rule('income',500);s=self.planning_action(income,amount=450,happened_on=DAY);self.assertEqual(s['cash_cents'],236000)
  transfer=rule('transfer',125,to_account_id=cid);s=self.planning_action(transfer,amount=100,happened_on=DAY);self.assertEqual(s['cash_cents'],226000);self.assertEqual(s['safe_cents'],226000);self.assertEqual(next(a for a in s['accounts'] if a['id']==cid)['balance_cents'],490000)
  self.assertEqual(len(s['calendar_actuals']),2);self.assertEqual(len(s['calendar_transfers']),1);self.assertEqual(len(s['reconciliation_links']),3)
 def test_late_envelope_confirmation_preserves_period_and_deletion_reopens_it(self):
  aid=self.account(balance=2000);old=(datetime.date.today()-datetime.timedelta(days=14)).isoformat()
  s=self.post('/api/envelopes',{'name':'Épicerie en retard','reserved':230,'budget':230,'frequency':'weekly','start_on':old,'forecast_account_id':aid});eid=s['envelopes'][0]['id']
  backup=self.get('/api/backup/export');backup['tables']['envelopes'][0]['planning_since']=old
  next(x for x in backup['tables']['app_settings'] if x['key']=='forecast_tracking_since')['value']=old
  self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});row=next(r for r in self.get('/api/state')['planning']['rows'] if r['original_on']==old)
  s=self.planning_action(row,amount=215,happened_on=DAY,account_id=aid);oldrow=next(r for r in s['planning']['rows'] if r['original_on']==old);todayrow=next(r for r in s['planning']['rows'] if r['original_on']==DAY)
  self.assertEqual(oldrow['actual_cents'],21500);self.assertEqual(oldrow['status'],'actual');self.assertIsNone(todayrow['actual_cents']);self.assertEqual(todayrow['remaining_cents'],23000);self.assertEqual(s['cash_cents'],178500);self.assertEqual(s['envelope_details'][0]['spent_cents'],0)
  backup=self.get('/api/backup/export');self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
  s=self.post('/api/transactions/delete',{'id':s['transactions'][0]['id']});self.assertEqual(s['cash_cents'],200000);self.assertEqual(next(r for r in s['planning']['rows'] if r['original_on']==old)['remaining_cents'],23000);self.assertEqual(s['planning']['envelope_actual_links'],[])
 def test_planning_associates_existing_actual_without_reapplying_bank_balance(self):
  aid=self.account(balance=2000);s=self.post('/api/envelopes',{'name':'Courses','reserved':230,'budget':230,'frequency':'weekly','start_on':DAY,'forecast_account_id':aid});eid=s['envelopes'][0]['id']
  s=self.transaction(aid,-215,description='Marché déjà saisi');tid=s['transactions'][0]['id'];row=s['planning']['rows'][0]
  s=self.planning_action(row,actual_id=tid,account_id=aid);self.assertEqual(s['cash_cents'],178500);self.assertEqual(s['reserved_cents'],1500);self.assertEqual(s['planning']['rows'][0]['actual_cents'],21500);self.assertEqual(len(s['calendar_actuals']),1)
  rule=self.post('/api/recurring',{'description':'Vérification association unique','type':'expense','amount':220,'account_id':aid,'start_on':DAY,'frequency':'monthly','one_time':True})['recurring'][0]['id']
  before=self.get('/api/backup/export')['tables'];self.post('/api/reconcile/link',{'recurring_id':rule,'occurrence_on':DAY,'actual_type':'transaction','actual_id':tid},400);self.assertEqual(self.get('/api/backup/export')['tables'],before);self.post('/api/recurring/delete',{'id':rule})
  self.planning_action(row,status=400,actual_id=tid,account_id=aid)
  s=self.post('/api/transactions/update',{'id':tid,'account_id':aid,'amount':-215,'description':'Sans enveloppe','happened_on':DAY,'envelope_id':None});self.assertEqual(s['cash_cents'],178500);self.assertEqual(s['reserved_cents'],23000);self.assertEqual(s['planning']['envelope_actual_links'],[])
  s=self.post('/api/recurring',{'description':'Facture attendue','type':'expense','amount':220,'account_id':aid,'start_on':DAY,'frequency':'monthly','one_time':True});row=next(r for r in s['planning']['rows'] if r['source']=='recurring')
  s=self.planning_action(row,actual_id=tid);self.assertEqual(s['cash_cents'],178500);self.assertEqual(next(r for r in s['planning']['rows'] if r['source']=='recurring')['actual_cents'],21500)
 def test_planning_moves_adjusts_and_skips_only_one_occurrence_without_bank_changes(self):
  aid=self.account(balance=2000);day=lambda n:(datetime.date.today()+datetime.timedelta(days=n)).isoformat()
  s=self.post('/api/envelopes',{'name':'Courses','reserved':230,'budget':230,'frequency':'weekly','start_on':day(7),'forecast_account_id':aid});eid=s['envelopes'][0]['id'];key=f'env-{eid}|{day(7)}'
  find=lambda s:next(r for r in s['planning']['rows'] if r['key']==key)
  original=find(s);s=self.planning_action(original,'move',new_on=day(10));self.assertEqual(find(s)['date'],day(10));self.assertEqual(find(s)['original_on'],day(7))
  self.planning_action(original,'adjust',status=400,amount=200)
  s=self.planning_action(find(s),'adjust',amount=200);self.assertEqual(find(s)['planned_cents'],20000);self.assertEqual(next(d for d in s['forecast'] if d['date']==day(9))['cash_cents'],200000);self.assertEqual(next(d for d in s['forecast'] if d['date']==day(10))['cash_cents'],180000)
  s=self.planning_action(find(s),'skip');self.assertEqual(find(s)['status'],'skipped');self.assertEqual(next(d for d in s['forecast'] if d['date']==day(10))['cash_cents'],200000);self.assertEqual(next(r for r in s['planning']['rows'] if r['original_on']==day(14))['planned_cents'],23000)
  self.assertEqual(s['cash_cents'],200000);self.assertEqual(s['calendar_actuals'],[])
  s=self.post('/api/recurring',{'description':'Facture unique','type':'expense','amount':100,'account_id':aid,'start_on':day(2),'frequency':'monthly','one_time':True});key=next(r['key'] for r in s['planning']['rows'] if r['source']=='recurring')
  s=self.planning_action(find(s),'move',new_on=day(5));s=self.planning_action(find(s),'adjust',amount=80);self.assertEqual(find(s)['planned_cents'],8000);s=self.planning_action(find(s),'skip');self.assertEqual(find(s)['status'],'skipped');self.assertEqual(s['cash_cents'],200000)
 def test_bank_bridge_reconciles_each_date_and_ignores_card_debt(self):
  aid=self.account(balance=2000);excluded=self.account('savings',500);self.account('credit',5000)
  self.post('/api/accounts/inclusion',{'id':excluded,'included':False})
  self.post('/api/envelopes',{'name':'Courses','reserved':230,'budget':230,'frequency':'weekly','start_on':DAY,'forecast_account_id':aid})
  for kind,amount,extra in [('income',1000,{}),('expense',100,{}),('transfer',50,{'to_account_id':excluded})]:self.post('/api/recurring',{'description':'Prévu '+kind,'type':kind,'amount':amount,'account_id':aid,'start_on':DAY,'frequency':'monthly','one_time':True,**extra})
  s=self.get('/api/state');first=s['forecast'][0];self.assertEqual(first['cash_cents'],262000);self.assertEqual(first['bridge']['opening_cash_cents'],200000)
  for d in s['forecast']:
   c=d['bridge'];self.assertEqual(c['opening_cash_cents']+sum(c[k] for k in ['income_cents','expense_cents','envelope_cents','transfer_cents']),d['cash_cents']);self.assertEqual(c['closing_cash_cents']-c['reserved_cents'],d['safe_cents'])
  before=self.get('/api/backup/export')['tables'];self.get('/api/state');self.assertEqual(self.get('/api/backup/export')['tables'],before)
 def test_planning_action_backup_compatibility_and_missing_new_table_rejected(self):
  self.account();backup=self.get('/api/backup/export');old=copy.deepcopy(backup)
  for name in ['envelope_actual_links','envelope_occurrence_moves']:del old['tables'][name]
  old['tables']['app_settings']=[s for s in old['tables']['app_settings'] if s['key']!='planning_actions_v1']
  self.post('/api/backup/validate',{'backup':old});self.post('/api/backup/restore',{'backup':old,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/state')['cash_cents'],100000)
  bad=copy.deepcopy(backup);del bad['tables']['envelope_actual_links'];before=self.get('/api/backup/export')['tables'];self.post('/api/backup/restore',{'backup':bad,'confirm':'REMPLACER'},400);self.assertEqual(self.get('/api/backup/export')['tables'],before)

 def test_private_listener_enforces_identity_origin_and_preserves_local_access(self):
  self.stop()
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));private_port=sock.getsockname()[1]
  origin='https://budget.exemple.ts.net';login='alex@example.test'
  (self.dir/'data'/'private-access.json').write_text(json.dumps({'origin':origin,'login':login,'port':private_port}));self.start()
  self.assertTrue(self.get('/api/private/status')['enabled']);self.assertEqual(self.get('/api/private/status')['origin'],origin)
  def remote(path,headers=None,data=None,status=200):
   old=self.base;self.base=f'http://127.0.0.1:{private_port}'
   try:return self.call(path,data,status,headers={'Host':'budget.exemple.ts.net',**(headers or {})})
   finally:self.base=old
  owner={'Tailscale-User-Login':login};valid={**owner,'Origin':origin,'Content-Type':'application/json'}
  for path in ['/','/api/state','/api/backup/export','/api/private/status']:remote(path,status=403)
  remote('/api/state',{'Tailscale-User-Login':'other@example.test'},status=403);remote('/api/state',{'X-Forwarded-User':login},status=403)
  self.assertEqual(remote('/api/private/status',owner)['data_key'],self.get('/api/private/status')['data_key']);self.assertEqual(remote('/api/state',owner)['accounts'],[]);self.assertEqual(remote('/api/state',{**owner,'Host':f'127.0.0.1:{private_port}'})['accounts'],[])
  before=self.get('/api/backup/export')['tables'];account={'name':'Compte distant fictif','kind':'checking','balance':500}
  for headers in [{**owner,'Content-Type':'application/json'},{**valid,'Origin':'https://evil.example.com'},{**valid,'Host':'evil.example.com'},{**valid,'Content-Type':'text/plain'}]:remote('/api/accounts',headers,data=account,status=403)
  self.assertEqual(self.get('/api/backup/export')['tables'],before)
  s=remote('/api/accounts',valid,data=account);self.assertEqual(s['cash_cents'],50000);self.assertEqual(self.get('/api/state')['cash_cents'],50000)
  self.call('/api/state',status=403,headers={'Host':'budget.exemple.ts.net'})

 def test_extended_bill_frequencies_dates_backup_and_migration(self):
  aid=self.account(balance=2000)
  cases=[('weekly','2028-01-31','2028-02-07'),('biweekly','2028-01-31','2028-02-14'),('monthly','2028-01-31','2028-02-29'),('quarterly','2028-01-31','2028-04-30'),('semiannual','2028-08-31','2029-02-28'),('yearly','2028-02-29','2029-02-28')]
  for frequency,start,expected in cases:
   s=self.post('/api/recurring',{'description':'Facture '+frequency,'type':'expense','amount':35,'account_id':aid,'frequency':frequency,'start_on':start});rid=max(r['id'] for r in s['recurring'])
   self.post('/api/overrides',{'recurring_id':rid,'occurrence_on':expected,'amount':40})
   wrong=(datetime.date.fromisoformat(expected)+datetime.timedelta(days=1)).isoformat();self.post('/api/overrides',{'recurring_id':rid,'occurrence_on':wrong,'amount':40},400)
  for frequency,months in [('quarterly',3),('semiannual',6),('yearly',12)]:
   now=datetime.date.today();index=now.year*12+now.month-1-months;start=datetime.date(index//12,index%12+1,min(now.day,28)).isoformat()
   s=self.post('/api/recurring',{'description':'Prévision '+frequency,'type':'expense','amount':10,'account_id':aid,'frequency':frequency,'start_on':start});rid=max(r['id'] for r in s['recurring']);expected=now.replace(day=min(now.day,28)).isoformat()
   self.assertTrue(any(r.get('recurring_id')==rid and r['original_on']==expected for r in s['planning']['rows']))
  backup=self.get('/api/backup/export');self.post('/api/backup/validate',{'backup':backup});self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
  self.stop()
  with sqlite3.connect(self.dir/'data'/'budget.sqlite') as db:
   # Simulate the previous constraint with linked monthly rules and overrides.
   db.execute("UPDATE recurring SET frequency='monthly'")
   schema=db.execute("SELECT sql FROM sqlite_master WHERE name='recurring'").fetchone()[0]
   old=schema.replace('"recurring"','recurring_old',1).replace("'quarterly','semiannual','yearly',",'')
   db.execute(old);db.execute('INSERT INTO recurring_old SELECT * FROM recurring');db.execute('DROP TABLE recurring');db.execute('ALTER TABLE recurring_old RENAME TO recurring');db.commit()
   before=db.execute('SELECT * FROM recurring').fetchall();links=db.execute('SELECT * FROM recurring_overrides').fetchall()
  self.start()
  with sqlite3.connect(self.dir/'data'/'budget.sqlite') as db:
   self.assertEqual(db.execute('SELECT * FROM recurring').fetchall(),before);self.assertEqual(db.execute('SELECT * FROM recurring_overrides').fetchall(),links);self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(),[])
  self.assertTrue((self.dir/'data'/'backups'/'budget-before-extended-recurrences.sqlite').exists())

 def test_card_payment_plan_projects_purchases_and_confirms_actual_once(self):
  aid=self.account(balance=2000);cid=self.account('credit',5000);day=lambda n:(datetime.date.today()+datetime.timedelta(days=n)).isoformat()
  self.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':day(1),'forecast_account_id':cid})
  s=self.post('/api/card-payments',{'card_account_id':cid,'from_account_id':aid,'mode':'purchases','frequency':'weekly','start_on':day(2)});plan=s['card_payment_plans'][0];rid=plan['recurring_id'];row=next(r for r in s['planning']['rows'] if r.get('recurring_id')==rid)
  self.assertEqual(row['planned_cents'],23000);self.assertEqual(s['cash_cents'],200000);self.assertEqual(s['credit_reserved_cents'],0);self.assertEqual(next(d for d in s['forecast'] if d['date']==day(1))['cash_cents'],200000);self.assertEqual(next(d for d in s['forecast'] if d['date']==day(2))['cash_cents'],177000)
  s=self.planning_action(row,amount=200,happened_on=DAY);self.assertEqual(s['cash_cents'],180000);self.assertEqual(len(s['calendar_transfers']),1);self.assertEqual(next(d for d in s['forecast'] if d['date']==day(2))['cash_cents'],180000)
  nextrow=next(r for r in s['planning']['rows'] if r.get('recurring_id')==rid and r['original_on']==day(9));self.assertEqual(nextrow['planned_cents'],26000)
  before=self.get('/api/backup/export')['tables'];self.planning_action(row,status=400,amount=200,happened_on=DAY);self.assertEqual(self.get('/api/backup/export')['tables'],before)
  tid=s['calendar_transfers'][0]['id'];s=self.post('/api/transfers/update',{'id':tid,'from_account_id':aid,'to_account_id':cid,'amount':215,'description':'Paiement corrigé','happened_on':DAY});self.assertEqual(s['cash_cents'],178500);self.assertEqual(next(r for r in s['planning']['rows'] if r.get('recurring_id')==rid and r['original_on']==day(9))['planned_cents'],24500)
  s=self.post('/api/transfers/delete',{'id':tid});self.assertEqual(s['cash_cents'],200000);self.assertEqual(next(d for d in s['forecast'] if d['date']==day(2))['cash_cents'],177000)
 def test_existing_card_payment_requires_association_or_explicit_new_payment(self):
  aid=self.account(balance=2000);cid=self.account('credit',0)
  self.transaction(cid,-215,description='Marché')
  s=self.post('/api/transfers',{'from_account_id':aid,'to_account_id':cid,'amount':215,'description':'Opération bancaire','happened_on':DAY});tid=s['calendar_transfers'][0]['id']
  s=self.post('/api/card-payments',{'card_account_id':cid,'from_account_id':aid,'mode':'purchases','frequency':'weekly','start_on':DAY});rid=s['card_payment_plans'][0]['recurring_id'];row=next(r for r in s['planning']['rows'] if r.get('recurring_id')==rid)
  self.assertEqual(row['planned_cents'],21500);self.assertEqual(row['unmatched_payment_ids'],[tid]);before=self.get('/api/backup/export')['tables']
  self.planning_action(row,status=400,amount=215,happened_on=DAY);self.assertEqual(self.get('/api/backup/export')['tables'],before)
  s=self.planning_action(row,actual_id=tid);self.assertEqual(s['cash_cents'],178500);self.assertEqual(len(s['calendar_transfers']),1);self.assertEqual(next(r for r in s['planning']['rows'] if r.get('recurring_id')==rid)['status'],'actual')
 def test_card_plan_reuses_existing_rule_fixed_mode_pause_and_duplicate_protection(self):
  aid=self.account(balance=2000);cid=self.account('credit',5000);start=(datetime.date.today()+datetime.timedelta(days=2)).isoformat()
  rule={'description':'Ancien paiement CIBC','type':'transfer','amount':100,'account_id':aid,'to_account_id':cid,'start_on':start,'frequency':'weekly'};rid=self.post('/api/recurring',rule)['recurring'][0]['id']
  payload={'card_account_id':cid,'from_account_id':aid,'mode':'purchases','frequency':'weekly','start_on':start};self.post('/api/card-payments',payload,400)
  s=self.post('/api/card-payments',{**payload,'replace_recurring_id':rid});self.assertEqual(len(s['recurring']),1);self.assertEqual(s['card_payment_plans'][0]['recurring_id'],rid)
  s=self.post('/api/card-payments',{**payload,'mode':'fixed','amount':150});self.assertEqual(next(d for d in s['forecast'] if d['date']==start)['cash_cents'],185000)
  s=self.post('/api/card-payments',{**payload,'mode':'fixed','amount':150,'active':False});self.assertTrue(all(d['cash_cents']==200000 for d in s['forecast']))
  self.post('/api/recurring',rule,400);self.post('/api/accounts/update',{'id':cid,'name':'Carte','kind':'checking','balance':5000,'included':True},400);self.post('/api/accounts/update',{'id':aid,'name':'Source','kind':'credit','balance':2000,'included':False},400)
  self.post('/api/transfers',{'from_account_id':aid,'to_account_id':cid,'amount':25,'description':'Paiement réel','happened_on':DAY});s=self.post('/api/card-payments/delete',{'card_account_id':cid});self.assertEqual(s['card_payment_plans'],[]);self.assertEqual(s['recurring'],[]);self.assertEqual(s['cash_cents'],197500);self.assertEqual(len(s['calendar_transfers']),1)
 def test_card_plan_invalid_configuration_and_backup_roundtrip(self):
  aid=self.account(balance=2000);cid=self.account('credit',5000);before=self.get('/api/backup/export');start=(datetime.date.today()+datetime.timedelta(days=2)).isoformat();payload={'card_account_id':cid,'from_account_id':aid,'mode':'purchases','frequency':'weekly','start_on':start}
  for changes in [{'card_account_id':aid},{'from_account_id':cid},{'mode':'unknown'},{'frequency':'daily'},{'mode':'fixed','amount':-1},{'start_on':'2026-02-30'}]:self.post('/api/card-payments',{**payload,**changes},400)
  self.assertEqual(self.get('/api/backup/export')['tables'],before['tables']);self.post('/api/card-payments',payload);backup=self.get('/api/backup/export');self.post('/api/backup/validate',{'backup':backup});self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
  bad=copy.deepcopy(backup);del bad['tables']['card_payment_plans'];self.post('/api/backup/restore',{'backup':bad,'confirm':'REMPLACER'},400);self.assertEqual(self.get('/api/backup/export')['tables'],backup['tables'])
  old=copy.deepcopy(before);del old['tables']['card_payment_plans'];old['tables']['app_settings']=[s for s in old['tables']['app_settings'] if s['key']!='card_payments_v1'];self.post('/api/backup/restore',{'backup':old,'confirm':'REMPLACER'});self.assertEqual(self.get('/api/state')['card_payment_plans'],[]);self.assertEqual(self.get('/api/state')['cash_cents'],200000)
 def test_card_payment_projection_browsing_does_not_change_financial_data(self):
  aid=self.account(balance=2000);cid=self.account('credit',5000);self.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':DAY,'forecast_account_id':cid});s=self.post('/api/card-payments',{'card_account_id':cid,'from_account_id':aid,'mode':'purchases','frequency':'weekly','start_on':DAY});self.assertEqual(s['forecast'][0]['cash_cents'],177000)
  before=self.get('/api/backup/export')['tables'];self.get('/api/state');self.get('/api/state');self.assertEqual(self.get('/api/backup/export')['tables'],before)
  for d in s['forecast']:
   c=d['bridge'];self.assertEqual(c['opening_cash_cents']+c['income_cents']+c['expense_cents']+c['envelope_cents']+c['transfer_cents'],d['cash_cents']);self.assertEqual(d['credit_reserved_cents'],0)

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
