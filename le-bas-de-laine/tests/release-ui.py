"""1.0 presentation, touch targets, compact-height dialogs and owner guide, fake budget."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];VERSION=json.loads((ROOT/'package.json').read_text())['version'];tmp=tempfile.TemporaryDirectory(prefix='bdl-release-ui-');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w')
server=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(Path(tmp.name)/'data'),'PORT':str(port)},stdout=log,stderr=log)
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
try:
 for _ in range(100):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 assert state['version']==VERSION;reference=state['simulation']['reference'];call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie','amount':1000,'start_on':reference,'frequency':'monthly','day_adjust':'none'}],'categories':[{'name':'Maison','limit':100,'period':'monthly','renewal_day':1}]});baseline=call('/api/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#today');expect(page.locator('.sidebar-bottom')).to_contain_text('Version '+VERSION);assert 'Version d’essai' not in page.locator('body').inner_text();expect(page.locator('.app-footer')).to_contain_text(VERSION);expect(page.locator('.forecast-definition')).to_contain_text('distinct du solde bancaire')
  for width,height in [(320,568),(390,844),(390,390),(768,900)]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':height});page.emulate_media(color_scheme=theme);page.locator('#new-transaction').click();dialog=page.locator('#editor');expect(dialog).to_be_visible();assert dialog.get_by_label('Description',exact=True).evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=16;assert dialog.get_by_role('button',name='Fermer',exact=True).evaluate('(e)=>e.getBoundingClientRect().height')>=44;assert dialog.locator('#editor-save').evaluate('(e)=>e.getBoundingClientRect().height')>=44
    dialog.evaluate('(e)=>e.scrollTop=e.scrollHeight');box=dialog.get_by_role('button',name='Fermer',exact=True).bounding_box();assert box['y']>=0 and box['y']+box['height']<=height;dialog.get_by_role('button',name='Fermer',exact=True).click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.goto(base+'/#plan');page.locator('.settings').get_by_text('Réglages et sauvegardes',exact=True).click();page.get_by_role('link',name='Guide d’utilisation',exact=True).click();expect(page).to_have_url(base+'/guide');expect(page.get_by_role('heading',name='Lire les montants',exact=True)).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.get_by_role('link',name='← Retour à l’application').click();expect(page.get_by_role('heading',name='Votre plan',exact=True)).to_be_visible();assert call('/api/export')['tables']==baseline
  share=call('/api/share',{'action':'create'})['result']['path'];page.goto(base+share);expect(page.locator('.app-footer')).to_contain_text(VERSION);assert not page.get_by_role('link',name='Guide d’utilisation').count();assert call(share+'/data')['simulation']==call('/api/state')['simulation'];assert not errors,errors;browser.close()
 print('PASS: 1.0 identity without trial labels, 16px controls and 44px buttons, compact-height sticky dialog close, readable forecast definition, owner guide/back link without writes, shared parity.')
finally:server.terminate();server.wait(timeout=5);log.close();tmp.cleanup()
