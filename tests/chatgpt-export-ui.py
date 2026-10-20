"""Owner explicitly downloads a reviewed snapshot; no automatic external request."""
import importlib.util,json,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import header_action
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 f.account();before=f.get('/api/backup/export')['tables']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));context=browser.new_context(accept_downloads=True);page=context.new_page();errors=[];external=[];page.on('pageerror',lambda e:errors.append(str(e)));context.on('request',lambda r:external.append(r.url) if r.url.startswith('https://') else None);context.route('https://chatgpt.com/**',lambda r:r.fulfill(status=200,body='ChatGPT destination stub'))
  page.goto(f.base);expect(page.locator('#app-version')).to_have_text('v'+f.get('/api/state')['version'])
  for width,theme in [(1440,"light"),(390,"light"),(1440,"dark"),(390,"dark")]:
   page.set_viewport_size({'width':width,'height':1000})
   if width==1440:page.get_by_label('Apparence',exact=True).select_option(theme)
   header_action(page,'Poser une question à ChatGPT');dialog=page.locator('#s26-chatgpt-dialog');expect(dialog).to_be_visible();expect(dialog.get_by_role('status')).to_contain_text('Fichier prêt');expect(dialog).to_contain_text('Rien n’est envoyé automatiquement');assert not external

   if dialog.locator('details').get_attribute('open') is None:dialog.locator('summary').click()
   content=dialog.get_by_label('Contenu du fichier pour ChatGPT');expect(content).to_be_visible();assert content.get_attribute('readonly') is not None;out=json.loads(content.input_value());assert out['current']['cash_cents']==100000
   dialog.get_by_label('Historique des transactions').select_option('all');expect(dialog.get_by_role('status')).to_contain_text('Fichier prêt');expect(content).to_have_value(__import__('re').compile('"history_selection": "all"'))
   with page.expect_download() as download:dialog.get_by_role('link',name='Télécharger mon fichier',exact=True).click()
   assert Path(download.value.path()).read_text()==content.input_value();assert download.value.suggested_filename.endswith('.json');assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');dialog.get_by_role('button',name='Fermer',exact=True).click()
  page.route('**/api/chatgpt/export?*',lambda r:r.fulfill(status=503,body='Unavailable'));header_action(page,'Poser une question à ChatGPT');expect(dialog.get_by_role('status')).to_contain_text('Réessayez');expect(dialog.get_by_role('link',name='Télécharger mon fichier',exact=True)).to_have_count(0);dialog.get_by_role('button',name='Fermer',exact=True).click();page.unroute('**/api/chatgpt/export?*')
  header_action(page,'Poser une question à ChatGPT');expect(dialog.get_by_role('status')).to_contain_text('Fichier prêt');link=dialog.get_by_role('link',name='Ouvrir ChatGPT ↗');assert link.get_attribute('href')=='https://chatgpt.com/';assert 'noreferrer' in link.get_attribute('rel')
  with page.expect_popup() as popup:link.click()
  popup.value.wait_for_load_state();assert popup.value.url=='https://chatgpt.com/';assert popup.value.evaluate('window.opener===null');assert external==['https://chatgpt.com/'];assert not errors,errors;browser.close()
 after=f.get('/api/backup/export')['tables'];assert all(after[t]==before[t] for t in before if t!='app_settings')
 assert [r for r in after['app_settings'] if r['key']!='appearance_theme_v50']==[r for r in before['app_settings'] if r['key']!='appearance_theme_v50']
 print('PASS: desktop/iPhone owner tool, review, history scope, exact downloaded snapshot, explicit clean ChatGPT link, no background transmission or financial writes.')
finally:f.tearDown()
