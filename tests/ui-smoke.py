from ui_navigation import navigate as navigate_view
import json,os,subprocess,tempfile,time,urllib.request,datetime,socket,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
base=f'http://127.0.0.1:{port}'
server=Path(__file__).resolve().parents[1]/'server.js'
artifacts=Path(tempfile.mkdtemp(prefix='budget-ui-captures-'))
def get(path):
 with urllib.request.urlopen(base+path) as r:return json.load(r)
def post(path,data):
 req=urllib.request.Request(base+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:return json.load(r)
def day(n):return (datetime.date.today()+datetime.timedelta(days=n)).isoformat()
with tempfile.TemporaryDirectory(prefix='budget-polish-') as d:
 log=open(d+'/server.log','w');proc=subprocess.Popen(['node',str(server)],cwd=d,env={**os.environ,'PORT':str(port)},stdout=log,stderr=log)
 try:
  for _ in range(50):
   try:s=get('/api/state');break
   except OSError:time.sleep(.1)
  s=post('/api/accounts',{'name':'Compte quotidien','kind':'checking','balance':2200});aid=s['accounts'][0]['id']
  post('/api/accounts',{'name':'Épargne projets','kind':'savings','balance':500})
  s=post('/api/envelopes',{'name':'Épicerie','reserved':300,'budget':400,'frequency':'monthly','start_on':day(20),'rollover':False,'active':True})
  for name,kind,amount,start,freq in [('Salaire','income',1800,4,'biweekly'),('Loyer','expense',900,7,'monthly'),('Internet','expense',85,10,'monthly'),('Assurance auto','expense',125,15,'monthly')]:
   s=post('/api/recurring',{'description':name,'type':kind,'amount':amount,'account_id':aid,'start_on':day(start),'frequency':freq,'day_adjust':'none','active':True})
  s=post('/api/transactions',{'account_id':aid,'amount':-42.75,'description':'Courses de la semaine','happened_on':day(0)})
  with sync_playwright() as p:
   browser_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser');b=p.chromium.launch(**({'executable_path':browser_path} if browser_path else {}));page=b.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.goto(base);page.wait_for_selector('.chart-dot');assert page.locator('.chart-dot').count()==30
   assert page.locator('.forecast-metrics').inner_text().count('$')==3
   minimum=min(x['safe_cents'] for x in s['forecast'][:30]);assert page.locator('.forecast-alert').is_hidden()
   selected=page.locator('.chart-dot[tabindex="0"]');selected.focus();page.keyboard.press('End');assert page.locator('.chart-dot').last.get_attribute('tabindex')=='0';assert s['forecast'][29]['date'][-2:] in page.locator('.chart-selection').inner_text()
   page.keyboard.press('Home');assert page.locator('.chart-dot').first.get_attribute('tabindex')=='0'
   page.locator('.chart-table summary').click();assert page.locator('.chart-table tbody tr').count()==30;page.locator('.chart-table summary').click()
   page.evaluate('scrollTo(0,0)');page.screenshot(path=str(artifacts/'desktop.png'),full_page=True)
   for view in ['comptes','transactions','enveloppes','recurrences','prevision','calendrier','virements','exceptions','bilan','importer','objectifs','sauvegardes','dashboard']:
    navigate_view(page,view);assert page.locator('#workspace-title').inner_text()==page.locator(f'[data-view="{view}"]').inner_text()
    for width in [390,1440]:
     page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(view,width)
   page.locator('#dashboard-envelopes').click();assert page.locator('#section-enveloppes').is_visible();navigate_view(page,'dashboard')
   page.locator('#dashboard-recurring').click();assert page.locator('#section-recurrences').is_visible();navigate_view(page,'dashboard')
   page.locator('#open-transaction').click();assert page.locator('#transaction-dialog').is_visible();page.locator('#close-transaction').click()
   for width in [375,390,768,1024,1440]:
    page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
   page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(artifacts/'mobile.png'),full_page=True)
   page.emulate_media(color_scheme='dark',reduced_motion='reduce');assert page.locator('body').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(245, 247, 243)'
   # Negative budget: use actual API input, then validate the warning against the response.
   s=post('/api/accounts/update',{'id':aid,'name':'Compte quotidien','balance':-1500,'kind':'checking','included':True})
   page.set_viewport_size({'width':1440,'height':1100});page.reload();page.wait_for_selector('.forecast-alert:not([hidden])');assert page.locator('.chart-dot.below-zero').count()>0
   page.screenshot(path=str(artifacts/'negative.png'),full_page=True)
   # Exercise both an API validation error and a successful save from the real modal.
   page.locator('#open-transaction').click()
   page.locator('#transaction [name="account_id"]').select_option(str(aid))
   page.locator('#transaction').evaluate('(form)=>form.noValidate=true')
   page.locator('#transaction [name="amount"]').fill('0')
   page.locator('#transaction [name="description"]').fill('Essai de validation')
   page.locator('#transaction').get_by_role('button',name='Enregistrer',exact=True).click()
   page.wait_for_selector('#transaction-dialog .form-feedback');assert page.locator('#transaction-dialog').is_visible()
   errors[:]=[e for e in errors if '400 (Bad Request)' not in e]
   before=get('/api/state')['accounts'];balance=next(a['balance_cents'] for a in before if a['id']==aid)
   page.locator('#transaction [name="amount"]').fill('5')
   page.locator('#transaction').get_by_role('button',name='Enregistrer',exact=True).click();page.wait_for_selector('#transaction-dialog',state='hidden');page.wait_for_selector('.save-notification:not([hidden])')
   assert next(a['balance_cents'] for a in get('/api/state')['accounts'] if a['id']==aid)==balance-500
   # Empty and constant data, and no forecast rows, are independent presentation cases.
   empty=get('/api/state');empty.update(accounts=[],envelopes=[],recurring=[],transactions=[],transfers=[],cash_cents=0,reserved_cents=0,safe_cents=0)
   for x in empty['forecast']:x.update(safe_cents=0,cash_cents=0,reserved_cents=0,events=[])
   page.route('**/api/state',lambda route:route.fulfill(json=empty));page.reload();page.wait_for_selector('#v2-envelope-progress .empty-state');assert page.locator('.chart-dot').count()==30
   page.locator('#v2-envelope-progress .empty-state button').click();assert page.locator('dialog[open]').is_visible();page.keyboard.press('Escape')
   page.locator('#dashboard-upcoming .empty-state button').click();assert page.locator('dialog[open]').is_visible();page.keyboard.press('Escape')
   assert not errors,errors
   print('PASS: modal API validation error stays visible; successful save closes modal, confirms status and changes balance by exactly 500 cents.')
   print('PASS: actual API fixtures; 30 chart points/table rows; keyboard Home/End; negative warning; empty/constant data; 13 screens; dashboard shortcuts; 3 dialogs; no page overflow at 375/390/768/1024/1440; dark preference and reduced motion; no JS/console errors.')
   print('Captures avec données fictives :',artifacts)
   b.close()
 finally:proc.terminate();proc.wait();log.close()
