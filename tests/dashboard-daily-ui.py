from ui_navigation import dashboard_control
"""One-click canonical daily Safe-to-Spend from either home mode."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account(balance=1000);f.post('/api/envelopes',{'name':'Reserve','reserved':125,'budget':0,'frequency':'none','forecast_spend':False})
 for offset,amount in [(0,50),(40,100),(70,200)]:f.post('/api/recurring',{'description':'Facture '+str(offset),'amount':amount,'type':'expense','account_id':aid,'start_on':f.future73(offset),'frequency':'monthly','one_time':True})
 before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);page.locator('#v80-hero [data-horizon="60"]').click();page.locator('#home-daily-open').click();dialog=page.locator('#home-daily-dialog');expect(dialog).to_be_visible();expect(dialog.locator('.home-daily-row')).to_have_count(60)
  for days in [30,60,90]:
   dialog.get_by_role('button',name=f'{days} jours',exact=True).click();expect(dialog.locator('.home-daily-row')).to_have_count(days);s=f.get('/api/state')
   for i in [0,days-1]:
    row=dialog.locator('.home-daily-row').nth(i);expect(row.locator('time')).to_have_attribute('datetime',s['forecast'][i]['date']);money=page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",s['forecast'][i]['safe_cents']);expect(row.locator('strong')).to_have_text(money)
  assert dialog.locator('.home-daily-list').evaluate('(e)=>e.scrollHeight>e.clientHeight');assert f.get('/api/backup/export')['tables']==before
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':844});assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');expect(dialog.locator('.home-daily-row').first).to_be_visible()
  dialog.get_by_role('button',name='Fermer',exact=True).click();expect(page.locator('#home-daily-open')).to_be_focused();page.keyboard.press('Enter');expect(dialog).to_be_visible();page.keyboard.press('Escape');expect(dialog).not_to_be_visible()
  dashboard_control(page,'home-mode');page.locator('#home-daily-open').click();expect(dialog).to_be_visible();f.transaction(aid,-25);dialog.get_by_role('button',name='Actualiser les montants',exact=True).click();expected=f.get('/api/state')['forecast'][0]['safe_cents'];money=page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",expected);expect(dialog.locator('.home-daily-row').first.locator('strong')).to_have_text(money);assert not errors,errors;browser.close()
 print('PASS: quick daily dialog in both dashboard modes, selected horizon and exact canonical 30/60/90 dates/amounts after reserves, responsive scroll, keyboard/focus and refresh, no browsing writes.')
finally:f.tearDown()
