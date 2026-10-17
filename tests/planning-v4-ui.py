"""v4 calendar, forecast and read-only scenarios against an isolated real API."""
import importlib.util,os,shutil,sys,tempfile,datetime
from pathlib import Path
sys.dont_write_bytecode=True
from ui_navigation import navigate
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('budget_api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI('runTest');f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-v4-ui-'))
def day(n):return (datetime.date.today()+datetime.timedelta(days=n)).isoformat()
try:
 empty=f.get('/api/backup/export')
 aid=f.account(balance=2000);cid=f.account('credit',5000)
 f.post('/api/accounts/update',{'id':aid,'name':'Conjoint','kind':'checking','balance':2000,'included':True});f.post('/api/accounts/update',{'id':cid,'name':'CIBC','kind':'credit','balance':5000,'included':False})
 f.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':day(1),'forecast_account_id':cid})
 f.post('/api/card-payments',{'card_account_id':cid,'from_account_id':aid,'mode':'purchases','frequency':'weekly','start_on':day(2)})
 f.post('/api/recurring',{'description':'Paie','amount':1400,'type':'income','account_id':aid,'start_on':day(4),'frequency':'biweekly'})
 f.transaction(aid,-20,description='Café réel',happened_on=day(-1))
 with sync_playwright() as p:
  executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser');browser=p.chromium.launch(**({'executable_path':executable} if executable else {}));page=browser.new_page(viewport={'width':1440,'height':1100});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);navigate(page,'prevision');expect(page.locator('#v4-metrics .v4-metric')).to_have_count(3);expect(page.locator('#v4-chart')).to_be_visible();assert not page.locator('#v4-forecast-audit').get_attribute('open')
  s=f.get('/api/state');before=f.get('/api/backup/export')['tables'];page.locator('#v4-slider').focus();page.keyboard.press('End');expect(page.locator('#v4-selected-date')).to_have_value(day(29));target=s['forecast'][29];assert int(page.locator('#v4-forecast-day .v4-day-value').get_attribute('data-value'))==target['safe_cents']
  page.locator('#v4-forecast [data-days="60"]').click();expect(page.locator('#v4-slider')).to_have_attribute('max','59');page.locator('#v4-chart-kind').select_option('cash_cents');expect(page.locator('#v4-chart')).to_have_attribute('aria-label',__import__('re').compile('Solde bancaire prévu'));page.locator('#v4-chart-kind').select_option('safe_cents')
  page.locator('#v4-forecast [data-days="90"]').click();page.locator('#v4-selected-date').fill(day(50));page.locator('#v4-selected-date').dispatch_event('change');expect(page.locator('#v4-selected-date')).to_have_value(day(50));assert int(page.locator('#v4-forecast-day .v4-day-value').get_attribute('data-value'))==s['forecast'][50]['safe_cents']
  # Purchase simulation on a card recalculates its dated bank repayment.
  page.locator('#v4-sim-open').click();sim=page.locator('#v4-simulator');sim.locator('[name="amount"]').fill('100');sim.locator('[name="account_id"]').select_option(str(cid));sim.locator('[name="date"]').fill(day(1));sim.get_by_role('button',name='Comparer les prévisions',exact=True).click();expect(sim.locator('.v4-simulation-result')).to_contain_text('Minimum sur 90 jours');sim.get_by_role('button',name='Voir les deux courbes',exact=True).click();expect(sim).not_to_be_visible();expect(page.locator('.v4-chart-scenario')).to_have_count(1);page.locator('#v4-selected-date').fill(day(2));page.locator('#v4-selected-date').dispatch_event('change');expect(page.locator('#v4-forecast-day .v4-day-scenario')).to_contain_text('1 650,00');assert f.get('/api/backup/export')['tables']==before
  page.locator('#v4-scenario-banner').get_by_role('button',name='Effacer').click();expect(page.locator('.v4-chart-scenario')).to_have_count(0)
  navigate(page,'calendrier');expect(page.locator('#v4-cal-grid')).to_be_visible();assert page.locator('#v4-cal-grid [data-date]').count() in [28,35,42];cell=page.locator(f'#v4-cal-grid [data-date="{day(1)}"]');cell.click();expect(page.locator('#v4-calendar-day')).to_contain_text('Épicerie');expect(page.locator('#v4-calendar-day')).to_contain_text('CIBC');assert int(cell.locator('.v4-cell-balance').get_attribute('data-value'))==s['forecast'][1]['safe_cents'];page.screenshot(path=str(images/'calendrier-ordinateur.png'),full_page=True)
  # Keyboard navigation keeps selection and roving focus together.
  cell.focus();page.keyboard.press('ArrowRight');expect(page.locator(f'#v4-cal-grid [data-date="{day(2)}"]')).to_be_focused();expect(page.locator('#v4-calendar-day')).to_contain_text('Paiement CIBC depuis Conjoint')
  page.locator('#v4-calendar [data-calendar-view="week"]').click();expect(page.locator('#v4-cal-grid [data-date]')).to_have_count(7)
  # Past dates show actual operations and never pretend to know a historical balance.
  page.locator('#v4-cal-today').click();page.locator('#v4-cal-prev').click();past=day(-1)
  # Selecting a date across a week boundary is supported by keyboard.
  page.locator('#v4-cal-today').click();page.locator(f'#v4-cal-grid [data-date="{day(0)}"]').focus();page.keyboard.press('ArrowLeft');expect(page.locator('#v4-calendar-day')).to_contain_text('Café réel');expect(page.locator('#v4-calendar-day .v4-day-value')).to_have_count(0)
  # Quick add drafts the selected date and type without saving anything.
  page.locator('#v4-cal-today').click();page.locator('#v4-calendar-day .v4-quick-add summary').click();page.locator('#v4-calendar-day .v4-add-options').get_by_role('button',name='Virement',exact=True).click();rec=page.locator('#recurring');expect(rec).to_be_visible();expect(rec.locator('[name="start_on"]')).to_have_value(day(0));expect(rec.locator('[name="one_time"]')).to_have_value('true');expect(rec.locator('[name="type"]')).to_have_value('transfer');page.locator('dialog[open] .close-editor').click();assert f.get('/api/backup/export')['tables']==before
  # Move preview performs no writes; applying it uses the existing reviewed action dialog.
  page.locator(f'#v4-cal-grid [data-date="{day(1)}"]').click();page.locator('#v4-calendar-day .v4-event').filter(has_text='Épicerie').get_by_role('button',name='Déplacer').click();sim.locator('[name="date"]').fill(day(3));sim.get_by_role('button',name='Comparer les prévisions',exact=True).click();expect(sim.locator('.v4-simulation-result')).to_contain_text('Minimum sur 90 jours');assert f.get('/api/backup/export')['tables']==before;sim.get_by_role('button',name='Appliquer ce report…').click();action=page.locator('#planning-action-dialog');expect(action).to_be_visible();expect(action.locator('[name="new_on"]')).to_have_value(day(3));action.get_by_role('button',name='Enregistrer le report',exact=True).click();expect(action).not_to_be_visible();s=f.get('/api/state');assert s['cash_cents']==198000;assert next(r for r in s['planning']['rows'] if r['source']=='envelope')['date']==day(3)
  page.locator(f'#v4-cal-grid [data-date="{day(3)}"]').click();page.locator('#v4-calendar-day .v4-event').filter(has_text='Épicerie').get_by_role('button',name='Confirmer',exact=True).click();expect(action).to_be_visible();action.get_by_role('button',name='Fermer',exact=True).click()
  # Completed expenses feed the comparison without mixing in transfers or unlinked receipts.
  s=f.post('/api/recurring',{'description':'Assurance rapprochée','type':'expense','amount':120,'account_id':aid,'start_on':day(0),'frequency':'monthly','one_time':True});rid=s['recurring'][0]['id'];r=next(r for r in s['planning']['rows'] if r.get('recurring_id')==rid);f.planning_action(r,amount=115,happened_on=day(0));page.reload();navigate(page,'prevision');expect(page.locator('#v4-comparison')).to_contain_text('de moins que prévu');expect(page.locator('#v4-comparison')).to_contain_text('120,00');expect(page.locator('#v4-comparison')).to_contain_text('115,00')
  # The graph and calendar remain usable at phone/tablet/desktop widths.
  before=f.get('/api/backup/export')['tables']
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000})
   for view in ['calendrier','prevision']:
    navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,view)
   page.locator('#v4-sim-open').click();assert sim.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),width;sim.get_by_role('button',name='Fermer',exact=True).click()
  page.set_viewport_size({'width':1440,'height':1100});navigate(page,'prevision');page.locator('#v4-forecast [data-days="30"]').click();page.locator('#v4-selected-date').fill(day(3));page.locator('#v4-selected-date').dispatch_event('change');page.screenshot(path=str(images/'prevision-ordinateur.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});navigate(page,'calendrier');page.locator('#v4-calendar [data-calendar-view="week"]').click();page.wait_for_function('''()=>{const g=document.querySelector('#v4-cal-grid'),s=g.querySelector('[aria-pressed="true"]');return s.getBoundingClientRect().left>=g.getBoundingClientRect().left&&s.getBoundingClientRect().right<=g.getBoundingClientRect().right+1}''');page.screenshot(path=str(images/'calendrier-iphone.png'),full_page=True);navigate(page,'prevision');page.screenshot(path=str(images/'prevision-iphone.png'),full_page=True)
  assert f.get('/api/backup/export')['tables']==before
  f.post('/api/accounts/update',{'id':aid,'name':'Conjoint','kind':'checking','balance':-9000,'included':True});page.reload();navigate(page,'prevision');expect(page.locator('#v4-alerts .risk')).to_be_visible();page.locator('#v4-alerts .risk').get_by_role('button',name='Voir cette journée').click();expect(page.locator('#v4-forecast-day .v4-day-value')).to_have_class(__import__('re').compile('negative'))
  f.post('/api/backup/restore',{'backup':empty,'confirm':'REMPLACER'});page.reload();navigate(page,'prevision');expect(page.locator('#v4-sim-open')).to_be_disabled();expect(page.locator('#v4-chart')).to_be_visible();navigate(page,'calendrier');expect(page.locator('#v4-calendar-day')).to_contain_text('Une journée tranquille')
  assert not errors,errors;browser.close()
 print('PASS: v4 30/90-day forecast and exact server amounts, keyboard dates, card purchase simulation without writes, monthly/weekly calendar, actual past, planned quick entry, move preview then reviewed application, confirmation dialog, five responsive widths and no browsing writes.')
 print('Captures fictives :',images)
finally:f.tearDown()
