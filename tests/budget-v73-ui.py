"""Real browser coverage of early envelope funding and scoped iPhone consultation."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-v73-ui-'))
try:
 joint,personal,*cards=f.banking_accounts();f.banking_apply(joint,cards);future=f.future73();s=f.post('/api/envelopes',{'name':'Épicerie jeudi','reserved':0,'budget':230,'frequency':'weekly','start_on':future,'rollover':True,'forecast_spend':False});eid=s['envelopes'][0]['id']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);navigate(page,'enveloppes');page.locator(f'[data-envelope-id="{eid}"]').get_by_role('button',name='Gérer',exact=True).click();sheet=page.locator('#v44-envelope-sheet');sheet.get_by_label('Montant à réserver',exact=True).fill('100');sheet.get_by_role('button',name='Réserver maintenant',exact=True).click();expect(sheet.locator('.v44-metric').first).to_contain_text('100,00');s=f.get('/api/state');assert s['safe_cents']==90000 and next(d for d in s['forecast'] if d['date']==future)['safe_cents']==77000;sheet.screenshot(path=str(images/'enveloppe-avance.png'));sheet.get_by_role('button',name='Fermer',exact=True).click()
  navigate(page,'sauvegardes');page.get_by_role('button',name='Vue iPhone simplifiée',exact=True).click();dialog=page.locator('dialog').filter(has=page.locator('#sharing73-url'));dialog.get_by_role('button',name='Créer un nouveau lien').click();expect(page.locator('#sharing73-url')).to_have_value(__import__('re').compile(r'.*/shared/[a-f0-9]{64}'));url=page.locator('#sharing73-url').input_value();dialog.get_by_role('button',name='Fermer',exact=True).click()
  context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);viewer=context.new_page();viewer.on('pageerror',lambda e:errors.append(str(e)));requests=[];viewer.on('request',lambda r:requests.append(r.url));viewer.goto(url);data=f.get(url.removeprefix(f.base)+'/data');money=lambda n:viewer.evaluate("n=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(n/100)",n)
  for n in [30,60,90,30]:
   viewer.get_by_role('button',name=f'{n} jours',exact=True).click();expect(viewer.locator('#safe')).to_have_text(money(data['current_safe_cents']));expect(viewer.get_by_role('button',name=f'{n} jours',exact=True)).to_have_attribute('aria-pressed','true')
  expect(viewer.locator('#high')).to_have_text(money(data['periods']['30']['safe']['highest']['amount_cents']));expect(viewer.locator('#low')).to_have_text(money(data['periods']['30']['safe']['lowest']['amount_cents']));assert viewer.locator('input').count()==2;assert not viewer.locator('select,textarea,a').count();assert all('/api/' not in u for u in requests)
  for scheme in ['light','dark']:
   viewer.emulate_media(color_scheme=scheme)
   for width in [320,375,390,430,768,1440]:
    viewer.set_viewport_size({'width':width,'height':950});assert viewer.evaluate('document.documentElement.scrollWidth<=innerWidth'),(scheme,width)
    if width==390:viewer.screenshot(path=str(images/f'iphone-{scheme}.png'),full_page=True)
  page.get_by_role('button',name='Vue iPhone simplifiée',exact=True).click();dialog.get_by_role('button',name='Révoquer le lien',exact=True).click();expect(page.locator('#sharing73-url')).to_have_value('');viewer.get_by_role('button',name='Actualiser',exact=True).click();expect(viewer.locator('#error')).to_contain_text('révoqué');expect(viewer.locator('#safe')).to_have_text('—');assert not errors,errors;browser.close()
 print('PASS: real early funding UI, partial reserve forecast, owner sharing controls, isolated mobile view, 30/60/90 figures, bank extrema, revocation, light/dark and six widths. Captures:',images)
finally:f.tearDown()
