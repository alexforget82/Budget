"""Remove limits and recurring bills, preserve history; fictional temporary data only."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-window-');data=Path(tmp.name)/'data';clock=Path(tmp.name)/'clock.mjs';sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w');server=None
seed=f'''import {{openDatabase}} from {json.dumps((ROOT/'database.js').as_uri())};import {{createService}} from {json.dumps((ROOT/'service.js').as_uri())};const db=openDatabase({json.dumps(str(data))});const api=createService(db,()=> '2026-11-01');db.atomic(()=>api.setup({{balance:1000,paychecks:[{{name:'Paie',amount:1000,start_on:'2026-11-08',frequency:'monthly',day_adjust:'none'}}],bills:[{{name:'Facture',amount:500,start_on:'2026-11-04',frequency:'monthly',day_adjust:'none',one_time:true}}],categories:[{{name:'Maison',limit:100,period:'monthly',renewal_day:1}}]}}));db.atomic(()=>api.recurrence({{name:'Allocation',kind:'income',amount:100,account_id:1,start_on:'2026-11-02',frequency:'monthly',day_adjust:'none',one_time:true}}));db.atomic(()=>api.category({{name:'Épicerie',limit:50,period:'weekly',renewal_day:4,starts_on:'2026-11-05'}}));db.db.close();'''
subprocess.run(['node','--input-type=module'],input=seed,text=True,check=True,stdout=subprocess.DEVNULL)
clock.write_text("const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-11-01T16:00:00Z']));}static now(){return Original.parse('2026-11-01T16:00:00Z');}};")
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
try:
 server=subprocess.Popen(['node','--import',str(clock),str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(data),'PORT':str(port)},stdout=log,stderr=log)
 for _ in range(100):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 sim=state['simulation'];assert sim['available_cents']==90000;assert sim['spending_30']['amount_cents']==45000
 share=call('/api/share',{'action':'create'})['result']['path'];baseline=call('/api/export')['tables'];assert call(share+'/data')['simulation']==call('/api/state')['simulation']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  for path in ['/#today',share]:
   page.goto(base+path);expect(page.locator('.hero-amount')).to_contain_text('450,00');expect(page.locator('.hero-caption')).to_contain_text('Minimum sur 30 jours');expect(page.locator('.before-income-detail summary')).to_contain_text('900,00')
   page.locator('.limits-breakdown summary').click();expect(page.locator('.limits-explanation')).to_contain_text('150,00');expect(page.locator('.limits-explanation')).to_contain_text('5 nov.')
   for index,day in enumerate(sim['daily'][:30]):
    page.locator('[name=forecast_day]').fill(str(index));expect(page.locator('.forecast-selected-summary')).to_have_attribute('data-date',day['date'])
    actual=page.locator('.forecast-selected-amount').inner_text();number=''.join(c for c in actual if c.isdigit() or c in ',-−').replace('−','-').replace(',','.')
    assert round(float(number)*100)==day['safe_cents'],(path,index,actual,day['safe_cents'])
   for width in [320,390,768,1440]:
    for theme in ['light','dark']:
     page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(path,width,theme)
  assert call('/api/export')['tables']==baseline
  page.goto(base+'/#plan');dialog=page.locator('#editor')
  limit=page.locator('.rule').filter(has=page.get_by_role('heading',name='Épicerie',exact=True));limit.get_by_role('button',name='Supprimer la limite',exact=True).click();expect(dialog).to_contain_text('La catégorie et ses transactions seront conservées');dialog.get_by_role('button',name='Fermer',exact=True).click();expect(limit).to_be_visible()
  limit.get_by_role('button',name='Modifier',exact=True).click();dialog.get_by_role('button',name='Supprimer la limite',exact=True).click();dialog.locator('#editor-save').click();expect(dialog).not_to_be_visible();expect(limit).to_have_count(0);updated=call('/api/state');cat=next(c for c in updated['categories'] if c['name']=='Épicerie');assert cat['limit_cents'] is None
  bill=page.locator('.rule').filter(has=page.get_by_role('heading',name='Facture',exact=True));bill.get_by_role('button',name='Modifier',exact=True).click();dialog.get_by_role('button',name='Supprimer la facture',exact=True).click();expect(dialog).to_contain_text('paiements déjà enregistrés seront conservés');dialog.locator('#editor-save').click();expect(dialog).not_to_be_visible();expect(bill).to_have_count(0);state=call('/api/state');assert not any(e['name']=='Facture' for d in state['simulation']['daily'] for e in d['events'])
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.reload();expect(bill).to_have_count(0);expect(limit).to_have_count(0);after=call('/api/export')['tables'];assert after['transactions']==baseline['transactions'];assert after['checkpoints']==baseline['checkpoints'];assert after['occurrence_states']==baseline['occurrence_states']
  assert not errors,errors;browser.close()
 print('PASS: limit and bill deletion from list/editor, confirmation/cancel, preserved category/history, refreshed projection and persistent disappearance; responsive owner/shared views.')
finally:
 if server is not None:server.terminate();server.wait(timeout=5)
 log.close();tmp.cleanup()
