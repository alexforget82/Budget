"""Weekly renewals remain visible when their incremental reservation is zero."""
import importlib.util, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 f.account(balance=1000)
 s=f.post('/api/envelopes',{'name':'Essence Alex','reserved':60,'budget':60,'frequency':'weekly','start_on':f.future73(2),'rollover':False,'forecast_spend':False})
 dates=[f.future73(n) for n in (2,9,16)]
 for i,date in enumerate(dates):
  d=next(d for d in s['forecast'] if d['date']==date)
  assert d['safe_cents']==100000-(i+1)*6000 and d['cash_cents']==100000
  assert len([e for e in d['events'] if e.get('envelope_renewal')])==1
 assert next(d for d in s['forecast'] if d['date']==dates[0])['events'][0]['amount_cents']==0
 before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+s['version']);navigate(page,'calendrier')
  for width in [1440,390]:
   page.set_viewport_size({'width':width,'height':1000})
   for date in dates:
    page.locator('#v41-calendar-month').fill(date[:7]);page.locator('#v41-calendar-month').dispatch_event('change')
    cell=page.locator(f'#v4-cal-grid [data-date="{date}"]');expect(cell).to_contain_text('Essence Alex');cell.click();panel=page.locator('#v4-calendar-day');expect(panel).to_contain_text('Essence Alex')
    if date==dates[0]:expect(panel).to_contain_text('Réserve inchangée');expect(panel).to_contain_text('Aucun montant supplémentaire à réserver')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors;browser.close()
 assert f.get('/api/backup/export')['tables']==before
 assert f.get('/api/state')['forecast']==s['forecast']
 print('PASS: three weekly envelope renewals visible on desktop/iPhone widths, zero incremental reserve explained, cash/forecast/ledger unchanged.')
finally:f.tearDown()
