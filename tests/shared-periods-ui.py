"""Shared summary matches owner's same-period minimum, explains equal minima and refreshes on choice."""
import importlib.util,shutil,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account(balance=1000)
 for offset,amount in [(10,100),(40,200),(70,300)]:f.post('/api/recurring',{'description':'Paiement '+str(offset),'amount':amount,'type':'expense','account_id':aid,'frequency':'monthly','one_time':True,'start_on':f.future73(offset)})
 path=f.post('/api/sharing',{'action':'create'})['path']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base+path);money=lambda c:page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",c);expect(page.locator('#safe')).to_have_text(money(100000));expect(page.locator('#same-periods')).to_have_text('');assert f.get('/api/state')['safe_cents']==100000
  for days,cents in [(30,90000),(60,70000),(90,40000)]:
   page.get_by_role('button',name=f'{days} jours',exact=True).click();state=f.get('/api/state');expected=min(state['safe_cents'],*[d['safe_cents'] for d in state['forecast'][:days]]);assert expected==cents;expect(page.locator('#safe')).to_have_text(money(state['safe_cents']));expect(page.locator('#low-title')).to_contain_text(f'{days} jours');expect(page.locator('#high')).to_have_text(money(max(state['safe_cents'],*[d['safe_cents'] for d in state['forecast'][:days]])));expect(page.locator('#low')).to_have_text(money(expected))
  # A transaction made since page load appears when selecting a period, without a full reload.
  f.transaction(aid,-25,description='Nouvelle depense');page.get_by_role('button',name='30 jours',exact=True).click();expect(page.locator('#safe')).to_have_text(money(97500));expect(page.locator('#low')).to_have_text(money(87500));state=f.get('/api/state')
  for r in state['recurring']:f.post('/api/recurring/delete',{'id':r['id']})
  page.get_by_role('button',name='60 jours',exact=True).click();expect(page.locator('#safe')).to_have_text(money(97500));expect(page.locator('#same-periods')).to_have_text('Le minimum est identique sur 30, 60, 90 jours.');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');f.post('/api/sharing',{'action':'revoke'});page.get_by_role('button',name='Actualiser',exact=True).click();expect(page.locator('#safe')).to_have_text('—');expect(page.locator('#same-periods')).to_have_text('');expect(page.locator('#updated')).to_have_text('');assert not errors,errors;browser.close()
 print('PASS: shared current available and selected minimum/maximum match the owner, distinct 30/60/90 minima, fresh figures on period choice, equal-minimum explanation and clearing revoked data.')
finally:f.tearDown()
