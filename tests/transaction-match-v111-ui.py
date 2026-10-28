"""Manual creation suggests nearby plans; confirmation reuses the real transaction."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 aid=f.account(balance=2000);other=f.account(balance=500)
 cid=next(c['id'] for c in f.get('/api/state')['categories'] if c['name']=='Transport')
 for desc,account,offset in [('Essence jeudi',aid,2),('Essence vendredi',aid,3),('Autre compte',other,2),('Trop loin',aid,20)]:
  f.post('/api/recurring',{'description':desc,'amount':60,'type':'expense','account_id':account,'category_id':cid,'frequency':'monthly','one_time':True,'start_on':f.future73(offset)})
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base)
  def create(desc,amount='55',again=False,category=True):
   page.locator('#open-transaction').click();page.locator('#transaction [name=amount]').fill(amount);page.locator('#transaction [name=description]').fill(desc);page.locator('#account-options').select_option(str(aid));page.locator('#s2-entry-options>summary').click();page.locator('#transaction [name=happened_on]').fill(api.DAY)
   if category:page.locator('#transaction-category').select_option(str(cid))
   page.locator('#transaction').get_by_role('button',name='Enregistrer et continuer' if again else 'Enregistrer',exact=True).click()
  create('Essence station')
  prompt=page.locator('#v111-match');expect(prompt).to_be_visible();expect(prompt.locator('section')).to_have_count(2);expect(prompt).not_to_contain_text('Autre compte');expect(prompt).not_to_contain_text('Trop loin')
  s=f.get('/api/state');cash=s['cash_cents'];count=len(s['calendar_actuals']);before=f.get('/api/backup/export')['tables']
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});assert prompt.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
  prompt.locator('section').first.get_by_role('button',name='Associer',exact=True).click();expect(prompt).not_to_be_visible();s=f.get('/api/state');assert s['cash_cents']==cash;assert len(s['calendar_actuals'])==count;row=next(r for r in s['planning']['rows'] if r['description']=='Essence jeudi');assert row['remaining_cents']==0,row;assert 'transaction:'+str(s['calendar_actuals'][0]['id']) in row['actual_ids'],row
  # Keep separate changes no financial tables, including a save-and-continue editor.
  create('Essence autre station',again=True);expect(prompt).to_be_visible();tables=f.get('/api/backup/export')['tables'];prompt.get_by_role('button',name='Garder séparée',exact=True).click();expect(prompt).not_to_be_visible();expect(page.locator('#transaction-dialog')).to_be_visible();assert f.get('/api/backup/export')['tables']==tables;page.locator('#close-transaction').click()
  # No category, envelope or matching description: same amount/date alone must not suggest.
  create('Achat sans lien',category=False);expect(page.locator('#transaction-dialog')).not_to_be_visible();page.wait_for_timeout(250);expect(prompt).not_to_be_visible()
  # Category matching works even with different merchant/plan names.
  rid=next(r['id'] for r in f.get('/api/state')['recurring'] if r['description']=='Essence vendredi');f.post('/api/budget/recurring-link',{'recurring_id':rid,'category_id':cid});page.reload();create('Marchand different');expect(prompt).to_be_visible();expect(prompt.locator('section')).to_have_count(1);tables=f.get('/api/backup/export')['tables'];page.route('**/api/planning/action',lambda route:route.fulfill(status=409,json={'error':'Cette prévision a changé.'}));prompt.get_by_role('button',name='Associer',exact=True).click();expect(prompt.locator('[role=alert]')).to_contain_text('La transaction reste enregistrée');assert f.get('/api/backup/export')['tables']==tables;page.unroute('**/api/planning/action');prompt.get_by_role('button',name='Garder séparée',exact=True).click()
  # An envelope can keep its remaining planned amount for later purchases.
  s=f.post('/api/envelopes',{'name':'Pharmacie test','reserved':0,'budget':100,'frequency':'monthly','start_on':f.future73(5),'forecast_spend':True,'forecast_account_id':aid});eid=next(e['id'] for e in s['envelopes'] if e['name']=='Pharmacie test');page.reload();create('Pharmacie test',amount='25',category=False);expect(prompt).to_be_visible();expect(prompt.get_by_role('checkbox')).not_to_be_checked();cash=f.get('/api/state')['cash_cents'];prompt.get_by_role('button',name='Associer',exact=True).click();expect(prompt).not_to_be_visible();s=f.get('/api/state');assert s['cash_cents']==cash;row=next(r for r in s['planning']['rows'] if r['source']=='envelope' and r['envelope_id']==eid and r['original_on']==f.future73(5));assert row['remaining_cents']==7500,row
  page.reload();expect(prompt).not_to_be_visible();assert not errors,errors;browser.close()
 print('PASS: early expense, differing amount, multiple choices, account/date exclusions, one-click association without second debit, dismiss without writes, save-and-continue, unrelated expense and reload, four widths, category matching, stale-plan error without writes and partial envelope protection.')
finally:f.tearDown()
