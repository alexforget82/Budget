"""Simple payment method on desktop and iPhone-sized browser, no debt input."""
import importlib.util,shutil,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,set_theme
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp();images=Path(tempfile.mkdtemp(prefix='sillage-simple-credit-'))
try:
 bank=f.account(balance=1000)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);navigate(page,'comptes')
  page.evaluate("window.appOpenEditor('account')");form=page.locator('#account');form.locator('[name=name]').fill('CIBC sans solde');form.locator('[name=kind]').select_option('credit');expect(page.locator('#account-simple')).to_be_checked();expect(form.locator('[name=balance]')).to_be_hidden();expect(form.locator('[name=balance]')).to_be_disabled();form.locator('#account-save').click();expect(page.locator('#account-dialog')).not_to_be_visible()
  s=f.get('/api/state');card=next(a for a in s['accounts'] if a['name']=='CIBC sans solde');assert card['simple_credit'] and s['cash_cents']==100000
  f.transaction(card['id'],-50,description='Achat maison');page.reload();navigate(page,'comptes')
  for width in [320,390,1440]:
   page.set_viewport_size({'width':width,'height':900});navigate(page,'comptes')
   item=page.locator(f'.bank-card[data-account-id="{card["id"]}"]');expect(item).to_contain_text('Sans suivi du solde');expect(item).not_to_contain_text('Montant dû');item.get_by_role('button',name='Modifier',exact=True).click();expect(form.locator('[name=balance]')).to_be_hidden();expect(page.locator('#account-simple')).to_be_checked();form.locator('#account-save').click();expect(page.locator('#account-dialog')).not_to_be_visible()
   page.locator(f'[data-actual-card-payment="{card["id"]}"]').click();dialog=page.locator('#actual-card-payment-dialog');expect(dialog.locator('[name=amount]')).to_have_value('50.00');dialog.get_by_role('button',name='Vérifier le paiement',exact=True).click();expect(page.locator('#actual-payment-result')).not_to_contain_text('Montant dû');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');page.screenshot(path=str(images/f'payment-{width}.png'));dialog.get_by_role('button',name='Fermer',exact=True).click()
  assert f.get('/api/state')['safe_cents']==95000;assert not errors,errors;browser.close()
 print('PASS: new card needs no balance; edit preserves mode and available cash; repayment suggests protected purchases; no debt figure; 320/390/1440 widths. Captures:',images)
finally:f.tearDown()
