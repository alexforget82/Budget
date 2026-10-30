"""Approved v13 presentation on live temporary financial data, never the user's database."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import dashboard_control,edit_envelope,navigate,set_theme,manage_envelope,detailed_dashboard
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-v13-'))
try:
 aid=f.account(balance=2450.32);f.post('/api/setup/scope',{'account_id':aid});card=f.account('credit',100)
 s=f.post('/api/envelopes',{'name':'Épicerie','reserved':230,'budget':230,'frequency':'weekly','start_on':api.DAY,'rollover':False,'forecast_spend':False});eid=s['envelopes'][0]['id']
 f.post('/api/envelopes',{'name':'Restaurant','reserved':125,'budget':125,'frequency':'monthly','start_on':api.DAY,'rollover':True,'forecast_spend':False})
 f.post('/api/recurring',{'description':'Apple One','amount':53.98,'type':'expense','account_id':card,'frequency':'monthly','start_on':api.DAY})
 f.post('/api/recurring',{'description':'Paie Alex','amount':1168.05,'type':'income','account_id':aid,'frequency':'biweekly','start_on':f.future73(2)})
 f.transaction(card,-50,description='Marché de la semaine',envelope_id=eid)
 path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v16.1.0');expect(page.locator('#v13-home-grid')).to_be_visible()
  def cash(c):return page.evaluate('(n)=>new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(n/100)',c)
  expect(page.locator('#v80-safe')).to_have_text(cash(state['safe_cents']))
  expect(page.locator('#v13-equation')).to_contain_text(cash(state['cash_cents']));expect(page.locator('#v13-equation>div strong').nth(1)).to_have_text(cash(-state['envelope_reserved_cents']));assert state['cash_cents']-state['envelope_reserved_cents']-state['card_envelope_reserved_cents']-state['credit_reserved_cents']==state['safe_cents']
  expect(page.locator('.v13-recent')).to_contain_text('Marché de la semaine')
  for days in [30,60,90,30]:
   page.locator(f'#v80-hero [data-horizon="{days}"]').click();values=[state['safe_cents']]+[d['safe_cents'] for d in state['forecast'][:days]]
   expect(page.locator('.v13-extremes strong').first).to_have_text(cash(min(values)));expect(page.locator('.v13-extremes strong').last).to_have_text(cash(max(values)));expect(page.locator('#v80-safe')).to_have_text(cash(state['safe_cents']))
  page.locator('#v14-calculation > summary').click();page.locator('#v13-equation button').click();expect(page.locator('dialog[open]')).to_be_visible();page.keyboard.press('Escape')
  detailed_dashboard(page);expect(page.locator('#v13-home-grid')).to_be_hidden();expect(page.locator('#v80-hero .v80-spark')).to_have_count(1);dashboard_control(page,'home-mode');expect(page.locator('#v13-home-grid .v80-spark')).to_have_count(1)
  for theme in ['dark','light']:
   set_theme(page,theme)
   for width in [320,375,390,430,768,1024,1440,1920]:
    page.set_viewport_size({'width':width,'height':844 if width<768 else 1000})
    for view in ['dashboard','enveloppes','budget','transactions','prevision','calendrier','comptes','recurrences','sauvegardes']:
     navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme,view)
    navigate(page,'dashboard')
    if width>=1100:assert page.locator('#app-version').bounding_box()['y']<1000
    if width in [390,1440]:page.screenshot(path=str(images/f'dashboard-{theme}-{width}.png'),full_page=width==1440)
    navigate(page,'enveloppes');expect(page.locator('.v13-envelope-detail[open]')).to_have_count(0)
    if width<=760:assert page.locator('#envelopes .envelope-tile').first.bounding_box()['y']<780,(width,theme,'first envelope priority')
    page.locator('#v13-envelope-search').fill('epicerie');expect(page.locator('#envelopes .envelope-tile:visible')).to_have_count(1);page.locator('#v13-envelope-search').fill('introuvable');expect(page.locator('.v13-empty')).to_be_visible();page.locator('#v13-envelope-search').fill('')
    page.locator('.v13-filters [data-frequency=weekly]').click();expect(page.locator('#envelopes .envelope-tile:visible')).to_have_count(1);page.locator('.v13-filters [data-frequency=monthly]').click();expect(page.locator('#envelopes .envelope-tile:visible')).to_have_count(1);page.locator('.v13-filters [data-frequency=all]').click()
    if width in [390,1440]:page.screenshot(path=str(images/f'enveloppes-{theme}-{width}.png'),full_page=width==1440)
    tile=manage_envelope(page,eid);expect(tile.locator('.v81-envelope-facts')).to_be_visible();edit_envelope(page,eid);expect(page.locator('#envelope')).to_be_visible();page.keyboard.press('Escape');tile.locator('.v13-envelope-detail>summary').click()
  after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings')
  # A refreshed state cannot duplicate or expand the compact management details.
  f.transaction(aid,-1,description='Achat après rafraîchissement');navigate(page,'dashboard');page.locator('#home-refresh').click() if page.locator('#home-refresh').count() else page.reload();navigate(page,'enveloppes');expect(page.locator('#envelopes .envelope-tile')).to_have_count(2);expect(page.locator('#envelopes .v13-envelope-period')).to_have_count(2);expect(page.locator('#envelopes .v81-envelope-facts')).to_have_count(2);expect(page.locator('#envelopes>.envelope-tile>.v81-envelope-facts')).to_have_count(0)
  page.goto(f.base+path);expect(page.locator('#shared-version')).to_have_text('Sillage v16.1.0');expect(page.locator('#grocery-card')).to_be_visible();expected=f.get(path+'/data');expect(page.locator('#safe')).to_have_text(cash(expected['current_safe_cents']))
  for theme in ['dark','light']:
   page.emulate_media(color_scheme=theme)
   for width in [320,390,430,768]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if theme=='dark':page.screenshot(path=str(images/'partage-iphone.png'),full_page=True)
  assert not errors,errors;browser.close()
 print('PASS v13: real canonical amounts/current/min/max, financial tables unchanged by navigation, 8 widths x 2 themes x 9 screens, envelope filters/editing/refresh, personalized dashboard and shared view. Screenshots:',images)
finally:f.tearDown()
