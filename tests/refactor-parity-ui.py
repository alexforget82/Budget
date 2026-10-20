"""Compare the pinned 11.3 financial data and visible CSS against the refactored app."""
import importlib.util,json,shutil,subprocess,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
# Use a cumulative envelope: the intentional 11.4.2 correction for non-cumulative future protection is tested separately.
current=api.ROOT;work=Path(tempfile.mkdtemp(prefix='sillage-refactor-parity-'));baseline=work/'v113';baseline.mkdir();archive=work/'source.tar';subprocess.run(['git','archive','-o',str(archive),'731a58b68532e67ac9f63e6765752db34ee32d9c'],cwd=current,check=True);subprocess.run(['tar','-xf',str(archive),'-C',str(baseline)],check=True);api.ROOT=baseline;f=api.BudgetAPI();f.setUp()
try:
 aid=f.account(balance=5000);card=f.account('credit',200);cid=f.make_category('Budget de référence');f.global74(cid,230,frequency='weekly');f.post('/api/envelopes',{'name':'Épicerie de test','rollover':True,'reserved':100,'budget':230,'frequency':'weekly','start_on':f.future73(),'forecast_spend':False});f.post('/api/recurring',{'description':'Paie','amount':1168.05,'type':'income','account_id':aid,'frequency':'biweekly','start_on':f.future73(3)})
 for i in range(8):f.transaction(aid,-10-i,description='Achat '+str(i),category_id=cid)
 before=f.get('/api/backup/export')['tables'];financial=f.get('/api/state');samples={};differences=[]
 selector='.workspace-header,.app-shell-nav,.view-active,.view-active button,.view-active input,.view-active select,.view-active .v60-budget-row,.view-active .ledger-row,.view-active summary,.view-active h2,.view-active h3,.view-active strong'
 probe='''(selector)=>[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length).map((n,i)=>{const c=getComputedStyle(n);return {key:n.id||n.tagName+':'+n.className+':'+i,css:Object.fromEntries(['display','position','color','backgroundColor','fontSize','fontWeight','lineHeight','padding','margin','borderRadius','gridTemplateColumns'].map(k=>[k,c[k]]))}})'''
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def capture(version):
   page.goto(f.base);page.wait_for_function('typeof state!=="undefined"&&state&&state.accounts.length>0');page.add_style_tag(content='*{transition:none!important;animation:none!important}.save-notification{display:none!important}')
   for theme in ['light','dark']:
    page.set_viewport_size({'width':1440,'height':1000});page.get_by_label('Apparence',exact=True).select_option(theme)
    for width in [390,1440]:
     page.set_viewport_size({'width':width,'height':1000})
     for view in ['dashboard','transactions','budget','comptes','enveloppes','recurrences','prevision','calendrier','categories','bilan']:
      navigate(page,view);page.wait_for_timeout(100)
      if view=='budget':expect(page.locator('.v60-budget-row').first).to_be_visible()
      key=(theme,width,view);value=page.evaluate(probe,selector)
      if version=='before':samples[key]=value
      elif value!=samples[key]:differences.append({'view':list(key),'before':samples[key],'after':value})
   assert not errors,errors
  capture('before');f.stop();api.ROOT=current;f.start();capture('after');browser.close()
 after=f.get('/api/state');assert all(after[k]==financial[k] for k in ['forecast','accounts','envelopes','transactions','safe_cents','reserved_cents','planning'])
 after_tables=f.get('/api/backup/export')['tables'];assert all(after_tables[k]==v for k,v in before.items() if k!='app_settings')
 if differences:
  report=work/'differences.json';report.write_text(json.dumps(differences,indent=2));raise AssertionError(f'{len(differences)} visible-style differences; inspect {report}')
 print('PASS: 40 view/theme/width combinations retain identical visible computed styles; canonical 90-day forecasts, planning, accounts, reserves and ledger are identical to pinned 11.3. All comparisons use temporary data.')
finally:f.tearDown();api.ROOT=current
