"""Real envelope forecasts and reconciliation in Chromium, isolated financial data."""
import importlib.util,os,shutil,sys,tempfile,datetime
from pathlib import Path
sys.dont_write_bytecode=True
from ui_navigation import navigate_legacy as navigate
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('budget_api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI('runTest');f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-forecast-ui-'))
try:
 aid=f.account(balance=3200);credit=f.account('credit',300);today=datetime.date.today();day=lambda n:(today+datetime.timedelta(days=n)).isoformat()
 s=f.post('/api/envelopes',{'name':'Épicerie du jeudi','reserved':230,'budget':230,'frequency':'weekly','start_on':api.DAY,'forecast_account_id':aid});eid=s['envelopes'][0]['id']
 for name,amount,offset in [('Essence',60,2),('Sorties',80,4)]:f.post('/api/envelopes',{'name':name,'reserved':amount,'budget':amount,'frequency':'weekly','start_on':day(offset),'forecast_account_id':aid})
 f.post('/api/envelopes',{'name':'Voyage','reserved':400,'budget':100,'frequency':'monthly','start_on':day(3),'forecast_account_id':aid,'forecast_spend':False})
 f.post('/api/envelopes',{'name':'À planifier','reserved':10,'budget':0,'frequency':'none'})
 s=f.post('/api/recurring',{'description':'Assurance habitation','type':'expense','amount':120,'account_id':aid,'start_on':api.DAY,'frequency':'monthly','one_time':True});rid=s['recurring'][0]['id']
 s=f.transaction(aid,-115,description='Assureur réel');tid=s['transactions'][0]['id']
 f.post('/api/recurring',{'description':'Salaire','type':'income','amount':1850,'account_id':aid,'start_on':day(3),'frequency':'biweekly'})
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1100});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(f.base);page.wait_for_selector('.envelope-tile',state='attached');navigate(page,'prevision');expect(page.locator('#planning-notices')).to_contain_text('À planifier');expect(page.locator('.projected-bank-balance')).to_be_visible()
  page.locator('#planning-graph-kind').select_option('cash_cents');expect(page.locator('#planning-chart')).to_have_attribute('aria-label',__import__('re').compile('Solde bancaire prévu'))
  target=day(19);page.locator('#planning-date').fill(target);page.locator('#planning-date').dispatch_event('change');expected=next(d for d in f.get('/api/state')['forecast'] if d['date']==target);fmt=lambda cents:page.evaluate('(n)=>(n/100).toLocaleString("fr-CA",{style:"currency",currency:"CAD"})',cents);expect(page.locator('.projected-bank-balance')).to_have_text(fmt(expected['cash_cents']))
  page.evaluate('scrollTo(0,0)');page.screenshot(path=str(images/'prevision-enveloppes.png'),full_page=True)
  navigate(page,'calendrier');cell=page.locator(f'.cal-cell[data-date="{api.DAY}"]');expect(cell).to_contain_text('Épicerie du jeudi');cell.click();expect(page.locator('#cal-detail')).to_contain_text('Épicerie du jeudi')
  navigate(page,'suivi');page.locator('[data-review-mode="history"]').click();expect(page.locator('#section-suivi.view-active')).to_be_visible();card=page.locator(f'.review-card[data-key="env-{eid}|{api.DAY}"]');expect(card).to_contain_text('230,00');before=f.get('/api/transactions/list')['count'];card.get_by_role('button',name='Saisir la transaction').click();expect(page.locator('#transaction-dialog')).to_be_visible();assert page.locator('#transaction [name="amount"]').input_value()=='230.00';assert page.locator('#envelope-options').input_value()==str(eid);assert f.get('/api/transactions/list')['count']==before
  page.locator('#transaction [name="amount"]').fill('215');page.locator('#transaction').get_by_role('button',name='Enregistrer',exact=True).click();expect(page.locator('#transaction-dialog')).not_to_be_visible();expect(card).to_contain_text('Réel enregistré');expect(card).to_contain_text('215,00');expect(card).to_contain_text('-15,00')
  card.get_by_role('button',name='Encore des achats').click();expect(card).to_contain_text('Achats supplémentaires prévus');assert next(r for r in f.get('/api/state')['planning']['rows'] if r['source']=='envelope' and r['date']==api.DAY and r['envelope_id']==eid)['remaining_cents']==1500
  card.get_by_role('button',name='Terminer la période').click();expect(card).to_contain_text('Réel enregistré')
  rec=page.locator(f'.review-card[data-key="rec-{rid}|{api.DAY}"]');rec.get_by_role('button',name='Associer un réel').click();expect(page.locator('dialog[open] select')).to_contain_text('Assureur réel');page.locator('dialog[open]').get_by_role('button',name='Associer cette opération').click();expect(rec).to_contain_text('115,00');expect(rec).to_contain_text('Réel enregistré')
  before=f.get('/api/backup/export')['tables'];page.screenshot(path=str(images/'prevu-reel.png'),full_page=True)
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for view in ['prevision','suivi','calendrier','enveloppes']:
    navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(view,width)
  page.set_viewport_size({'width':390,'height':844});navigate(page,'suivi');page.screenshot(path=str(images/'mobile-prevu-reel.png'),full_page=True)
  assert f.get('/api/backup/export')['tables']==before,'Browsing changed financial records'
  page.set_viewport_size({'width':1440,'height':1100});navigate(page,'enveloppes');page.locator('.envelope-tile button',has_text='Ajuster').first.click();expect(page.locator('#envelope-forecast-account')).to_be_visible();expect(page.locator('#envelope [name="forecast_spend"]')).to_be_visible();page.keyboard.press('Escape')
  assert not errors,errors;browser.close()
 print('PASS: envelope calendar expenses, exact bank forecast, graph switch, actual draft without saving, 215 replaces 230, reopen/close partial period, manual recurring match with different amount, no browsing writes, four views at five widths, envelope configuration.')
 print('Captures fictives :',images)
finally:f.tearDown()
