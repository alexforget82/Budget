"""Daily review and bank bridge; all financial data are fictitious and temporary."""
import importlib.util,os,shutil,sys,tempfile,datetime
from pathlib import Path
sys.dont_write_bytecode=True
from ui_navigation import navigate_legacy as navigate
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('budget_api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI('runTest');f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-review-ui-'))
try:
 today=datetime.date.today();day=lambda i:(today+datetime.timedelta(days=i)).isoformat();aid=f.account(balance=3200);credit=f.account('credit',5000)
 s=f.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':day(0),'forecast_account_id':aid});eid=s['envelopes'][0]['id'];envkey=f'env-{eid}|{day(0)}'
 def rule(name,kind,amount,offset=0,**extra):
  s=f.post('/api/recurring',{'description':name,'type':kind,'amount':amount,'account_id':aid,'start_on':day(offset),'frequency':'monthly','one_time':True,**extra});return s['recurring'][0]['id']
 bill=rule('Assurance habitation','expense',120);income=rule('Paie','income',1000);payment=rule('Paiement carte choisi','transfer',80,to_account_id=credit);late=rule('Facture à reporter','expense',20,-1);late_income=rule('Revenu à vérifier','income',50,-1);future=rule('Achat à venir','expense',100,5)
 s=f.transaction(aid,-115,description='Assureur déjà saisi');existing=s['transactions'][0]['id'];backup=f.get('/api/backup/export');next(x for x in backup['tables']['app_settings'] if x['key']=='forecast_tracking_since')['value']=day(-1);f.post('/api/backup/restore',{'backup':backup,'confirm':'REMPLACER'})
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1100});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' and '400 (Bad Request)' not in m.text else None)
  page.goto(f.base);page.wait_for_selector('#planning-inbox .inbox-card',state='attached');navigate(page,'suivi');expect(page.locator('#planning-inbox')).to_be_visible();expect(page.locator('#planning-history')).to_be_hidden();expect(page.locator('.inbox-card')).to_have_count(6)
  page.locator('[data-inbox-filter="week"]').click();expect(page.locator('.inbox-card')).to_have_count(8);page.locator('[data-inbox-filter="due"]').click();before=f.get('/api/backup/export')['tables'];page.evaluate('scrollTo(0,0)');page.screenshot(path=str(images/'a-confirmer.png'),full_page=True)
  card=lambda key:page.locator(f'.inbox-card[data-key="{key}"]')
  rec_key=lambda rid,offset=0:f'rec-{rid}|{day(offset)}'
  dialog=page.locator('#planning-action-dialog')
  # Existing actual association must not debit the bank again.
  card(rec_key(bill)).get_by_role('button',name='Confirmer le réel',exact=True).click();dialog.locator('[name="entry_mode"]').select_option('existing');dialog.locator('[name="actual_id"]').select_option(str(existing));dialog.get_by_role('button',name='Valider le réel').click();expect(dialog).not_to_be_visible();expect(card(rec_key(bill))).to_have_count(0);assert f.get('/api/state')['cash_cents']==308500
  # Split spending: leave a remainder, then finish with a lower total than planned.
  card(envkey).get_by_role('button',name='Confirmer le réel',exact=True).click();dialog.locator('[name="amount"]').fill('100');dialog.locator('[name="complete_period"]').uncheck();dialog.get_by_role('button',name='Valider le réel').click();expect(card(envkey)).to_contain_text('130,00');card(envkey).get_by_role('button',name='Confirmer le réel',exact=True).click();dialog.locator('[name="amount"]').fill('115');dialog.get_by_role('button',name='Valider le réel').click();expect(card(envkey)).to_have_count(0);assert f.get('/api/state')['cash_cents']==287000
  card(rec_key(income)).get_by_role('button',name='Confirmer le réel',exact=True).click();dialog.locator('[name="amount"]').fill('980');dialog.get_by_role('button',name='Valider le réel').click();expect(card(rec_key(income))).to_have_count(0);assert f.get('/api/state')['cash_cents']==385000
  card(rec_key(payment)).get_by_role('button',name='Confirmer le réel',exact=True).click();dialog.locator('[name="amount"]').fill('75');dialog.get_by_role('button',name='Valider le réel').click();expect(card(rec_key(payment))).to_have_count(0);assert f.get('/api/state')['cash_cents']==377500;assert f.get('/api/state')['credit_reserved_cents']==0
  # Postpone only one occurrence; changing a forecast must not touch actuals.
  before=f.get('/api/state')['cash_cents'];card(rec_key(late,-1)).get_by_role('button',name='Reporter',exact=True).click();dialog.locator('[name="new_on"]').fill(day(3));dialog.get_by_role('button',name='Enregistrer le report').click();expect(card(rec_key(late,-1))).to_have_count(0);page.locator('[data-inbox-filter="week"]').click();expect(card(rec_key(late,-1))).to_contain_text('Initialement prévu');assert f.get('/api/state')['cash_cents']==before
  card(rec_key(future,5)).get_by_role('button',name='Modifier le prévu').click();dialog.locator('[name="amount"]').fill('80');dialog.get_by_role('button',name='Enregistrer le montant prévu').click();expect(card(rec_key(future,5))).to_contain_text('80,00')
  # A stale form reports an inline error and creates no operation.
  card(rec_key(future,5)).get_by_role('button',name='Modifier le prévu').click();row=next(r for r in f.get('/api/state')['planning']['rows'] if r['key']==rec_key(future,5));f.planning_action(row,'adjust',amount=90);dialog.locator('[name="amount"]').fill('70');dialog.get_by_role('button',name='Enregistrer le montant prévu').click();expect(page.locator('#planning-action-error')).to_contain_text('changé');expect(dialog).to_be_visible();dialog.get_by_role('button',name='Actualiser la liste',exact=True).click();expect(dialog).not_to_be_visible();expect(card(rec_key(future,5))).to_contain_text('90,00')
  card(rec_key(late_income,-1)).get_by_role('button',name='Annuler',exact=True).click();dialog.get_by_role('button',name='Annuler cette occurrence',exact=True).click();expect(card(rec_key(late_income,-1))).to_have_count(0);assert f.get('/api/state')['cash_cents']==before
  page.locator('[data-review-mode="history"]').click();expect(page.locator('#planning-history')).to_be_visible();expect(page.locator(f'.review-card[data-key="{envkey}"]')).to_contain_text('215,00');page.locator('[data-review-mode="queue"]').click()
  # All the sum's terms and detail groups come from the same simulation as the chart.
  navigate(page,'prevision');page.locator('#planning-date').fill(day(19));page.locator('#planning-date').dispatch_event('change');s=f.get('/api/state');d=next(d for d in s['forecast'] if d['date']==day(19));fmt=lambda value:page.evaluate('(n)=>(n/100).toLocaleString("fr-CA",{style:"currency",currency:"CAD"})',value)
  expect(page.locator('[data-bridge="closing_cash_cents"] strong')).to_have_text(fmt(d['cash_cents']));expect(page.locator('[data-bridge="closing_safe_cents"] strong')).to_have_text(fmt(d['safe_cents']));page.locator('[data-bridge-group="envelope_cents"] summary').click();expect(page.locator('[data-bridge-group="envelope_cents"]')).to_contain_text('Épicerie');page.evaluate('document.getElementById("balance-bridge").scrollIntoView()');page.locator('#balance-bridge').screenshot(path=str(images/'explication-solde.png'))
  snapshot=f.get('/api/backup/export')['tables'];page.locator('#planning-day-slider').focus();page.keyboard.press('End');expect(page.locator('.bridge-equation')).to_have_attribute('data-date',s['forecast'][-1]['date'])
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for view in ['suivi','prevision']:
    navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,view)
   navigate(page,'suivi');page.locator('[data-inbox-filter="week"]').click();card(rec_key(future,5)).get_by_role('button',name='Confirmer le réel').click();assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1'),('dialog',width);dialog.get_by_role('button',name='Fermer',exact=True).click()
  page.set_viewport_size({'width':390,'height':844});page.evaluate('scrollTo(0,0)');page.screenshot(path=str(images/'mobile-a-confirmer.png'),full_page=True);assert f.get('/api/backup/export')['tables']==snapshot,'Exploration changed financial records'
  assert not errors,errors;browser.close()
 print('PASS: daily queue, existing receipt association, split envelope confirmations, income and transfer amount correction, exact real balances, no card reserve, postponement, one-occurrence amount edit, cancellation, stale-form inline error without writes, history, exact selected-date bridge, keyboard date navigation, five responsive widths, no browsing mutations.')
 print('Captures fictives :',images)
finally:f.tearDown()
