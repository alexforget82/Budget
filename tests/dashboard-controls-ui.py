"""Dashboard overflow, settings ownership, chart extremes and read-only navigation."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme,header_action,dashboard_control
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-v141-'))
try:
 bank=f.account(balance=2450.32);f.post('/api/accounts/update',{'id':bank,'name':'Conjoint','kind':'checking','balance':2450.32,'included':True});f.post('/api/setup/scope',{'account_id':bank})
 f.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':api.DAY,'rollover':False,'forecast_spend':False})
 for name,amount,kind,offset,frequency in [('Paie',1168.05,'income',3,'biweekly'),('Hydro',90.53,'expense',2,'monthly'),('Assurance',85,'expense',8,'monthly')]:f.post('/api/recurring',{'description':name,'amount':amount,'type':kind,'account_id':bank,'frequency':frequency,'start_on':f.future73(offset)})
 before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');page.set_default_timeout(10000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base)
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,768,1440]:
    page.set_viewport_size({'width':width,'height':1000});navigate(page,'dashboard');page.evaluate('scrollTo(0,0)')
    tools=page.locator('#s26-tools')
    if tools.get_attribute('open') is not None and tools.locator(':scope>summary').is_visible():tools.locator(':scope>summary').click()
    head=page.locator('#v80-hero .v80-panel-head');menu=page.locator('#dashboard-more');summary=menu.locator(':scope>summary')
    expect(menu).not_to_have_attribute('open','');expect(head.locator('#home-daily-open')).to_be_visible();expect(head.locator('#dashboard-more')).to_be_visible();expect(page.locator('.v41-header-tools')).not_to_be_visible();expect(page.get_by_label('Apparence',exact=True)).not_to_be_visible()
    expect(page.locator('.v70-scope-note')).to_contain_text('Disponible à dépenser : Conjoint uniquement')
    for horizon in [30,60,90]:
     head.locator(f'[data-horizon="{horizon}"]').click();values=[state['safe_cents']]+[d['safe_cents'] for d in state['forecast'][:horizon]];svg=page.locator('.dashboard-chart')
     expect(svg.locator('.dashboard-chart-axis')).to_have_count(3)
     assert int(svg.locator('[data-extreme=low]').get_attribute('data-value'))==min(values)
     assert int(svg.locator('[data-extreme=high]').get_attribute('data-value'))==max(values)
     assert len(svg.locator('polyline').get_attribute('points').split())==horizon+1
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
    if width in [390,1440]:page.screenshot(path=str(images/f'dashboard-{theme}-{width}.png'),full_page=width==1440)
    summary.click();expect(page.get_by_role('button',name='Rechercher…',exact=True)).to_be_visible();expect(page.locator('#home-mode')).to_be_visible()
    box=menu.locator('.dashboard-more-body').bounding_box();assert box['x']>=15 and box['x']+box['width']<=width-15,(width,box)
    assert page.locator('#v80-hero').evaluate('(e)=>getComputedStyle(e).overflow')=='visible'
    if width in [390,1440]:page.screenshot(path=str(images/f'plus-{theme}-{width}.png'))
    page.keyboard.press('Escape');expect(menu).not_to_have_attribute('open','');expect(summary).to_be_focused()
    header_action(page,'Rechercher…');expect(page.locator('#v41-search')).to_be_visible();page.locator('#v41-search').get_by_role('button',name='Fermer',exact=True).click()
    page.keyboard.press('Control+k');expect(page.locator('#v41-search')).to_be_visible();page.keyboard.press('Escape');expect(page.locator('#v41-search')).not_to_be_visible()
    page.locator('#home-daily-open').click();expect(page.locator('#home-daily-dialog')).to_be_visible();page.locator('#home-daily-dialog').get_by_role('button',name='Fermer',exact=True).click()
    # Responsive navigation must not steal the controls back into the old header.
    navigate(page,'transactions');set_theme(page,theme);assert page.locator('#v141-settings .life-appearance').count()==1;assert page.locator('#v141-settings .sillage-health').count()==1
    header_action(page,'Rechercher…');expect(page.locator('#v41-search')).to_be_visible();page.locator('#v41-search').get_by_role('button',name='Fermer',exact=True).click()
    navigate(page,'dashboard');dashboard_control(page,'home-mode');dashboard_control(page,'home-mode');expect(page.locator('#v80-hero .v80-panel-head #dashboard-more')).to_have_count(1)
  after=f.get('/api/backup/export')['tables'];assert all(before[t]==after[t] for t in before if t!='app_settings');assert f.get('/api/state')['forecast']==state['forecast'];assert not errors,errors
  # A flat forecast still has a readable scale and one combined extreme marker.
  for rule in state['recurring']:f.post('/api/recurring/delete',{'id':rule['id']})
  for envelope in state['envelopes']:f.post('/api/envelopes/delete',{'id':envelope['id']})
  page.reload();expect(page.locator('.dashboard-chart [data-extreme=both]')).to_have_count(1);assert 'NaN' not in page.locator('.dashboard-chart polyline').get_attribute('points');assert not errors,errors;browser.close()
 print('PASS: overflow/settings placement, escape/focus, search/daily/detailed navigation, 30/60/90 axis and canonical extremes, four widths/two themes, unchanged financial tables and forecasts. Captures:',images)
finally:f.tearDown()
