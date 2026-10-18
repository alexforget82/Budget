"""Version 4.3: category renaming and monthly reserve-only budgets, fictitious data."""
import importlib.util,os,shutil,tempfile,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-v43-ui-'))
try:
 aid=f.account();cat=f.get('/api/state')['categories'][0];f.transaction(aid,-20,category_id=cat['id'])
 with sync_playwright() as p:
  executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser');browser=p.chromium.launch(**({'executable_path':executable} if executable else {}));page=browser.new_page(viewport={'width':1440,'height':1100});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v7.0')
  navigate(page,'transactions');page.get_by_role('button',name='Gérer les catégories',exact=True).click();page.get_by_role('button',name='+ Catégorie',exact=True).click();page.locator('#category-manager summary').click();form=page.locator('#category-edit-form');expect(form).to_be_visible();form.locator('select').select_option(str(cat['id']));form.locator('[name="name"]').fill('Vie quotidienne');form.get_by_role('button',name='Enregistrer le nom',exact=True).click();expect(page.locator('#category-edit-status')).to_contain_text('Nom enregistré');expect(form.locator('select')).to_contain_text('Vie quotidienne');assert f.get('/api/transactions/list')['rows'][0]['category_name']=='Vie quotidienne'
  navigate(page,'transactions');expect(page.locator('.ledger-category').first).to_contain_text('Vie quotidienne');assert f.get('/api/state')['cash_cents']==98000
  navigate(page,'enveloppes');page.get_by_role('button',name='+ Budget mensuel réservé',exact=True).click();envelope=page.locator('#envelope');dialog=page.locator('dialog').filter(has=envelope);expect(envelope.locator('[name="frequency"]')).to_have_value('monthly');expect(envelope.locator('[name="forecast_spend"]')).to_have_value('false');expect(envelope.locator('[name="forecast_account_id"]')).to_be_disabled();expect(page.locator('#envelope-mode-help')).to_contain_text('aucun paiement');future=envelope.locator('[name="start_on"]').input_value();assert future.endswith('-01') and future>api.DAY
  envelope.locator('[name="name"]').fill('Restaurant');envelope.locator('[name="budget"]').fill('125');envelope.get_by_role('button',name='Créer',exact=True).click();expect(dialog).not_to_be_visible();s=f.get('/api/state');eid=s['envelopes'][0]['id'];assert s['safe_cents']==98000 and len(s['transactions'])==1;d=next(d for d in s['forecast'] if d['date']==future);assert d['safe_cents']==85500 and d['cash_cents']==98000 and all(e['type']=='reserve' for e in d['events'])
  card=page.locator(f'[data-envelope-id="{eid}"]');expect(card).to_contain_text('Budget réservé');card.get_by_role('button',name='Ajuster l’enveloppe',exact=True).click();envelope.locator('[name="reserved"]').fill('125');envelope.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();assert f.get('/api/state')['safe_cents']==85500
  f.transaction(aid,-30,envelope_id=eid,category_id=cat['id'],description='Souper au restaurant');page.reload();navigate(page,'enveloppes');expect(card.locator('.bank-balance')).to_contain_text('95,00');s=f.get('/api/state');assert s['cash_cents']==95000 and s['safe_cents']==85500 and len(s['transactions'])==2
  before=f.get('/api/backup/export')['tables'];page.screenshot(path=str(images/'enveloppes-reservees.png'),full_page=True)
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000});navigate(page,'enveloppes');card.get_by_role('button',name='Ajuster l’enveloppe',exact=True).click();expect(envelope.locator('[name="forecast_spend"]')).to_have_value('false');assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),width
   if width==390:dialog.screenshot(path=str(images/'budget-reserve-iphone.png'))
   envelope.locator('[name="forecast_spend"]').select_option('true');expect(envelope.locator('[name="forecast_account_id"]')).to_be_enabled();envelope.locator('[name="forecast_spend"]').select_option('false');dialog.get_by_role('button',name='Fermer',exact=True).click()
   navigate(page,'transactions');page.get_by_role('button',name='Gérer les catégories',exact=True).click();expect(form).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.set_viewport_size({'width':390,'height':844});form.scroll_into_view_if_needed();page.screenshot(path=str(images/'categories-iphone.png'));assert f.get('/api/backup/export')['tables']==before;assert not errors,errors;browser.close()
 print('PASS: v4.3, category renaming from transactions, historic labels and balances preserved; monthly reserved budget preset, projected reservation without bank payment, current reserve and actual spending counted once; five responsive widths, both modes, no browsing mutations or JavaScript errors.')
 print('Captures fictives :',images)
finally:f.tearDown()
