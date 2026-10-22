"""Understand the canonical available amount and verify bank balances without silent corrections."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import header_action,navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-confidence-116-'))
try:
 aid=f.account(balance=1000);f.post('/api/envelopes',{'name':'Épicerie','reserved':100,'budget':0,'frequency':'none','forecast_spend':False});f.post('/api/recurring',{'description':'Assurance prévue','amount':80,'type':'expense','account_id':aid,'frequency':'monthly','start_on':f.future73(2)})
 before=f.get('/api/backup/export')['tables'];initial=f.get('/api/state')
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base)
  money=lambda n:page.evaluate("n=>(n/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'})",n)
  status=page.locator('#v116-bank-status');expect(status).to_contain_text('Soldes à vérifier')
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,1440]:
    page.set_viewport_size({'width':width,'height':844});navigate(page,'dashboard');header_action(page,'Pourquoi ce montant ?');d=page.locator('#v81-explanation');d.get_by_label('Date du calcul').select_option('now')
    d.get_by_role('button',name='Solde bancaire inclus',exact=True).click();expect(d.locator('details').filter(has=page.get_by_text('Comptes compris dans le calcul',exact=True))).to_have_attribute('open','')
    d.get_by_role('button',name='Argent protégé',exact=True).click();expect(d.locator('details').filter(has=page.get_by_text('Réserves par enveloppe',exact=True))).to_have_attribute('open','');expect(d.locator('.v81-total strong')).to_have_text(money(initial['safe_cents']))
    d.get_by_label('Date du calcul').select_option(initial['forecast'][2]['date']);d.get_by_role('button',name='Solde bancaire inclus',exact=True).click();expect(d.locator('details').filter(has=page.get_by_text('Suivre le calcul jour par jour',exact=True)).first).to_have_attribute('open','');assert d.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');d.get_by_role('button',name='Fermer',exact=True).click()
    if not status.evaluate('(e)=>e.open'):status.locator('summary').click()
    status.get_by_role('button',name='Vérifier Compte checking',exact=True).click();bank=page.locator('#v41-bank-dialog');expect(bank.locator('#v116-bank-context')).to_contain_text('1 000,00');bank.locator('input[name=balance]').fill('950');bank.get_by_role('button',name='Comparer sans modifier',exact=True).click();expect(bank.locator('#v116-bank-impact')).to_contain_text('Minimum prévu · 90 jours');expect(bank).to_contain_text('Écart :');assert bank.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if width==390:
     assert bank.locator('.v41-bank-summary').bounding_box()['y']>=bank.locator('.dialog-heading').bounding_box()['y']+bank.locator('.dialog-heading').bounding_box()['height']-1
     bank.screenshot(path=str(images/f'comparaison-{theme}.png'))
    bank.locator('input[name=balance]').fill('960');expect(bank.locator('#v116-bank-impact')).to_have_count(0);bank.get_by_role('button',name='Fermer',exact=True).click()
  after=f.get('/api/backup/export')['tables'];assert all(after[k]==before[k] for k in before if k!='app_settings');assert f.get('/api/state')['forecast']==initial['forecast']
  status.get_by_role('button',name='Vérifier Compte checking',exact=True).click();bank.locator('input[name=balance]').fill('1000');bank.get_by_role('button',name='Comparer sans modifier',exact=True).click();bank.get_by_role('button',name='Valider ce rapprochement',exact=True).click();expect(bank).to_contain_text('Rapprochement enregistré');bank.get_by_role('button',name='Fermer',exact=True).click();expect(status).to_contain_text('Soldes vérifiés')
  # A preview becomes obsolete when another device changes the ledger.
  status.get_by_role('button',name='Vérifier Compte checking',exact=True).click();bank.locator('input[name=balance]').fill('950');bank.get_by_role('button',name='Comparer sans modifier',exact=True).click();expect(bank.locator('#v116-bank-impact')).to_be_visible();f.transaction(aid,-10,description='Nouvel achat');page.evaluate('async()=>budgetRuntime.render(await(await fetch("/api/state")).json())');expect(bank.locator('#v116-bank-impact')).to_have_count(0);expect(bank).to_contain_text('Comparez de nouveau');expect(status).to_contain_text('Soldes à vérifier');assert not errors,errors;browser.close()
 print('PASS: clickable exact current/future equations, account verification status, read-only bank impact, stale preview invalidation, explicit checkpoint, two themes and three widths. Captures:',images)
finally:f.tearDown()
