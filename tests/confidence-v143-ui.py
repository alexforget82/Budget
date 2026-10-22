"""V14.3 history, period-first envelopes and guided reconciliation on phone/desktop."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme,header_action
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-v143-'))
try:
 bank=f.account(balance=2000);f.post('/api/setup/scope',{'account_id':bank});s=f.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':api.DAY,'rollover':False,'forecast_spend':False});eid=s['envelopes'][0]['id'];f.transaction(bank,-71.69,description='Épicerie semaine',envelope_id=eid)
 f.transaction(bank,-30,description='Piste A');f.transaction(bank,-20,description='Piste B');before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base)
  # Opening focus must not steal the description field on the next frame.
  page.wait_for_function('!!window.budgetRuntime?.state');assert page.evaluate("""async()=>{window.appOpenEditor('transaction');const field=document.querySelector('#transaction [name=description]');field.focus();await new Promise(requestAnimationFrame);return document.activeElement===field;}""");page.locator('#close-transaction').click()
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,768,1440]:
    page.set_viewport_size({'width':width,'height':844 if width<768 else 1000});navigate(page,'dashboard');header_action(page,'Pourquoi mon minimum a changé ?');dialog=page.locator('#minimum-history-dialog');expect(dialog).to_be_visible();expect(dialog.locator('.confidence-change').first).to_be_visible();dialog.locator('.confidence-change>summary').first.click();expect(dialog.locator('.confidence-change[open]')).to_contain_text('Piste B')
    for horizon in [30,60,90]:dialog.get_by_role('button',name=str(horizon)+' jours',exact=True).click();expect(dialog.get_by_role('button',name=str(horizon)+' jours',exact=True)).to_have_attribute('aria-pressed','true')
    assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(width,theme,'history overflow')
    if width in [390,1440]:page.screenshot(path=str(images/f'historique-{theme}-{width}.png'))
    dialog.get_by_role('button',name='Fermer',exact=True).click();navigate(page,'enveloppes');card=page.locator(f'.envelope-tile[data-envelope-id="{eid}"]');strip=card.locator('.confidence-envelope-summary');expect(strip).to_contain_text('230,00');expect(strip).to_contain_text('71,69');expect(strip).to_contain_text('158,31');card.get_by_role('button',name='Gérer',exact=True).click();sheet=page.locator('#v44-envelope-sheet');expect(sheet).to_contain_text('Restant à dépenser');expect(sheet).to_contain_text('158,31');expect(sheet.locator('.confidence-reserve-detail')).not_to_have_attribute('open','');assert sheet.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');sheet.get_by_role('button',name='Fermer',exact=True).click()
    if width in [390,1440]:page.screenshot(path=str(images/f'enveloppes-{theme}-{width}.png'))
    navigate(page,'dashboard');header_action(page,'Rapprocher avec ma banque');bankDialog=page.locator('#v41-bank-dialog');bankDialog.locator('[name=balance]').fill(str(state['accounts'][0]['balance_cents']/100+50));bankDialog.get_by_role('button',name='Comparer sans modifier',exact=True).click();expect(bankDialog.locator('.confidence-bank-hints')).to_contain_text('Deux opérations');bankDialog.get_by_role('button',name='2 · Examiner',exact=True).click();bankDialog.get_by_role('button',name='3 · Valider',exact=True).click();expect(bankDialog.locator('.v41-correction')).to_have_attribute('open','');assert bankDialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    if width in [390,1440]:page.screenshot(path=str(images/f'rapprochement-{theme}-{width}.png'))
    bankDialog.get_by_role('button',name='Fermer',exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
  assert f.get('/api/state')['forecast']==state['forecast'];after=f.get('/api/backup/export')['tables'];assert all(after[t]==before[t] for t in before if t!='app_settings');assert not errors,errors
  # Error and retry do not discard financial data.
  navigate(page,'dashboard');page.route('**/api/forecast/history',lambda route:route.abort());header_action(page,'Pourquoi mon minimum a changé ?');expect(dialog.get_by_role('button',name='Réessayer',exact=True)).to_be_visible();page.unroute('**/api/forecast/history');dialog.get_by_role('button',name='Réessayer',exact=True).click();expect(dialog.locator('.confidence-change').first).to_be_visible();browser.close()
 print('PASS: history 30/60/90 and bridge, budget/spent/remaining, reserve detail, guided pair review, retry, 4 widths/two themes; no financial writes. Captures:',images)
finally:f.tearDown()
