from ui_navigation import transaction_action,set_theme
"""Sillage 2026 identity and visual system across owner and restricted mobile views."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-2026-'))
try:
 joint,personal,*cards=f.banking_accounts();f.banking_apply(joint,cards);f.post('/api/accounts/update',{'id':joint,'name':'Conjoint','kind':'checking','included':True,'balance':4500})
 s=f.post('/api/categories',{'name':'Maison et famille'});cid=next(c['id'] for c in s['categories'] if c['name']=='Maison et famille');f.global74(cid,300)
 s=f.post('/api/envelopes',{'name':'Restaurant','reserved':125,'budget':125,'frequency':'monthly','start_on':f.future73(10),'forecast_spend':False});eid=s['envelopes'][0]['id']
 f.post('/api/recurring',{'description':'Paie Alex','amount':1400,'type':'income','account_id':joint,'frequency':'biweekly','start_on':f.future73(3)})
 f.post('/api/recurring',{'description':'Hydro-Québec','amount':120,'type':'expense','account_id':joint,'frequency':'monthly','start_on':f.future73(5)})
 for i in range(24):f.transaction(joint,-(i+1),description='Achat maison '+str(i),category_id=cid)
 f.transaction(cards[0],-25,description='Restaurant sur carte',envelope_id=eid);before=f.get('/api/backup/export')['tables'];path=f.post('/api/sharing',{'action':'create'})['path']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1500,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page).to_have_title('Sillage 2026 — Votre argent, votre cap');expect(page.locator('.brand')).to_contain_text('2026');expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);assert page.locator('#s26-tools').get_attribute('open') is None
  money=lambda c:page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",c);expect(page.locator('#v80-safe')).to_have_text(money(f.get('/api/state')['safe_cents']))
  for theme in ['light','dark']:
   set_theme(page,theme)
   if page.locator('#s26-tools').get_attribute('open') is not None:page.locator('#s26-tools>summary').click()
   for view in ['dashboard','transactions','budget','enveloppes','comptes','prevision','calendrier','categories','bilan']:
    navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,view);page.screenshot(path=str(images/(view+'-'+theme+'.png')),full_page=True)
   for width in [320,390,768,1100,1850]:
    page.set_viewport_size({'width':width,'height':1000})
    for view in ['dashboard','transactions','budget','prevision','categories','sauvegardes']:
     navigate(page,view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,width,view)
     if width==390 and view=='dashboard':
      page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(images/('iphone-'+theme+'.png')))
   page.set_viewport_size({'width':1500,'height':1050})
  # Existing forms retain their exact account/envelope behavior under the new presentation.
  navigate(page,'transactions');transaction_action(page,'+ Nouvelle transaction');expect(page.locator('#transaction')).to_be_visible();page.locator('#transaction-dialog').get_by_role('button',name='Fermer',exact=True).click();navigate(page,'dashboard');page.locator('#home-daily-open').click();expect(page.locator('#home-daily-dialog .home-daily-row')).to_have_count(30);page.locator('#home-daily-dialog').get_by_role('button',name='Fermer',exact=True).click()
  page.set_viewport_size({'width':390,'height':700});navigate(page,'categories');page.locator('.mobile-navigation-trigger').click();page.locator('#s26-tools .v41-header-tools').get_by_role('button',name='Rechercher…',exact=True).click();expect(page.locator('#v41-search')).to_be_visible();page.locator('#v41-search').get_by_role('button',name='Fermer',exact=True).click();navigate(page,'dashboard');page.set_viewport_size({'width':1500,'height':1050})
  after=f.get('/api/backup/export')['tables'];after['app_settings']=[r for r in after['app_settings'] if r['key']!='appearance_theme_v50'];before['app_settings']=[r for r in before['app_settings'] if r['key']!='appearance_theme_v50'];assert after==before
  viewer=browser.new_page(viewport={'width':390,'height':844});viewer.goto(f.base+path);expect(viewer.locator('h1')).to_have_text('Sillage 2026');expect(viewer.locator('#safe')).to_have_text(money(f.get('/api/state')['safe_cents']));assert viewer.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors;browser.close()
 print('PASS: Sillage 2026 identity, grouped navigation, nine screens light/dark, 320–1850 responsive, retained editor and daily view, canonical money unchanged and restricted viewer branding. Captures:',images)
finally:f.tearDown()
