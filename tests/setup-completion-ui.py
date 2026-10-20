"""Completed setup leaves the main menu and remains reachable without restarting setup."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,header_action
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account();f.post('/api/setup/scope',{'account_id':aid});before=f.get('/api/backup/export')['tables'];forecast=f.get('/api/state')['forecast']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1400,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);link=page.locator('.app-shell-nav [data-view=demarrage]');expect(link).to_be_visible();navigate(page,'demarrage');page.locator('.v70-steps button').last.click();page.get_by_role('button',name='Terminer la configuration',exact=True).click();expect(page.locator('#app-dashboard')).to_be_visible();expect(link).to_be_hidden();assert f.get('/api/state')['setup70']['completed'];page.reload();expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);expect(link).to_be_hidden()
  header_action(page,'État des données');page.get_by_role('button',name='Revoir la configuration',exact=True).click();expect(page.locator('#section-demarrage')).to_be_visible();page.locator('.v70-steps button').nth(1).click();expect(page.locator('.v70-steps button').nth(1)).to_have_attribute('aria-current','step');expect(link).to_be_hidden();assert f.get('/api/state')['setup70']['completed'];page.reload();expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);expect(link).to_be_hidden()
  page.set_viewport_size({'width':390,'height':844});header_action(page,'État des données');page.get_by_role('button',name='Revoir la configuration',exact=True).click();expect(page.locator('#section-demarrage')).to_be_visible();expect(link).to_be_hidden();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');after=f.get('/api/backup/export')['tables'];assert all(before[t]==after[t] for t in before if t!='app_settings');assert f.get('/api/state')['forecast']==forecast
  # A reset restores the unfinished guide and its menu entry in this disposable budget.
  preview=f.post('/api/setup/reset-preview',{});f.post('/api/setup/reset',{'token':preview['token'],'confirmation':'EFFACER','acknowledged':True,'backup':False});page.reload();expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);assert link.get_attribute('hidden') is None;expect(page.locator('#section-demarrage')).to_be_visible();assert not errors,errors;browser.close()
 print('PASS: completion hides setup, persists after reload, data-status button reopens it, browsing completed steps preserves completion, mobile access, unchanged ledger/forecast and reset restores the guide.')
finally:f.tearDown()
