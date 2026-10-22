from ui_navigation import open_mobile_options
from ui_navigation import set_theme
"""Dense register with 80 operations: layout, pagination, filters and financial invariance."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='compact-register-'))
try:
 aid=f.account(balance=5000)
 for i in range(80):f.transaction(aid,-(i+1),description=f'Commerce {i:02d}',happened_on=api.DAY)
 before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1500,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);navigate(page,'transactions');expect(page.locator('.ledger-row')).to_have_count(50);expect(page.locator('#v2-pages')).to_contain_text('80 opérations');section=page.locator('#section-transactions');assert 'register-compact' in section.get_attribute('class');row=page.locator('.ledger-row').first;assert row.bounding_box()['height']<=62,row.bounding_box();assert row.bounding_box()['y']<650,row.bounding_box();assert page.locator('.merchant-mark').first.is_hidden()
  # Header and rows share actual column positions.
  for selector,key in [('.ledger-name','description'),('.ledger-category','category'),('.ledger-amount','amount'),('.review-pill','status')]:
   h=page.locator(f'.sillage-ledger-head [data-column={key}]').bounding_box();r=row.locator(selector).bounding_box();assert abs(h['x']-r['x'])<6,(selector,h,r)
  ids=page.locator('.ledger-row').evaluate_all('(rows)=>rows.map(r=>r.dataset.transactionId)');page.locator('#v2-next').click();expect(page.locator('.ledger-row')).to_have_count(30);assert not set(ids)&set(page.locator('.ledger-row').evaluate_all('(rows)=>rows.map(r=>r.dataset.transactionId)'));page.locator('#v2-prev').click();expect(page.locator('.ledger-row')).to_have_count(50)
  page.locator('#v2-search').fill('Commerce 05');expect(page.locator('.ledger-row')).to_have_count(1);page.locator('#v2-search').fill('');expect(page.locator('.ledger-row')).to_have_count(50);page.locator('.ledger-row').first.locator('.v80-row-check').check();expect(page.get_by_role('button',name='Modifier la sélection',exact=True)).to_be_enabled();page.get_by_role('button',name='Effacer',exact=True).click();open_mobile_options(page,'mobile-transaction-options');page.locator('#register-density').click();assert 'register-compact' not in section.get_attribute('class');page.reload();navigate(page,'transactions');expect(page.locator('#register-density')).to_have_text('Vue compacte');open_mobile_options(page,'mobile-transaction-options');page.locator('#register-density').click()
  for scheme in ['light','dark']:
   set_theme(page,scheme)
   for width in [320,390,768,1100,1500,1850]:
    page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,scheme);assert page.locator('.ledger-row').first.bounding_box()['height']<150,(width,scheme);assert page.locator('.ledger-row').first.locator('.ledger-amount').is_visible()
    if width in [320,768]:
     open_mobile_options(page,'mobile-transaction-options');page.locator('#register-density').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('comfortable',width);open_mobile_options(page,'mobile-transaction-options');page.locator('#register-density').click()
   page.screenshot(path=str(images/(scheme+'.png')))
  after=f.get('/api/backup/export')['tables'];after['app_settings']=[x for x in after['app_settings'] if x['key']!='appearance_theme_v50'];before['app_settings']=[x for x in before['app_settings'] if x['key']!='appearance_theme_v50'];assert after==before;assert not errors,errors;browser.close()
 print('PASS: 80 records, compact rows and aligned columns, pagination, search, selection, remembered density, light/dark and six widths, no financial writes. Captures:',images)
finally:f.tearDown()
