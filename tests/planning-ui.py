"""Accounts/planning interactions; temporary data only."""
import importlib.util,json,os,shutil,sys,tempfile
from pathlib import Path
sys.dont_write_bytecode=True
from ui_navigation import navigate_legacy as navigate
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('budget_api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI('runTest');f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-planning-ui-'))
try:
 checking=f.account(balance=3600);savings=f.account('savings',2200);credit=f.account('credit',640)
 for account_id,name,kind,balance,included in [(checking,'Compte quotidien','checking',3600,True),(savings,'Épargne projets','savings',2200,False),(credit,'Carte de crédit','credit',640,False)]:f.post('/api/accounts/update',{'id':account_id,'name':name,'kind':kind,'balance':balance,'included':included})
 from datetime import date,timedelta
 def day(n):return (date.today()+timedelta(days=n)).isoformat()
 for name,reserved,budget,freq in [('Épicerie',260,400,'weekly'),('Sorties et loisirs',90,150,'monthly'),('Imprévus',500,200,'none')]:f.post('/api/envelopes',{'name':name,'reserved':reserved,'budget':budget,'frequency':freq,'start_on':day(7),'active':True})
 for name,kind,amount,start,freq in [('Salaire','income',1850,3,'biweekly'),('Loyer','expense',1100,6,'monthly'),('Assurance auto','expense',120,12,'monthly'),('Internet','expense',79.99,14,'monthly'),('Abonnement musique','expense',12.99,5,'monthly')]:f.post('/api/recurring',{'description':name,'type':kind,'amount':amount,'account_id':checking,'start_on':day(start),'frequency':freq,'day_adjust':'none','active':True})
 f.post('/api/goals',{'name':'Voyage au bord de la mer','target':2500,'saved':850,'target_date':'2027-06-01'})
 original=f.get('/api/backup/export')['tables'];forecast=f.get('/api/state')['forecast']
 with sync_playwright() as p:
  path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser');browser=p.chromium.launch(**({'executable_path':path} if path else {}));page=browser.new_page(viewport={'width':1440,'height':1050});page.set_default_timeout(8000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(f.base);page.wait_for_selector('.bank-card',state='attached')
  assert page.locator('.app-shell-nav button:visible[data-view]').count()==10
  navigate(page,'comptes');assert page.locator('.bank-card').count()==3;assert page.locator('.bank-card.credit input').count()==0;assert page.locator('#balance-form').is_hidden();page.evaluate('scrollTo(0,0)');page.screenshot(path=str(images/'comptes.png'),full_page=True)
  page.locator(f'.bank-card[data-account-id="{checking}"] button',has_text='Modifier').click();expect(page.locator('dialog[open]')).to_be_visible();page.keyboard.press('Escape')
  page.get_by_role('button',name='Comparer un solde',exact=True).click();expect(page.locator('#balance-form')).to_be_visible();page.keyboard.press('Escape')
  navigate(page,'enveloppes');assert page.locator('.envelope-tile').count()==3;assert page.locator('#v21-env-form').is_hidden();page.screenshot(path=str(images/'enveloppes.png'),full_page=True);page.locator('.envelope-tile button',has_text='Ajuster').first.click();expect(page.locator('dialog[open]')).to_be_visible();page.keyboard.press('Escape')
  navigate(page,'recurrences');assert page.locator('.recurrence-tile').count()==5;assert page.locator('#v21-link-form').is_hidden();page.screenshot(path=str(images/'recurrences.png'),full_page=True)
  page.locator('[data-filter="income"]').click();assert page.locator('.recurrence-tile').count()==1;page.locator('[data-filter="all"]').click();assert page.locator('.recurrence-tile').count()==5
  navigate(page,'prevision');assert page.locator('#planning-day-slider').get_attribute('max')=='89';assert page.locator('#forecast').is_hidden();assert page.locator('#planning-weeks .week-card').count()==4
  fmt=lambda cents:page.evaluate('(n)=>(n/100).toLocaleString("fr-CA",{style:"currency",currency:"CAD"})',cents)
  assert page.locator('.trajectory-metric').nth(1).locator('strong').inner_text()==fmt(min(d['safe_cents'] for d in forecast))
  page.screenshot(path=str(images/'prevision-90-jours.png'),full_page=True)
  page.locator('#planning-day-slider').focus();page.keyboard.press('End');assert page.locator('#planning-date').input_value()==forecast[-1]['date'];assert page.locator('.selected-day-value').inner_text()==fmt(forecast[-1]['safe_cents']);assert page.locator('#planning-day-next').is_disabled();assert page.locator('#planning-week-days button').count()==6
  page.locator('[data-horizon="30"]').click();assert page.locator('#planning-day-slider').get_attribute('max')=='29';assert page.locator('.selected-day-value').inner_text()==fmt(forecast[29]['safe_cents']);assert page.locator('.trajectory-metric').nth(1).locator('strong').inner_text()==fmt(min(d['safe_cents'] for d in forecast[:30]))
  page.locator('[data-horizon="60"]').click();assert page.locator('#planning-day-slider').get_attribute('max')=='59';page.locator('[data-horizon="90"]').click();page.locator('#planning-day-slider').focus();page.keyboard.press('Home');assert page.locator('#planning-date').input_value()==forecast[0]['date']
  page.locator('#planning-weeks-next').click();page.locator('#planning-weeks .week-card').first.click();assert page.locator('#planning-date').input_value()==forecast[28]['date'];page.locator('#planning-week-days button').nth(2).click();assert page.locator('#planning-date').input_value()==forecast[30]['date']
  page.locator('.forecast-source-list>summary').click();assert page.locator('#forecast .forecast-day').count()==90;page.locator('#forecast-expand').click();assert page.locator('#forecast .forecast-day.is-open').count()==90;page.locator('.forecast-source-list>summary').click()
  navigate(page,'calendrier');assert page.locator('.cal-cell.has-movements').count()>0;page.locator('.cal-cell.has-movements').first.click();expect(page.locator('#cal-detail h3')).to_be_visible()
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':900})
   for view in ['comptes','prevision','enveloppes','recurrences','objectifs','calendrier']:
    navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,view)
  page.set_viewport_size({'width':390,'height':844});navigate(page,'prevision');page.locator('#planning-day-slider').focus();page.keyboard.press('Home');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(images/'mobile-prevision.png'),full_page=True);navigate(page,'comptes');page.screenshot(path=str(images/'mobile-comptes.png'),full_page=True)
  assert f.get('/api/backup/export')['tables']==original,'Presentation changed financial data'
  assert not errors,errors
  # The inclusion switch updates through the same validated API.
  page.locator(f'.bank-card[data-account-id="{savings}"] input').check();expect(page.locator(f'.bank-card[data-account-id="{savings}"] input')).to_be_checked();page.wait_for_function('document.querySelector(".account-overview-metric strong").textContent.includes("5")');assert next(a for a in f.get('/api/state')['accounts'] if a['id']==savings)['included']==1
  f.post('/api/accounts/update',{'id':checking,'name':'Compte quotidien','kind':'checking','balance':-8000,'included':True});page.reload();navigate(page,'prevision');expect(page.locator('.trajectory-alert')).to_be_visible();page.locator('.trajectory-alert button').click();assert 'negative' in page.locator('.selected-day-value').get_attribute('class');page.screenshot(path=str(images/'prevision-negative.png'),full_page=True)
  assert not errors,errors
  browser.close()
 print('PASS: cards/editors, 10 visible sidebar routes, planning tabs, recurrence filters, 30/60/90 horizons, exact server metrics, slider keyboard endpoints, week/day selection, complete daily disclosure, calendar, six views at five widths, no financial changes from browsing; inclusion toggle via API.')
 print('Captures fictives :',images)
finally:f.tearDown()
