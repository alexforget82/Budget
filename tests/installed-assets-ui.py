"""Run the browser against the installed copy, not the development checkout."""
import importlib.util,subprocess,tempfile,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
source=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('api',source/'tests/api-tests.py');api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
with tempfile.TemporaryDirectory(prefix='sillage-install-browser-') as tmp:
 installed=Path(tmp)/'Application Support'/'Sillage'
 subprocess.run(['node','--input-type=module','-e',"import {copyReleaseFiles} from './mac-service.js';copyReleaseFiles(process.argv[1],process.argv[2]);",str(source),str(installed)],cwd=source,check=True)
 api.ROOT=installed;f=api.BudgetAPI();f.setUp()
 try:
  f.account();before=f.get('/api/backup/export')['tables']
  with sync_playwright() as p:
   browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1400,'height':1000});errors=[];failed=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('requestfailed',lambda r:failed.append(r.url) if r.failure!='net::ERR_ABORTED' else None);page.on('response',lambda r:failed.append(str(r.status)+' '+r.url) if r.status>=400 else None);page.goto(f.base+'/#dashboard');expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);expect(page.locator('#v80-safe')).not_to_have_text('—');assert page.locator('.sillage-logo').evaluate('e=>e.complete&&e.naturalWidth>0');assert page.locator('.app-shell-nav').evaluate('e=>getComputedStyle(e).position')=='fixed';page.get_by_role('button',name='Pourquoi ce montant ?',exact=True).click();expect(page.locator('#v81-explanation')).to_be_visible();assert not errors,errors;assert not failed,failed;browser.close()
  assert f.get('/api/backup/export')['tables']==before
  print('PASS: installed copy loads CSS, scripts and logo, displays real balances, opens the explanation and leaves the ledger unchanged.')
 finally:f.tearDown()
