"""Actual card repayment workflow and phone keyboard/viewport layout."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-131-'))
try:
 bank=f.account(balance=1000);f.post('/api/setup/scope',{'account_id':bank});card=f.account('credit',100)
 f.post('/api/recurring',{'description':'Apple One','amount':53.98,'type':'expense','account_id':card,'frequency':'monthly','start_on':api.DAY});f.transaction(card,-53.98,description='Apple One');before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v16.0.0')
  for theme in ['light','dark']:
   set_theme(page,theme)
   for width in [320,390,430,768,1440]:
    page.set_viewport_size({'width':width,'height':844 if width<768 else 1000});navigate(page,'comptes');page.locator(f'[data-actual-card-payment="{card}"]').click();dialog=page.locator('#actual-card-payment-dialog');form=dialog.locator('form');expect(dialog).to_be_visible();expect(form.locator('[name=from_account_id]')).to_have_value(str(bank));expect(form.locator('[name=amount]')).to_have_value('53.98');form.get_by_role('button',name='Vérifier le paiement',exact=True).click();result=page.locator('#actual-payment-result');expect(result).to_be_visible();expect(result).to_contain_text('946,02');expect(result).to_contain_text('1 000,00'.replace(' ','\xa0'));assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(width,theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if width==390:
     page.screenshot(path=str(images/f'paiement-{theme}.png'));form.locator('[name=amount]').fill('20');expect(result).to_be_hidden();form.locator('[name=amount]').focus();page.evaluate("Object.defineProperty(visualViewport,'height',{configurable:true,value:innerHeight-300});visualViewport.dispatchEvent(new Event('resize'))");expect(page.locator('body')).to_have_class(__import__('re').compile('sillage-keyboard-open'));assert dialog.bounding_box()['height']<=544;expect(page.locator('.mobile-tabbar')).to_be_hidden();page.evaluate("Object.defineProperty(visualViewport,'scale',{configurable:true,value:2});visualViewport.dispatchEvent(new Event('resize'))");assert 'sillage-keyboard-open' not in page.locator('body').get_attribute('class');page.evaluate("delete visualViewport.height;delete visualViewport.scale;visualViewport.dispatchEvent(new Event('resize'))")
    dialog.get_by_role('button',name='Fermer',exact=True).click()
  after=f.get('/api/backup/export')['tables'];assert all(before[k]==after[k] for k in before if k!='app_settings')
  page.set_viewport_size({'width':390,'height':844});navigate(page,'comptes');page.locator(f'[data-actual-card-payment="{card}"]').click();dialog=page.locator('#actual-card-payment-dialog');form=dialog.locator('form');form.get_by_role('button',name='Vérifier le paiement',exact=True).click();expect(page.locator('#actual-payment-confirm')).to_be_enabled()
  # Another device invalidates the preview; a second verification is required.
  f.transaction(bank,-1,description='Autre appareil');page.locator('#actual-payment-confirm').click();expect(page.locator('#actual-payment-error')).to_contain_text('budget a changé');expect(page.locator('#actual-payment-result')).to_be_hidden();form.get_by_role('button',name='Vérifier le paiement',exact=True).click();expect(page.locator('#actual-payment-confirm')).to_be_enabled();page.locator('#actual-payment-confirm').click();expect(dialog).not_to_be_visible();s=f.get('/api/state');assert s['cash_cents']==94502 and s['safe_cents']==94502 and s['card_envelope_reserved_cents']==0;assert len(f.get('/api/backup/export')['tables']['account_transfers'])==1
  navigate(page,'comptes');page.locator(f'[data-actual-card-payment="{card}"]').click();form=dialog.locator('form');form.locator('[name=amount]').fill('53.98');form.get_by_role('button',name='Vérifier le paiement',exact=True).click();expect(page.locator('#actual-payment-result')).to_contain_text('paiement du même montant existe');expect(page.locator('#actual-payment-confirm')).to_be_disabled();dialog.get_by_role('button',name='Fermer',exact=True).click();assert not errors,errors;browser.close()
 print('PASS: default Conjoint/protected amount, live preview, input invalidation, no preview writes, stale confirmation rejection, exactly one real transfer, duplicate warning, 5 widths/two themes, simulated visual keyboard viewport. Captures:',images)
finally:f.tearDown()
