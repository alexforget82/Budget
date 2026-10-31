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
 reference=state['simulation']['reference'];today=datetime.date.fromisoformat(reference);target=(today+datetime.timedelta(days=2)).isoformat()
 call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie test','amount':1000,'frequency':'weekly','start_on':(today+datetime.timedelta(days=6)).isoformat(),'day_adjust':'none'}],'bills':[{'name':'Facture calendrier','amount':53.98,'frequency':'monthly','start_on':target,'day_adjust':'none'}],'categories':[{'name':'Épicerie','limit':230,'period':'weekly','renewal_day':(today.weekday()+1)%7}]})
 call('/api/recurrence',{'name':'Facture en retard','kind':'expense','amount':5,'account_id':1,'frequency':'monthly','start_on':(today-datetime.timedelta(days=1)).isoformat(),'day_adjust':'none','one_time':True})
 initial=call('/api/export')['tables'];state=call('/api/state');first=reference[:7];last=state['simulation']['daily'][-1]['date'][:7];captures=Path(os.environ.get('BDL_CALENDAR_CAPTURES',tempfile.mkdtemp(prefix='bdl-calendar-captures-')));captures.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#plan');schedule=page.locator('.schedule');schedule.locator('summary').click()
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);month=schedule.get_by_label('Mois',exact=True);month.fill(target[:7]);schedule.get_by_role('button',name='Mois',exact=True).click();expect(schedule.locator('.calendar-grid')).to_be_visible()
    for d in state['simulation']['daily']:
     if d['date'].startswith(target[:7]):
      cell=schedule.locator('[data-calendar-date="'+d['date']+'"]');expected=page.evaluate('(n)=>new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD",maximumFractionDigits:2}).format(n/100)',d['safe_cents']);assert cell.locator('.calendar-balance').text_content()==expected
    cell=schedule.locator('[data-calendar-date="'+target+'"]');cell.click();expect(cell).to_have_attribute('aria-pressed','true');expect(schedule.locator('.calendar-day-detail')).to_have_attribute('data-date',target);expect(schedule.locator('.calendar-day-detail')).to_contain_text('Facture calendrier');expect(schedule.locator('.calendar-day-detail')).to_contain_text('53,98');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    schedule.get_by_role('button',name='Liste',exact=True).click();expect(schedule.locator('.calendar-grid')).to_have_count(0);assert schedule.locator('.calendar-list-day').count()==len([d for d in state['simulation']['daily'] if d['date'].startswith(target[:7])]);expect(schedule).to_contain_text('Facture calendrier');schedule.get_by_role('button',name='Mois',exact=True).click()
    if width in [390,1440]:schedule.screenshot(path=str(captures/f'calendar-{theme}-{width}.png'))
  month.fill(first);schedule.get_by_role('button',name='Mois',exact=True).click();expect(schedule.get_by_role('button',name='Mois précédent')).to_be_disabled();schedule.locator('[data-calendar-date="'+reference+'"]').click();expect(schedule.locator('.calendar-day-detail')).to_contain_text('Facture en retard');expect(schedule.locator('.calendar-day-detail')).to_contain_text('En retard');expect(schedule.locator('.calendar-day-detail')).to_contain_text('Renouvellement · Épicerie');expect(schedule.locator('.calendar-day-detail')).to_contain_text('sans débit bancaire')
  # Monday-first alignment and days outside the 90-day window.
  first_date=first+'-01';offset=datetime.date.fromisoformat(first_date).weekday();assert schedule.locator('.calendar-grid').evaluate('(g)=>Array.from(g.children).indexOf(g.querySelector("[data-calendar-date]"))')==7+offset
  for cell in schedule.locator('.calendar-cell:disabled').all():assert cell.locator('.calendar-balance').text_content()=='—'
  month.fill(last);schedule.get_by_role('button',name='Mois',exact=True).click();expect(schedule.get_by_role('button',name='Mois suivant')).to_be_disabled();assert call('/api/export')['tables']==initial
  # Pay through the selected day's existing action and keep the calendar open in the chosen month.
  month.fill(target[:7]);schedule.get_by_role('button',name='Mois',exact=True).click();schedule.locator('[data-calendar-date="'+target+'"]').click();schedule.locator('.calendar-day-detail').get_by_role('button',name='Payée',exact=True).click();expect(schedule).to_have_attribute('open','');expect(schedule.get_by_label('Mois',exact=True)).to_have_value(target[:7]);expect(schedule.locator('.calendar-day-detail')).not_to_contain_text('Facture calendrier');final=call('/api/state');assert len(final['transactions'])==1 and final['transactions'][0]['date']==reference and any(o['status']=='paid' for o in final['occurrence_states']);assert not errors,errors;browser.close()
 print('PASS: month/list, exact engine amounts, Monday alignment, horizon boundaries, overdue/renewals and existing payment action; 4 widths/2 themes. Captures:',captures)
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
