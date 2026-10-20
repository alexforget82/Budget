"""Imported/user-entered HTML remains text in the owner transaction views."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account();attack='<img src=x onerror="window.__budgetXSS=1">';cid=f.make_category(attack);f.transaction(aid,-12.34,description=attack,category_id=cid);before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});page.goto(f.base);navigate(page,'transactions');expect(page.locator('.ledger-name').first).to_have_text(attack);assert page.evaluate('window.__budgetXSS===undefined');page.locator('.ledger-name').first.click();expect(page.locator('#sillage-inspector')).to_be_visible();assert page.evaluate('window.__budgetXSS===undefined');assert page.locator('img[src=x]').count()==0;browser.close()
 assert f.get('/api/backup/export')['tables']==before
 print('PASS: HTML in transaction descriptions/categories stays inert text in the register and inspector, with no injected image or financial writes.')
finally:f.tearDown()
