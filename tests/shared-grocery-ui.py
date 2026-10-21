"""Grocery-only weekly read access: real purchases, refresh, privacy and phone layout."""
import datetime,importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account();card=f.account(kind='credit',balance=0)
 today=datetime.date.fromisoformat(api.DAY);start=(today-datetime.timedelta(days=(today.weekday()-3)%7)).isoformat()
 s=f.post('/api/envelopes',{'name':'Épicerie','reserved':0,'budget':230,'frequency':'weekly','start_on':start,'rollover':False,'forecast_spend':False});eid=next(e['id'] for e in s['envelopes'] if e['name']=='Épicerie')
 f.post('/api/envelopes',{'name':'Cadeau secret','reserved':25,'budget':0,'frequency':'none','forecast_spend':False});f.transaction(card,-50,envelope_id=eid,description='<img src=x onerror=alert(1)> Courses');f.transaction(aid,-7,description='Dépense privée')
 path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base+path)
  expect(page.locator('#grocery-remaining')).to_contain_text('180,00');expect(page.locator('#grocery-spent')).to_contain_text('50,00');assert datetime.date.fromisoformat(f.get(path+'/data')['grocery']['next_renewal']).weekday()==3
  expect(page.locator('#grocery-details')).not_to_have_attribute('open','');page.locator('#grocery-details>summary').click();expect(page.locator('.grocery-purchase')).to_have_count(1);expect(page.locator('.grocery-purchase span')).to_have_text('<img src=x onerror=alert(1)> Courses');assert not page.locator('#grocery-card img').count();assert 'Cadeau secret' not in page.locator('body').inner_text();assert 'Dépense privée' not in page.locator('body').inner_text()
  for theme in ['light','dark']:
   page.emulate_media(color_scheme=theme)
   for width in [320,390,430,768]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert f.get('/api/backup/export')['tables']==before
  f.transaction(aid,-20,envelope_id=eid);page.locator('#refresh').click();expect(page.locator('#grocery-remaining')).to_contain_text('160,00');expect(page.locator('.grocery-purchase')).to_have_count(2)
  page.get_by_role('button',name='90 jours',exact=True).click();expect(page.locator('#grocery-remaining')).to_contain_text('160,00')
  f.post('/api/envelopes/update',{'id':eid,'name':'Epicerie','reserved':0,'budget':230,'frequency':'weekly','start_on':f.future73(7),'rollover':False,'forecast_spend':False});page.locator('#refresh').click();expect(page.locator('#grocery-card')).to_be_visible();expect(page.locator('#grocery-until')).to_contain_text('Débute le');expect(page.locator('#grocery-remaining')).to_contain_text('230,00');
  f.post('/api/envelopes/update',{'id':eid,'name':'Epicerie','reserved':0,'budget':230,'frequency':'none','forecast_spend':False});page.locator('#refresh').click();expect(page.locator('#grocery-card')).to_be_visible();expect(page.locator('#grocery-until')).to_contain_text('Aucune période configurée');
  f.post('/api/sharing',{'action':'revoke'});page.locator('#refresh').click();expect(page.locator('#grocery-card')).to_be_hidden();expect(page.locator('.grocery-purchase')).to_have_count(0);assert not errors,errors;browser.close()
 print('PASS: weekly grocery remainder, Thursday renewal, bank/card purchases, escaped labels, other data private, phone widths/themes, refresh, revocation and read-only data.')
finally:f.tearDown()
