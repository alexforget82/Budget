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
 reference=state['simulation']['reference'];today=datetime.date.fromisoformat(reference);pay=(today+datetime.timedelta(days=7)).isoformat()
 call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie','amount':1000,'frequency':'weekly','start_on':pay,'day_adjust':'none'}],'categories':[{'name':'Épicerie','limit':230,'period':'weekly','renewal_day':(today.weekday()+1)%7}]})
 state=call('/api/account',{'name':'Carte test'});bank=next(a for a in state['accounts'] if a['is_main']);card=next(a for a in state['accounts'] if a['kind']=='card');cat=state['categories'][0]
 call('/api/transaction',{'account_id':card['id'],'category_id':cat['id'],'description':'Épicerie test','amount':-71.69,'date':reference})
 # A Sunday within the forecast shows its actual Monday date in the agenda.
 sunday=today+datetime.timedelta(days=(6-today.weekday())%7+7)
 call('/api/recurrence',{'name':'Facture du dimanche','kind':'expense','amount':10,'account_id':bank['id'],'frequency':'monthly','start_on':sunday.isoformat()})
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base)
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme)
    page.goto(base+'/#today');page.get_by_role('button',name='Puis-je faire cet achat ?',exact=True).click();dialog=page.locator('#editor');dialog.get_by_label('Montant',exact=True).fill('50');dialog.get_by_label('Catégorie (si prévue dans une limite)',exact=True).select_option(str(cat['id']));dialog.get_by_role('button',name='Vérifier',exact=True).click();expect(dialog.locator('.purchase-result h2')).to_have_text('Oui');assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth+1');dialog.get_by_role('button',name='Fermer',exact=True).click()
    page.locator(('.bottom-nav' if width<=800 else '.sidebar')+' [data-page=plan]').click();page.locator('.category-report summary').click();expect(page.locator('.report-table')).to_contain_text('71,69');page.locator('.schedule summary').click();page.get_by_label('Mois',exact=True).last.fill((sunday+datetime.timedelta(days=1)).isoformat()[:7]);expect(page.locator('.schedule')).to_contain_text('Facture du dimanche');expect(page.locator('.schedule')).to_contain_text('→');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.get_by_role('button',name='+ Compte / carte',exact=True).click();dialog=page.locator('#editor');dialog.get_by_label('Nom',exact=True).fill('Épargne');dialog.get_by_label('Type de compte',exact=True).select_option('bank');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();row=page.locator('.rule').filter(has=page.get_by_role('heading',name='Épargne',exact=True));row.get_by_role('button',name='Saisir le solde').click();dialog.get_by_label('Solde réel',exact=True).fill('500');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();expect(row).to_contain_text('500,00');final=call('/api/state');assert len(final['transactions'])==1 and len(final['transfers'])==0;assert not errors,errors;browser.close()
 print('PASS: purchase simulation, category report, shifted agenda, secondary savings; 4 widths and 2 themes, no financial writes from simulation.')
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();tmp.cleanup()
