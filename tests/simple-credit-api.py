"""Simple credit: no debt entry; bank cash and protections reconcile exactly."""
import importlib.util, unittest, copy, datetime
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
class SimpleCredit(api.BudgetAPI):
 def simple(self,name='Carte simple'):
  s=self.post('/api/accounts',{'name':name,'kind':'credit','simple_credit':True})
  a=next(a for a in s['accounts'] if a['name']==name);self.assertTrue(a['simple_credit']);self.assertFalse(a['included']);return a['id']
 def payment(self,bank,card,amount):
  return self.post('/api/transfers',{'from_account_id':bank,'to_account_id':card,'amount':amount,'description':'Paiement de carte','happened_on':api.DAY})
 def check(self,s,cash,safe,protected):
  self.assertEqual((s['cash_cents'],s['safe_cents'],s['card_envelope_reserved_cents']),(cash,safe,protected))
  for d in s['forecast']:self.assertEqual(d['cash_cents']-d['reserved_cents'],d['safe_cents'])
 def test_simple_purchase_payment_refund_and_overpayment(self):
  bank=self.account(balance=1000);card=self.simple();self.check(self.transaction(card,-100),100000,90000,10000)
  self.check(self.payment(bank,card,40),96000,90000,6000)
  self.check(self.transaction(card,10,description='Retour'),96000,91000,5000)
  self.check(self.payment(bank,card,50),91000,91000,0)
  self.check(self.payment(bank,card,20),89000,89000,0)
 def test_simple_envelope_and_future_occurrences(self):
  bank=self.account(balance=1000);card=self.simple();s=self.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':api.DAY,'rollover':False,'forecast_spend':False});eid=s['envelopes'][0]['id']
  self.check(s,100000,77000,0);s=self.transaction(card,-71.69,envelope_id=eid);self.check(s,100000,77000,7169)
  self.assertEqual(next(e for e in s['envelopes'] if e['id']==eid)['reserved_cents'],15831)
  self.check(self.payment(bank,card,71.69),92831,77000,0)
  for offset in [7,14,21]:
   d=next(d for d in s['forecast'] if d['date']==self.future73(offset));self.assertLessEqual(d['safe_cents'],77000-23000*(offset//7))
  path=self.post('/api/sharing',{'action':'create'})['path'];self.assertEqual(self.get(path+'/data')['current_safe_cents'],77000)
 def test_planned_card_expense_actual_and_payment_only_deduct_once(self):
  bank=self.account(balance=1000);card=self.simple();s=self.post('/api/recurring',{'description':'Apple One','amount':53.98,'type':'expense','account_id':card,'frequency':'monthly','one_time':True,'start_on':api.DAY})
  self.assertEqual(s['forecast'][0]['safe_cents'],94602)
  s=self.transaction(card,-53.98,description='Apple One');self.check(s,100000,94602,5398);self.assertEqual(s['forecast'][0]['safe_cents'],94602)
  s=self.payment(bank,card,53.98);self.check(s,94602,94602,0);self.assertEqual(s['forecast'][0]['safe_cents'],94602)
 def test_activation_preserves_history_edit_delete_restart_and_restore(self):
  self.account(balance=1000);card=self.account('credit',0);s=self.transaction(card,-200,description='Ancien achat non suivi');before=s['safe_cents'];balance=next(a for a in s['accounts'] if a['id']==card)['balance_cents']
  s=self.post('/api/accounts/update',{'id':card,'name':'Marge simple','kind':'credit','simple_credit':True});self.assertEqual(s['safe_cents'],before);self.assertEqual(next(a for a in s['accounts'] if a['id']==card)['balance_cents'],balance)
  prior=(datetime.date.fromisoformat(api.DAY)-datetime.timedelta(days=2)).isoformat();s=self.transaction(card,-25,happened_on=prior);tid=s['transactions'][0]['id'];self.check(s,100000,97500,2500)
  s=self.post('/api/transactions/update',{'id':tid,'account_id':card,'amount':-30,'description':'Corrigé','happened_on':prior});self.check(s,100000,97000,3000)
  exported=next(a for a in self.get('/api/chatgpt/export?history=all')['accounts'] if a['id']==card);self.assertTrue(exported['simple_credit']);self.assertIsNone(exported['balance_cents'])
  backup=self.get('/api/backup/export');self.stop();self.start();self.check(self.get('/api/state'),100000,97000,3000)
  self.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'});self.check(self.get('/api/state'),100000,97000,3000)
  self.check(self.post('/api/transactions/delete',{'id':tid}),100000,100000,0)
  self.check(self.transaction(card,-15),100000,98500,1500)
 def test_two_cards_and_actual_payment_preview_use_identical_protection(self):
  bank=self.account(balance=1000);first=self.simple('CIBC');second=self.simple('Marge');self.transaction(first,-100);s=self.transaction(second,-40);self.check(s,100000,86000,14000)
  tables=self.get('/api/backup/export')['tables'];preview=self.post('/api/card-payments/actual-preview',{'from_account_id':bank,'to_account_id':first,'amount':50,'description':'Paiement CIBC','happened_on':api.DAY});self.assertEqual(tables,self.get('/api/backup/export')['tables']);self.assertEqual(preview['after']['safe_cents'],86000)
  s=self.post('/api/card-payments/actual-confirm',{'token':preview['token']});self.check(s,95000,86000,9000);self.assertEqual(s['safe_cents'],preview['after']['safe_cents']);self.assertEqual(sum(f['amount_cents'] for f in s['sts_breakdown']['card_envelopes'] if f['card_account_id']==second),4000)
  path=self.post('/api/sharing',{'action':'create'})['path'];shared=self.get(path+'/data');self.assertEqual([d['safe_cents'] for d in shared['daily']],[d['safe_cents'] for d in s['forecast']])
 def test_early_envelope_purchase_uses_next_period_without_double_reserving(self):
  self.account(balance=1000);card=self.simple();date=self.future73(1);eid=self.post('/api/envelopes',{'name':'Épicerie','reserved':0,'budget':230,'frequency':'weekly','start_on':date,'rollover':False,'forecast_spend':False})['envelopes'][0]['id']
  draft={'account_id':card,'envelope_id':eid,'amount':-71.69,'description':'Épicerie tôt','happened_on':api.DAY};choice=self.post('/api/envelopes/period-preview',{'draft':draft})['choices'][0]
  s=self.post('/api/transactions',{**draft,'budget_period_on':choice['date'],'budget_period_signature':choice['signature']});self.check(s,100000,92831,7169);tomorrow=next(d for d in s['forecast'] if d['date']==date);self.assertEqual(tomorrow['safe_cents'],77000);self.assertEqual(tomorrow['envelope_reserved_cents'],15831)
 def test_ambiguous_historical_protection_cannot_be_reactivated(self):
  self.account(balance=1000);card=self.account('credit',0);eid=self.post('/api/envelopes',{'name':'Ancienne enveloppe','reserved':100,'budget':0,'frequency':'none','forecast_spend':False})['envelopes'][0]['id'];self.transaction(card,-50,envelope_id=eid)
  self.post('/api/accounts/update',{'id':card,'name':'Carte rapprochée','kind':'credit','balance':0,'included':False});before=self.get('/api/backup/export')['tables']
  self.post('/api/accounts/update',{'id':card,'name':'Carte simple','kind':'credit','simple_credit':True},400);self.assertEqual(before,self.get('/api/backup/export')['tables'])
 def test_csv_history_invalid_mode_and_backup_are_safe(self):
  bank=self.account(balance=1000);card=self.simple();before=self.get('/api/backup/export')['tables']
  for payload in [{'name':'Invalide','kind':'checking','simple_credit':True},{'name':'Invalide','kind':'credit','simple_credit':'oui'}]:
   self.post('/api/accounts',payload,400);self.assertEqual(before,self.get('/api/backup/export')['tables'])
  s=self.import_rows(self.csv_data(card));self.check(self.get('/api/state'),100000,100000,0)
  self.import_rows(self.csv_data(card,text=f'Date;Description;Montant\n{api.DAY};Achat réel;-12,50',affects_balance=True));self.check(self.get('/api/state'),100000,98750,1250)
  backup=self.get('/api/backup/export');before=copy.deepcopy(backup['tables'])
  for value in ['[]','{"999999":true}',f'{{"{bank}":true}}',f'{{"{card}":false}}']:
   bad=copy.deepcopy(backup);next(x for x in bad['tables']['app_settings'] if x['key']=='simple_credit_v161')['value']=value;self.post('/api/backup/validate',{'backup':bad},400);self.assertEqual(before,self.get('/api/backup/export')['tables'])
if __name__=='__main__':
 names=[n for n in SimpleCredit.__dict__ if n.startswith('test_')];result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(SimpleCredit(n) for n in names));raise SystemExit(not result.wasSuccessful())
