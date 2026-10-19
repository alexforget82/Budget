"""Essential home and actionable, canonical forecast alerts; date visible on every row."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='essential-home-'))
try:
 aid=f.account(balance=500)
 f.post('/api/envelopes',{'name':'Reserve','reserved':100,'budget':0,'frequency':'none','forecast_spend':False})
 for description,amount,offset,kind in [('Facture en attente',20,0,'expense'),('Facture importante',300,5,'expense'),('Prochaine paie',500,10,'income'),('Paiement lointain',1000,40,'expense')]:f.post('/api/recurring',{'description':description,'amount':amount,'type':kind,'account_id':aid,'frequency':'monthly','one_time':True,'start_on':f.future73(offset)})
 f.transaction(aid,-5,description='Transaction a dater');before=f.get('/api/backup/export')['tables'];state=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1500,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#v80-safe')).to_be_visible();assert 'home-essential' in page.locator('#app-dashboard').get_attribute('class');expect(page.locator('#v81-maximum')).not_to_be_visible();expect(page.locator('#v53-daily')).not_to_be_visible();expect(page.locator('#home-alerts')).to_contain_text('passe sous 100');expect(page.locator('#home-alerts')).to_contain_text('Facture en attente');assert page.locator('.home-alert-caution').count()==1;assert page.locator('.home-alert-danger').count()==0
  money=lambda cents:page.evaluate("c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",cents)
  expect(page.locator('#v80-safe')).to_have_text(money(state['safe_cents']));expect(page.locator('.v80-hero-facts>div:nth-child(2) strong')).to_have_text(money(min(state['safe_cents'],*[d['safe_cents'] for d in state['forecast'][:30]])));expect(page.locator('.v80-hero-facts>div:nth-child(3)')).to_contain_text('Prochaine paie')
  page.get_by_role('button',name='Voir la prochaine rentrée d’argent',exact=True).click();expect(page.locator('#v4-selected-date')).to_have_value(f.future73(10));navigate(page,'dashboard');page.locator('#v80-hero [data-horizon="60"]').click();expect(page.locator('#home-alerts')).to_contain_text('Un manque de');assert page.locator('.home-alert-danger').count()==1;page.locator('.home-alert-danger').get_by_role('button',name='Voir cette date',exact=True).click();expect(page.locator('#v4-selected-date')).to_have_value(f.future73(40));navigate(page,'dashboard');page.locator('#home-alerts').get_by_role('button',name='Vérifier les opérations',exact=True).click();expect(page.locator('#planning-inbox')).to_be_visible();navigate(page,'dashboard')
  page.locator('#home-mode').click();expect(page.locator('#v81-maximum')).to_be_visible();page.reload();expect(page.locator('#home-mode')).to_have_text('Revenir à l’essentiel');page.locator('#home-mode').click();page.locator('#dashboard-customize').click();assert 'v47-editing' in page.locator('#app-dashboard').get_attribute('class');expect(page.locator('[data-widget=summary]')).to_be_visible();page.locator('#dashboard-customize').click()
  navigate(page,'transactions');when=page.locator('.ledger-row time.sillage-row-date');expect(when).to_have_count(1);expect(when).to_be_visible();expect(when).to_have_attribute('datetime',api.DAY);page.locator('#sillage-sort').select_option('amount:asc');expect(when).to_be_visible();page.locator('#register-density').click();expect(when).to_be_visible();page.locator('#register-density').click()
  for theme in ['light','dark']:
   page.get_by_label('Apparence',exact=True).select_option(theme)
   for width in [320,390,768,1100,1500]:
    page.set_viewport_size({'width':width,'height':1000});navigate(page,'dashboard');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme);expect(page.locator('#v80-safe')).to_be_visible();navigate(page,'transactions');expect(when).to_be_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
   navigate(page,'dashboard');page.screenshot(path=str(images/(theme+'.png')))
  after=f.get('/api/backup/export')['tables'];after['app_settings']=[x for x in after['app_settings'] if x['key']!='appearance_theme_v50'];before['app_settings']=[x for x in before['app_settings'] if x['key']!='appearance_theme_v50'];assert after==before
  # Confirmation clears the overdue notification using the new state, without retaining an old warning.
  s=f.get('/api/state');r=next(r for r in s['planning']['rows'] if r['description']=='Facture en attente');f.planning_action(r,amount=20,happened_on=api.DAY);page.reload();expect(page.locator('#home-alerts')).not_to_contain_text('restent à confirmer')
  # A healthy forecast has a quiet empty state; no alert is fabricated.
  for r in f.get('/api/state')['recurring']:f.post('/api/recurring/delete',{'id':r['id']})
  page.reload();expect(page.locator('.home-all-clear')).to_be_visible();assert page.locator('.home-alert').count()==0;page.get_by_role('button',name='Voir le calcul du minimum prévu',exact=True).click();expect(page.locator('#v81-date')).to_have_value('now');page.locator('#v81-explanation').get_by_role('button',name='Fermer',exact=True).click();f.post('/api/accounts/update',{'id':aid,'name':'Conjoint','kind':'checking','balance':50,'included':True});page.reload();expect(page.locator('.home-alert-danger')).to_contain_text('disponible actuel est négatif');page.get_by_role('button',name='Comprendre ce montant',exact=True).click();expect(page.locator('#v81-date')).to_have_value('now');assert not errors,errors;browser.close()
 print('PASS: three canonical home metrics, horizon-sensitive threshold and negative alerts, due queue, navigation, detailed mode and customization, quiet state, visible transaction dates, light/dark and five widths. Captures:',images)
finally:f.tearDown()
