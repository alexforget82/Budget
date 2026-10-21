"""Phone navigation and real workflows, keeping the canonical financial engine unchanged."""
import importlib.util,json,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,header_action
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-mobile-115-'))
try:
 aid=f.account(balance=10000);f.post('/api/setup/scope',{'account_id':aid});cid=f.make_category('Dépenses iPhone');income=f.make_category('Paie iPhone');f.budget_apply({'month':api.MONTH,'category_id':income,'amount':7063.22,'direction':'income','mode':'target','repeat_monthly':True});f.budget_apply({'month':api.MONTH,'category_id':cid,'amount':4639.22,'direction':'expense','mode':'target','repeat_monthly':True})
 for i in range(25):f.transaction(aid,-10-i,category_id=cid,description='Achat classé '+str(i))
 f.post('/api/envelopes',{'name':'Épicerie iPhone','reserved':0,'budget':230,'frequency':'weekly','start_on':f.future73(2),'rollover':False,'forecast_spend':False});before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));context=browser.new_context(viewport={'width':390,'height':844},locale='fr-CA',is_mobile=True,has_touch=True);page=context.new_page();page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+state['version']);bar=page.get_by_role('navigation',name='Navigation rapide');expect(page.locator('#v4-calendar [data-calendar-view=week]')).to_have_attribute('aria-pressed','true')
  for theme in ['light','dark']:
   page.set_viewport_size({'width':1440,'height':1000});page.get_by_label('Apparence',exact=True).select_option(theme)
   for width in [320,375,390,430,760]:
    page.set_viewport_size({'width':width,'height':844});expect(bar).to_be_visible()
    for view in ['dashboard','budget','transactions','prevision','calendrier','comptes','enveloppes','recurrences','sauvegardes']:
     navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme,view)
     assert bar.evaluate('(e)=>Math.abs(e.getBoundingClientRect().bottom-innerHeight)<2');assert page.locator('#app-version').is_visible();assert page.locator('#app-version').evaluate('(e)=>e.closest(".mobile-tabbar")!==null')
    bar.get_by_role('button',name='Budget',exact=True).click();expect(page.locator('#section-budget')).to_be_visible();expect(bar.get_by_role('button',name='Budget',exact=True)).to_have_attribute('aria-current','page')
    assert page.locator('#v60-month').bounding_box()['width']>170,(width,'month width')
    page.wait_for_function("[...document.querySelectorAll('#monthly-budget-workspace>.v60-metrics strong')].every(e=>e.scrollWidth<=e.clientWidth+1)")
    assert page.locator('#mobile-budget-options').get_attribute('open') is None;page.locator('#mobile-budget-options>summary').click();expect(page.get_by_role('button',name='Mes enveloppes',exact=True)).to_be_visible();page.locator('#mobile-budget-options>summary').click()
    if width==390:page.screenshot(path=str(images/f'budget-{theme}.png'))
    bar.get_by_role('button',name='Transactions',exact=True).click();expect(page.locator('.ledger-row').first).to_be_visible();assert page.locator('.ledger-row').first.bounding_box()['y']<550,(width,'ledger priority')
    check=page.locator('.v80-row-check').first;check.check();expect(page.locator('#v80-bulk-bar')).to_be_visible();check.uncheck();expect(page.locator('#v80-bulk-bar')).to_be_hidden()
    page.locator('#mobile-transaction-options>summary').click();expect(page.locator('#v2-account')).to_be_visible();page.locator('#mobile-transaction-options>summary').click()
    if width==390:page.screenshot(path=str(images/f'transactions-{theme}.png'))
    bar.get_by_role('button',name='Prévision',exact=True).click();expect(page.locator('#v4-forecast')).to_be_visible();assert page.locator('#v4-metrics').bounding_box()['y']<500
    page.locator('#v4-forecast [data-days="60"]').click();expect(page.locator('#v4-slider')).to_have_attribute('max','59');page.locator('#v4-forecast [data-days="30"]').click()
    if width==390:page.screenshot(path=str(images/f'prevision-{theme}.png'))
    bar.get_by_role('button',name='Plus',exact=True).click();expect(page.locator('.mobile-navigation-trigger')).to_have_attribute('aria-expanded','true');page.locator('.app-shell-nav [data-view="comptes"]').click();expect(page.locator('#section-comptes')).to_be_visible()
    page.locator('.app-shell-nav .quick-add').click();dialog=page.locator('#transaction-dialog');expect(dialog).to_be_visible();assert dialog.bounding_box()['width']<=width+1;assert dialog.bounding_box()['height']<=844;assert dialog.evaluate('(e)=>Math.abs(e.getBoundingClientRect().bottom-innerHeight)<2');assert dialog.locator('[name=description]').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=16;
    if width==390:
     if theme=='dark':dialog.screenshot(path=str(images/'saisie-dark.png'))
     page.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,value:400});visualViewport.dispatchEvent(new Event('resize'))");page.wait_for_function("document.querySelector('#transaction-dialog').getBoundingClientRect().bottom<=401");assert dialog.bounding_box()['height']<=400;page.evaluate("delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))")
    dialog.get_by_role('button',name='Fermer',exact=True).click()
  page.set_viewport_size({'width':320,'height':844});bar.get_by_role('button',name='Budget',exact=True).click();page.locator('#monthly-budget-workspace>.v60-metrics strong').first.evaluate('(e)=>e.textContent="10 000 000,00 $"');page.wait_for_function("[...document.querySelectorAll('#monthly-budget-workspace>.v60-metrics strong')].every(e=>e.scrollWidth<=e.clientWidth+1)");assert page.locator('#monthly-budget-workspace>.v60-metrics>div').first.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');page.reload();expect(page.locator('#app-version')).to_have_text('v'+state['version'])
  page.set_viewport_size({'width':1440,'height':1000});navigate(page,'budget');expect(bar).to_be_hidden();assert page.locator('#v60-month').evaluate('(e)=>e.closest(".mobile-options")===null');assert page.get_by_label('Afficher les catégories',exact=True).evaluate('(e)=>e.parentElement.classList.contains("v60-toolbar")');assert page.locator('#app-version').evaluate('(e)=>e.closest(".app-nav-footer")!==null')
  after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings');assert f.get('/api/state')['forecast']==state['forecast']
  # One explicit entry through the phone's primary action updates the ledger once.
  page.set_viewport_size({'width':390,'height':844});bar.get_by_role('button',name='Transactions',exact=True).click();page.locator('.app-shell-nav .quick-add').click();form=page.locator('#transaction');form.locator('[name=amount]').fill('12.34');form.locator('[name=description]').fill('Saisie iPhone vérifiée');form.locator('[name=category_id]').select_option(str(cid));form.get_by_role('button',name='Enregistrer',exact=True).click();expect(page.locator('#transaction-dialog')).not_to_be_visible();expect(page.locator('.ledger-description').first).to_contain_text('Saisie iPhone vérifiée');assert f.get('/api/state')['cash_cents']==state['cash_cents']-1234;assert not errors,errors;browser.close()
 print('PASS: light/dark, five phone widths, nine views; bottom tabs, full menu, readable amounts/month, visible ledger, filters, bulk actions, bottom sheets, desktop restoration, unchanged browsing finances and one exact transaction entry. Captures:',images)
finally:f.tearDown()
