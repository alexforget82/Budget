"""Calendar fields in first-run and recurrence editing on desktop and phone."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-calendar-ui-');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w')
server=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(Path(tmp.name)/'data'),'PORT':str(port)},stdout=log,stderr=log)
def call(url,data=None):
 req=urllib.request.Request(base+url,data=None if data is None else json.dumps(data).encode(),headers={} if data is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:return json.load(r)
try:
 for _ in range(80):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 reference=state['simulation']['reference'];today=datetime.date.fromisoformat(reference);state=call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie','amount':1000,'frequency':'weekly','start_on':(today+datetime.timedelta(days=1)).isoformat(),'day_adjust':'none'}],'categories':[{'name':'Épicerie','limit':230,'period':'weekly','renewal_day':(today.weekday()+1)%7},{'name':'Restaurant','limit':100,'period':'monthly','renewal_day':1}]});bank=state['accounts'][0]['id'];cat=next(c for c in state['categories'] if c['name']=='Épicerie');restaurant=next(c for c in state['categories'] if c['name']=='Restaurant');state=call('/api/account',{'name':'CIBC'});card=next(a for a in state['accounts'] if a['kind']=='card')['id']
 call('/api/transaction',{'account_id':card,'category_id':cat['id'],'description':'Marché local','amount':-50,'date':reference});call('/api/transaction',{'account_id':bank,'description':'Maison','amount':-20,'date':reference});call('/api/transfer',{'from_account_id':bank,'to_account_id':card,'amount':50,'date':reference,'description':'Paiement carte'})
 captures=Path(os.environ.get('BDL_TOOLS_CAPTURES',tempfile.mkdtemp(prefix='bdl-tools-captures-')));captures.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':390,'height':900},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#transactions');search=page.get_by_label('Rechercher une transaction',exact=True);category=page.get_by_label('Filtrer par catégorie',exact=True);account=page.get_by_label('Filtrer par compte',exact=True)
  search.fill('epicerie');expect(page.locator('.ledger tbody .description')).to_have_count(1);expect(page.locator('.table-foot')).to_contain_text('50,00');search.fill('');category.select_option(str(restaurant['id']));expect(page.locator('.ledger')).to_contain_text('Aucune opération');category.select_option('none');expect(page.locator('.ledger tbody .description')).to_have_text('Maison');category.select_option('transfers');account.select_option(str(card));expect(page.locator('.ledger tbody .description')).to_have_text('Paiement carte');expect(page.locator('.table-foot')).to_contain_text('Virements (hors net) 50,00');page.locator('.ledger').get_by_role('button',name='Modifier',exact=True).click();dialog=page.locator('#editor');dialog.get_by_label('Montant',exact=True).fill('30');dialog.get_by_label('Description',exact=True).fill('Paiement corrigé');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();expect(category).to_have_value('transfers');expect(account).to_have_value(str(card));expect(page.locator('.table-foot')).to_contain_text('Virements (hors net) 30,00');assert call('/api/state')['simulation']['card_cents']==2000
  page.locator('.ledger').get_by_role('button',name='Modifier',exact=True).click();dialog.get_by_role('button',name='Supprimer ce virement',exact=True).click();expect(dialog.get_by_role('heading',name='Supprimer ce virement ?')).to_be_visible();dialog.get_by_role('button',name='Supprimer',exact=True).click();expect(dialog).not_to_be_visible();assert len(call('/api/state')['transfers'])==0;assert call('/api/state')['simulation']['card_cents']==5000
  page.goto(base+'/#today');row=page.locator('.limit-overview-row').filter(has=page.get_by_role('heading',name='Épicerie',exact=True));expect(row.locator('.limit')).to_contain_text('230,00');expect(row.locator('.spent')).to_contain_text('50,00');expect(row.locator('.remaining')).to_contain_text('180,00');expect(row.locator('.limit-next')).to_contain_text('Renouvelle')
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme)
    for view in ['transactions','today']:
     page.goto(base+'/#'+view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme,view)
     if width in [390,1440]:page.screenshot(path=str(captures/f'{view}-{theme}-{width}.png'),full_page=True)
  share=call('/api/share',{'action':'create'})['result']['path'];baseline=call('/api/export')['tables'];page.goto(base+share);page.get_by_role('button',name='Puis-je faire cet achat ?',exact=True).click();dialog.get_by_label('Montant',exact=True).fill('50');dialog.get_by_role('button',name='Vérifier',exact=True).click();expect(dialog.locator('.purchase-result h2')).to_have_text('Oui');assert 'Minimum après achat' not in dialog.inner_text();dialog.get_by_label('Montant',exact=True).fill('100000');expect(dialog.locator('.purchase-result h2')).to_have_count(0);dialog.get_by_role('button',name='Vérifier',exact=True).click();expect(dialog.locator('.purchase-result h2')).to_have_text('Non');dialog.get_by_label('Montant',exact=True).fill('50');dialog.locator('summary').click();dialog.get_by_label('Catégorie (si prévue dans une limite)',exact=True).select_option(str(cat['id']));dialog.get_by_label('Moyen de paiement',exact=True).select_option(str(card));dialog.get_by_role('button',name='Vérifier',exact=True).click();expected=call('/api/purchase/preview',{'amount':50,'date':reference,'category_id':cat['id'],'account_id':card});expect(dialog.locator('.purchase-result h2')).to_have_text('Oui' if expected['allowed'] else 'Non')
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  dialog.get_by_role('button',name='Fermer',exact=True).click();assert call('/api/export')['tables']==baseline;assert not errors,errors;browser.close()
 print('PASS: transfer edit/delete, accent-insensitive/category/account filters with totals, exact limits overview, shared yes/no with optional category/card and no writes; 4 widths/2 themes. Captures:',captures)
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
