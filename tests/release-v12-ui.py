"""v12 recurring card protections, shared version and explicit public update checks."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import manage_envelope,navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 joint=f.account(balance=1000);card=f.account('credit',5000);f.post('/api/recurring',{'description':'Apple One','amount':53.98,'type':'expense','account_id':card,'frequency':'monthly','one_time':True,'start_on':api.DAY});f.post('/api/envelopes',{'name':'Epicerie','reserved':0,'budget':230,'frequency':'weekly','start_on':f.future73(2),'rollover':True,'forecast_spend':False});path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844},locale='fr-CA');errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v14.1.0');assert not any('/api/release/check' in u for u in requests)
  navigate(page,'enveloppes');manage_envelope(page);facts=page.locator('.v81-envelope-facts').first;expect(facts).to_contain_text('Report activé');expect(facts).to_contain_text('Prochain renouvellement');facts.get_by_text('Comprendre cette enveloppe',exact=True).click();expect(facts).to_contain_text('déjà retiré du disponible actuel')
  navigate(page,'sauvegardes');panel=page.locator('#v12-release-panel');expect(panel).to_contain_text('Version installée : v14.1.0')
  page.route('**/api/release/check',lambda r:r.fulfill(json={'installed_version':'14.0.0','latest_version':'12.0.1','available':True,'download_url':'https://github.com/alexforget82/Budget/archive/refs/tags/v12.0.1.zip'}));panel.get_by_role('button',name='Vérifier les mises à jour',exact=True).click();expect(panel).to_contain_text('12.0.1 disponible');expect(panel.get_by_role('link',name='Télécharger le ZIP')).to_have_attribute('href','https://github.com/alexforget82/Budget/archive/refs/tags/v12.0.1.zip');page.unroute('**/api/release/check');page.route('**/api/release/check',lambda r:r.fulfill(status=503,json={'error':'Vérification indisponible'}));panel.get_by_role('button',name='Vérifier les mises à jour',exact=True).click();expect(panel).to_contain_text('Vérification indisponible');expect(panel.get_by_role('link',name='Télécharger le ZIP')).to_have_count(0);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings')
  s=f.transaction(card,-53.98,description='Apple One');page.goto(f.base+path);expect(page.locator('#shared-version')).to_have_text('Sillage v14.1.0');expect(page.locator('#safe')).to_contain_text('946,02');expect(page.locator('#grocery-card')).to_be_visible()
  f.post('/api/transfers',{'from_account_id':joint,'to_account_id':card,'amount':53.98,'description':'Paiement carte','happened_on':api.DAY});page.locator('#refresh').click();expect(page.locator('#safe')).to_contain_text('946,02')
  changed=f.get(path+'/data');changed['version']='12.0.1';page.route('**/shared/*/data',lambda r:r.fulfill(json=changed));page.locator('#refresh').click();expect(page.locator('#shared-version')).to_contain_text('Interface v14.1.0');expect(page.locator('#reload-interface')).to_be_visible();page.unroute('**/shared/*/data');page.locator('#reload-interface').click();expect(page.locator('#shared-new-version')).to_be_hidden()
  for scheme in ['light','dark']:
   page.emulate_media(color_scheme=scheme)
   for width in [320,390,430,768]:page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors;browser.close()
 print('PASS: protected recurring card purchase and payment agree in shared view, shared/owner versions, envelope period/report text, explicit update check, failed check and phone widths/themes; browsing leaves financial tables unchanged.')
finally:f.tearDown()
