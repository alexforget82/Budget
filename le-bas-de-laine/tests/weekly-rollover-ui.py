"""Real temporary SQLite, fixed test-only server dates, never the user's budget."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-roll-ui-');data=Path(tmp.name)/'data';clock=Path(tmp.name)/'clock.mjs';sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w');server=None
seed=f'''import {{openDatabase}} from {json.dumps((ROOT/'database.js').as_uri())};import {{createService}} from {json.dumps((ROOT/'service.js').as_uri())};const db=openDatabase({json.dumps(str(data))});const api=createService(db,()=> '2027-04-01');db.atomic(()=>api.setup({{balance:1000,paychecks:[{{name:'Paie',amount:1000,start_on:'2027-04-09',frequency:'weekly',day_adjust:'none'}}],categories:[{{name:'Épicerie',limit:230,period:'weekly',renewal_day:4}}]}}));db.atomic(()=>api.transaction({{account_id:1,category_id:1,amount:-180,date:'2027-04-01',description:'Épicerie passée'}}));db.run("INSERT INTO accounts(name,kind) VALUES('Carte','card')");db.db.close();'''
subprocess.run(['node','--input-type=module'],input=seed,text=True,check=True,stdout=subprocess.DEVNULL)
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
def start(date):
 global server
 if server is not None:server.terminate();server.wait(timeout=5)
 clock.write_text("const Original=Date;const value="+json.dumps(date+'T16:00:00Z')+";globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:[value]));}static now(){return Original.parse(value);}};")
 server=subprocess.Popen(['node','--import',str(clock),str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_UPDATE_CHECKS':'off','BDL_DATA':str(data),'PORT':str(port)},stdout=log,stderr=log)
 for _ in range(100):
  try:
   state=call('/api/state')
   if state['simulation']['reference']==date:return state
  except Exception:pass
  time.sleep(.05)
 raise RuntimeError('test server unavailable')
captures=Path(os.environ.get('BDL_ROLLOVER_CAPTURES',tempfile.mkdtemp(prefix='bdl-rollover-captures-')));captures.mkdir(parents=True,exist_ok=True)
try:
 state=start('2027-04-08');assert state['simulation']['categories'][0]['current']['carry_cents']==5000
 share=call('/api/share',{'action':'create'})['result']['path'];baseline=call('/api/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#today')
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);row=page.locator('.limit-overview-row').first;expect(row.locator('.limit')).to_contain_text('280,00');expect(row.locator('.remaining')).to_contain_text('280,00');expect(row.locator('.limit-carry')).to_contain_text('Report reçu : 50,00');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    if width in [390,1440]:row.screenshot(path=str(captures/f'rollover-{theme}-{width}.png'))
  page.goto(base+share);expect(page.locator('.limit-overview-row .remaining')).to_contain_text('280,00');page.get_by_role('button',name='Puis-je faire cet achat ?',exact=True).click();dialog=page.locator('#editor');dialog.get_by_label('Montant',exact=True).fill('50');dialog.locator('summary').click();dialog.get_by_label('Moyen de paiement',exact=True).select_option('2');dialog.get_by_label('Catégorie (si prévue dans une limite)',exact=True).select_option('1');dialog.get_by_role('button',name='Vérifier',exact=True).click();expected=call('/api/purchase/preview',{'amount':50,'account_id':2,'category_id':1});expect(dialog.locator('.purchase-result h2')).to_have_text('Oui' if expected['allowed'] else 'Non');dialog.get_by_role('button',name='Fermer',exact=True).click();assert call('/api/export')['tables']==baseline
  state=start('2027-05-01');page.reload();expect(page.locator('.limit-overview-row .limit')).to_contain_text('970,00');assert state['simulation']['categories'][0]['current']['date']=='2027-04-29'
  state=start('2027-05-06');page.reload();expect(page.locator('.limit-overview-row .remaining')).to_contain_text('230,00');expect(page.locator('.limit-overview-row .limit-carry')).to_have_count(0);assert state['simulation']['categories'][0]['current']['carry_cents']==0;assert state['simulation']['categories'][0]['limit_cents']==23000;assert not errors,errors;browser.close()
 print('PASS: actual same-month carry 50+230=280, no reset on day 1, reset to full allocation at new-month renewal, owner/shared parity and readonly purchase; 4 widths/2 themes.')
finally:
 if server is not None:server.terminate();server.wait(timeout=5)
 log.close();tmp.cleanup()
