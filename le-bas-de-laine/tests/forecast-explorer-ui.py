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
 reference=state['simulation']['reference'];today=datetime.date.fromisoformat(reference);billday=(today+datetime.timedelta(days=4)).isoformat();far=(today+datetime.timedelta(days=89)).isoformat()
 state=call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie test','amount':2000,'frequency':'weekly','start_on':(today+datetime.timedelta(days=10)).isoformat(),'day_adjust':'none'}],'bills':[{'name':'Bell','amount':53.98,'frequency':'monthly','start_on':billday,'day_adjust':'none'},{'name':'Discord Nitro','amount':20,'frequency':'monthly','start_on':billday,'day_adjust':'none'}],'categories':[{'name':'Épicerie','limit':230,'period':'weekly','renewal_day':(today.weekday()+1)%7}]})
 call('/api/recurrence',{'name':'Facture lointaine','kind':'expense','amount':100000,'account_id':1,'frequency':'yearly','start_on':far,'day_adjust':'none','one_time':True});share=call('/api/share',{'action':'create'})['result']['path'];state=call('/api/state');baseline=call('/api/export')['tables'];daily=state['simulation']['daily'];window=daily[:30];minimum=min(range(len(window)),key=lambda i:window[i]['safe_cents']);captures=Path(os.environ.get('BDL_FORECAST_CAPTURES',tempfile.mkdtemp(prefix='bdl-forecast-captures-')));captures.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));context=browser.new_context(locale='fr-CA',has_touch=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#today');explorer=page.locator('.forecast-explorer');slider=explorer.get_by_label('Choisir une date',exact=True)
  def choose(i):slider.evaluate('(el,i)=>{el.value=String(i);el.dispatchEvent(new Event("input",{bubbles:true}));}',i)
  def check(i):
   expected=page.evaluate('(n)=>new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD",maximumFractionDigits:2}).format(n/100)',window[i]['safe_cents']);expect(explorer.locator('.forecast-selected-summary')).to_have_attribute('data-date',window[i]['date']);expect(explorer.locator('.forecast-selected-amount')).to_have_text(expected);expect(explorer.locator('svg')).to_have_attribute('data-selected-date',window[i]['date'])
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);expect(slider).to_have_attribute('max','29')
    for i in range(30):choose(i);check(i)
    choose(4);expect(explorer.locator('.forecast-day-detail')).to_contain_text('Bell');expect(explorer.locator('.forecast-day-detail')).to_contain_text('Discord Nitro');assert 'Facture lointaine' not in explorer.inner_text();expect(page.locator('.forecast-message')).to_contain_text('Facture lointaine');explorer.get_by_role('button',name='Minimum :',exact=False).click();check(minimum)
    choose(0);expect(explorer.locator('.forecast-day-detail')).to_contain_text('Renouvellement · Épicerie');expect(explorer.locator('.forecast-day-detail')).to_contain_text('sans débit bancaire');slider.focus();slider.press('ArrowRight');check(1);slider.press('End');check(29);slider.press('Home');check(0)
    graph=explorer.locator('svg');box=graph.bounding_box();graph.click(position={'x':box['width']*.97,'y':box['height']*.5});check(29);choose(0);graph.tap(position={'x':box['width']*.97,'y':box['height']*.5});check(29);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    if width in [390,1440]:page.locator('.minimum').screenshot(path=str(captures/f'forecast-{theme}-{width}.png'))
  choose(4);page.locator('#refresh').click();expect(explorer.locator('.forecast-selected-summary')).to_have_attribute('data-date',window[4]['date'])
  # The simple shared page uses the identical readonly explorer and exact amounts.
  page.goto(base+share);choose(4);check(4);expect(page.locator('#new-transaction')).not_to_be_visible();assert page.get_by_role('button',name='Payée',exact=True).count()==0;assert call('/api/export')['tables']==baseline;assert not errors,errors;context.close();browser.close()
 print('PASS: all 30 exact daily values, bill details, protected limits, 90-day warning, minimum jump, keyboard/pointer, shared parity, no writes; 4 widths/2 themes. Captures:',captures)
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
