"""Calendar fields in first-run and recurrence editing on desktop and phone."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-calendar-ui-');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w')
server=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_UPDATE_CHECKS':'off','BDL_DATA':str(Path(tmp.name)/'data'),'PORT':str(port)},stdout=log,stderr=log)
def call(url,data=None):
 req=urllib.request.Request(base+url,data=None if data is None else json.dumps(data).encode(),headers={} if data is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:return json.load(r)
try:
 for _ in range(80):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 reference=state['simulation']['reference'];today=datetime.date.fromisoformat(reference);firstpay=(today+datetime.timedelta(days=3)).isoformat();firstbill=(today+datetime.timedelta(days=1)).isoformat();moved=(today+datetime.timedelta(days=2)).isoformat();nextbill=(today+datetime.timedelta(days=8)).isoformat()
 state=call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie spéciale','amount':1000,'frequency':'weekly','start_on':firstpay,'day_adjust':'none'}],'bills':[{'name':'Facture variable','amount':20,'frequency':'weekly','start_on':firstbill,'day_adjust':'none'}],'categories':[{'name':'Épicerie','limit':230,'period':'weekly','renewal_day':(today.weekday()+1)%7}]});payrule=next(r for r in state['recurrences'] if r['kind']=='income')['id'];billrule=next(r for r in state['recurrences'] if r['kind']=='expense')['id'];captures=Path(os.environ.get('BDL_ONEOFF_CAPTURES',tempfile.mkdtemp(prefix='bdl-oneoff-captures-')));captures.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':900},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#today');dialog=page.locator('#editor')
  def event(name):return page.locator('.event').filter(has_text=name).first
  event('Paie spéciale').get_by_role('button',name='Modifier cette fois',exact=True).click();dialog.get_by_label('Montant prévu cette fois',exact=True).fill('500');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();state=call('/api/state');assert state['recurrences'][0]['amount_cents']==100000;assert len(state['transactions'])==0;assert next(o for o in state['simulation']['upcoming'] if o['rule_id']==payrule and o['original_on']==firstpay)['amount_cents']==50000
  event('Facture variable').get_by_role('button',name='Modifier cette fois',exact=True).click();dialog.get_by_label('Montant prévu cette fois',exact=True).fill('50');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();state=call('/api/state');assert len(state['transactions'])==0;assert next(o for o in state['simulation']['upcoming'] if o['rule_id']==billrule and o['original_on']==nextbill)['amount_cents']==2000
  event('Facture variable').get_by_role('button',name='Modifier cette fois',exact=True).click();dialog.get_by_role('button',name='Revenir au montant habituel',exact=True).click();expect(dialog).not_to_be_visible();assert next(o for o in call('/api/state')['simulation']['upcoming'] if o['rule_id']==billrule and o['original_on']==firstbill)['amount_cents']==2000
  event('Facture variable').get_by_role('button',name='Reporter',exact=True).click();dialog.get_by_label('Nouvelle date',exact=True).fill(moved);dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();event('Facture variable').get_by_role('button',name='Modifier cette fois',exact=True).click();dialog.get_by_label('Montant prévu cette fois',exact=True).fill('40');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();state=call('/api/state');o=next(o for o in state['simulation']['upcoming'] if o['rule_id']==billrule and o['original_on']==firstbill);assert o['date']==moved and o['amount_cents']==4000;assert len(state['transactions'])==0
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);event('Facture variable').get_by_role('button',name='Modifier cette fois',exact=True).click();expect(dialog.get_by_label('Montant prévu cette fois',exact=True)).to_have_value('40');assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if width in [390,1440]:dialog.screenshot(path=str(captures/f'oneoff-{theme}-{width}.png'))
    dialog.get_by_role('button',name='Fermer',exact=True).click()
  before=call('/api/state')['simulation']['available_cents'];event('Facture variable').get_by_role('button',name='Modifier cette fois',exact=True).click();dialog.get_by_role('button',name='Saisir le paiement réel…',exact=True).click();expect(dialog.get_by_role('heading',name='Payer Facture variable')).to_be_visible();expect(dialog.get_by_label('Montant réel',exact=True)).to_have_value('40');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();state=call('/api/state');assert len(state['transactions'])==1 and state['transactions'][0]['amount_cents']==-4000;assert state['simulation']['available_cents']==before
  page.goto(base+'/#plan');schedule=page.locator('.schedule');schedule.locator('summary').click();schedule.get_by_label('Mois',exact=True).fill(firstpay[:7]);schedule.get_by_role('button',name='Mois',exact=True).click();schedule.locator('[data-calendar-date="'+firstpay+'"]').click();schedule.locator('.calendar-day-detail').get_by_role('button',name='Modifier cette fois',exact=True).click();expect(dialog.get_by_label('Montant prévu cette fois',exact=True)).to_have_value('500');dialog.get_by_role('button',name='Fermer',exact=True).click()
  share=call('/api/share',{'action':'create'})['result']['path'];page.goto(base+share);assert page.get_by_role('button',name='Modifier cette fois',exact=True).count()==0;assert not errors,errors;browser.close()
 print('PASS: one-off income/expense, untouched next occurrence and base rule, no actual transaction until payment, reset, retained postponement, calendar access and readonly shared view; 4 widths/2 themes. Captures:',captures)
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
