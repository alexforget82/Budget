"""An early grocery purchase can explicitly use tomorrow's protected budget."""
import importlib.util,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from ui_navigation import navigate,transaction_action
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 bank=f.account(balance=1000);start=f.future73(1);s=f.post('/api/envelopes',{'name':'Épicerie','reserved':0,'budget':230,'frequency':'weekly','start_on':start,'rollover':False,'forecast_spend':False});eid=s['envelopes'][0]['id'];s=f.transaction(bank,-71.69,description='Épicerie',envelope_id=eid);tid=s['transactions'][0]['id'];path=f.post('/api/sharing',{'action':'create'})['path'];before=f.get('/api/backup/export')['tables']
 choices=f.post('/api/envelopes/period-preview',{'transaction_id':tid});assert len(choices['choices'])==1;assert f.get('/api/backup/export')['tables']==before
 # Stale data cannot be confirmed, and an unoffered date is rejected.
 c=choices['choices'][0];payload={'transaction_id':tid,'envelope_id':eid,'occurrence_on':c['date'],'signature':c['signature']};f.post('/api/envelopes/link-period',{**payload,'occurrence_on':f.future73(20)},400)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':844},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f.base);navigate(page,'transactions');page.locator('.ledger-menu').first.locator('summary').click();page.get_by_role('button',name='Associer au prévu',exact=True).click();dialog=page.locator('#v10-match');expect(dialog.get_by_role('button',name=start+' · Épicerie · Budget réservé',exact=True)).to_be_visible();dialog.get_by_role('button',name=start+' · Épicerie · Budget réservé',exact=True).click();expect(dialog).not_to_be_visible();s=f.get('/api/state')
  after=f.get('/api/backup/export')['tables'];assert after['transactions']==before['transactions'];assert after['accounts']==before['accounts'];assert after['account_transfers']==before['account_transfers'];assert not after['envelope_period_status'];assert len(after['envelope_actual_links'])==1
  assert s['safe_cents']==92831;assert s['forecast'][1]['safe_cents']==77000;assert s['forecast'][8]['safe_cents']==54000;f.post('/api/envelopes/link-period',payload,400)
  navigate(page,'enveloppes');page.locator(f'[data-envelope-id="{eid}"]').get_by_role('button',name='Voir la fiche',exact=True).click();sheet=page.locator('#v44-envelope-sheet');expect(sheet).to_contain_text('158,31');assert sheet.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1');page.keyboard.press('Escape')
  page.goto(f.base+path);expect(page.locator('#grocery-remaining')).to_contain_text('158,31');expect(page.locator('#grocery-spent')).to_contain_text('71,69');assert not errors,errors;browser.close()
 # Card purchases can use the same protected period without releasing the card obligation.
 card=f.account('credit',0);s=f.transaction(card,-10,description='Épicerie sur carte',envelope_id=eid);ctid=s['transactions'][0]['id'];choice=f.post('/api/envelopes/period-preview',{'transaction_id':ctid})['choices'][0];previous=s;changed=f.post('/api/envelopes/link-period',{'transaction_id':ctid,'envelope_id':eid,'occurrence_on':choice['date'],'signature':choice['signature']});assert changed['accounts']==previous['accounts'];assert changed['safe_cents']==previous['safe_cents'];assert changed['card_envelope_reserved_cents']==1000;assert changed['forecast'][1]['safe_cents']==previous['forecast'][1]['safe_cents']+1000;assert f.get(path+'/data')['grocery']['remaining_cents']==14831
 # A second eligible purchase invalidates an old candidate signature.
 s=f.transaction(bank,-5,description='Autre épicerie',envelope_id=eid);other=s['transactions'][0]['id'];preview=f.post('/api/envelopes/period-preview',{'transaction_id':other})['choices'][0];f.transaction(bank,-1,description='Autre appareil');f.post('/api/envelopes/link-period',{'transaction_id':other,'envelope_id':eid,'occurrence_on':preview['date'],'signature':preview['signature']},400)
 print('PASS: phone menu offers protected period, 71.69 consumes only tomorrow budget, remainder158.31 in owner/shared, bank/date/transaction unchanged, future weeks intact, no completed period, no double link, stale/invalid date rejected.')
finally:f.tearDown()
