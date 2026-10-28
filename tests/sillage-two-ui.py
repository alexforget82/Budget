"""Sillage 2: four daily routes, progressive details and exact transaction behavior."""
import importlib.util,shutil,tempfile,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();captures=Path(os.environ.get('SILLAGE_CAPTURE_DIR',tempfile.mkdtemp(prefix='sillage2-')));captures.mkdir(parents=True,exist_ok=True)
try:
 bank=f.account(balance=5000);cat=f.make_category('Épicerie simple');f.post('/api/envelopes',{'name':'Épicerie simple','reserved':100,'budget':100,'frequency':'weekly','start_on':api.DAY,'forecast_spend':False});f.global74(cat,400)
 before=f.get('/api/state');tables=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);navigate(page,'dashboard')
  assert page.title()=='Sillage 2'
  assert page.locator('.app-shell-nav>.s2-primary').all_text_contents()==[' Disponible',' Transactions',' Budget',' À venir']
  expect(page.locator('#s26-tools>summary')).to_have_text('Réglages');expect(page.locator('#s2-dashboard-details')).not_to_have_attribute('open','')
  for view in ['comptes','categories','sauvegardes','prevision','bilan','enveloppes','paie','verification','recurrences','dashboard']:
   navigate(page,view)
   if view!='dashboard':expect(page.locator('#section-'+view)).to_be_visible()
  assert f.get('/api/state')['forecast']==before['forecast']
  assert all(f.get('/api/backup/export')['tables'][k]==tables[k] for k in tables if k!='app_settings')
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,768,1100,1440]:
    page.set_viewport_size({'width':width,'height':844})
    for view in ['dashboard','transactions','budget','recurrences']:
     navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,width,view)
     if width in [390,1440]:page.screenshot(path=str(captures/f'{view}-{theme}-{width}.png'))
  page.set_viewport_size({'width':390,'height':844});navigate(page,'dashboard');assert page.locator('.mobile-tabbar>button').all_text_contents()==['Disponible','Transactions','Budget','À venir']
  page.locator('.mobile-tabbar [data-mobile-view=recurrences]').click();expect(page.locator('#section-recurrences')).to_be_visible()
  page.locator('#open-transaction').evaluate('(b)=>b.click()');dialog=page.locator('#transaction-dialog');expect(dialog).to_be_visible();expect(page.locator('#s2-entry-options')).not_to_have_attribute('open','')
  form=page.locator('#transaction');form.locator('[name=amount]').fill('25');form.locator('[name=description]').fill('Épicerie simple');form.locator('[name=account_id]').select_option(str(bank));form.locator('[name=category_id]').select_option(str(cat));page.locator('#s2-entry-options>summary').click();expect(form.locator('[name=happened_on]')).to_be_visible();page.screenshot(path=str(captures/'transaction-390.png'))
  form.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();after=f.get('/api/state');assert after['cash_cents']==before['cash_cents']-2500;assert after['reserved_cents']==before['reserved_cents']-2500;assert after['safe_cents']==before['safe_cents'];assert len(f.get('/api/transactions/list')['rows'])==1
  page.keyboard.press('Control+k');expect(page.locator('#v41-search')).to_be_visible();page.locator('#v41-search').get_by_role('button',name='Fermer',exact=True).click()
  assert not errors,errors;browser.close()
 print('PASS: Sillage 2 branding, four primary routes and four phone tabs, settings/context routes, progressive date entry, canonical financial parity on read, one exact transaction, keyboard search, five widths/two themes. Captures:',captures)
finally:f.tearDown()
