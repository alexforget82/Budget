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
 reference=state['simulation']['reference'];today=datetime.date.fromisoformat(reference);yesterday=(today-datetime.timedelta(days=1)).isoformat();tomorrow=(today+datetime.timedelta(days=1)).isoformat()
 state=call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie','amount':1000,'frequency':'weekly','start_on':tomorrow,'day_adjust':'none'}],'categories':[{'name':'Épicerie','limit':230,'period':'weekly','renewal_day':(today.weekday()+1)%7}]});bank=state['accounts'][0]['id']
 for name,amount in [('Bell en retard',10),('Discord en retard',20)]:call('/api/recurrence',{'name':name,'kind':'expense','amount':amount,'account_id':bank,'frequency':'yearly','start_on':yesterday,'day_adjust':'none','one_time':True})
 captures=Path(os.environ.get('BDL_STATUS_CAPTURES',tempfile.mkdtemp(prefix='bdl-status-captures-')));captures.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA',accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#today');expect(page.locator('.balance-verified-note')).to_be_visible();expect(page.locator('.balance-verified-note')).to_contain_text('2026');expect(page.locator('.overdue-reminder')).to_contain_text('2 échéances en retard');expect(page.locator('.backup-summary .backup-date')).to_contain_text('Copie quotidienne locale')
  before=call('/api/export')['tables']
  with page.expect_download() as download_info:page.get_by_role('link',name='Télécharger une sauvegarde',exact=True).click()
  saved=Path(tmp.name)/'download.json';download_info.value.save_as(saved);assert json.loads(saved.read_text())['tables']==before;assert call('/api/export')['tables']==before
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    if width in [390,1440]:page.screenshot(path=str(captures/f'status-{theme}-{width}.png'),full_page=True)
  page.get_by_role('button',name='Traiter',exact=True).click();dialog=page.locator('#editor');row=dialog.locator('.schedule-row').filter(has_text='Bell en retard');row.get_by_role('button',name='Payée',exact=True).click();expect(dialog).not_to_be_visible();expect(page.locator('.overdue-reminder')).to_contain_text('1 échéance en retard');state=call('/api/state');assert len(state['transactions'])==1 and state['transactions'][0]['date']==reference;assert state['balance_verified_on']==reference
  page.get_by_role('button',name='Traiter',exact=True).click();dialog.get_by_role('button',name='Reporter',exact=True).click();expect(dialog.get_by_role('heading',name='Reporter Discord en retard')).to_be_visible();dialog.get_by_label('Nouvelle date',exact=True).fill(tomorrow);dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();expect(page.locator('.overdue-reminder')).to_have_count(0)
  call('/api/recurrence',{'name':'Hydro en retard','kind':'expense','amount':5,'account_id':bank,'frequency':'yearly','start_on':yesterday,'day_adjust':'none','one_time':True});share=call('/api/share',{'action':'create'})['result']['path'];before=call('/api/export')['tables'];page.goto(base+share);expect(page.locator('.balance-verified-note')).to_contain_text('2026');expect(page.locator('.overdue-reminder')).to_contain_text('Hydro en retard');assert page.get_by_role('button',name='Traiter',exact=True).count()==0;assert page.locator('.backup-summary').count()==0;assert page.get_by_role('link',name='Télécharger une sauvegarde',exact=True).count()==0;assert call('/api/export')['tables']==before;assert not errors,errors;browser.close()
 print('PASS: main balance date, real local-copy timestamp and actual JSON download, overdue pay/postpone shortcuts, shared readonly indicators; 4 widths/2 themes. Captures:',captures)
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
