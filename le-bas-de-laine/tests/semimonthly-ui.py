"""Two fixed dates in owner limits/bills, early-purchase period and readonly shared view."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-semi-ui-');data=Path(tmp.name)/'data';clock=Path(tmp.name)/'clock.mjs';sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w');server=None
seed=f'''import {{openDatabase}} from {json.dumps((ROOT/'database.js').as_uri())};import {{createService}} from {json.dumps((ROOT/'service.js').as_uri())};const db=openDatabase({json.dumps(str(data))});const api=createService(db,()=> '2026-11-01');db.atomic(()=>api.setup({{balance:1000,paychecks:[{{name:'Paie',amount:1000,start_on:'2026-11-25',frequency:'monthly',day_adjust:'none'}}],bills:[{{name:'Internet',amount:25,start_on:'2026-11-01',frequency:'monthly',day_adjust:'none'}}],categories:[{{name:'Maison',limit:150,period:'monthly',renewal_day:1}}]}}));db.db.close();'''
subprocess.run(['node','--input-type=module'],input=seed,text=True,check=True,stdout=subprocess.DEVNULL)
clock.write_text("const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-11-10T16:00:00Z']));}static now(){return Original.parse('2026-11-10T16:00:00Z');}};")
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
try:
 server=subprocess.Popen(['node','--import',str(clock),str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(data),'PORT':str(port)},stdout=log,stderr=log)
 for _ in range(100):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#plan');dialog=page.locator('#editor')
  row=page.locator('.rule').filter(has=page.get_by_role('heading',name='Maison',exact=True));row.get_by_role('button',name='Modifier',exact=True).click();dialog.get_by_label('Période',exact=True).select_option('semimonthly');dialog.get_by_label('Montant par renouvellement',exact=True).fill('75');dialog.get_by_label('Renouvellement',exact=True).select_option('1');dialog.get_by_label('Deuxième renouvellement',exact=True).select_option('15');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();state=call('/api/state');cat=state['categories'][0];assert cat['limit_cents']==7500 and cat['renewal_day2']==15;expect(row).to_contain_text('2 fois par mois')
  row.get_by_role('button',name='Modifier',exact=True).click();expect(dialog.get_by_label('Deuxième renouvellement',exact=True)).to_have_value('15');dialog.get_by_role('button',name='Fermer',exact=True).click()
  bill=page.locator('.rule').filter(has=page.get_by_role('heading',name='Internet',exact=True));bill.get_by_role('button',name='Modifier',exact=True).click();dialog.get_by_label('Fréquence',exact=True).select_option('semimonthly');dialog.get_by_label('Deuxième jour du mois',exact=True).select_option('15');expect(dialog.locator('.calendar-preview')).to_contain_text('15 nov. 2026');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();state=call('/api/state');rule=next(r for r in state['recurrences'] if r['name']=='Internet');assert rule['second_day']==15;expect(bill).to_contain_text('Deux fois par mois');assert call('/api/budget?month=2026-11')['expense']['planned_cents']==20000
  page.locator('#new-transaction').click();dialog.get_by_label('Catégorie',exact=True).select_option(str(cat['id']));expect(dialog.locator('[name=period_on]')).to_contain_text('15 nov.');dialog.get_by_role('button',name='Fermer',exact=True).click()
  share=call('/api/share',{'action':'create'})['result']['path'];assert call(share+'/data')['simulation']==call('/api/state')['simulation']
  for path in ['/#plan',share]:
   page.goto(base+path)
   for width in [320,390,768,1440]:
    for theme in ['light','dark']:
     page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(path,width,theme)
  # Initial setup supports the same second-day fields, with no hidden defaults lost.
  call('/api/reset',{'confirm':'EFFACER'});page.goto(base);page.get_by_label('Son solde réel aujourd’hui',exact=True).fill('1000');page.get_by_role('button',name='Continuer',exact=True).click()
  page.locator('[name=amount]').fill('1000');page.locator('[name=frequency]').select_option('semimonthly');page.locator('[name=start_on]').fill('2026-11-10');page.get_by_label('Deuxième jour du mois',exact=True).select_option('25');page.get_by_role('button',name='Continuer',exact=True).click()
  page.get_by_role('button',name='+ Une facture',exact=True).click();page.locator('[name=name]').fill('Téléphone');page.locator('[name=amount]').fill('25');page.locator('[name=frequency]').select_option('semimonthly');page.locator('[name=start_on]').fill('2026-11-10');page.get_by_label('Deuxième jour du mois',exact=True).select_option('25');page.get_by_role('button',name='Continuer',exact=True).click()
  item=page.locator('.setup-item').filter(has=page.get_by_role('checkbox',name='Épicerie',exact=True));item.locator('[name=period]').select_option('semimonthly');item.locator('[name=limit]').fill('50');item.locator('[name=renewal_day]').select_option('1');item.get_by_label('Deuxième renouvellement',exact=True).select_option('15')
  for name in ['Essence','Autres','Restaurant']:page.get_by_role('checkbox',name=name,exact=True).uncheck()
  page.get_by_role('button',name='Voir mon disponible',exact=True).click();expect(page.locator('.hero-amount')).to_be_visible();setup=call('/api/state');assert all(r['frequency']=='semimonthly' and r['second_day']==25 for r in setup['recurrences']);assert setup['categories'][0]['renewal_day2']==15
  assert not errors,errors;browser.close()
 print('PASS: two fixed days in limit/bill editors, saved values/preview, two monthly budget allocations and bills, early purchase next period, owner/shared parity; 4 widths/2 themes.')
finally:
 if server is not None:server.terminate();server.wait(timeout=5)
 log.close();tmp.cleanup()
