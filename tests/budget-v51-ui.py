"""V5.1 version footer, dark text contrast and light-mode restoration."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-v51-ui-'))
try:
 f.account(balance=2200);home=f.make_category('Essentiels pour la maison');f.make_subcategory(home,'Entretien');before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);version=page.locator('#app-version');expect(version).to_have_text('v5.1.1');expect(page.locator('.workspace-header #app-version')).to_have_count(0);expect(page.locator('.app-nav-footer #app-version')).to_have_count(1)
  assert version.bounding_box()['y']>=page.locator('#open-transaction').bounding_box()['y']+page.locator('#open-transaction').bounding_box()['height'];assert version.bounding_box()['x']<238;assert version.bounding_box()['y']>1000
  page.get_by_label('Apparence',exact=True).select_option('dark');navigate(page,'categories')
  page.evaluate('''window.contrastFailures=(selector,pseudo=null)=>[...document.querySelectorAll(selector)].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&(e.textContent.trim()||/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName))).flatMap(e=>{const rgb=s=>(s.match(/[\\d.]+/g)||[]).map(Number),lum=a=>a.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);let p=e,bg;while(p){bg=rgb(getComputedStyle(p).backgroundColor);if(bg.length===3||bg[3]===1)break;p=p.parentElement}const c=getComputedStyle(e,pseudo),a=lum(rgb(c.color)),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),large=parseFloat(c.fontSize)>=24||(parseFloat(c.fontSize)>=18.66&&parseInt(c.fontWeight)>=700);return ratio>=(large?3:4.5)?[]:[{text:e.textContent.slice(0,60),ratio,color:c.color,background:bg}]})''')
  def contrast(selector):
   page.wait_for_timeout(120);failures=page.evaluate('s=>window.contrastFailures(s)',selector);assert not failures,failures
  contrast('.category-workspace h2,.category-workspace p,.category-workspace label,.category-list-row>strong,.v46-sub-row>span,.v41-header-action,#app-version,.life-appearance')
  assert not page.evaluate('window.contrastFailures("#category-search,#category-create-form input","::placeholder")')
  # A legacy inline !important color on white must remain readable, then restore exactly in light mode.
  page.evaluate('''const b=document.createElement('button');b.id='legacy-contrast-fixture';b.textContent='Ancien bouton';b.style.cssText='background:#fff!important;color:#d5e7d9!important';document.querySelector('#section-categories').append(b)''');contrast('#legacy-contrast-fixture');page.get_by_label('Apparence',exact=True).select_option('light');page.wait_for_timeout(100);assert page.locator('#legacy-contrast-fixture').evaluate('(e)=>e.style.getPropertyValue("color")')=='rgb(213, 231, 217)';page.locator('#legacy-contrast-fixture').evaluate('(e)=>e.remove()');page.get_by_label('Apparence',exact=True).select_option('dark');contrast('.category-workspace h2,.category-workspace p,.category-list-row>strong,.v41-header-action,#app-version');page.screenshot(path=str(images/'categories-sombre.png'),full_page=True)
  page.locator('#open-transaction').click();contrast('#transaction label,#transaction button,#transaction-dialog h2');page.locator('#close-transaction').click();page.get_by_role('button',name='Rechercher…',exact=True).click();contrast('#v41-search h2,#v41-search label,#v41-search button');page.locator('#v41-search').get_by_role('button',name='Fermer',exact=True).click()
  page.set_viewport_size({'width':390,'height':900});navigate(page,'categories');expect(version).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(images/'categories-iphone.png'),full_page=True);page.reload();expect(version).to_have_text('v5.1.1');expect(page.locator('html')).to_have_attribute('data-theme','dark');assert not errors,errors;browser.close()
 after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings')
 print('PASS: v5.1 footer below +Transaction at desktop bottom and on mobile, category/header/dialog contrast, legacy inline !important repair and exact light restoration, persistence and unchanged financial data. Captures:',images)
finally:f.tearDown()
