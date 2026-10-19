"""Owner and spouse show identical available funds, minimum and maximum for every horizon."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account();f.post('/api/envelopes',{'name':'Reserve','reserved':230,'budget':0,'frequency':'none','forecast_spend':False})
 for offset,amount,kind in [(10,100,'expense'),(35,600,'income'),(70,200,'income')]:f.post('/api/recurring',{'description':'Mouvement '+str(offset),'type':kind,'amount':amount,'account_id':aid,'frequency':'monthly','one_time':True,'start_on':f.future73(offset)})
 path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));owner=browser.new_page(viewport={'width':1400,'height':1000});viewer=browser.new_page(viewport={'width':390,'height':844});errors=[];owner.on('pageerror',lambda e:errors.append(str(e)));viewer.on('pageerror',lambda e:errors.append(str(e)));owner.goto(f.base);viewer.goto(f.base+path);expect(owner.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);money=lambda c:viewer.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",c)
  for days,maximum in [(30,77000),(60,127000),(90,147000)]:
   owner.locator(f'#v80-hero [data-horizon="{days}"]').click();viewer.get_by_role('button',name=f'{days} jours',exact=True).click();expect(viewer.locator('#safe')).to_have_text(money(77000));expect(owner.locator('#v80-safe')).to_have_text(money(77000));expect(viewer.locator('#low')).to_have_text(money(67000));expect(owner.locator('.v80-hero-facts>div:nth-child(2) strong')).to_have_text(money(67000));expect(viewer.locator('#high')).to_have_text(money(maximum));expect(owner.locator('#v81-maximum strong')).to_have_text(money(maximum));expect(viewer.locator('#high-title')).to_contain_text(f'{days} jours');expect(viewer.locator('#same-periods')).to_contain_text('identique');on=f.get(path+'/data')['periods'][str(days)]['safe']['highest']['on'];long=viewer.evaluate("d=>new Date(d+'T12:00:00').toLocaleDateString('fr-CA',{day:'numeric',month:'long'})",on);expect(viewer.locator('#high-date')).to_have_text('Prévu le '+long);expect(owner.locator('#v81-maximum small')).to_have_text(long)
  after=f.get('/api/backup/export')['tables'];assert before==after;assert not errors,errors;browser.close()
 print('PASS: owner and spouse match exactly for available now, protected minimum and protected maximum across 30/60/90; minimum stays equal while maximum rises; no financial writes.')
finally:f.tearDown()
