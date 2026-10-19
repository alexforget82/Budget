"""Restricted mobile purchase verdict and daily protected balances."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account(balance=1000)
 f.post('/api/recurring',{'description':'Facture privee','amount':950,'type':'expense','account_id':aid,'frequency':'monthly','one_time':True,'start_on':f.future73(40)})
 path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844});errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.goto(f.base+path)
  expect(page.locator('#purchase-check')).to_be_enabled();assert not page.locator('#daily-panel').evaluate('(e)=>e.open')
  page.locator('#daily-title').click();expect(page.locator('.daily-row')).to_have_count(30)
  summary=f.get(path+'/data')
  for i in [0,10,29]:
   row=page.locator('.daily-row').nth(i);assert row.locator('time').get_attribute('datetime')==summary['daily'][i]['date'];assert row.locator('strong').inner_text()==page.evaluate("n=>(n/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",summary['daily'][i]['safe_cents'])
  page.locator('#purchase-amount').fill('100');page.locator('#purchase-check').click();expect(page.locator('#purchase-result')).to_have_text('Oui')
  for days,result in [(60,'Non'),(90,'Non'),(30,'Oui')]:
   page.get_by_role('button',name=f'{days} jours',exact=True).click();expect(page.locator('#purchase-result')).to_have_text('');expect(page.locator('.daily-row')).to_have_count(days);expect(page.locator('#purchase-check')).to_be_enabled();page.locator('#purchase-check').click();expect(page.locator('#purchase-result')).to_have_text(result)
  page.locator('#purchase-amount').fill('101');expect(page.locator('#purchase-result')).to_have_text('')
  held=[];page.route('**/simulate',lambda route:held.append(route));page.locator('#purchase-check').click();page.wait_for_timeout(100);page.locator('#purchase-amount').fill('102');held[0].fulfill(json={'allowed':True,'days':30});page.wait_for_timeout(100);expect(page.locator('#purchase-result')).to_have_text('');page.unroute('**/simulate')
  for scheme in ['light','dark']:
   page.emulate_media(color_scheme=scheme)
   for width in [320,390,430,768]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('#day-list').evaluate('(e)=>e.scrollHeight>e.clientHeight')
  assert f.get('/api/state')['transactions']==before['transactions'];assert f.get('/api/state')['safe_cents']==before['safe_cents'];assert 'Facture privee' not in page.locator('body').inner_text();assert not any('/api/' in u for u in requests)
  page.locator('#purchase-check').click();expect(page.locator('#purchase-result')).to_have_text('Oui');f.transaction(aid,-950);page.locator('#refresh').click();expect(page.locator('#purchase-result')).to_have_text('');expect(page.locator('#purchase-check')).to_be_enabled();page.locator('#purchase-check').click();expect(page.locator('#purchase-result')).to_have_text('Non')
  f.post('/api/sharing',{'action':'revoke'});page.locator('#purchase-check').click();expect(page.locator('#safe')).to_have_text('—');expect(page.locator('#purchase-result')).to_have_text('');expect(page.locator('#purchase-check')).to_be_disabled();expect(page.locator('.daily-row')).to_have_count(0);assert not errors,errors;browser.close()
 print('PASS: read-only Oui/Non, 30/60/90 daily protected balances, stale verdict protection, mobile layouts, refresh and revoked access.')
finally:f.tearDown()
