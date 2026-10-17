"""The register and editor, verified against a temporary server/database."""
import importlib.util,json,os,shutil,sys,tempfile,datetime
from pathlib import Path
sys.dont_write_bytecode=True
from ui_navigation import navigate
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('budget_api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI('runTest');f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-transactions-ui-'))
try:
 aid=f.account(balance=3600);credit=f.account('credit',120)
 f.post('/api/accounts/update',{'id':aid,'name':'Compte quotidien','kind':'checking','balance':3600,'included':True})
 categories=f.get('/api/state')['categories'];food=next(c['id'] for c in categories if c['name']=='Épicerie');transport=next(c['id'] for c in categories if c['name']=='Transport');income=next(c['id'] for c in categories if c['name']=='Revenus')
 today=datetime.date.today();old=(today.replace(day=1)-datetime.timedelta(days=1)).replace(day=12).isoformat()
 for i in range(52):f.transaction(aid,-1,description='Transport '+str(i),happened_on=old,category_id=transport)
 for name,amount,cat,date in [('CAFÉ du Coin',-4.25,food,api.DAY),('Marché du quartier',-78.45,food,(today-datetime.timedelta(days=1 if today.day>1 else 0)).isoformat()),('Pharmacie',-22.60,None,(today-datetime.timedelta(days=1 if today.day>1 else 0)).isoformat()),('Internet',-79,None,api.DAY),('Salaire',1850,income,api.DAY),('Restaurant',-47.30,None,api.DAY)]:
  s=f.transaction(aid,amount,description=name,category_id=cat,happened_on=date)
  if name=='Internet':f.post('/api/transactions/review',{'id':s['transactions'][0]['id'],'reviewed':True})
 with sync_playwright() as p:
  executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser');browser=p.chromium.launch(**({'executable_path':executable} if executable else {}));page=browser.new_page(viewport={'width':1440,'height':1100});page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.add_init_script("""const originalFetch=window.fetch;window.fetch=(input,init)=>{const result=originalFetch(input,init);return String(input).includes('/api/transactions/list?')&&String(input).includes('search=cafe')?result.then(async response=>{await new Promise(resolve=>setTimeout(resolve,700));return response}):result};""")
  page.goto(f.base);navigate(page,'transactions');expect(page.locator('.ledger-row')).to_have_count(50)
  formatMoney=lambda value:page.evaluate('(v)=>(v/100).toLocaleString("fr-CA",{style:"currency",currency:"CAD"})',value)
  assert page.locator('[data-metric="expense_cents"] strong').inner_text()==formatMoney(28360)
  page.locator('#v2-next').click();expect(page.locator('.ledger-row')).to_have_count(8);assert page.locator('[data-metric="expense_cents"] strong').inner_text()==formatMoney(28360)
  page.locator('#transactions-period').select_option('current');expect(page.locator('.ledger-row')).to_have_count(6)
  # This response is deliberately delayed; a later search must win.
  with page.expect_request(lambda r:'/api/transactions/list?' in r.url and 'search=cafe' in r.url):page.locator('#v2-search').fill('cafe')
  page.locator('#v2-search').fill('salaire');expect(page.locator('.ledger-row')).to_have_count(1);expect(page.locator('.ledger-name')).to_have_text('Salaire');page.wait_for_timeout(800);expect(page.locator('.ledger-name')).to_have_text('Salaire')
  page.locator('#v2-search').fill('cafe');expect(page.locator('.ledger-row')).to_have_count(1);expect(page.locator('.ledger-name')).to_have_text('CAFÉ du Coin');page.locator('#v2-search').fill('');expect(page.locator('.ledger-row')).to_have_count(6)
  cafe=page.locator('.ledger-row',has=page.locator('.ledger-name',has_text='CAFÉ du Coin'));cafe.locator('.review-pill').click();expect(page.locator('[data-metric="pending_count"] strong')).to_have_text('4')
  page.locator('[data-mode="pending"]').click();expect(page.locator('.ledger-row')).to_have_count(4);page.locator('[data-mode="all"]').click();expect(page.locator('.ledger-row')).to_have_count(6)
  page.locator('.register-advanced>summary').click();page.locator('#v3-category-filter').select_option(str(food));expect(page.locator('.ledger-row')).to_have_count(2);page.locator('#v3-category-filter').select_option('');expect(page.locator('.ledger-row')).to_have_count(6);page.locator('.register-advanced>summary').click()
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.set_viewport_size({'width':1440,'height':1100});page.wait_for_selector('.save-notification',state='hidden');page.evaluate('scrollTo(0,0)');page.screenshot(path=str(images/'transactions.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(images/'mobile-transactions.png'),full_page=True);page.set_viewport_size({'width':1440,'height':1100})
  before=next(a['balance_cents'] for a in f.get('/api/state')['accounts'] if a['id']==aid)
  page.locator('#open-transaction').click();page.locator('#account-options').select_option(str(aid));expect(page.locator('.entry-more')).not_to_have_attribute('open','');page.locator('.merchant-chip',has_text='CAFÉ du Coin').click();expect(page.locator('#transaction-category')).to_have_value(str(food));expect(page.locator('.entry-category-hint')).to_contain_text('Épicerie')
  page.locator('#transaction [name="amount"]').fill('6.75');
  for width in [375,390,768,1024,1440]:
   page.set_viewport_size({'width':width,'height':1000});assert page.locator('#transaction-dialog').evaluate('(dialog)=>dialog.scrollWidth<=dialog.clientWidth+1'),('editor',width)
  page.set_viewport_size({'width':1440,'height':1100});page.screenshot(path=str(images/'saisie-transaction.png'),full_page=True);page.locator('#transaction-category').select_option(str(transport));page.locator('#transaction [name="description"]').fill('CAFÉ du Coin');expect(page.locator('#transaction-category')).to_have_value(str(transport))
  page.locator('#transaction').get_by_role('button',name='Enregistrer et continuer',exact=True).click();expect(page.locator('#transaction-dialog')).to_be_visible();expect(page.locator('#transaction [name="amount"]')).to_have_value('');expect(page.locator('#transaction [name="description"]')).to_have_value('')
  page.locator('.merchant-chip',has_text='Marché du quartier').click();expect(page.locator('#transaction-category')).to_have_value(str(food));page.locator('#transaction [name="amount"]').fill('10');page.locator('#transaction').get_by_role('button',name='Enregistrer',exact=True).click();expect(page.locator('#transaction-dialog')).not_to_be_visible();assert next(a['balance_cents'] for a in f.get('/api/state')['accounts'] if a['id']==aid)==before-1675
  cafe=page.locator('.ledger-row',has=page.locator('.ledger-name',has_text='CAFÉ du Coin')).first;cafe.locator('.ledger-menu>summary').click();cafe.get_by_role('button',name='Refaire cette opération',exact=True).click();expect(page.locator('.entry-copy-notice')).to_be_visible();assert page.locator('#transaction [name="happened_on"]').input_value()==api.DAY;count=f.get('/api/transactions/list')['count'];page.locator('#close-transaction').click();assert f.get('/api/transactions/list')['count']==count
  page.locator('#open-transaction').click();page.locator('.entry-type[data-direction="income"]').click();expect(page.locator('#transaction-category')).to_have_value('');expect(page.locator('.entry-more')).to_be_hidden();page.locator('#transaction [name="amount"]').fill('25');page.locator('#transaction [name="description"]').fill('Remboursement');page.locator('#transaction-category').select_option(str(income));page.locator('#transaction').get_by_role('button',name='Enregistrer',exact=True).click();expect(page.locator('#transaction-dialog')).not_to_be_visible();assert next(a['balance_cents'] for a in f.get('/api/state')['accounts'] if a['id']==aid)==before-1675+2500
  # Last-page deletion returns to a populated page rather than an empty page 2.
  page.locator('#transactions-period').select_option('previous');expect(page.locator('.ledger-row')).to_have_count(50);page.locator('#v2-next').click();expect(page.locator('.ledger-row')).to_have_count(2)
  for expected in [1,50]:
   row=page.locator('.ledger-row').first;row.locator('.ledger-menu>summary').click();page.once('dialog',lambda dialog:dialog.accept());row.get_by_role('button',name='Supprimer',exact=True).click();expect(page.locator('.ledger-row')).to_have_count(expected)
  expect(page.locator('#v2-pages')).to_contain_text('Page 1 / 1')
  # A failed read clears the totals and offers a working retry.
  page.route('**/api/transactions/list?**',lambda route:route.fulfill(status=503,json={'error':'Essai temporaire'}));page.locator('[data-mode="income"]').click();expect(page.locator('#register-result-label')).to_contain_text('impossible');expect(page.locator('[data-metric="expense_cents"] strong')).to_have_text('—');page.unroute('**/api/transactions/list?**');page.get_by_role('button',name='Réessayer',exact=True).click();expect(page.locator('#register-result-label')).to_contain_text('0 opérations')
  errors[:]=[e for e in errors if '503 (Service Unavailable)' not in e];assert not errors,errors;browser.close()
 print('PASS: full-filter totals across pages, race-safe accent search, review status, quick/advanced filters, five responsive widths, merchant category suggestions/manual override, save-and-continue, exact signed balances, draft repeat, income entry, last-page deletion, error/retry.')
 print('Captures fictives :',images)
finally:f.tearDown()
