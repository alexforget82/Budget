"""Phase 1 entry, conservative learned choices, CSV and bulk envelope UI."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-132-'))
try:
 bank=f.account(balance=1000);c1=f.make_category('Alimentation 132');c2=f.make_category('Sorties 132');a=f.post('/api/envelopes',{'name':'Courses 132','reserved':230,'budget':230,'frequency':'weekly','start_on':f.future73(1),'rollover':False,'forecast_spend':False})['envelopes'][0]['id'];b=f.post('/api/envelopes',{'name':'Loisirs 132','reserved':50,'budget':50,'frequency':'monthly','start_on':f.future73(1),'rollover':False,'forecast_spend':False})['envelopes'][0]['id'];f.transaction(bank,-20,description='ÉPICERIE -- MÉTRO',category_id=c1,envelope_id=a);f.transaction(bank,-10,description='Restaurant test',category_id=c2,envelope_id=b);missing=f.transaction(bank,-3,description='Sans enveloppe')['transactions'][0]['id'];before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v14.5.0')
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,1440]:
    page.set_viewport_size({'width':width,'height':844 if width<768 else 1000});expect(page.locator('#envelope-options option')).to_have_count(3);page.locator('#open-transaction').click();form=page.locator('#transaction');description=form.locator('[name=description]');description.fill('epicerie metro!');expect(page.locator('#envelope-options')).to_have_value(str(a));expect(page.locator('#transaction-category')).to_have_value(str(c1));expect(page.locator('#envelope-options')).to_be_visible();expect(form.locator('.entry-more')).to_be_hidden();assert not page.locator('#envelope-options').evaluate('(e)=>!!e.closest("details")');assert page.locator('#transaction-dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    if width==390:
     form.locator('[name=amount]').fill('71.69');page.screenshot(path=str(images/f'saisie-{theme}.png'))
    # Choosing an envelope supplies its unique category, while later explicit fields remain untouched.
    page.locator('#envelope-options').select_option(str(b));expect(page.locator('#transaction-category')).to_have_value(str(c2));page.locator('#transaction-category').select_option(str(c1));description.fill('ÉPICERIE---METRO');expect(page.locator('#envelope-options')).to_have_value(str(b));expect(page.locator('#transaction-category')).to_have_value(str(c1));page.locator('#envelope-options').select_option('');description.fill('epicerie METRO!');expect(page.locator('#envelope-options')).to_have_value('')
    page.locator('#close-transaction').click();page.reload()
   navigate(page,'transactions');page.locator('#v132-without-envelope').check();expect(page.locator('.ledger-row')).to_have_count(1);expect(page.locator('.ledger-row')).to_contain_text('Sans enveloppe');page.locator('.v80-row-check').check();page.get_by_role('button',name='Modifier la sélection',exact=True).click();bulk=page.locator('#v80-bulk-dialog');bulk.get_by_label('Action',exact=True).select_option('envelope');bulk.get_by_label('Enveloppe de la sélection',exact=True).select_option(str(a));bulk.get_by_role('button',name='Vérifier les modifications',exact=True).click();expect(bulk).to_contain_text('Disponible');expect(bulk.get_by_role('button',name='Confirmer les modifications',exact=True)).to_be_visible();assert bulk.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
   if theme=='dark':page.screenshot(path=str(images/'lot-dark.png'))
   bulk.get_by_role('button',name='Fermer',exact=True).click();page.locator('#v132-without-envelope').uncheck()
  after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings')
  # Category-only choice infers the unique envelope without opening Budget.
  page.reload();page.locator('#open-transaction').click();page.locator('#transaction-category').select_option(str(c1));expect(page.locator('#envelope-options')).to_have_value(str(a));page.locator('#close-transaction').click()
  navigate(page,'importer');page.locator('#csv-file').set_input_files({'name':'releve.csv','mimeType':'text/csv','buffer':f'Date;Description;Montant\n{api.DAY};epicerie metro!;-12.50'.encode()});expect(page.locator('#csv-mapping')).to_be_visible();page.locator('#csv-preview-button').click();expect(page.locator('#csv-preview-rows')).to_contain_text('Courses 132');page.locator('#csv-envelope').select_option('none');expect(page.locator('#csv-preview')).to_be_hidden();page.locator('#csv-preview-button').click();expect(page.locator('#csv-preview-rows')).not_to_contain_text('Enveloppe : Courses 132')
  assert not errors,errors;browser.close()
 print('PASS: normalized auto-prefill, visible envelope, unique cross proposals and manual overrides, category-only inference without Budget, no browsing writes, missing-envelope filter and bulk preview, CSV envelope override, 3 widths/two themes. Captures:',images)
finally:f.tearDown()
