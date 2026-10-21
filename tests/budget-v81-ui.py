from ui_navigation import manage_envelope,set_theme
"""v8.1 readable current/forecast explanation, envelope facts and financial invariance."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import manage_envelope,navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='budget-v81-ui-'))
try:
 joint,personal,*cards=f.banking_accounts();f.banking_apply(joint,cards);f.post('/api/accounts/update',{'id':joint,'name':'Conjoint','kind':'checking','included':True,'balance':2500})
 s=f.post('/api/envelopes',{'name':'Restaurant','reserved':125,'budget':125,'frequency':'monthly','start_on':api.DAY,'rollover':False,'forecast_spend':False});eid=s['envelopes'][0]['id'];f.transaction(cards[0],-25,description='Souper sur carte',envelope_id=eid)
 f.post('/api/recurring',{'description':'Facture importante','amount':400,'type':'expense','account_id':joint,'frequency':'monthly','start_on':f.future73(2)})
 f.post('/api/recurring',{'description':'Paie','amount':1000,'type':'income','account_id':joint,'frequency':'monthly','start_on':f.future73(5)})
 before=f.get('/api/backup/export')['tables'];s=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1500,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);money=lambda c:page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",c)
  expect(page.locator('#v80-safe')).to_have_text(money(s['safe_cents']));expect(page.locator('#safe')).not_to_be_visible();expect(page.locator('#sts-today')).not_to_be_visible()
  for days in [30,60,90]:
   page.locator('#v80-hero').get_by_role('button',name=f'{days} jours',exact=True).click();low=min(s['safe_cents'],*[d['safe_cents'] for d in s['forecast'][:days]]);expect(page.locator('.v80-hero-facts>div:nth-child(2) strong')).to_have_text(money(low));expect(page.locator('#v80-safe')).to_have_text(money(s['safe_cents']))
  page.get_by_role('button',name='Pourquoi ce montant ?',exact=True).click();dialog=page.locator('#v81-explanation');expect(dialog).to_be_visible();dialog.get_by_label('Date du calcul').select_option('now');expect(dialog).to_contain_text('Disponible maintenant');expect(dialog).to_contain_text('Achats sur carte à rembourser');rows=dialog.locator('.v81-line');expect(rows.filter(has_text='Disponible après protections').locator('strong')).to_have_text(money(s['safe_cents']));expect(rows.filter(has_text='Dont achats sur carte encore protégés').locator('strong')).to_have_text(money(2500));dialog.get_by_label('Date du calcul').select_option(s['forecast'][2]['date']);expect(rows.filter(has_text='Disponible après protections').locator('strong')).to_have_text(money(s['forecast'][2]['safe_cents']));dialog.get_by_text('Suivre le calcul jour par jour',exact=True).click();expect(dialog).to_contain_text('Facture importante');dialog.screenshot(path=str(images/'explication.png'));dialog.get_by_role('button',name='Fermer',exact=True).click()
  for theme in ['light','dark']:
   set_theme(page,theme);navigate(page,'dashboard');page.screenshot(path=str(images/f'dashboard-{theme}.png'),full_page=True)
  navigate(page,'enveloppes');card=page.locator(f'#envelopes [data-envelope-id="{eid}"]');manage_envelope(page,eid);facts=card.locator('.v81-envelope-facts');expect(facts).to_contain_text('Protégé maintenant');expect(facts.locator('.v81-line').filter(has_text='Protégé maintenant').locator('strong')).to_have_text(money(12500));facts.get_by_text('Comprendre cette enveloppe',exact=True).click();expect(facts).to_contain_text('Réserve inutilisée');expect(facts).to_contain_text('Achats sur carte encore protégés');page.screenshot(path=str(images/'enveloppes.png'),full_page=True)
  for width in [320,390,768,1500]:
   page.set_viewport_size({'width':width,'height':950});navigate(page,'dashboard');page.get_by_role('button',name='Pourquoi ce montant ?',exact=True).click();expect(dialog).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dialog.get_by_role('button',name='Fermer',exact=True).click();navigate(page,'enveloppes');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width==390:page.screenshot(path=str(images/'enveloppes-iphone.png'),full_page=True)
  after=f.get('/api/backup/export')['tables'];assert all(before[t]==after[t] for t in before if t!='app_settings');assert f.get('/api/state')['forecast']==s['forecast'];assert not errors,errors;browser.close()
 print('PASS: current versus prudent minimum 30/60/90, exact cash/reserve/card equation, future day drilldown, collapsed duplicate metrics, envelope card protection, dark/light and four widths; ledger and forecast unchanged. Captures:',images)
finally:f.tearDown()
