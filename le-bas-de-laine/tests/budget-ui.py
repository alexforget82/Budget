"""Budget comparisons on fixed fictional dates; never a user's database."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-budget-ui-');data=Path(tmp.name)/'data';clock=Path(tmp.name)/'clock.mjs';sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w');server=None
seed=f'''import {{openDatabase}} from {json.dumps((ROOT/'database.js').as_uri())};import {{createService}} from {json.dumps((ROOT/'service.js').as_uri())};const db=openDatabase({json.dumps(str(data))});const api=createService(db,()=> '2027-01-01');const telecom=api.category({{name:'Télécommunications'}});db.atomic(()=>api.setup({{balance:1000,paychecks:[{{name:'Salaire Alex',amount:1168.05,start_on:'2027-01-01',frequency:'biweekly',day_adjust:'none'}}],bills:[{{name:'Internet',amount:100,start_on:'2027-01-04',frequency:'monthly',day_adjust:'none',category_id:telecom}}],categories:[{{name:'Épicerie',limit:230,period:'weekly',renewal_day:5}}]}}));const late=createService(db,()=> '2027-01-10');db.atomic(()=>late.occurrence({{rule_id:1,original_on:'2027-01-01',action:'pay',date:'2027-01-01'}}));db.atomic(()=>late.transaction({{account_id:1,category_id:2,amount:-180,date:'2027-01-02',description:'Épicerie'}}));db.atomic(()=>late.occurrence({{rule_id:2,original_on:'2027-01-04',action:'pay',date:'2027-01-04',amount:120}}));const card=Number(db.run("INSERT INTO accounts(name,kind) VALUES('Carte','card')").lastInsertRowid);db.atomic(()=>late.recurrence({{name:'Paiement carte',kind:'transfer',account_id:1,to_account_id:card,amount:200,start_on:'2027-01-20',frequency:'monthly',day_adjust:'none'}}));db.atomic(()=>late.transfer({{from_account_id:1,to_account_id:card,amount:50,date:'2027-01-05',description:'Paiement carte'}}));db.db.close();'''
subprocess.run(['node','--input-type=module'],input=seed,text=True,check=True,stdout=subprocess.DEVNULL)
clock.write_text("const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2027-01-10T16:00:00Z']));}static now(){return Original.parse('2027-01-10T16:00:00Z');}};")
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
captures=Path(os.environ.get('BDL_BUDGET_CAPTURES',tempfile.mkdtemp(prefix='bdl-budget-captures-')));captures.mkdir(parents=True,exist_ok=True)
try:
 server=subprocess.Popen(['node','--import',str(clock),str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(data),'PORT':str(port)},stdout=log,stderr=log)
 for _ in range(100):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 before=call('/api/export')['tables'];projection=state['simulation']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#plan');budget=page.locator('.budget-report');budget.locator('summary').click();expect(budget.locator('.budget-table')).to_be_visible()
  pay=budget.locator('.budget-row').filter(has_text='Salaire Alex');grocery=budget.locator('.budget-row').filter(has_text='Épicerie');internet=budget.locator('.budget-row').filter(has_text='Télécommunications')
  expect(pay).to_contain_text('3 versements');expect(pay).to_contain_text('3 504,15');expect(grocery).to_contain_text('5 allocations');expect(grocery).to_contain_text('1 150,00');expect(internet.locator('.negative')).to_contain_text('20,00');expect(budget.locator('.budget-carry')).to_contain_text('50,00');expect(budget).to_contain_text('Virements à part');assert budget.locator('input[type=number]').count()==0
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    if width in [390,1440]:budget.screenshot(path=str(captures/f'budget-{theme}-{width}.png'))
  month=budget.get_by_label('Mois',exact=True);month.fill('2027-02');expect(pay).to_contain_text('2 versements');expect(pay).to_contain_text('2 336,10');expect(grocery).to_contain_text('4 allocations');expect(grocery).to_contain_text('920,00');assert 'reports futurs' in budget.inner_text().lower()
  budget.get_by_role('button',name='Budget : mois précédent').click();expect(month).to_have_value('2027-01');expect(pay).to_contain_text('3 versements');assert call('/api/export')['tables']==before;assert call('/api/state')['simulation']==projection
  # Classification is optional; existing category selection is visible when a rule has one.
  rule=page.locator('.rule').filter(has=page.get_by_role('heading',name='Internet',exact=True));rule.get_by_role('button',name='Modifier',exact=True).click();dialog=page.locator('#editor');expect(dialog.get_by_label('Catégorie de la règle',exact=True)).to_have_value('1');dialog.get_by_role('button',name='Fermer',exact=True).click();assert call('/api/export')['tables']==before
  assert not errors,errors;browser.close()
 print('PASS: monthly category budget, 3/2 paychecks, 5/4 allocations, actual variance, separate carry/transfers, optional categories and identical financial projection/tables; 4 widths/2 themes. Captures:',captures)
finally:
 if server is not None:server.terminate();server.wait(timeout=5)
 log.close();tmp.cleanup()
