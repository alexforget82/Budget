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
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base)
  expect(page.locator('.tutorial-card')).to_be_visible();expect(page.locator('.tutorial-card')).to_contain_text('Partir du solde réel');page.get_by_label('Son solde réel aujourd’hui',exact=True).fill('1000');page.get_by_role('button',name='Masquer l’aide',exact=True).click();expect(page.locator('.tutorial-card')).not_to_be_visible();expect(page.get_by_label('Son solde réel aujourd’hui',exact=True)).to_have_value('1000');page.get_by_role('button',name='Afficher le tutoriel',exact=True).click();expect(page.locator('.tutorial-card')).to_be_visible();expect(page.get_by_label('Son solde réel aujourd’hui',exact=True)).to_have_value('1000')
  page.get_by_role('button',name='Continuer',exact=True).click();expect(page.locator('.tutorial-card')).to_contain_text('prochaines paies');page.locator('[name=amount]').fill('1000');page.locator('[name=start_on]').fill((datetime.date.fromisoformat(state['simulation']['reference'])+datetime.timedelta(days=7)).isoformat());page.get_by_role('button',name='Continuer',exact=True).click();expect(page.locator('.tutorial-card')).to_contain_text('factures fixes');page.get_by_role('button',name='Continuer',exact=True).click();expect(page.locator('.tutorial-card')).to_contain_text('dépenses variables');page.get_by_role('button',name='Voir mon disponible',exact=True).click();expect(page.locator('.hero-amount')).to_be_visible();baseline=call('/api/export')['tables']
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);page.get_by_role('button',name='Tutoriel',exact=True).click();dialog=page.locator('#editor');expect(dialog.locator('.tutorial-card')).to_contain_text('Partir du solde réel');dialog.get_by_role('button',name='Suivant',exact=True).click();dialog.get_by_role('button',name='Précédent',exact=True).click();expect(dialog.locator('.tutorial-card')).to_contain_text('Partir du solde réel')
    for _ in range(4):dialog.get_by_role('button',name='Suivant',exact=True).click()
    expect(dialog.locator('.tutorial-card')).to_contain_text('quotidien');assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dialog.get_by_role('button',name='Terminer',exact=True).click();expect(dialog).not_to_be_visible()
  page.locator('.sidebar [data-page=plan]').click();page.get_by_role('button',name='Tutoriel',exact=True).click();page.locator('#editor').get_by_role('button',name='Fermer',exact=True).click();assert call('/api/export')['tables']==baseline;assert not errors,errors;browser.close()
 print('PASS: automatic contextual tutorial in all 4 setup steps; hiding preserves inputs; replay and early exit are read-only at 4 widths/2 themes.')
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
