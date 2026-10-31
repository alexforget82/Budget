"""Calendar fields in first-run and recurrence editing on desktop and phone."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-calendar-ui-');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w')
server=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(Path(tmp.name)/'data'),'PORT':str(port)},stdout=log,stderr=log)
def call(url,data=None):
 req=urllib.request.Request(base+url,data=None if data is None else json.dumps(data).encode(),headers={} if data is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:return json.load(r)
try:
 for _ in range(80):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base);page.get_by_label('Son solde réel aujourd’hui',exact=True).fill('1000');page.get_by_role('button',name='Continuer',exact=True).click();page.locator('[name=amount]').fill('1000');page.locator('[name=start_on]').fill('2027-01-12');page.locator('[name=frequency]').select_option('last_day');page.locator('[name=day_adjust]').select_option('after');expect(page.locator('.calendar-preview')).to_contain_text('1 févr. 2027');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.get_by_role('button',name='Continuer',exact=True).click();page.get_by_role('button',name='Continuer',exact=True).click();page.get_by_role('button',name='Voir mon disponible',exact=True).click();expect(page.locator('.hero-amount')).to_be_visible();state=call('/api/state');rule=state['recurrences'][0];assert rule['frequency']=='last_day' and rule['day_adjust']=='after'
  for width in [320,390,768,1440]:
   page.set_viewport_size({'width':width,'height':900});page.locator(('.bottom-nav' if width<=800 else '.sidebar')+' [data-page=plan]').click();page.locator('.plan-grid>section.panel').first.get_by_role('button',name='Modifier',exact=True).first.click();dialog=page.locator('#editor');expect(dialog.locator('[name=day_adjust]')).to_have_value('after');expect(dialog.locator('.calendar-preview')).to_contain_text('1 févr. 2027');dialog.locator('[name=frequency]').select_option('last_business_day');expect(dialog.locator('.calendar-preview')).to_contain_text('29 janv. 2027');dialog.locator('[name=frequency]').select_option('monthly');dialog.locator('[name=start_on]').fill('2027-01-31');dialog.locator('[name=day_adjust]').select_option('before');expect(dialog.locator('.calendar-preview')).to_contain_text('29 janv. 2027');assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();saved=call('/api/state')['recurrences'][0];assert saved['day_adjust']=='before';
   # Restore the rule for the next viewport without relying on browser cache.
   call('/api/recurrence',{**saved,'amount':saved['amount_cents']/100,'frequency':'last_day','start_on':'2027-01-12','day_adjust':'after'});page.reload();expect(page.locator('main')).not_to_be_empty()
  assert not errors,errors;browser.close()
 print('PASS: calendar options in wizard and editor, live read-only previews, month end vs business month end, saved adjustment, 320/390/768/1440 widths.')
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
