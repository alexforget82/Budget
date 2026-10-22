"""V14 reading density, themes, canonical numbers and unchanged finances."""
import importlib.util,shutil,tempfile,unicodedata
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-v14-'))
try:
 bank=f.account(balance=5500);card=f.account('credit',250);f.post('/api/accounts/update',{'id':bank,'name':'Conjoint','kind':'checking','balance':5500,'included':True})
 f.post('/api/setup/scope',{'account_id':bank})
 normalize=lambda s:''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if not unicodedata.combining(c))
 existing=f.get('/api/state')['categories'];cats=[next((c['id'] for c in existing if normalize(c['name'])==normalize(n)),None) or f.make_category(n) for n in ['Épicerie','Restaurant','Essence','Maison','Abonnements','Salaire']]
 for name,amount in [('Épicerie',230),('Restaurant',125),('Essence',60),('Maison',100)]:f.post('/api/envelopes',{'name':name,'reserved':amount,'budget':amount,'frequency':'weekly' if name in ['Épicerie','Essence'] else 'monthly','start_on':api.DAY,'rollover':False,'forecast_spend':False})
 for i in range(45):f.transaction(bank,-(12+i%19),description=['Marché du quartier','Station-service','Pharmacie','Café du coin','Quincaillerie'][i%5],category_id=cats[i%5])
 f.post('/api/recurring',{'description':'Paie Alex','amount':1168.05,'type':'income','account_id':bank,'frequency':'biweekly','start_on':f.future73(2)})
 f.post('/api/recurring',{'description':'Apple One','amount':53.98,'type':'expense','account_id':card,'frequency':'monthly','start_on':f.future73(3)})
 f.budget_apply({'month':api.MONTH,'category_id':cats[-1],'amount':7063.22,'direction':'income','mode':'target','repeat_monthly':True})
 for cid,amount in zip(cats,[920,125,240,150,53.98]):f.budget_apply({'month':api.MONTH,'category_id':cid,'amount':amount,'direction':'expense','mode':'target','repeat_monthly':True})
 path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');errors=[];bad=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:bad.append(r.url) if r.status>=400 else None);page.goto(f.base);expect(page.locator('body')).to_have_class(__import__('re').compile('sillage-v14'));expect(page.locator('#app-version')).to_have_text('v14.1.0')
  cash=lambda n:page.evaluate('(n)=>new Intl.NumberFormat("fr-CA",{style:"currency",currency:"CAD"}).format(n/100)',n)
  expect(page.locator('#v80-safe')).to_have_text(cash(state['safe_cents']));expect(page.locator('#v14-calculation')).not_to_have_attribute('open','');page.locator('#v14-calculation>summary').click();expect(page.locator('#v13-equation')).to_contain_text(cash(state['cash_cents']));page.locator('#v13-equation button').click();expect(page.locator('dialog[open]')).to_be_visible();page.keyboard.press('Escape');page.locator('#v14-calculation>summary').click()
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,768,1100,1440,1920]:
    page.set_viewport_size({'width':width,'height':844 if width<768 else 1000})
    for view in ['dashboard','transactions','budget','enveloppes','prevision','calendrier','comptes']:
     navigate(page,view);page.evaluate('scrollTo(0,0)');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,width,view)
     if view=='dashboard':expect(page.locator('#v80-safe')).to_have_text(cash(state['safe_cents']))
     if view=='transactions':assert page.locator('.ledger-row').first.bounding_box()['height']<=(120 if width<1280 else 62),(width,page.locator('.ledger-row').first.bounding_box())
     if view=='enveloppes':
      row=page.locator('#envelopes>.envelope-tile').first;assert row.bounding_box()['height']<270,(width,row.bounding_box());expect(row.get_by_role('button',name='Gérer',exact=True)).to_be_visible();assert row.evaluate('(e)=>parseFloat(getComputedStyle(e).borderRadius)===0')
     if view=='budget':assert page.locator('#monthly-budget-workspace>.v60-metrics').evaluate('(e)=>[...e.querySelectorAll("strong")].filter(x=>x.getClientRects().length).every(x=>x.scrollWidth<=x.clientWidth+1)'),(width,theme,'money overflow')
     if width in [390,1440] and view in ['dashboard','transactions','budget','enveloppes','prevision','calendrier']:page.screenshot(path=str(images/f'{view}-{theme}-{width}.png'),full_page=width==1440)
   ratio=page.locator('body').evaluate(r'''e=>{const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0),c=getComputedStyle(e),a=lum(rgb(c.color)),b=lum(rgb(c.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}''');assert ratio>=7,(theme,ratio)
   navigate(page,'dashboard');page.locator('#open-transaction').click();dialog=page.locator('#transaction-dialog');expect(dialog).to_be_visible();assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');page.locator('#close-transaction').click()
  after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings');assert not errors,errors;assert not bad,bad
  page.goto(f.base+path);expect(page.locator('#safe')).to_have_text(cash(state['safe_cents']))
  for theme in ['light','dark']:
   page.emulate_media(color_scheme=theme)
   for width in [320,390,430]:
    page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');expect(page.locator('#grocery-card')).to_be_visible();assert page.locator('.shared-extremes').evaluate('(e)=>getComputedStyle(e).display==="grid"')
   page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(images/f'partage-{theme}-390.png'),full_page=True)
  browser.close()
 print('PASS v14: canonical current amount, accessible calculation, 45 transaction density, compact envelope rows, budget numbers intact, 6 widths/two themes/7 screens, existing shared link and totals, no navigation financial writes. Captures:',images)
finally:f.tearDown()
