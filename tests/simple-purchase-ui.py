"""Simple purchase: scoped bank default, exact 30/60/90 extrema, zero boundary and no writes."""
import importlib.util,shutil,tempfile,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='simple-purchase-ui-'))
try:
 joint,personal,*cards=f.banking_accounts();f.banking_apply(joint,cards);f.post('/api/accounts/update',{'id':joint,'name':'Maison','kind':'checking','included':True,'balance':1000});f.post('/api/accounts/update',{'id':personal,'name':'Conjoint','kind':'checking','included':False,'balance':0});f.post('/api/envelopes',{'name':'Reserve','reserved':100,'budget':0,'frequency':'none','forecast_spend':False})
 for desc,amount,kind,offset in [('Facture',400,'expense',10),('Paie',500,'income',20),('Gros paiement',900,'expense',40),('Paiement lointain',200,'expense',70)]:f.post('/api/recurring',{'description':desc,'amount':amount,'type':kind,'account_id':joint,'frequency':'monthly','start_on':f.future73(offset),'one_time':True})
 before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1400,'height':1050});page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version']);navigate(page,'prevision');page.locator('#v4-sim-open').click();sim=page.locator('#v4-simulator');expect(sim.get_by_label('Compte utilisé')).not_to_be_visible();expect(sim.get_by_label('Compte utilisé')).to_have_value(str(joint));expect(sim.get_by_label('Période de simulation',exact=True)).to_have_value('30');sim.locator('[name=amount]').fill('100');sim.locator('[name=date]').fill(api.DAY);expect(sim).to_contain_text('non déjà couvert par une enveloppe')
  money=lambda c:page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",c)
  for days in [30,60,90]:
   sim.get_by_label('Période de simulation',exact=True).select_option(str(days));sim.get_by_role('button',name='Vérifier cet achat',exact=True).click();expect(sim.locator('#purchase-verdict')).to_contain_text('Non' if days==90 else 'Oui');out=f.post('/api/simulate',{'kind':'purchase','amount':100,'account_id':joint,'date':api.DAY});window=out['scenario'][:days];low=min(d['safe_cents'] for d in window);high=max(d['safe_cents'] for d in window);expect(sim.locator('#purchase-low strong')).to_have_text(money(low));expect(sim.locator('#purchase-high strong')).to_have_text(money(high));assert low=={30:40000,60:0,90:-20000}[days];expect(sim.locator('.purchase-details')).not_to_have_attribute('open','');sim.screenshot(path=str(images/f'reponse-{days}.png'))
  sim.get_by_label('Période de simulation',exact=True).select_option('30');expect(sim.locator('#purchase-verdict')).to_have_count(0);sim.locator('[name=date]').fill(f.future73(50));assert not sim.locator('[name=date]').evaluate('e=>e.checkValidity()');sim.get_by_role('button',name='Vérifier cet achat',exact=True).click();expect(sim.locator('#purchase-verdict')).to_have_count(0);sim.locator('[name=date]').fill(api.DAY)
  # An excluded account or credit card must not produce a misleading yes.
  sim.locator('.purchase-options summary').click();sim.get_by_label('Compte utilisé').select_option(str(cards[0]));sim.get_by_role('button',name='Vérifier cet achat',exact=True).click();expect(sim.locator('#purchase-verdict')).to_have_text('À vérifier avec le compte du disponible');sim.get_by_label('Compte utilisé').select_option(str(joint));sim.locator('.purchase-options summary').click()
  for theme in ['light','dark']:
   page.get_by_label('Apparence',exact=True).evaluate('(e,value)=>{e.value=value;e.dispatchEvent(new Event("change",{bubbles:true}));}',theme)
   for width in [320,390,768,1400]:
    page.set_viewport_size({'width':width,'height':950});sim.get_by_role('button',name='Vérifier cet achat',exact=True).click();expect(sim.locator('#purchase-verdict')).to_contain_text('Oui');assert sim.evaluate('d=>d.scrollWidth<=d.clientWidth+1'),(theme,width)
    if width==390:sim.screenshot(path=str(images/f'achat-{theme}-iphone.png'))
  after=f.get('/api/backup/export')['tables'];assert all(after[k]==v for k,v in before.items() if k!='app_settings');assert f.get('/api/state')['forecast']==state['forecast']
  # Optional saved scenarios retain the chosen horizon.
  sim.get_by_label('Période de simulation',exact=True).select_option('60');sim.get_by_role('button',name='Vérifier cet achat',exact=True).click();sim.locator('.purchase-details summary').click();sim.locator('#v41-scenario-name').fill('Achat prudent');sim.get_by_role('button',name='Enregistrer ce scénario',exact=True).click();expect(sim).not_to_be_visible();page.set_viewport_size({'width':1400,'height':1050});page.locator('.v41-saved-scenarios summary').click();page.get_by_role('button',name='Reprendre ce scénario',exact=True).click();expect(sim.get_by_label('Période de simulation',exact=True)).to_have_value('60');assert not errors,errors;browser.close()
 print('PASS: two fields, configured bank default, exact low/high for 30/60/90, yes at zero and no at deficit, invalid date guard, safe card warning, read-only simulation, saved horizon, light/dark and four widths. Captures:',images)
finally:f.tearDown()
