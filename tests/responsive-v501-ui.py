from ui_navigation import set_theme
"""Fluid layout across CSS viewports, including widths equivalent to browser zoom."""
import importlib.util,math,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-v501-ui-'))
try:
 aid=f.account(balance=2200);f.post('/api/envelopes',{'name':'Maison','reserved':50,'budget':0,'frequency':'none','forecast_spend':False});f.post('/api/recurring',{'description':'Salaire','type':'income','amount':1500,'account_id':aid,'start_on':api.DAY,'frequency':'biweekly','active':True});before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1920,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version'])
  widths=sorted(set([320,375,390,760,761,1024,1920,2560,3440]+[math.floor(1440/z) for z in [.5,.67,.75,.85,1,1.25,1.5,2]]))
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in widths:
    page.set_viewport_size({'width':width,'height':950})
    for view in ['dashboard','paie','comptes','transactions','calendrier','prevision']:
     navigate(page,view)
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,width,view)
     assert page.evaluate('Math.abs(document.body.getBoundingClientRect().width-innerWidth)<1'),(theme,width,'body width')
     if width>760:assert page.locator('.app-shell-nav').evaluate('(e)=>Math.abs(e.getBoundingClientRect().left)<1'),(width,'sidebar')
     if view=='paie' and width>=1600:
      gap=page.locator('#section-paie').evaluate('(e)=>innerWidth-e.getBoundingClientRect().right');assert 0<=gap<=45,(width,gap)
  page.set_viewport_size({'width':1920,'height':1080});navigate(page,'paie');set_theme(page,'dark');page.wait_for_timeout(100)
  page.locator('#v41-undo').evaluate('(e)=>e.disabled=true')
  # Explicit dark theme rules must beat the legacy white !important button styles.
  for selector in ['.app-shell-nav [data-view=prevision]','.v41-header-action','.v41-header-action:disabled']:
   ratios=page.locator(selector).evaluate_all('''els=>els.map(e=>{const rgb=s=>(s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number),lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),c=getComputedStyle(e),a=lum(rgb(c.color)),b=lum(rgb(c.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)})''');assert ratios and min(ratios)>=4.5,(selector,ratios)
  page.screenshot(path=str(images/'pleine-largeur-sombre.png'),full_page=True);set_theme(page,'light');page.screenshot(path=str(images/'pleine-largeur-clair.png'),full_page=True)
  page.set_viewport_size({'width':720,'height':700});navigate(page,'paie');page.locator('.mobile-navigation-trigger').click();page.locator('#s26-tools>summary').click();expect(page.locator('.app-shell-nav [data-view=sauvegardes]')).to_be_visible();page.locator('.app-shell-nav [data-view=sauvegardes]').click();expect(page.locator('#section-sauvegardes')).to_be_visible()
  assert not errors,errors;browser.close()
 after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings')
 print('PASS: light/dark, six routes,',len(widths),'viewport widths (320–3440; includes 50/67/75/85/100/125/150/200% equivalent widths), full-width content, anchored sidebar, small-window menu, dark button contrast >=4.5 and unchanged financial data. Captures:',images)
finally:f.tearDown()
