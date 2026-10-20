"""Pinned 11.1 -> migration -> extra real transaction -> 11.1, with identical forecasts."""
import importlib.util,json,shutil,sqlite3,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
current=api.ROOT;workspace=Path(tempfile.mkdtemp(prefix='sillage-upgrade-rollback-'));baseline=workspace/'v111';baseline.mkdir();archive=workspace/'v111.tar';subprocess.run(['git','archive','-o',str(archive),'bb25864082819775d6ce65d860cbe30806c01e54'],cwd=current,check=True);subprocess.run(['tar','-xf',str(archive),'-C',str(baseline)],check=True)
f=api.BudgetAPI();api.ROOT=baseline;f.setUp()
try:
 joint=f.account(balance=5000);card=f.account('credit',200);personal=f.account(balance=100)
 f.post('/api/accounts/inclusion',{'id':personal,'included':False})
 cid=next(c['id'] for c in f.get('/api/state')['categories'] if c['name']=='Transport');sid=f.make_subcategory(cid,'Essence');f.global74(cid,230,frequency='weekly',subcategory_id=sid)
 s=f.post('/api/envelopes',{'name':'Essence à protéger','reserved':100,'budget':100,'frequency':'weekly','start_on':f.future73(2),'rollover':True,'forecast_account_id':card,'forecast_spend':False});eid=s['envelopes'][0]['id']
 f.transaction(card,-35,description='Station',category_id=cid,subcategory_id=sid,envelope_id=eid)
 f.post('/api/recurring',{'description':'Paie','type':'income','amount':1500,'account_id':joint,'frequency':'biweekly','start_on':f.future73(3)})
 f.post('/api/recurring',{'description':'Internet','type':'expense','amount':75,'account_id':joint,'frequency':'monthly','start_on':f.future73(5)})
 f.post('/api/recurring',{'description':'Cadeau','type':'transfer','amount':50,'account_id':joint,'to_account_id':personal,'frequency':'monthly','one_time':True,'start_on':f.future73(4)})
 share=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/state');tables=f.get('/api/backup/export')['tables'];shared=f.get(share+'/data')
 def finances(state):return {k:state[k] for k in ['accounts','envelopes','transactions','recurring','forecast','planning','cash_cents','reserved_cents','safe_cents','spending_windows','card_payment_plans']}
 def highlow(state,n):
  points=[state['safe_cents']]+[r['safe_cents'] for r in state['forecast'][:n]];return min(points),max(points)
 def visible_daily(page):
  page.locator('#home-daily-open').click();d=page.locator('#home-daily-dialog');expect(d).to_be_visible();text=d.inner_text();d.get_by_role('button',name='Fermer',exact=True).click();return text
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v11.1.0');day_text=visible_daily(page)
  f.stop();api.ROOT=current
  # Keep the exact old app before installation, through the production snapshot function.
  subprocess.run(['node','--input-type=module','-e',"import {preserveRollbackRelease} from './mac-rollback.js';preserveRollbackRelease(process.argv[1],process.argv[2]);",str(baseline),str(f.dir/'data')],cwd=current,check=True)
  f.start();after=f.get('/api/state');assert finances(after)==finances(before);assert f.get('/api/backup/export')['tables']==tables;assert f.get(share+'/data')['daily']==shared['daily'];assert all(highlow(after,n)==highlow(before,n) for n in [30,60,90])
  page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+json.load(open(current/'package.json'))['version']);assert visible_daily(page)==day_text
  with sqlite3.connect(f.dir/'data'/'budget.sqlite') as db:assert db.execute('PRAGMA user_version').fetchone()[0]==1
  backups=list((f.dir/'data'/'backups').glob('budget-before-schema-v1-*.sqlite'));assert len(backups)==1
  with sqlite3.connect(backups[0]) as db:assert db.execute('PRAGMA user_version').fetchone()[0]==0;assert db.execute('SELECT balance_cents FROM accounts WHERE id=?',(joint,)).fetchone()[0]==500000
  # A real transaction after upgrading must survive code rollback.
  f.transaction(joint,-12.34,description='Après mise à jour',category_id=cid,subcategory_id=sid);latest=f.get('/api/state');latest_tables=f.get('/api/backup/export')['tables'];f.stop()
  api.ROOT=f.dir/'data'/'backups'/'sillage-v11.1.0-release';f.start();rolled=f.get('/api/state');assert rolled['version']=='11.1.0';assert finances(rolled)==finances(latest);assert f.get('/api/backup/export')['tables']==latest_tables;assert f.get(share+'/data')['daily']==[{'date':r['date'],'safe_cents':r['safe_cents']} for r in rolled['forecast']]
  page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v11.1.0');expect(page.locator('#home-daily-open')).to_be_visible();browser.close()
 print('PASS: all financial tables, 90-day forecast, 30/60/90 extrema, visible daily list and shared daily figures unchanged through migration; coherent pre-migration backup; return to actual pinned 11.1 code preserves a newly recorded transaction and its forecasts.')
finally:
 f.tearDown();api.ROOT=current;shutil.rmtree(workspace)
