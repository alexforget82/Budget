"""Related navigation, canonical envelopes/forecast, keyboard and phone classification."""
import importlib.util, shutil, tempfile, os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
captures=Path(os.environ.get('SILLAGE_CAPTURE_DIR',tempfile.mkdtemp(prefix='sillage-captures-')));captures.mkdir(parents=True,exist_ok=True)
f=api.BudgetAPI();f.setUp()
try:
 bank=f.account(balance=10000);cat=f.make_category('Épicerie parcours')
 f.transaction(bank,-20,category_id=cat,description='Marché parcours')
 f.post('/api/envelopes',{'name':'Épicerie parcours','reserved':120,'budget':230,'frequency':'weekly','start_on':api.DAY,'forecast_spend':False,'rollover':False})
 f.post('/api/recurring',{'description':'Paie parcours','amount':1200,'account_id':bank,'type':'income','frequency':'biweekly','start_on':f.future73(2)})
 f.post('/api/recurring',{'description':'Facture parcours','amount':50,'account_id':bank,'type':'expense','frequency':'monthly','start_on':f.future73(4)})
 f.global74(cat,1000)
 baseline=f.get('/api/state');before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base)
  navigate(page,'dashboard');expect(page.locator('#dashboard-payday')).to_contain_text('1 200,00')
  navigate(page,'budget');expect(page.locator('.v60-table-heading')).to_contain_text('Protégé maintenant');expect(page.locator(f'.v60-budget-row[data-category-id="{cat}"] .flow-protected')).to_contain_text('230,00')
  navigate(page,'bilan');expect(page.locator('#section-bilan')).to_be_visible();expect(page.locator('.app-shell-nav [data-view=bilan]')).not_to_be_visible();expect(page.locator('.app-shell-nav [data-view=budget]')).to_have_attribute('aria-current','page')
  navigate(page,'enveloppes');expect(page.locator('#section-enveloppes')).to_be_visible()
  page.keyboard.press('Control+k');expect(page.locator('#v41-search')).to_be_visible();page.locator('#v41-search').get_by_role('button',name='Fermer',exact=True).click();page.keyboard.press('g');page.keyboard.press('t');expect(page.locator('#section-transactions')).to_be_visible()
  page.locator('#v2-search').fill('N');page.locator('#v2-search').press('n');expect(page.locator('#transaction-dialog')).not_to_be_visible();page.locator('#v2-search').fill('');page.locator('#v2-search').dispatch_event('input');expect(page.locator('.ledger-row')).to_have_count(1)
  navigate(page,'recurrences');page.locator('#v60-recurring-month').fill(f.future73(2)[:7]);page.locator('#v60-recurring-month').dispatch_event('change');expect(page.locator('.flow-rec-head')).to_contain_text('Effet sur le disponible');page.locator('#v60-recurring').get_by_role('button',name='Calendrier',exact=True).click();expect(page.locator('.flow-rec-calendar')).to_be_visible();expect(page.locator('.flow-rec-calendar')).to_contain_text('Paie parcours');page.locator('#v60-recurring').get_by_role('button',name='Liste',exact=True).click()
  navigate(page,'prevision');expect(page.locator('.flow-chart-min-label')).to_contain_text('Minimum');expect(page.locator('#forecast-daily-table tbody tr')).to_have_count(30);page.locator('#v4-forecast [data-days="60"]').click();expect(page.locator('#forecast-daily-table tbody tr')).to_have_count(60);page.locator('#v4-forecast [data-days="90"]').click();expect(page.locator('#forecast-daily-table tbody tr')).to_have_count(90)
  assert page.locator('.flow-chart-event').count()>0
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,768,1100,1440]:
    page.set_viewport_size({'width':width,'height':844})
    for view in ['dashboard','budget','bilan','recurrences','prevision','transactions']:
     navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(view,width,theme,page.evaluate('''[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().width>0 && e.getBoundingClientRect().right>innerWidth+1).slice(-12).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right,e.textContent.slice(0,70)])'''))
  page.set_viewport_size({'width':390,'height':844});navigate(page,'transactions');row=page.locator('.ledger-row').first
  row.evaluate("""row=>{const touch=x=>new Touch({identifier:1,target:row,clientX:x,clientY:200});row.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(250)]}));row.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[touch(100)]}));}""");expect(page.locator('#register-classification-dialog')).to_be_visible();page.locator('#register-classification-dialog').get_by_role('button',name='Fermer',exact=True).click()
  # Vertical scrolling never triggers classification; the + button opens the real editor.
  row.evaluate("""row=>{const touch=y=>new Touch({identifier:1,target:row,clientX:200,clientY:y});row.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,touches:[touch(200)]}));row.dispatchEvent(new TouchEvent('touchend',{bubbles:true,changedTouches:[touch(400)]}));}""")
  expect(page.locator('#register-classification-dialog')).not_to_be_visible()
  page.locator('#open-transaction').evaluate('(b)=>b.click()');expect(page.locator('#transaction-dialog')).to_be_visible();page.locator('#transaction-dialog').get_by_role('button',name='Fermer',exact=True).click()
  assert page.locator('.mobile-tabbar>button').count()==4
  page.goto(f.base+'/#bilan');expect(page.locator('#section-bilan')).to_be_visible()
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [390,1440]:
    page.set_viewport_size({'width':width,'height':950})
    for view in ['dashboard','budget','recurrences','prevision']:
     navigate(page,view);page.screenshot(path=str(captures/f'{view}-{theme}-{width}.png'))
  assert not errors,errors
  after=f.get('/api/state');assert after['forecast']==baseline['forecast'];assert after['safe_cents']==baseline['safe_cents'];assert after['reserved_cents']==baseline['reserved_cents']
  tables=f.get('/api/backup/export')['tables'];assert all(tables[k]==before[k] for k in before if k!='app_settings')
  browser.close()
 print('PASS: budget tabs, payday panel, canonical envelope amounts, recurrence table/calendar, 30/60/90 daily forecast, chart labels/events, keyboard, swipe classification, five widths/two themes, unchanged finances.')
finally:f.tearDown()
