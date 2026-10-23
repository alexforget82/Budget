"""Register totals and monthly inline edits preserve financial accounts and periodic plans."""
import importlib.util, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from ui_navigation import navigate, set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 bank=f.account(balance=10000);cat=f.make_category('Restaurant registre')
 for i in range(55): f.transaction(bank,-10,description='Achat registre',category_id=cat)
 baseline=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);navigate(page,'transactions')
  expect(page.locator('.ledger-row')).to_have_count(50)
  expect(page.locator('.register-totals-footer')).to_contain_text('550,00')
  checks=page.locator('.v80-row-check');checks.nth(0).check();checks.nth(1).check()
  expect(page.locator('.register-selection-stats')).to_contain_text('20,00');expect(page.locator('.register-selection-stats')).to_contain_text('10,00')
  page.screenshot(path='docs/v145/transactions-desktop.png')
  navigate(page,'budget');row=page.locator(f'.v60-budget-row[data-category-id="{cat}"]');field=row.locator('.budget-inline-amount');expect(field).to_be_visible();field.fill('120.50');field.press('Enter');expect(row.locator('.budget-inline-amount')).to_have_value('120.50')
  page.wait_for_function("()=>!document.querySelector('.budget-inline-amount:disabled')")
  month=page.locator('#v60-month').input_value();state=f.get('/api/budget/global?month='+month);assert next(r for r in state['rows'] if r['id']==cat)['budget_cents']==12050
  after=f.get('/api/state')
  for key in ['cash_cents','safe_cents','reserved_cents','credit_reserved_cents']: assert after[key]==baseline[key],key
  for width in [390,768,1100,1440]:
   page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.set_viewport_size({'width':1440,'height':1000});set_theme(page,'light');page.screenshot(path='docs/v145/budget-desktop.png')
  page.set_viewport_size({'width':390,'height':844});set_theme(page,'dark');page.screenshot(path='docs/v145/budget-iphone.png')
  navigate(page,'transactions');page.screenshot(path='docs/v145/transactions-iphone.png')
  assert not errors,errors
  browser.close()
 print('PASS: full filtered totals, signed selection total/mean, monthly inline persistence, unchanged cash, responsive budget.')
finally:f.tearDown()
