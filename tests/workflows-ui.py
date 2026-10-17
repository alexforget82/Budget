from ui_navigation import navigate as navigate_view
"""End-to-end checks for the daily budgeting tools, on fictitious data only."""
import importlib.util,json,os,shutil,tempfile,sys
sys.dont_write_bytecode=True
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('budget_api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
fixture=api.BudgetAPI('runTest');fixture.setUp();artifacts=Path(tempfile.mkdtemp(prefix='budget-v3-ui-'))
try:
 aid=fixture.account();categories=fixture.get('/api/state')['categories'];cat=next(c['id'] for c in categories if c['name']=='Épicerie')
 with sync_playwright() as p:
  executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser');browser=p.chromium.launch(**({'executable_path':executable} if executable else {}));page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto(fixture.base);page.wait_for_selector('#transaction-category option[value="'+str(cat)+'"]',state='attached')
  page.locator('#open-transaction').click();page.locator('#transaction [name="amount"]').fill('32.50');page.locator('#transaction [name="description"]').fill('Commerce');page.locator('#transaction-category').select_option(str(cat));page.locator('#transaction').get_by_role('button',name='Enregistrer',exact=True).click();expect(page.locator('#transaction-dialog')).not_to_be_visible();assert fixture.get('/api/state')['accounts'][0]['balance_cents']==96750
  navigate_view(page,'transactions');page.locator('#v2-transaction-list button',has_text='Modifier').click();page.locator('#v2-edit-direction').select_option('income');page.locator('#v2-edit-form [name="amount"]').fill('50');page.locator('#v2-edit-form button').click();expect(page.locator('#v2-edit')).not_to_be_visible();assert fixture.get('/api/state')['accounts'][0]['balance_cents']==105000
  fixture.transaction(aid,-20,category_id=cat,description='Courses');page.reload();navigate_view(page,'bilan');expect(page.locator('#monthly-summary')).to_contain_text('50,00');expect(page.locator('#category-report')).to_contain_text('Épicerie');page.locator('#budget-category').select_option(str(cat));page.locator('#category-budget-form [name="amount"]').fill('100');page.locator('#category-budget-form button').click();expect(page.locator('#budget-comparison')).to_contain_text('100,00')
  page.locator('#category-create-form [name="name"]').fill('Animaux');page.locator('#category-create-form button').click();expect(page.locator('#transaction-category option',has_text='Animaux')).to_have_count(1)
  page.screenshot(path=str(artifacts/'bilan.png'),full_page=True)
  navigate_view(page,'objectifs');page.locator('#section-objectifs .page-actions button').click();page.locator('#goal-form [name="name"]').fill('Vacances');page.locator('#goal-form [name="target"]').fill('2000');page.locator('#goal-form [name="saved"]').fill('300');page.locator('#goal-form [name="target_date"]').fill('2027-06-01');page.locator('#goal-save').click();expect(page.locator('#goals-list')).to_contain_text('15 %');page.locator('#goals-list button',has_text='Modifier').click();page.locator('#goal-form [name="saved"]').fill('500');page.locator('#goal-save').click();expect(page.locator('#goals-list')).to_contain_text('25 %');page.screenshot(path=str(artifacts/'objectifs.png'),full_page=True)
  navigate_view(page,'importer');page.locator('#csv-account').select_option(str(aid));page.locator('#csv-category').select_option(str(cat));data=f'Date;Description;Montant\n{api.DAY};Commerce;50\n{api.DAY};Import CSV;-12,50'
  page.locator('#csv-file').set_input_files({'name':'releve.csv','mimeType':'text/csv','buffer':data.encode()});expect(page.locator('#csv-mapping')).to_be_visible();page.locator('#csv-preview-button').click();expect(page.locator('#csv-preview')).to_be_visible();assert page.locator('#csv-preview-rows input:checked').count()==1;assert page.locator('#csv-preview-rows input:disabled').count()==1
  page.screenshot(path=str(artifacts/'import.png'),full_page=True);balance=fixture.get('/api/state')['accounts'][0]['balance_cents'];page.locator('#csv-commit').click();expect(page.locator('#csv-status')).to_contain_text('1 opération(s) importée(s)');assert fixture.get('/api/state')['accounts'][0]['balance_cents']==balance
  navigate_view(page,'comptes');page.get_by_role('button',name='Comparer un solde',exact=True).click();page.locator('#balance-account').select_option(str(aid));page.locator('#balance-form [name="balance"]').fill('777.77');page.locator('#balance-form [name="note"]').fill('Vérification réelle');page.locator('#balance-preview').click();expect(page.locator('#balance-comparison')).to_be_visible();page.locator('#balance-confirm').click();expect(page.locator('#balance-history')).to_contain_text('777,77');assert fixture.get('/api/state')['accounts'][0]['balance_cents']==77777
  navigate_view(page,'sauvegardes')
  with page.expect_download() as download:page.locator('a[href="/api/backup/export"]').click()
  file=download.value;backup_path=artifacts/'backup.json';file.save_as(backup_path);backup=json.loads(backup_path.read_text());assert backup['format']=='mon-budget'
  fixture.transaction(aid,-10);page.locator('#restore-file').set_input_files(str(backup_path));expect(page.locator('#restore-confirmation')).to_be_visible();assert page.locator('#restore-button').is_disabled();page.locator('#restore-confirm-text').fill('REMPLACER');page.locator('#restore-button').click();expect(page.locator('#restore-status')).to_contain_text('Budget restauré');assert fixture.get('/api/backup/export')['tables']==backup['tables']
  page.locator('#restore-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"format":"wrong"}'});expect(page.locator('#restore-status')).to_contain_text('impossible');assert fixture.get('/api/backup/export')['tables']==backup['tables'];errors[:]=[e for e in errors if '400 (Bad Request)' not in e]
  for width in [390,1440]:
   page.set_viewport_size({'width':width,'height':900})
   for view in ['dashboard','comptes','transactions','enveloppes','recurrences','prevision','calendrier','virements','exceptions','bilan','importer','objectifs','sauvegardes']:
    navigate_view(page,view);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(view,width)
  page.set_viewport_size({'width':390,'height':844});navigate_view(page,'bilan');page.screenshot(path=str(artifacts/'mobile-bilan.png'),full_page=True)
  assert not errors,errors;browser.close()
 print('PASS: positive expense entry, sign-changing edit, monthly report, category creation/budget, goal create/edit, CSV duplicate preview and history import, balance correction, backup download and restore, invalid backup refusal, 13 populated screens at mobile/desktop widths.')
 print('Captures fictives :',artifacts)
finally:fixture.tearDown()
